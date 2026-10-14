const DEFAULT_IMAGE = 'imgs.jpg';
const SAVED_PROFILE_KEY = 'portfolio-template-profile';
const form = document.querySelector('[data-portfolio-form]');
const card = document.querySelector('[data-preview-card]');
const status = document.querySelector('[data-save-status]');
const imageInput = form.querySelector('[data-image-input]');
const viewSavedButton = form.querySelector('[data-view-saved]');
const savedDialog = document.querySelector('[data-saved-dialog]');
const savedContent = document.querySelector('[data-saved-content]');
const downloadSavedButton = document.querySelector('[data-download-saved]');
let profileImage = DEFAULT_IMAGE;
const profileFields = ['full_name', 'email', 'phone', 'address', 'about', 'education'];

function getProfile() {
    return {
        full_name: form.elements.full_name.value,
        email: form.elements.email.value,
        phone: form.elements.phone.value,
        address: form.elements.address.value,
        about: form.elements.about.value,
        education: form.elements.education.value,
        template: form.querySelector('[data-template-choice]:checked').value,
        profileImage,
    };
}

function renderProfile(profile, target = card) {
    for (const field of ['full_name', 'email', 'phone', 'address', 'about', 'education']) {
        target.querySelector(`[data-preview="${field}"]`).textContent = profile[field];
    }

    target.classList.remove('template-classic', 'template-modern', 'template-minimal');
    target.classList.add(`template-${profile.template}`);

    const avatar = target.querySelector('.avatar');
    avatar.src = profile.profileImage || DEFAULT_IMAGE;
    avatar.alt = `Profile photo of ${profile.full_name}`;
}

form.querySelectorAll('[data-field]').forEach((field) => {
    field.addEventListener('input', () => renderProfile(getProfile()));
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

  function isValidProfile(profile) {
      return profile
          && profileFields.every((field) => typeof profile[field] === 'string')
          && ['classic', 'modern', 'minimal'].includes(profile.template)
          && (
              profile.profileImage == null
              || profile.profileImage === DEFAULT_IMAGE
              || (typeof profile.profileImage === 'string'
                  && /^data:image\/(?:jpeg|png|webp);base64,/i.test(profile.profileImage))
          );
  }

  function applyProfile(profile) {
      profileFields.forEach((field) => {
          form.elements[field].value = profile[field];
      });
      form.querySelector(`[data-template-choice][value="${profile.template}"]`).checked = true;
      imageInput.value = '';
      profileImage = profile.profileImage || DEFAULT_IMAGE;
      renderProfile(getProfile());
  }

  form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      try {
          localStorage.setItem(SAVED_PROFILE_KEY, JSON.stringify(getProfile()));
          status.textContent = 'Portfolio saved in this browser.';
      } catch (error) {
          status.textContent = `Could not save the portfolio in this browser: ${error.message}`;
      }
  });

  viewSavedButton.addEventListener('click', () => {
      try {
          const storedProfile = localStorage.getItem(SAVED_PROFILE_KEY);
          if (storedProfile === null) {
              status.textContent = 'There is no saved portfolio in this browser yet.';
              return;
          }
          const saved = JSON.parse(storedProfile);
          if (!isValidProfile(saved)) {
              status.textContent = 'The saved portfolio data is invalid.';
              return;
          }
          const savedCard = card.cloneNode(true);
          renderProfile(saved, savedCard);
          savedContent.replaceChildren(savedCard);
          savedDialog.showModal();
          status.textContent = 'Showing the portfolio saved in this browser.';
      } catch (error) {
          status.textContent = `Could not load the saved portfolio: ${error.message}`;
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
          avatar.src = await imageAsDataUrl(avatar.src);

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
        status.textContent = 'Could not prepare the download image. Check your connection and try again.';
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
    window.setTimeout(() => {
        profileImage = DEFAULT_IMAGE;
        imageInput.value = '';
        try {
            localStorage.removeItem(SAVED_PROFILE_KEY);
            status.textContent = 'Form reset and saved portfolio removed from this browser.';
        } catch (error) {
            status.textContent = `Form reset, but the saved portfolio could not be removed: ${error.message}`;
        }
        renderProfile(getProfile());
    }, 0);
});

function loadSavedProfile() {
    try {
        const storedProfile = localStorage.getItem(SAVED_PROFILE_KEY);
        if (storedProfile === null) {
            renderProfile(getProfile());
            status.textContent = 'No saved portfolio in this browser yet. Fill in the form and choose Save portfolio.';
            return;
        }
        const saved = JSON.parse(storedProfile);
        if (!isValidProfile(saved)) {
            status.textContent = 'Saved portfolio data is invalid. Save a new profile to replace it.';
            return;
        }
        applyProfile(saved);
        status.textContent = 'Saved profile loaded from this browser.';
    } catch (error) {
        status.textContent = `Could not load the saved portfolio from this browser: ${error.message}`;
    }
}

loadSavedProfile();
