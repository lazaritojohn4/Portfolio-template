# Portfolio Template Generator

A local portfolio editor with live preview, three visual templates, saving through Supabase, and standalone HTML downloads.

## Run locally

Create a Supabase project and run this SQL in its SQL Editor:

```sql
create table public.portfolio (
    id integer primary key check (id = 1),
    full_name text not null,
    career_title text not null,
    email text not null,
    phone text not null,
    address text not null,
    about text not null,
    skills text not null default '',
    projects text not null default '',
    work_experience text not null default '',
    education text not null,
    template text not null,
    profile_image text not null default ''
);
```

For an existing `portfolio` table, apply this migration in the Supabase SQL Editor:

```sql
alter table public.portfolio
    add column if not exists career_title text not null default 'Aspiring IT Professional',
    add column if not exists skills text not null default '',
    add column if not exists projects text not null default '',
    add column if not exists work_experience text not null default '';
```

## Deploy to Netlify

The included `netlify.toml` publishes the static site and routes `/api/portfolio`
to a Netlify Function, so saving and loading portfolios work after deployment.
In the Netlify site settings, add these environment variables for the function:

* `SUPABASE_URL`: your Supabase project URL.
* `SUPABASE_SERVICE_ROLE_KEY`: your Supabase service role key.

If Supabase is not configured, the portfolio editor automatically saves to the
current browser instead; those local saves are not shared between devices.

Run the SQL above (or the migration) in Supabase before deploying. Keep the
service role key in Netlify environment variables only; never put it in frontend
code or commit it. Push the repository to its connected Git provider, or deploy
the repository with the Netlify CLI.

The three templates use the same portfolio content and editing features, but
present that content with distinct visual styling and layouts.

Install Python 3.9 or newer. In PowerShell, set the Supabase project URL and service role key in the same terminal where you start the server:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
py server.py
```

Open <http://127.0.0.1:8000> in a browser. Stop the server with **Ctrl+C**.

The service role key must remain private and must never be placed in frontend code or committed to Git. The server refuses to start unless Supabase is configured; it does not use a local database.

## Project files

* `index.html`: form, live preview, and saved portfolio dialog.
* `styles.css`: responsive layout and template styling.
* `app.js`: preview interactions, image handling, API calls, and HTML download.
* `server.py`: local HTTP server and Supabase API.
* `netlify/functions/portfolio.js`: Supabase Netlify API function.
* `netlify.toml`: Netlify publish directory and API route.
* `imgs.jpg`: sample profile image.
* `server.js`: static Node.js server; use `server.py` for Supabase saving.