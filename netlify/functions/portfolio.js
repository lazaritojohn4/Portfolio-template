const PROFILE_LIMITS = {
    full_name: 120,
    career_title: 120,
    email: 255,
    phone: 40,
    address: 180,
    about: 3000,
    skills: 1000,
    projects: 3000,
    work_experience: 3000,
    education: 3000,
};
const OPTIONAL_FIELDS = new Set(['skills', 'projects', 'work_experience']);
const TEMPLATES = new Set(['classic', 'modern', 'minimal']);
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function jsonResponse(statusCode, payload) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        body: JSON.stringify(payload),
    };
}

function validateProfile(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { error: 'Profile must be a JSON object.' };
    }

    const profile = {};
    for (const [field, maxLength] of Object.entries(PROFILE_LIMITS)) {
        const value = data[field] ?? (OPTIONAL_FIELDS.has(field) ? '' : null);
        if (typeof value !== 'string' || (!OPTIONAL_FIELDS.has(field) && !value.trim())) {
            return { error: `${field} must be a non-empty string.` };
        }
        if (value.length > maxLength) {
            return { error: `${field} must be no longer than ${maxLength} characters.` };
        }
        if (field === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
            return { error: 'Enter a valid email address.' };
        }
        profile[field] = value;
    }

    if (!TEMPLATES.has(data.template)) {
        return { error: 'Choose classic, modern, or minimal.' };
    }
    profile.template = data.template;

    const image = data.profileImage ?? '';
    if (typeof image !== 'string') return { error: 'Profile image must be text.' };
    if (image === '' || image === 'imgs.jpg') {
        profile.profile_image = image;
    } else {
        const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/i.exec(image);
        if (!match) return { error: 'Use a JPG, PNG, or WebP profile image.' };
        const decoded = Buffer.from(match[1], 'base64');
        if (decoded.length > MAX_IMAGE_BYTES) return { error: 'Profile image must be no larger than 2 MB.' };
        profile.profile_image = image;
    }

    return { profile };
}

async function supabaseRequest(method, path, options = {}) {
    const projectUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!projectUrl || !serviceKey) throw new Error('Supabase is not configured for this Netlify site.');

    const url = new URL(`/rest/v1${path}`, projectUrl);
    if (options.query) {
        for (const [key, value] of Object.entries(options.query)) url.searchParams.set(key, value);
    }
    const headers = {
        Accept: 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
    };
    if (options.payload) {
        headers['Content-Type'] = 'application/json';
        headers.Prefer = 'resolution=merge-duplicates';
    }

    const response = await fetch(url, {
        method,
        headers,
        body: options.payload ? JSON.stringify(options.payload) : undefined,
    });
    const text = await response.text();
    if (!response.ok) {
        let message = text || `Supabase returned status ${response.status}.`;
        try {
            const body = JSON.parse(text);
            message = body.message || body.error || message;
        } catch {}
        throw new Error(message);
    }
    return text ? JSON.parse(text) : null;
}

exports.handler = async (event) => {
    try {
        if (event.httpMethod === 'GET') {
            const rows = await supabaseRequest('GET', '/portfolio', {
                query: {
                    select: 'full_name,career_title,email,phone,address,about,skills,projects,work_experience,education,template,profile_image',
                    id: 'eq.1',
                },
            });
            if (!rows || rows.length === 0) return jsonResponse(200, { saved: false });
            const profile = rows[0];
            profile.profileImage = profile.profile_image;
            delete profile.profile_image;
            profile.saved = true;
            return jsonResponse(200, profile);
        }

        if (event.httpMethod === 'DELETE') {
            await supabaseRequest('DELETE', '/portfolio', { query: { id: 'eq.1' } });
            return jsonResponse(200, { saved: false });
        }

        if (event.httpMethod !== 'PUT') return jsonResponse(405, { error: 'Method not allowed.' });
        const body = event.isBase64Encoded
            ? Buffer.from(event.body || '', 'base64').toString('utf8')
            : event.body || '';
        if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) {
            return jsonResponse(413, { error: 'Portfolio is too large.' });
        }
        let data;
        try {
            data = JSON.parse(body);
        } catch {
            return jsonResponse(400, { error: 'Request body must be valid JSON.' });
        }
        const result = validateProfile(data);
        if (result.error) return jsonResponse(400, { error: result.error });

        await supabaseRequest('POST', '/portfolio', {
            query: { on_conflict: 'id' },
            payload: { id: 1, ...result.profile },
        });
        return jsonResponse(200, { saved: true });
    } catch (error) {
        console.error('Portfolio API request failed:', error);
        return jsonResponse(500, { error: error.message || 'Portfolio request failed.' });
    }
};
