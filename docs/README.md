# Static Deployment Notes

This `docs/` folder is a pure frontend version of the worship song review assistant.

Files required in the same deployed directory:

- `index.html`
- `app.js`
- `songs_db_agent_v1.json`
- `weekly_runtime_input_template.json`

Recommended GitHub Pages setup:

1. Push this repository to GitHub.
2. In repository settings, enable Pages.
3. Set the source to `Deploy from a branch`.
4. Choose your branch and the `/docs` folder.

The app runs fully in the browser and fetches local JSON files from the same directory.
