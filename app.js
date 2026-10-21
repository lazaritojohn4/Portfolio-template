const LEGACY_DEFAULT_IMAGE = 'imgs.jpg';
const form = document.querySelector('[data-portfolio-form]');
const card = document.querySelector('[data-preview-card]');
const status = document.querySelector('[data-save-status]');
const imageInput = form.querySelector('[data-image-input]');
const fullNameInput = form.elements.full_name;
const careerTitleInput = form.elements.career_title;
const viewSavedButton = form.querySelector('[data-view-saved]');
const savedDialog = document.querySelector('[data-saved-dialog]');
const savedContent = document.querySelector('[data-saved-content]');
const downloadSavedButton = document.querySelector('[data-download-saved]');
let profileImage = '';
let browserStorageMode = window.location.protocol === 'file:';
let hasUnsavedChanges = false;
const SAVED_PROFILE_KEY = 'portfolio-template-profile';
const profileFields = [
    'full_name',
    'career_title',
    'email',
    'phone',
    'address',
    'about',
    'skills',
    'projects',
    'work_experience',
    'education',
];

function getProfile() {
    return {
        full_name: form.elements.full_name.value.trim().replace(/ +/g, ' '),
        career_title: form.elements.career_title.value,
        email: form.elements.email.value,
        phone: form.elements.phone.value,
        address: form.elements.address.value,
        about: form.elements.about.value,
        skills: form.elements.skills.value,
        projects: form.elements.projects.value,
        work_experience: form.elements.work_experience.value,
        education: form.elements.education.value,
        template: form.querySelector('[data-template-choice]:checked').value,
        profileImage: profileImage === LEGACY_DEFAULT_IMAGE ? '' : profileImage,
    };
}

function isValidName(name) {
    return /^\p{L}+(?: *\p{L}+)* *$/u.test(name);
}

function isValidCareerTitle(title) {
    return isValidName(title);
}

function validateFullName() {
    fullNameInput.setCustomValidity(
        fullNameInput.value && !isValidName(fullNameInput.value)
            ? 'Use letters and spaces only for the full name.'
            : '',
    );
}

function sanitizeLettersAndSpaces(field) {
    field.value = field.value
        .replace(/[^\p{L} ]/gu, '')
        .replace(/ {2,}/g, ' ')
        .trimStart();
}

function renderProfile(profile, target = card) {
    for (const field of ['full_name', 'career_title', 'email', 'phone', 'address', 'about', 'projects', 'work_experience', 'education']) {
        target.querySelector(`[data-preview="${field}"]`).textContent = profile[field];
    }

    const skills = typeof profile.skills === 'string' ? profile.skills : '';
    const skillItems = skills.split(/[,\n]/).map((skill) => skill.trim()).filter(Boolean);
    const skillList = target.querySelector('[data-preview-skills]');
    skillList.replaceChildren(...skillItems.map((skill) => {
        const item = document.createElement('li');
        item.textContent = skill;
        return item;
    }));
    target.querySelector('[data-section="skills"]').hidden = skillItems.length === 0;
    target.querySelector('[data-section="projects"]').hidden = !profile.projects;
    target.querySelector('[data-section="work_experience"]').hidden = !profile.work_experience;

    target.classList.remove('template-classic', 'template-modern', 'template-minimal');
    target.classList.add(`template-${profile.template}`);
    const avatar = target.querySelector('.avatar');
    const image = profile.profileImage && profile.profileImage !== LEGACY_DEFAULT_IMAGE;
    if (image && avatar.tagName !== 'IMG') {
        const imageElement = document.createElement('img');
        imageElement.className = 'avatar';
        avatar.replaceWith(imageElement);
        target.querySelector('.avatar').src = profile.profileImage;
    } else if (!image && avatar.tagName === 'IMG') {
        const placeholder = document.createElement('span');
        placeholder.className = 'avatar avatar-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.textContent = '?';
        avatar.replaceWith(placeholder);
    } else if (image) {
        avatar.src = profile.profileImage;
    }
    const renderedAvatar = target.querySelector('.avatar');
    if (renderedAvatar.tagName === 'IMG') {
        renderedAvatar.alt = profile.full_name ? `Profile photo of ${profile.full_name}` : 'Profile photo';
    }
}

form.querySelectorAll('[data-field]').forEach((field) => {
    field.addEventListener('input', () => {
        if (field === fullNameInput) {
            sanitizeLettersAndSpaces(fullNameInput);
            validateFullName();
        } else if (field === careerTitleInput) {
            sanitizeLettersAndSpaces(careerTitleInput);
        }
        renderProfile(getProfile());
    });
});

form.addEventListener('input', () => {
    hasUnsavedChanges = true;
});
form.addEventListener('change', () => {
    hasUnsavedChanges = true;
});
window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = '';
});

form.querySelectorAll('[placeholder]').forEach((field) => {
    const example = field.placeholder;
    field.addEventListener('focus', () => {
        field.placeholder = '';
    });
    field.addEventListener('blur', () => {
        if (!field.value) field.placeholder = example;
    });
});

form.querySelectorAll('[data-template-choice]').forEach((choice) => {
    choice.addEventListener('change', () => renderProfile(getProfile()));
});

imageInput.addEventListener('change', (event) => {
    const [file] = event.currentTarget.files;
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
        imageInput.value = '';
        status.textContent = 'Choose a JPG, PNG, or WebP image no larger than 2 MB.';
        return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
        profileImage = reader.result;
        renderProfile(getProfile());
    });
    reader.addEventListener('error', () => {
        status.textContent = 'The selected image could not be read. Please choose another file.';
    });
    reader.readAsDataURL(file);
});

  function requestBrowserPortfolio(method, profile) {
      if (method === 'PUT') {
          localStorage.setItem(SAVED_PROFILE_KEY, JSON.stringify(profile));
          return { saved: true };
      }

      if (method === 'DELETE') {
          localStorage.removeItem(SAVED_PROFILE_KEY);
          return { saved: false };
      }

      const savedProfile = localStorage.getItem(SAVED_PROFILE_KEY);
      if (savedProfile === null) return { saved: false };

      const storedProfile = JSON.parse(savedProfile);
      const migratedProfile = { ...getProfile(), ...storedProfile };
      migratedProfile.career_title ||= form.elements.career_title.value;
      migratedProfile.skills = typeof migratedProfile.skills === 'string' ? migratedProfile.skills : '';
      migratedProfile.projects = typeof migratedProfile.projects === 'string' ? migratedProfile.projects : '';
      migratedProfile.work_experience = typeof migratedProfile.work_experience === 'string'
          ? migratedProfile.work_experience
          : '';
      return { ...migratedProfile, saved: true };
  }

  function portfolioStorageName() {
      return browserStorageMode ? 'this browser' : 'Supabase';
  }

  async function requestPortfolio(method, profile) {
      if (browserStorageMode) return requestBrowserPortfolio(method, profile);

      const options = {
          method,
          headers: { Accept: 'application/json' },
      };

      if (profile) {
          options.headers['Content-Type'] = 'application/json';
          options.body = JSON.stringify(profile);
      }

      const response = await fetch('/api/portfolio', options);
      let payload;
      try {
          payload = await response.json();
      } catch {
          throw new Error('The server returned an invalid response.');
      }

      if (!response.ok) {
          const error = new Error(payload.error || `The server returned status ${response.status}.`);
          if (error.message.includes('Supabase is not configured')) {
              browserStorageMode = true;
              return requestBrowserPortfolio(method, profile);
          }
          throw error;
      }

      if (payload.browserStorage === true) {
          browserStorageMode = true;
          return requestBrowserPortfolio(method, profile);
      }

      return payload;
  }

  function isValidProfile(profile) {
      return profile
          && profileFields.every((field) => typeof profile[field] === 'string')
          && isValidName(profile.full_name)
          && isValidCareerTitle(profile.career_title)
          && ['classic', 'modern', 'minimal'].includes(profile.template)
          && (
              profile.profileImage == null
              || profile.profileImage === ''
              || profile.profileImage === LEGACY_DEFAULT_IMAGE
              || (typeof profile.profileImage === 'string'
                  && /^data:image\/(?:jpeg|png|webp);base64,/i.test(profile.profileImage))
          );
  }

  function applyProfile(profile) {
      profileFields.forEach((field) => {
          form.elements[field].value = profile[field] || '';
      });
      validateFullName();
      form.querySelector(`[data-template-choice][value="${profile.template}"]`).checked = true;
      imageInput.value = '';
      profileImage = profile.profileImage && profile.profileImage !== LEGACY_DEFAULT_IMAGE
          ? profile.profileImage
          : '';
      renderProfile(getProfile());
      hasUnsavedChanges = false;
  }

  form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      try {
          await requestPortfolio('PUT', getProfile());
          hasUnsavedChanges = false;
          status.textContent = `Portfolio saved to ${portfolioStorageName()}.`;
      } catch (error) {
          status.textContent = `Could not save the portfolio: ${error.message} Make sure server.py is running.`;
      }
  });

  viewSavedButton.addEventListener('click', async () => {
      try {
          const saved = await requestPortfolio('GET');
          if (!saved.saved) {
              status.textContent = `There is no saved portfolio in ${portfolioStorageName()} yet.`;
              return;
          }
          if (!isValidProfile(saved)) {
              status.textContent = 'The saved portfolio data is invalid.';
              return;
          }
          const savedCard = card.cloneNode(true);
          renderProfile(saved, savedCard);
          savedContent.replaceChildren(savedCard);
          savedDialog.showModal();
          status.textContent = `Showing the portfolio saved in ${portfolioStorageName()}.`;
      } catch (error) {
          status.textContent = `Could not load the saved portfolio: ${error.message} Make sure server.py is running.`;
      }
  });

  downloadSavedButton.addEventListener('click', async () => {
      const savedCard = savedContent.querySelector('[data-preview-card]');
      if (!savedCard) {
          status.textContent = 'Open a saved portfolio before downloading it.';
          return;
      }

      const styles = [...document.styleSheets]
          .map((styleSheet) => {
              try {
                  return [...styleSheet.cssRules].map((rule) => rule.cssText).join('\n');
              } catch {
                  return '';
              }
          })
          .filter(Boolean)
          .join('\n');

      if (!styles) {
          status.textContent = 'Could not prepare the portfolio download because its styles are unavailable.';
          return;
      }

      try {
          const downloadableCard = savedCard.cloneNode(true);
          const avatar = downloadableCard.querySelector('.avatar');
          if (avatar.tagName === 'IMG') avatar.src = await imageAsDataUrl(avatar.src);
          const documentHtml = `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(downloadableCard.querySelector('[data-preview="full_name"]').textContent)} | Portfolio</title>
    <style>
  ${styles}
      body { padding: 24px; }
      .portfolio-card { margin: 0 auto; }
  </style>
  </head>
  <body>
    ${downloadableCard.outerHTML}
  </body>
  </html>`;
        const downloadUrl = URL.createObjectURL(new Blob([documentHtml], { type: 'text/html;charset=utf-8' }));
        const downloadLink = document.createElement('a');
        const name = downloadableCard.querySelector('[data-preview="full_name"]').textContent.trim() || 'portfolio';
        downloadLink.href = downloadUrl;
        downloadLink.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'portfolio'}.html`;
        document.body.append(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        status.textContent = 'Downloaded the saved portfolio as a standalone HTML file.';
    } catch {
        status.textContent = 'Could not prepare the portfolio download image. Check your connection and try again.';
    }
});

async function imageAsDataUrl(source) {
    if (source.startsWith('data:image/')) return source;

    const response = await fetch(source);
    if (!response.ok) throw new Error('Unable to load the profile image.');
    const imageBlob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(reader.result));
        reader.addEventListener('error', () => reject(new Error('Unable to encode the profile image.')));
        reader.readAsDataURL(imageBlob);
    });
}

document.querySelector('[data-close-saved]').addEventListener('click', () => {
    savedDialog.close();
    viewSavedButton.focus();
});

savedDialog.addEventListener('click', (event) => {
    if (event.target === savedDialog) savedDialog.close();
});

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[character]);
}

form.addEventListener('reset', () => {
    window.setTimeout(async () => {
        profileImage = '';
        imageInput.value = '';
        validateFullName();
        try {
            await requestPortfolio('DELETE');
          hasUnsavedChanges = false;
          status.textContent = `Form reset and saved portfolio removed from ${portfolioStorageName()}.`;
        } catch (error) {
            hasUnsavedChanges = true;
            status.textContent = `Form reset, but the saved portfolio could not be deleted: ${error.message}`;
        }
        renderProfile(getProfile());
    }, 0);
});

async function loadSavedProfile() {
    try {
        const saved = await requestPortfolio('GET');
        if (!saved.saved) {
            renderProfile(getProfile());
            hasUnsavedChanges = false;
            status.textContent = '';
            return;
        }
        if (!isValidProfile(saved)) {
            status.textContent = 'Saved portfolio data is invalid. Save a new profile to replace it.';
            return;
        }
        applyProfile(saved);
      hasUnsavedChanges = false;
      status.textContent = `Saved profile loaded from ${portfolioStorageName()}.`;
    } catch (error) {
        status.textContent = `Could not connect to the portfolio server: ${error.message} Start it with "py server.py".`;
    }
}

renderProfile(getProfile());
loadSavedProfile();
