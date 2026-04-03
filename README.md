# Worship Song Planner

A static web app for church worship teams to prepare weekly service briefs, generate worship song review summaries, and publish the tool with GitHub Pages.

## Live Site

- GitHub Pages: `https://enhung.github.io/worship-song-planner/`

## What it does

- Fill in weekly service details with a browser form
- Select and rank songs from the bundled local song database
- Generate a formatted review summary for the pastor's wife
- Optionally call the OpenAI Responses API for a second-pass AI review
- Download or import/export JSON and Markdown
- Save in-progress form data in the browser automatically

## Project structure

- `docs/index.html` - static app entry
- `docs/app.js` - browser-side selection and summary logic
- `docs/songs_db_agent_v1.json` - bundled song database for the static site
- `docs/weekly_runtime_input_template.json` - sample input template
- `.github/workflows/deploy-pages.yml` - GitHub Pages deployment workflow

## Local preview

```bash
cd /Users/enhung/Documents/worship-agent/docs
python3 -m http.server 8000
```

Open:

- `http://127.0.0.1:8000`

## Deployment

This repo is configured for GitHub Pages via GitHub Actions.

High-level flow:

1. Push to `main`
2. GitHub Actions deploys `docs/`
3. GitHub Pages serves the static site

More detail:

- [GITHUB_PAGES_DEPLOY.md](/Users/enhung/Documents/worship-agent/GITHUB_PAGES_DEPLOY.md)

## AI review mode

The GitHub Pages version supports an optional OpenAI-powered second review.

How it works:

1. The app first generates a rule-based summary from the bundled song database.
2. If you provide your own OpenAI API key in the browser, the app can send the brief, selected songs, and summary to the OpenAI Responses API.
3. The model returns an additional review block with risks, adjustments, and teammate-facing notes.

Important:

- This Pages deployment is still a static site.
- There is no secure backend in this mode.
- Your API key is not stored in the repository, but browser-side key usage is still less secure than a server-side proxy.

For a safer production setup, move the OpenAI call to a backend or serverless function.
