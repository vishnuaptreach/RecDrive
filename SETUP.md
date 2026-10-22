# RecDrive — setup (one-time, ~10 minutes, Vishnu only)

Testers don't need any setup — they just open the site, sign in with their
aptreach.com Google account, and record. These two values are baked into
`app.js` (`CONFIG` at the top) before deploying:

```js
CLIENT_ID: '...',   // from step 1
FOLDER_ID: '...',   // from step 2
```

## Step 1 — Google Cloud: OAuth Client ID

1. Go to https://console.cloud.google.com/ — sign in as **vishnu@aptreach.com**.
2. Create a project (top bar → New Project) — name it `RecDrive`.
3. Left menu → **APIs & Services → Library** → search **Google Drive API** → **Enable**.
4. **APIs & Services → OAuth consent screen**:
   - User type: **Internal** (only aptreach.com accounts can use it) → Create.
   - App name: `RecDrive`, support email: your address. Save.
   - Scopes step: skip (scopes are requested at runtime).
5. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**, name: `RecDrive web`.
   - **Authorized JavaScript origins** → Add: `https://<company-github-account>.github.io`
     (the company GitHub account that hosts the repo — NOT nuvishh.github.io;
     add `http://localhost:8000` too if you want to test locally).
   - Create → copy the **Client ID** (ends with `.apps.googleusercontent.com`).

> The Client ID is not a secret — safe to keep in the public repo.
> Because the consent screen is *Internal*, no Google app verification is
> needed and only aptreach.com accounts can ever sign in.

## Step 2 — Drive: the shared folder

1. In **your** Drive (vishnu@aptreach.com) create a folder: **Test Recordings**.
2. Right-click → **Share** → add the testing team (people or the team group)
   with **Editor** access — they need Editor to upload into it.
   (Everyone else at aptreach.com gets *view* access per-file automatically,
   because the app sets each recording to "aptreach.com can view".)
3. Open the folder and copy its ID from the URL:
   `drive.google.com/drive/folders/`**`THIS_PART_IS_THE_FOLDER_ID`**

## Step 3 — bake the IDs in and deploy (company GitHub)

Send the Client ID + Folder ID to Muse — they get baked into `app.js`
(`CONFIG` block at the top) and you receive a ready-to-push package.
(Or edit those two lines yourself — they're clearly marked.)

1. Create the repo on the **company GitHub account** (e.g. `recdrive`).
2. Push all files in this package to that repo (branch `main`).
3. Repo **Settings → Pages** → Source: *Deploy from a branch* → `main` / root → Save.
4. Live URL: `https://<company-github-account>.github.io/<repo>/` — this
   origin must match the one from Step 1, or Google sign-in will fail.

## Troubleshooting

- **"Sign-in failed: access_blocked"** — the tester used a personal Gmail.
  Only @aptreach.com accounts work (Internal consent screen).
- **Upload init 403** — the tester isn't an Editor on the folder, or the
  Drive API isn't enabled in the project.
- **Recording has no sound** — tick "Tab / system audio" and, in Chrome's
  share picker, turn on the "Share tab audio" switch; for voice-over also
  tick "Microphone narration".
