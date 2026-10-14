import base64
import binascii
import json
import logging
import re
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "portfolio.sqlite3"
API_PATH = "/api/portfolio"
MAX_REQUEST_BYTES = 5 * 1024 * 1024
MAX_IMAGE_BYTES = 2 * 1024 * 1024
PROFILE_FIELDS = {
    "full_name": 120,
    "email": 255,
    "phone": 40,
    "address": 180,
    "about": 3000,
    "education": 3000,
}
TEMPLATES = {"classic", "modern", "minimal"}
IMAGE_DATA_URL = re.compile(
    r"^data:image/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$",
    re.IGNORECASE,
)


def initialize_database():
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS portfolio (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT NOT NULL,
                address TEXT NOT NULL,
                about TEXT NOT NULL,
                education TEXT NOT NULL,
                template TEXT NOT NULL,
                profile_image TEXT NOT NULL DEFAULT ''
            )"""
        )


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
            with sqlite3.connect(DATABASE_PATH) as connection:
                connection.row_factory = sqlite3.Row
                row = connection.execute(
                    "SELECT full_name, email, phone, address, about, education, "
                    "template, profile_image FROM portfolio WHERE id = 1"
                ).fetchone()
        except sqlite3.Error:
            logging.exception("Could not read the portfolio database")
            return self.send_json(500, {"error": "Could not read the portfolio database."})

        if row is None:
            return self.send_json(200, {"saved": False})

        profile = dict(row)
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
            if not isinstance(value, str) or not value.strip():
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

        try:
            with sqlite3.connect(DATABASE_PATH) as connection:
                connection.execute(
                    """INSERT INTO portfolio (
                        id, full_name, email, phone, address, about, education, template, profile_image
                    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        full_name = excluded.full_name,
                        email = excluded.email,
                        phone = excluded.phone,
                        address = excluded.address,
                        about = excluded.about,
                        education = excluded.education,
                        template = excluded.template,
                        profile_image = excluded.profile_image""",
                    (
                        profile["full_name"],
                        profile["email"],
                        profile["phone"],
                        profile["address"],
                        profile["about"],
                        profile["education"],
                        profile["template"],
                        profile["profile_image"],
                    ),
                )
        except sqlite3.Error:
            logging.exception("Could not save the portfolio")
            return self.send_json(500, {"error": "Could not save the portfolio."})

        self.send_json(200, {"saved": True})

    def do_DELETE(self):
        if urlsplit(self.path).path != API_PATH:
            return self.send_json(404, {"error": "Not found"})

        try:
            with sqlite3.connect(DATABASE_PATH) as connection:
                connection.execute("DELETE FROM portfolio WHERE id = 1")
        except sqlite3.Error:
            logging.exception("Could not delete the portfolio")
            return self.send_json(500, {"error": "Could not delete the portfolio."})

        self.send_json(200, {"saved": False})


def main():
    initialize_database()
    server = ThreadingHTTPServer(
        ("127.0.0.1", 8000),
        lambda *args, **kwargs: PortfolioHandler(
            *args, directory=str(BASE_DIR), **kwargs
        ),
    )
    print("Portfolio Generator running at http://127.0.0.1:8000")
    print(f"SQLite database: {DATABASE_PATH}")
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
