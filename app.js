'use strict';
/* ================= CONFIG — Vishnu fills these in (see SETUP.md) ================= */
const CONFIG = {
  CLIENT_ID: '723658558502-6ukbt7jeee80qppbe7gei70ghdpbmk9i.apps.googleusercontent.com', // Google Cloud OAuth Client ID (Web application)
  FOLDER_ID: '1qzd3kQMYxkEmQB10nsb-ElnOd-uxa1Av',            // "Test Recordings" folder in Vishnu's Drive (shared with the team)
  DOMAIN: 'aptreach.com',   // recordings become viewable by anyone with this domain account
};
const SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const CHUNK = 8 * 1024 * 1024; // Drive resumable-upload chunk (multiple of 256KB)

/* ================= helpers ================= */
const $ = (id) => document.getElementById(id);
const toast = (msg, ms = 2600) => {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._h); toast._h = setTimeout(() => t.classList.add('hidden'), ms);
};
const configured = () => CONFIG.CLIENT_ID && CONFIG.FOLDER_ID;

/* ================= auth (Google Identity Services) ================= */
let tokenClient = null, accessToken = null, tokenExpiry = 0, userProfile = null;

function initAuth() {
  if (!configured() || !window.google) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID, scope: SCOPES,
    callback: async (resp) => {
      if (resp.error) { toast('Sign-in failed: ' + resp.error); return; }
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
        userProfile = await r.json();
      } catch (e) { /* profile is cosmetic */ }
      renderAuth();
    },
  });
  renderAuth();
}
function renderAuth() {
  const signed = !!accessToken;
  $('btn-auth').classList.toggle('hidden', signed);
  $('btn-signout').classList.toggle('hidden', !signed);
  $('user-info').classList.toggle('hidden', !signed);
  if (signed && userProfile) $('user-info').textContent = '👤 ' + (userProfile.name || userProfile.email || '');
  $('btn-start').disabled = !signed;
}
function ensureToken() {
  if (accessToken && Date.now() < tokenExpiry) return Promise.resolve(accessToken);
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error));
      accessToken = resp.access_token; tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

/* ================= recording ================= */
let displayStream = null, micStream = null, audioCtx = null, recorder = null;
let chunks = [], startStamp = 0, elapsedBefore = 0, timerInt = null, lastBlob = null, lastName = '';

function pickMime() {
  for (const m of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', '']) {
    if (!m || MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function stampName() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  const who = (userProfile && (userProfile.given_name || userProfile.name) || 'tester').replace(/\s+/g, '');
  let title = $('in-title').value.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').slice(0, 50);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}_${who}${title ? '_' + title : ''}.webm`;
}

async function startRecording() {
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 }, audio: $('in-tab-audio').checked,
    });
  } catch (e) { toast('Screen pick cancelled'); return; }
  const tracks = [displayStream.getVideoTracks()[0]];
  // audio: mix tab/system audio + mic (either or both) into one track
  const sources = [];
  try {
    audioCtx = new AudioContext();
    if ($('in-tab-audio').checked && displayStream.getAudioTracks().length) {
      sources.push(audioCtx.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks())));
    }
    if ($('in-mic').checked) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      sources.push(audioCtx.createMediaStreamSource(micStream));
    }
    if (sources.length) {
      const dest = audioCtx.createMediaStreamDestination();
      sources.forEach((s) => s.connect(dest));
      tracks.push(dest.stream.getAudioTracks()[0]);
    }
  } catch (e) { /* audio is optional — record video-only */ }
  const stream = new MediaStream(tracks);
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: pickMime() || undefined, videoBitsPerSecond: 5_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = onStopped;
  displayStream.getVideoTracks()[0].addEventListener('ended', () => { if (recorder && recorder.state !== 'inactive') stopRecording(); });
  lastName = stampName();
  recorder.start(1000);
  elapsedBefore = 0; startStamp = Date.now();
  $('timer').textContent = '00:00'; $('timer').classList.remove('hidden'); $('live-badge').classList.remove('hidden');
  timerInt = setInterval(() => { $('timer').textContent = fmtTime(elapsedBefore + (Date.now() - startStamp)); }, 500);
  $('btn-start').classList.add('hidden'); $('btn-pause').classList.remove('hidden'); $('btn-stop').classList.remove('hidden');
  $('btn-pause').textContent = '⏸ Pause';
}
function togglePause() {
  if (!recorder) return;
  if (recorder.state === 'recording') {
    recorder.pause(); elapsedBefore += Date.now() - startStamp;
    $('btn-pause').textContent = '▶ Resume'; $('live-badge').textContent = '⏸ PAUSED';
  } else if (recorder.state === 'paused') {
    recorder.resume(); startStamp = Date.now();
    $('btn-pause').textContent = '⏸ Pause'; $('live-badge').textContent = '● REC';
  }
}
function stopRecording() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }
function cleanupStreams() {
  clearInterval(timerInt);
  [displayStream, micStream].forEach((s) => s && s.getTracks().forEach((t) => t.stop()));
  if (audioCtx) audioCtx.close().catch(() => {});
  displayStream = micStream = audioCtx = recorder = null;
  $('btn-pause').classList.add('hidden'); $('btn-stop').classList.add('hidden');
  $('btn-start').classList.remove('hidden');
  $('timer').classList.add('hidden'); $('live-badge').classList.add('hidden'); $('live-badge').textContent = '● REC';
}
function onStopped() {
  lastBlob = new Blob(chunks, { type: 'video/webm' });
  cleanupStreams();
  uploadVideo(lastBlob, lastName);
}

/* ================= Drive upload (resumable, chunked) ================= */
async function uploadVideo(blob, name) {
  $('upload-card').classList.remove('hidden');
  $('link-box').classList.add('hidden'); $('up-actions').classList.add('hidden');
  $('up-name').textContent = '⬆ ' + name + ' (' + (blob.size / 1048576).toFixed(1) + ' MB)';
  setProgress(0, 'Starting upload…');
  try {
    const token = await ensureToken();
    // 1) open a resumable session
    const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/webm', 'X-Upload-Content-Length': blob.size },
      body: JSON.stringify({ name, mimeType: 'video/webm', parents: [CONFIG.FOLDER_ID] }),
    });
    if (!init.ok) throw new Error('upload init failed (' + init.status + ')');
    const sessionUri = init.headers.get('Location');
    // 2) send chunks
    let fileId = null, offset = 0;
    while (offset < blob.size) {
      const end = Math.min(offset + CHUNK, blob.size);
      const x = await new Promise((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.open('PUT', sessionUri);
        req.setRequestHeader('Content-Range', `bytes ${offset}-${end - 1}/${blob.size}`);
        req.upload.onprogress = (e) => setProgress(Math.round(((offset + e.loaded) / blob.size) * 100), 'Uploading…');
        req.onload = () => resolve(req);
        req.onerror = () => reject(new Error('network error during upload'));
        req.send(blob.slice(offset, end));
      });
      if (x.status === 200 || x.status === 201) { fileId = JSON.parse(x.responseText).id; break; }
      if (x.status !== 308) throw new Error('upload failed (' + x.status + ')');
      offset = end;
    }
    if (!fileId) throw new Error('upload did not complete');
    setProgress(100, 'Uploaded ✓ — setting view access…');
    // 3) anyone in the domain with the link can view
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'domain', domain: CONFIG.DOMAIN }),
    });
    const meta = await (await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, { headers: { Authorization: 'Bearer ' + token } })).json();
    const link = meta.webViewLink;
    setProgress(100, '✅ Done — link ready. Paste it into the sheet.');
    $('link-out').value = link; $('link-box').classList.remove('hidden');
    try { await navigator.clipboard.writeText(link); toast('Link copied 📋'); } catch (e) {}
    saveHistory(name, link);
  } catch (err) {
    setProgress(parseInt($('up-pct').textContent) || 0, '⚠️ ' + err.message + ' — video kept in this tab: retry or download it.');
    $('up-actions').classList.remove('hidden');
  }
}
function setProgress(pct, status) {
  $('up-bar').style.width = pct + '%'; $('up-pct').textContent = pct + '%';
  if (status) $('up-status').textContent = status;
}

/* ================= history (localStorage) ================= */
function saveHistory(name, link) {
  const h = JSON.parse(localStorage.getItem('recdrive-history') || '[]');
  h.unshift({ name, link, ts: Date.now() });
  localStorage.setItem('recdrive-history', JSON.stringify(h.slice(0, 30)));
  renderHistory();
}
function renderHistory() {
  const h = JSON.parse(localStorage.getItem('recdrive-history') || '[]');
  $('history-empty').classList.toggle('hidden', h.length > 0);
  $('history').innerHTML = h.map((it) =>
    `<li><span class="h-name" title="${it.name}">${it.name}</span><a href="${it.link}" target="_blank" rel="noopener">Open ↗</a></li>`).join('');
}

/* ================= wire up ================= */
window.addEventListener('load', () => {
  if (!configured()) $('setup-banner').classList.remove('hidden');
  initAuth(); renderHistory();
  $('btn-auth').onclick = () => tokenClient && tokenClient.requestAccessToken({ prompt: 'consent' });
  $('btn-signout').onclick = () => { accessToken = null; userProfile = null; renderAuth(); };
  $('btn-start').onclick = startRecording;
  $('btn-pause').onclick = togglePause;
  $('btn-stop').onclick = stopRecording;
  $('btn-copy').onclick = async () => { $('link-out').select(); try { await navigator.clipboard.writeText($('link-out').value); toast('Link copied 📋'); } catch (e) { document.execCommand('copy'); } };
  $('btn-retry').onclick = () => lastBlob && uploadVideo(lastBlob, lastName);
  $('btn-download').onclick = () => {
    if (!lastBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(lastBlob); a.download = lastName; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
});
