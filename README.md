# RecDrive ⏺️

**Record. Upload. Share the link.**

A screen recorder for QA/testing teams. The tester opens the page, signs in
with their company Google account, records the tab/window they're testing —
and the moment they hit **Stop**, the video uploads itself to a shared
Google Drive folder and hands back a viewable link to paste into the test
sheet. No manual uploading, no local files to manage.

## How it works

1. **Sign in** — Google Identity Services, Workspace accounts only
   (OAuth consent screen is *Internal* to the org).
2. **Record** — browser `getDisplayMedia` + `MediaRecorder` (WebM).
   Optional mic narration and tab/system audio (mixed in-browser).
   Pause/resume supported.
3. **Auto-upload** — chunked **resumable** Drive upload (8 MB chunks with
   progress) into one shared folder in Vishnu's Drive, so long recordings
   survive flaky networks.
4. **Auto-share** — each file is set to *“anyone at aptreach.com with the
   link can view”*; the link is shown, auto-copied, and kept in an
   on-page history (localStorage) for later pasting.

Files are named `YYYY-MM-DD_HHmm_<Tester>_<title>.webm` so the sheet and
the Drive folder stay readable.

## Files

- `index.html` — the page
- `style.css` — dark theme
- `app.js` — recorder + Drive upload (`CONFIG` at the top: Client ID,
  folder ID, domain)
- `SETUP.md` — one-time setup for the admin (OAuth client + shared folder)

## Notes

- 100% static — host on GitHub Pages / any static host. No server, no
  database, nothing stored anywhere except the team's Drive.
- Videos are WebM (plays in Chrome/Drive preview; Drive also transcodes
  for playback).

## License

MIT

---

Made with ♥ by **nuvish**
