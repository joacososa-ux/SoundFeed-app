// Reproductor flotante (PRUEBA). Canción completa con YouTube; si no hay video, fragmento de 30 s.
// Para sacarlo: borrar este archivo, player.css, su <link> en index.html y las líneas marcadas "player:" en app.js.
let music = null, h = null, toast = () => {};
const Q = { list: [], i: -1 }, ytCache = new Map();
let el = null, yt = null, ytReady = null, audio = null, timer = 0, playing = false, kind = 'none', open = false, seq = 0;

const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const cur = () => Q.list[Q.i] || null;
export const active = () => !!el && Q.i > -1;

export function init(ctx) { music = ctx.music; h = ctx.h; toast = ctx.toast || toast; }

function loadYT() {
  if (ytReady) return ytReady;
  ytReady = new Promise((res, rej) => {
    if (window.YT && window.YT.Player) return res(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(window.YT); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => { ytReady = null; rej(new Error('yt')); };
    document.head.append(s);
  });
  return ytReady;
}

/* ---------- interfaz ---------- */
function ui() {
  if (el) return el;
  const btn = (cls, label, path, fn) => { const x = h('button', { class: 'sfp-b ' + cls, type: 'button', 'aria-label': label, onclick: fn }); x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>'; return x; };
  el = h('section', { class: 'sfp', 'aria-label': 'Reproductor' });
  el.innerHTML = '<div class="sfp-vid"><div id="sfp-yt"></div></div>';
  const row = h('div', { class: 'sfp-row' });
  const cover = h('button', { class: 'sfp-cover', type: 'button', 'aria-label': 'Abrir o cerrar el detalle', onclick: toggleOpen });
  const info = h('button', { class: 'sfp-info', type: 'button', onclick: toggleOpen }, h('b', { class: 'sfp-t' }), h('span', { class: 'sfp-a' }));
  row.append(cover, info,
    btn('prev', 'Anterior', '<path d="M18 5v14l-9-7zM5 5h2v14H5z"/>', prev),
    btn('pp', 'Reproducir o pausar', '<path class="pl" d="M8 5v14l11-7z"/><path class="pa" d="M7 5h4v14H7zM13 5h4v14h-4z"/>', toggle),
    btn('next', 'Siguiente', '<path d="M6 5v14l9-7zM17 5h2v14h-2z"/>', next),
    btn('x', 'Cerrar reproductor', '<path d="M6 6l12 12M18 6L6 18"/>', close));
  const bar = h('div', { class: 'sfp-bar' }, h('span', { class: 'sfp-cur' }, '0:00'), h('input', { type: 'range', class: 'sfp-range', min: '0', max: '1000', value: '0', 'aria-label': 'Progreso', oninput: (e) => seek(+e.target.value / 1000) }), h('span', { class: 'sfp-dur' }, '0:00'));
  const queue = h('div', { class: 'sfp-q' });
  const note = h('p', { class: 'sfp-note', role: 'status' });
  el.append(row, bar, note, queue);
  document.body.append(el);
  return el;
}
const $ = (s) => el && el.querySelector(s);
function paint() {
  if (!el) return;
  const t = cur(); if (!t) return;
  $('.sfp-t').textContent = t.title; $('.sfp-a').textContent = t.artist;
  const c = $('.sfp-cover'); c.replaceChildren(t.cover ? h('img', { src: t.cover, alt: '', referrerpolicy: 'no-referrer' }) : (t.title || '?').charAt(0).toUpperCase());
  el.classList.toggle('on', true); el.classList.toggle('playing', playing); el.classList.toggle('yt', kind === 'youtube'); el.classList.toggle('open', open);
  $('.sfp-q').replaceChildren(h('b', {}, 'A continuación'), ...Q.list.map((x, i) => h('button', { type: 'button', class: 'sfp-qi' + (i === Q.i ? ' now' : ''), onclick: () => go(i) }, h('span', {}, x.title), h('small', {}, x.artist))));
  $('.sfp-q').hidden = Q.list.length < 2;
}
function toggleOpen() { open = !open; paint(); }

/* ---------- reproducción ---------- */
function stopAll() {
  clearInterval(timer); timer = 0; playing = false;
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  if (yt && yt.stopVideo) { try { yt.stopVideo(); } catch (_) {} }
}
async function resolve(t) {
  const key = t.title + '|' + t.artist;
  if (!ytCache.has(key)) ytCache.set(key, music.playback(t.title, t.artist).catch(() => ({ kind: 'none' })));
  return ytCache.get(key);
}
async function go(i) {
  if (i < 0 || i >= Q.list.length) return;
  const my = ++seq; stopAll(); Q.i = i; kind = 'none'; ui(); $('.sfp-note').textContent = 'Buscando la canción…'; paint();
  const t = cur();
  if (!t.cover) music.coverFor(t.title, t.artist).then((u) => { if (u && !t.cover) { t.cover = String(u).replace('600x600', '300x300'); if (my === seq) paint(); } }).catch(() => {});
  const p = await resolve(t); if (my !== seq) return;
  if (p.cover && !t.cover) { t.cover = p.cover; paint(); }
  // Cualquier reproducción suelta de la página (foro) se frena para no superponer audio.
  document.querySelectorAll('iframe.yt, .player audio').forEach((n) => { if (n.tagName === 'AUDIO') n.pause(); else n.remove(); });
  if (p.kind === 'youtube' && /^[\w-]{11}$/.test(p.youtubeId || '')) {
    try {
      const YT = await loadYT(); if (my !== seq) return;
      kind = 'youtube'; paint();
      if (!yt) {
        yt = new YT.Player('sfp-yt', { host: 'https://www.youtube-nocookie.com', videoId: p.youtubeId, width: '200', height: '200',
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
          events: { onReady: (e) => { e.target.playVideo(); }, onStateChange: onYT, onError: () => fallback(my, p) } });
      } else yt.loadVideoById(p.youtubeId);
      $('.sfp-note').textContent = 'Canción completa con YouTube.'; startTimer(); return;
    } catch (_) { /* sin YouTube: se prueba con el fragmento */ }
  }
  fallback(my, p);
}
function fallback(my, p) {
  if (my !== seq) return;
  if (yt && yt.stopVideo) { try { yt.stopVideo(); } catch (_) {} }
  if (p && p.kind !== 'none' && p.preview) {
    kind = 'preview'; if (!audio) { audio = new Audio(); audio.addEventListener('ended', () => next(true)); audio.addEventListener('play', () => { playing = true; paint(); }); audio.addEventListener('pause', () => { playing = false; paint(); }); }
    audio.src = p.preview; audio.play().then(() => {}, () => {}); $('.sfp-note').textContent = 'Fragmento de 30 s: no encontramos la canción completa.'; startTimer(); paint();
  } else {
    kind = 'none'; $('.sfp-note').textContent = 'No encontramos una muestra de esta canción.'; toast('No encontramos esa canción'); paint();
    if (Q.i < Q.list.length - 1) setTimeout(() => { if (my === seq) next(true); }, 1200);
  }
}
function onYT(e) {
  const S = window.YT && window.YT.PlayerState; if (!S) return;
  if (e.data === S.PLAYING) { playing = true; paint(); } else if (e.data === S.PAUSED) { playing = false; paint(); } else if (e.data === S.ENDED) next(true);
}
function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (!el) return;
    let c = 0, d = 0;
    if (kind === 'youtube' && yt && yt.getCurrentTime) { try { c = yt.getCurrentTime(); d = yt.getDuration(); } catch (_) {} }
    else if (kind === 'preview' && audio) { c = audio.currentTime; d = audio.duration; }
    const r = $('.sfp-range'); if (!r || document.activeElement === r) return;
    r.value = d > 0 ? String(Math.round(c / d * 1000)) : '0'; r.style.setProperty('--p', d > 0 ? c / d : 0);
    $('.sfp-cur').textContent = fmt(c); $('.sfp-dur').textContent = fmt(d);
  }, 400);
}
function seek(f) {
  if (kind === 'youtube' && yt && yt.getDuration) { try { yt.seekTo(f * yt.getDuration(), true); } catch (_) {} }
  else if (kind === 'preview' && audio && audio.duration) audio.currentTime = f * audio.duration;
}
function toggle() {
  if (kind === 'youtube' && yt) { try { playing ? yt.pauseVideo() : yt.playVideo(); } catch (_) {} }
  else if (kind === 'preview' && audio) { playing ? audio.pause() : audio.play().catch(() => {}); }
  else if (cur()) go(Q.i);
}
function next(auto) { if (Q.i < Q.list.length - 1) go(Q.i + 1); else if (!auto) go(0); else { playing = false; paint(); } }
function prev() {
  const c = kind === 'youtube' && yt && yt.getCurrentTime ? yt.getCurrentTime() : audio ? audio.currentTime : 0;
  if (c > 3) { seek(0); return; }
  go(Math.max(0, Q.i - 1));
}
export function close() {
  seq++; stopAll(); Q.list = []; Q.i = -1; kind = 'none';
  if (yt && yt.destroy) { try { yt.destroy(); } catch (_) {} yt = null; }
  if (el) { el.remove(); el = null; }
}
// Reproduce una lista de canciones { title, artist, cover? } empezando por la posición i.
export function playList(list, i) {
  if (!music) return;
  const seen = new Set(), clean = [];
  for (const t of list) { const k = t.title + '|' + t.artist; if (!seen.has(k)) { seen.add(k); clean.push({ title: t.title, artist: t.artist, cover: t.cover || null }); } }
  const start = list[i] ? clean.findIndex((x) => x.title === list[i].title && x.artist === list[i].artist) : 0;
  Q.list = clean.slice(0, 30); go(Math.max(0, start));
}
