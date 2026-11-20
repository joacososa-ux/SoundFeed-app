// Portada y reproducción desde el navegador: iTunes (30 s, sin clave), YouTube (clave opcional) y Spotify (PKCE).
import * as cfg from './config.js'; const { spotifyClientId, youtubeApiKey } = cfg, spotifyEnabled = cfg.spotifyEnabled === true;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const cache = new Map();
const first = (a) => String(a).split(/[&,]/)[0].trim();

/* ---------- iTunes por JSONP (funciona sin CORS) ---------- */
function jsonp(url, ms = 7000) {
  return new Promise((resolve, reject) => {
    const cb = '__sf' + Math.random().toString(36).slice(2);
    const sc = document.createElement('script');
    const done = (fn, v) => { clearTimeout(tm); delete window[cb]; sc.remove(); fn(v); };
    const tm = setTimeout(() => done(reject, new Error('timeout')), ms);
    window[cb] = (d) => done(resolve, d);
    sc.onerror = () => done(reject, new Error('bloqueado'));
    sc.src = url + '&callback=' + cb;
    document.head.append(sc);
  });
}
// Primero una consulta directa (CORS); si el navegador la bloquea, se usa JSONP como respaldo.
async function getJson(url, ms = 6000) {
  const ac = new AbortController(), tm = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error('http'); return await r.json(); }
  finally { clearTimeout(tm); }
}
// Portadas: se guardan en el dispositivo para no repetir consultas y se piden de a una.
const COVKEY = 'sf_cov';
const covLoad = () => { try { return JSON.parse(localStorage.getItem(COVKEY)) || {}; } catch (_) { return {}; } };
const covPending = new Map();
let covChain = Promise.resolve();
// Devuelve la primera promesa que se resuelve bien (si todas fallan, rechaza).
const firstOk = (ps) => new Promise((res, rej) => { let n = ps.length, last; ps.forEach((p) => p.then(res, (e) => { last = e; if (--n === 0) rej(last); })); });
// Respaldo de portadas: Deezer (por JSONP, sin clave).
async function deezerCover(title, artist) {
  const q = new URLSearchParams({ q: first(artist) + ' ' + title, limit: '4', output: 'jsonp' });
  const d = await jsonp('https://api.deezer.com/search?' + q, 5000);
  const rows = (d && d.data) || [], nt = norm(title);
  const hit = rows.find((r) => r.album && r.album.cover_big && norm(r.title).includes(nt)) || rows.find((r) => r.album && r.album.cover_big);
  return hit ? hit.album.cover_big : null;
}
const covLanes = [Promise.resolve(), Promise.resolve(), Promise.resolve()];
let covLane = 0;
export function coverFor(title, artist) {
  const key = (String(title) + '|' + String(artist)).toLowerCase().slice(0, 120);
  const saved = covLoad()[key]; if (saved) return Promise.resolve(saved);
  if (covPending.has(key)) return covPending.get(key);
  const job = async () => {
    let u = null;
    try {
      const rows = await itunesSearch(artist + ' ' + title, 3), nt = norm(title);
      const hit = rows.find((r) => r.cover && norm(r.title).includes(nt)) || rows.find((r) => r.cover);
      u = hit ? hit.cover : null;
    } catch (_) {}
    if (!u) { try { u = await deezerCover(title, artist); } catch (_) {} }
    if (u) {
      const m = covLoad(), ks = Object.keys(m); if (ks.length > 250) delete m[ks[0]];
      m[key] = u; try { localStorage.setItem(COVKEY, JSON.stringify(m)); } catch (_) {}
    }
    return u;
  };
  const i = covLane++ % covLanes.length;
  const p = (covLanes[i] = covLanes[i].then(job, job)); p.finally(() => covPending.delete(key));
  covPending.set(key, p); return p;
}
const itRows = (data) => (data.results || []).map((r) => ({
  title: r.trackName, artist: r.artistName, genre: r.primaryGenreName || '',
  preview: r.previewUrl || null, cover: String(r.artworkUrl100 || '').replace('100x100', '600x600') || null, link: r.trackViewUrl || null,
}));
async function itunesOne(term, limit, extra) {
  const q = new URLSearchParams({ term, media: 'music', entity: 'song', limit: String(limit), ...extra });
  const url = 'https://itunes.apple.com/search?' + q;
  return itRows(await firstOk([getJson(url, 5000), jsonp(url, 6000)]));
}
// Busca en la tienda general, en la de Argentina y por nombre de artista, para que aparezcan también los artistas locales.
export async function itunesSearch(term, limit = 8) {
  const key = 'it:' + term + limit;
  if (cache.has(key)) return cache.get(key);
  let base = null, err = null;
  try { base = await itunesOne(term, limit, {}); } catch (e) { err = e; }
  if (!base) { try { base = await itunesOne(term, limit, { country: 'AR' }); } catch (e) { err = e; } }
  if (!base) throw err || new Error('itunes');
  const lists = [base];
  if (limit > 3) { // extras opcionales: si fallan o tardan, se ignoran
    const wait = new Promise((r) => setTimeout(r, 4000, []));
    const extra = (x) => Promise.race([itunesOne(term, limit, x).catch(() => []), wait]);
    lists.push(...(await Promise.all([extra({ country: 'AR' }), extra({ country: 'AR', attribute: 'artistTerm' })])));
  }
  const seen = new Set(), rows = [];
  for (let i = 0; i < limit; i++) for (const l of lists) { const r = l[i]; if (!r) continue; const k = norm(r.title) + '|' + norm(r.artist); if (!seen.has(k)) { seen.add(k); rows.push(r); } }
  cache.set(key, rows);
  return rows;
}
function bestMatch(rows, title, artist) {
  const nt = norm(title), na = norm(first(artist)), withPrev = rows.filter((r) => r.preview);
  return withPrev.find((r) => norm(r.title).includes(nt) && norm(r.artist).includes(na)) || withPrev.find((r) => norm(r.title).includes(nt)) || rows[0] || null;
}

/* ---------- YouTube ---------- */
async function youtubeVideo(title, artist) {
  if (!youtubeApiKey) return null;
  const key = 'yt:' + artist + title;
  if (cache.has(key)) return cache.get(key);
  const q = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '1', q: `${artist} ${title} official audio`, key: youtubeApiKey });
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${q}`);
  if (!r.ok) throw new Error('youtube');
  const d = await r.json();
  const id = d.items && d.items[0] ? d.items[0].id.videoId : null;
  cache.set(key, id);
  return id;
}

/* ---------- Spotify (OAuth PKCE en el navegador, sin secreto) ---------- */
const SK = 'sf_spotify';
const redirectUri = () => location.origin + location.pathname;
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const load = () => { try { return JSON.parse(localStorage.getItem(SK)); } catch (_) { return null; } };
const save = (v) => { try { v ? localStorage.setItem(SK, JSON.stringify(v)) : localStorage.removeItem(SK); } catch (_) {} };

export const spotifyAvailable = () => !!spotifyEnabled && !!spotifyClientId;
export const spotifyConnected = () => spotifyAvailable() && !!load();
export const spotifyPremium = () => !!(load() || {}).premium;
export const spotifyDisconnect = () => save(null);

export async function spotifyConnect() {
  const verifier = rand(48), state = rand(12);
  sessionStorage.setItem('sf_pkce', JSON.stringify({ verifier, state, back: location.hash }));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const q = new URLSearchParams({ client_id: spotifyClientId, response_type: 'code', redirect_uri: redirectUri(), scope: 'user-read-private',
    state, code_challenge_method: 'S256', code_challenge: challenge });
  location.href = `https://accounts.spotify.com/authorize?${q}`;
}
// Se llama al cargar la página: si volvemos de Spotify con ?code=..., completa la conexión.
export async function spotifyHandleCallback() {
  const p = new URLSearchParams(location.search);
  if (!p.get('code') && !p.get('error')) return null;
  let saved; try { saved = JSON.parse(sessionStorage.getItem('sf_pkce')); } catch (_) {}
  sessionStorage.removeItem('sf_pkce');
  history.replaceState(null, '', location.pathname + (saved && saved.back ? saved.back : ''));
  if (p.get('error') || !saved || saved.state !== p.get('state')) return { error: 'No se pudo conectar Spotify.' };
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(), client_id: spotifyClientId, code_verifier: saved.verifier }) });
  if (!r.ok) return { error: 'Spotify rechazó la conexión. Revisá el Client ID y la URL de redirección.' };
  const t = await r.json();
  save({ access: t.access_token, refresh: t.refresh_token, exp: Date.now() + t.expires_in * 1000 - 60000, premium: false });
  try {
    const me = await (await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
    save({ ...load(), premium: me.product === 'premium' });
  } catch (_) {}
  return { ok: true };
}
async function spotifyToken() {
  const s = load(); if (!s) return null;
  if (s.exp > Date.now()) return s.access;
  if (!s.refresh) { save(null); return null; }
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refresh, client_id: spotifyClientId }) });
  if (!r.ok) { save(null); return null; }
  const t = await r.json();
  save({ ...s, access: t.access_token, refresh: t.refresh_token || s.refresh, exp: Date.now() + t.expires_in * 1000 - 60000 });
  return t.access_token;
}
async function spotifyTrack(title, artist) {
  const token = await spotifyToken(); if (!token) return null;
  const q = new URLSearchParams({ q: `track:${title} artist:${first(artist)}`, type: 'track', limit: '1' });
  const r = await fetch(`https://api.spotify.com/v1/search?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const t = ((await r.json()).tracks || {}).items;
  return t && t[0] ? { id: t[0].id, cover: t[0].album && t[0].album.images && t[0].album.images[0] && t[0].album.images[0].url } : null;
}

/* ---------- decisión final ---------- */
export async function playback(title, artist) {
  const out = { kind: 'none', cover: null, preview: null, link: null };
  try {
    const hit = bestMatch(await itunesSearch(`${artist} ${title}`), title, artist);
    if (hit) Object.assign(out, { kind: hit.preview ? 'preview' : 'none', cover: hit.cover, preview: hit.preview, link: hit.link });
  } catch (_) {}
  try {
    const sp = spotifyConnected() ? await spotifyTrack(title, artist) : null;
    if (sp) { out.kind = 'spotify'; out.spotifyId = sp.id; out.cover = sp.cover || out.cover; out.premium = spotifyPremium(); return out; }
    const yt = await youtubeVideo(title, artist);
    if (yt) { out.kind = 'youtube'; out.youtubeId = yt; }
  } catch (_) {}
  return out;
}
