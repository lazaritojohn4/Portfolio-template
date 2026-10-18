import base64
import binascii
import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


BASE_DIR = Path(__file__).resolve().parent
API_PATH = "/api/portfolio"
MAX_REQUEST_BYTES = 5 * 1024 * 1024
MAX_IMAGE_BYTES = 2 * 1024 * 1024
PROFILE_FIELDS = {
    "full_name": 120,
    "career_title": 120,
    "email": 255,
    "phone": 40,
    "address": 180,
    "about": 3000,
    "skills": 1000,
    "projects": 3000,
    "work_experience": 3000,
    "education": 3000,
}
OPTIONAL_PROFILE_FIELDS = {"skills", "projects", "work_experience"}
TEMPLATES = {"classic", "modern", "minimal"}
IMAGE_DATA_URL = re.compile(
    r"^data:image/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$",
    re.IGNORECASE,
)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_KEY")
    or ""
)


def supabase_request(method, path, *, payload=None, params=None, extra_headers=None):
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("Supabase is not configured.")

    url = f"{SUPABASE_URL}/rest/v1{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params, doseq=True)}"

    body = None
    headers = {
        "Accept": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    if extra_headers:
        headers.update(extra_headers)
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response_body = response.read()
            if not response_body:
                return None
            try:
                return json.loads(response_body.decode("utf-8"))
            except json.JSONDecodeError:
                return response_body.decode("utf-8")
    except urllib.error.HTTPError as exc:
        error_text = exc.read().decode("utf-8", errors="replace")
        try:
            error_payload = json.loads(error_text)
        except json.JSONDecodeError:
            error_payload = {"error": error_text or exc.reason}
        raise RuntimeError(error_payload.get("message") or error_payload.get("error") or exc.reason) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Unable to reach Supabase: {exc.reason}") from exc


class PortfolioHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlsplit(self.path).path != API_PATH:
            return super().do_GET()

        try:
            rows = supabase_request(
                "GET",
                "/portfolio",
                params={
                    "select": "full_name,career_title,email,phone,address,about,skills,projects,work_experience,education,template,profile_image",
                    "id": "eq.1",
                },
            )
        except RuntimeError as exc:
            logging.exception("Could not read the portfolio from Supabase")
            return self.send_json(500, {"error": str(exc)})

        if not rows:
            return self.send_json(200, {"saved": False})

        profile = dict(rows[0])
        profile["profileImage"] = profile.pop("profile_image")
        profile["saved"] = True
        self.send_json(200, profile)

    def do_PUT(self):
        if urlsplit(self.path).path != API_PATH:
            return self.send_json(404, {"error": "Not found"})

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send_json(400, {"error": "Invalid Content-Length"})

        if content_length <= 0:
            return self.send_json(400, {"error": "A JSON profile is required"})
        if content_length > MAX_REQUEST_BYTES:
            return self.send_json(413, {"error": "Portfolio is too large"})

        try:
            data = json.loads(self.rfile.read(content_length))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self.send_json(400, {"error": "Request body must be valid JSON"})

        if not isinstance(data, dict):
            return self.send_json(400, {"error": "Profile must be a JSON object"})

        errors = {}
        profile = {}
        for field, max_length in PROFILE_FIELDS.items():
            value = data.get(field)
            if field in OPTIONAL_PROFILE_FIELDS and value is None:
                value = ""
            if not isinstance(value, str) or (field not in OPTIONAL_PROFILE_FIELDS and not value.strip()):
                errors[field] = "This field is required."
            elif len(value) > max_length:
                errors[field] = f"Must be no longer than {max_length} characters."
            elif field == "email" and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
                errors[field] = "Enter a valid email address."
            else:
                profile[field] = value

        template = data.get("template")
        if not isinstance(template, str) or template not in TEMPLATES:
            errors["template"] = "Choose classic, modern, or minimal."
        else:
            profile["template"] = template

        image = data.get("profileImage", "")
        if not isinstance(image, str):
            errors["profileImage"] = "Profile image must be text."
        elif image in ("", "imgs.jpg"):
            profile["profile_image"] = image
        else:
            match = IMAGE_DATA_URL.fullmatch(image)
            if not match:
                errors["profileImage"] = "Use a JPG, PNG, or WebP profile image."
            else:
                try:
                    decoded_image = base64.b64decode(match.group(1), validate=True)
                except (binascii.Error, ValueError):
                    errors["profileImage"] = "Profile image data is invalid."
                else:
                    if len(decoded_image) > MAX_IMAGE_BYTES:
                        errors["profileImage"] = "Profile image must be no larger than 2 MB."
                    else:
                        profile["profile_image"] = image

        if errors:
            return self.send_json(400, {"error": "Please correct the profile data.", "fields": errors})

        payload = {
            "id": 1,
            "full_name": profile["full_name"],
            "career_title": profile["career_title"],
            "email": profile["email"],
            "phone": profile["phone"],
            "address": profile["address"],
            "about": profile["about"],
            "skills": profile["skills"],
            "projects": profile["projects"],
            "work_experience": profile["work_experience"],
            "education": profile["education"],
            "template": profile["template"],
            "profile_image": profile["profile_image"],
        }
        try:
            supabase_request(
                "POST",
                "/portfolio",
                payload=payload,
                params={"on_conflict": "id"},
                extra_headers={"Prefer": "resolution=merge-duplicates"},
            )
        except RuntimeError as exc:
            logging.exception("Could not save the portfolio to Supabase")
            return self.send_json(500, {"error": str(exc)})
        self.send_json(200, {"saved": True})

    def do_DELETE(self):
        if urlsplit(self.path).path != API_PATH:
            return self.send_json(404, {"error": "Not found"})

        try:
            supabase_request(
                "DELETE",
                "/portfolio",
                params={"id": "eq.1"},
            )
        except RuntimeError as exc:
            logging.exception("Could not delete the portfolio from Supabase")
            return self.send_json(500, {"error": str(exc)})
        self.send_json(200, {"saved": False})


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError(
            "Supabase is required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    server = ThreadingHTTPServer(
        ("127.0.0.1", 8000),
        lambda *args, **kwargs: PortfolioHandler(
            *args, directory=str(BASE_DIR), **kwargs
        ),
    )
    print("Supabase database enabled.")
    print("Portfolio Generator running at http://127.0.0.1:8000")
    print("Press Ctrl+C to stop the server.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
