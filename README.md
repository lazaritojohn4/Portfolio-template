# Portfolio Template Generator

A local portfolio editor with live preview, three visual templates, Supabase-backed saving, and standalone HTML downloads.

## Run locally

Create a Supabase project and run this SQL in its SQL Editor:

```sql
create table public.portfolio (
    id integer primary key check (id = 1),
    full_name text not null,
    email text not null,
    phone text not null,
    address text not null,
    about text not null,
    education text not null,
    template text not null,
    profile_image text not null default ''
);
```

Install Python 3.9 or newer. In PowerShell, set the Supabase project URL and service-role key in the same terminal where you start the server:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
py server.py
```

Open <http://127.0.0.1:8000> in a browser. Stop the server with **Ctrl+C**.

The service-role key must remain private and must never be placed in frontend code or committed to Git. The server refuses to start unless Supabase is configured; it does not use a local database.

## Project files

- `index.html` — form, live preview, and saved-portfolio dialog.
- `styles.css` — responsive layout and template styling.
- `app.js` — preview interactions, image handling, API calls, and HTML download.
- `server.py` — local HTTP server and Supabase API.
- `imgs.jpg` — sample profile image.
- `server.js` — static-only Node.js server; use `server.py` for Supabase-backed saving.