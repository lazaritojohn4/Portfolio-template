# Portfolio Template Generator

A local portfolio editor with live preview, three visual templates, SQLite-backed saving, and standalone HTML downloads.

## Run locally

Install Python 3.9 or newer, open a terminal in this folder, and run:

```powershell
py server.py
```

Open <http://127.0.0.1:8000> in a browser. Stop the server with **Ctrl+C**.

The server creates `portfolio.sqlite3` in this folder. The database is ignored by Git so saved profile data is not uploaded with the source code.

## Project files

- `index.html` — form, live preview, and saved-portfolio dialog.
- `styles.css` — responsive layout and template styling.
- `app.js` — preview interactions, image handling, API calls, and HTML download.
- `server.py` — local HTTP server and SQLite API.
- `imgs.jpg` — sample profile image.
- `server.js` — static-only Node.js server; use `server.py` for SQLite-backed saving.