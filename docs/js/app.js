import * as store from './store.js?v=14';
import * as music from './music.js?v=13';
import { recommend, seedThreads, slugify, LABEL, MOODS } from './recommend.js?v=12';
import * as fx from './fx.js?v=1';
import { initProfile } from './profile.js?v=1';
import * as Player from './player.js?v=2'; // player: prueba, se saca borrando estas líneas

const CATS = { letra: 'Análisis de letra', debate: 'Debate', anecdotas: 'Anécdotas', similares: 'Si te gusta esto' };
const $ = (s, el) => (el || document).querySelector(s);
const view = $('#view');
const S = { user: null, ready: false, guest: false, picked: new Set(), text: '', recs: null, recNote: '', ui: {},
  slug: null, data: null, cat: 'todo', threadId: null, off: null, offRecent: null, notice: '', spotifyMsg: '', premium: false, favs: [], offPlan: null, offFavs: null, following: new Set(), me: null, offFol: null, offMe: null };
const FREE_RECS = 3, PREMIUM_RECS = 9;
const TODAY_NOTE = 'Según tu ánimo de hoy';
const dayKey = () => new Date().toLocaleDateString('sv-SE');
function loadToday() {
  try { const t = JSON.parse(localStorage.getItem('sf_today') || 'null'); if (t && t.date === dayKey() && Array.isArray(t.moods)) return { date: t.date, moods: t.moods.filter((m) => MOODS.includes(m)), pending: false }; } catch (_) {}
  return { date: dayKey(), moods: [], pending: true };
}
S.today = loadToday();
try { S.guest = sessionStorage.getItem('sf_guest') === '1'; } catch (_) {}

/* ---------- utilidades ---------- */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) { if (kid == null || kid === false) continue; el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return el;
}
const moodLabel = (id) => LABEL[id] || id;
// Íconos de línea (mismo trazo en toda la app). Devuelve un <span class="ic"> con el SVG.
const ICON = {
  heart: '<path d="M12 20.5S3.5 15.4 3.5 9.2A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.4c0 6.2-8.5 11.3-8.5 11.3z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  out: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  repost: '<path d="M17 3l4 4-4 4"/><path d="M3 11V9a2 2 0 0 1 2-2h16"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a2 2 0 0 1-2 2H3"/>',
};
function ico(name, cls) { const s = document.createElement('span'); s.className = 'ic' + (cls ? ' ' + cls : ''); s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<svg viewBox="0 0 24 24">' + ICON[name] + '</svg>'; return s; }
const ambEl = () => { const a = document.createElement('div'); a.className = 'amb'; a.setAttribute('aria-hidden', 'true'); a.innerHTML = '<i class="o a"></i><i class="o b"></i><i class="o c"></i>'; return a; };
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  const hr = Math.round(m / 60);
  return hr < 24 ? `hace ${hr} h` : `hace ${Math.round(hr / 24)} d`;
}
const errMsg = (e) => (e && e.code === 'permission-denied' ? 'No tenés permiso para hacer eso. Revisá que hayas iniciado sesión.' : 'No se pudo completar la acción. Probá de nuevo.');

/* ---------- cuenta, bienvenida y Spotify ---------- */
function setGuest(v) { S.guest = v; try { v ? sessionStorage.setItem('sf_guest', '1') : sessionStorage.removeItem('sf_guest'); } catch (_) {} }
/* ---------- cuenta: avatar y menú ---------- */
function avatarEl(u, size) {
  const el = h('span', { class: 'av-pic', 'aria-hidden': 'true', 'data-uid': u.uid && !u.thumb && !u.photo ? u.uid : null, vars: { '--s': (size || 34) + 'px', '--a': hue(u.uid || u.name) } });
  el.append(h('b', {}, (u.name || '?').charAt(0).toUpperCase()));
  if (u.thumb) el.append(h('img', { src: u.thumb, alt: '' }));
  else if (u.photo) el.append(h('img', { src: u.photo, alt: '', referrerpolicy: 'no-referrer', onerror: (e) => e.target.remove() }));
  return el;
}
let MENU = null, SHEET = null;
function menuKey(e) { if (e.key === 'Escape') { if (SHEET) closeSheet(); else closeMenu(); } }
function leave(el) { el.classList.add('out'); setTimeout(() => el.remove(), 260); }
function closeMenu() {
  if (!MENU) return;
  leave(MENU); MENU = null; if (!SHEET) document.removeEventListener('keydown', menuKey);
  const b = $('.acct'); if (b) b.setAttribute('aria-expanded', 'false');
}
function closeSheet(now) { if (!SHEET) return; if (now === true) SHEET.remove(); else leave(SHEET); SHEET = null; document.body.classList.remove('noscroll'); if (!MENU) document.removeEventListener('keydown', menuKey); }
function meU() { return S.user ? { ...S.user, thumb: S.me && S.me.thumb ? S.me.thumb : null, photo: S.me && S.me.thumb ? null : S.user.photo } : null; }
function openMenu() {
  const u = meU(); if (!u) return;
  const item = (label, sub, fn, icon, i) => h('button', { class: 'mi', type: 'button', role: 'menuitem', onclick: fn, vars: { '--i': i } }, ico(icon), h('span', {}, label), sub ? h('small', {}, sub) : '');
  const panel = h('div', { class: 'menu', role: 'menu', 'aria-label': 'Tu cuenta' },
    h('div', { class: 'mhead' }, avatarEl(u, 44), h('div', {}, h('b', {}, '@' + u.name), h('small', {}, S.premium ? 'Plan Premium' : 'Plan gratuito'))),
    item('Mi perfil', '', () => { closeMenu(); location.hash = 'perfil-' + u.uid; }, 'user', 0),
    item('Cuenta', '', () => openSheet('cuenta'), 'card', 1),
    item('Plan', S.premium ? 'Premium' : 'Gratuito', () => openSheet('plan'), 'star', 2),
    h('div', { class: 'msep' }),
    h('button', { class: 'mi danger', type: 'button', role: 'menuitem', vars: { '--i': 3 }, onclick: () => { closeMenu(); store.logout(); } }, ico('out'), h('span', {}, 'Cerrar sesión')));
  MENU = h('div', { class: 'menu-back', onclick: (e) => { if (e.target === MENU) closeMenu(); } }, panel);
  document.body.append(MENU); document.addEventListener('keydown', menuKey);
  const b = $('.acct'); if (b) b.setAttribute('aria-expanded', 'true');
  const f = panel.querySelector('.mi'); if (f) f.focus();
}
function openSheet(kind) {
  closeMenu(); closeSheet(true);
  const u = S.user; if (!u) return;
  const row = (k, v) => h('div', { class: 'srow' }, h('span', {}, k), h('b', {}, v));
  const msg = h('p', { class: 'snote', role: 'status' });
  const mail = (label, fn, ok) => h('button', { class: 'btn ghost small', type: 'button', onclick: async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await fn(); msg.textContent = ok; } catch (_) { msg.textContent = 'No se pudo enviar ahora. Probá más tarde.'; }
  } }, label);
  let title = 'Perfil', body = [];
  if (kind === 'perfil') {
    body = [h('div', { class: 'sprof' }, avatarEl(u, 72), h('div', {}, h('h3', {}, '@' + u.name), h('p', {}, S.premium ? 'Plan Premium' : 'Plan gratuito'))),
      row('Favoritos guardados', String(S.favs.length)),
      h('p', { class: 'snote' }, 'Tu nombre de usuario es el que ven los demás en los foros. Por ahora no se puede cambiar.')];
  } else if (kind === 'cuenta') {
    title = 'Cuenta';
    const acts = [];
    if (u.password) {
      if (!u.verified) acts.push(mail('Reenviar correo de confirmación', () => store.resendVerification(), 'Te mandamos el correo de confirmación.'));
      acts.push(mail('Cambiar contraseña', () => store.resetPassword(u.email), 'Te mandamos un enlace para cambiar la contraseña.'));
    }
    const sw = h('button', { class: 'sw', type: 'button', role: 'switch', 'aria-checked': String(fx.isGlass()), 'aria-label': 'Cristal líquido' }, h('i'));
    sw.addEventListener('click', () => { const on = !fx.isGlass(); fx.setGlass(on); sw.setAttribute('aria-checked', String(on)); msg.textContent = on ? 'Cristal líquido activado.' : 'Cristal líquido desactivado: la app usa superficies sólidas.'; msg.classList.add('toast'); });
    body = [row('Correo', u.email || '—'), row('Ingreso con', u.password ? 'Correo y contraseña' : 'Google'),
      u.password ? row('Correo confirmado', u.verified ? 'Sí' : 'Todavía no') : '',
      h('div', { class: 'srow' }, h('span', { class: 'lbl' }, 'Cristal líquido', h('small', {}, 'Efecto de vidrio en toda la app')), sw),
      acts.length ? h('div', { class: 'sacts' }, acts) : '', msg];
  } else {
    title = 'Plan';
    body = [h('div', { class: 'splan' }, h('b', {}, S.premium ? 'Premium' : 'Gratuito'), h('small', {}, S.premium ? 'Tenés todo desbloqueado.' : 'Tu plan actual')),
      h('ul', { class: 'slist' },
        h('li', {}, 'Foros, hilos y respuestas'),
        h('li', {}, FREE_RECS + ' recomendaciones por ánimo'),
        h('li', { class: S.premium ? '' : 'off' }, 'Hasta ' + PREMIUM_RECS + ' recomendaciones'),
        h('li', { class: S.premium ? '' : 'off' }, 'Favoritos'),
        h('li', { class: S.premium ? '' : 'off' }, 'Insignia Premium')),
      S.premium ? '' : h('p', { class: 'snote' }, 'El plan Premium llega pronto.')];
  }
  showSheet(title, body);
}
function showSheet(title, body) {
  closeMenu(); closeSheet(true);
  const sheet = h('section', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'sheet-x', type: 'button', 'aria-label': 'Cerrar', onclick: () => closeSheet() }, '✕')),
    h('div', { class: 'sheet-body' }, body));
  SHEET = h('div', { class: 'menu-back sheet-back', onclick: (e) => { if (e.target === SHEET) closeSheet(); } }, sheet);
  document.body.classList.add('noscroll'); document.body.append(SHEET); document.addEventListener('keydown', menuKey);
  const x = sheet.querySelector('.sheet-x'); if (x) x.focus();
}
let TOAST = null, TT = 0;
function toast(m) {
  if (!TOAST) { TOAST = h('div', { class: 'sf-toast', role: 'status' }); document.body.append(TOAST); }
  TOAST.textContent = m; TOAST.classList.add('on'); clearTimeout(TT); TT = setTimeout(() => TOAST.classList.remove('on'), 2600);
}
function paintAccount() {
  const box = $('#account'), u = S.user;
  if (!u) {
    closeMenu(); closeSheet(true);
    box.replaceChildren(store.configured ? h('button', { class: 'btn small', type: 'button', onclick: () => { setGuest(false); route(); } }, 'Entrar') : '');
    return;
  }
  box.replaceChildren(h('button', { class: 'acct', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': String(!!MENU), 'aria-label': 'Menú de ' + u.name, onclick: () => (MENU ? closeMenu() : openMenu()) },
    avatarEl(meU(), 34), h('span', { class: 'burger', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
    u.password && !u.verified ? h('em', { class: 'dot', title: 'Confirmá tu correo' }) : ''));
}

/* ---------- acceso: ingreso, registro y nombre de usuario ---------- */
const LOGO_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lgw" gradientUnits="userSpaceOnUse" x1="5" y1="5" x2="43" y2="43"><stop offset="0" stop-color="#2be3f2"/><stop offset="1" stop-color="#ff3d9a"/></linearGradient></defs><path d="M24 5C13 5 5 12.6 5 22.4c0 5.2 2.4 9.7 6.2 12.8L9 43l8.3-4.1c2 .6 4.2.9 6.7.9 11 0 19-7.6 19-17.4S35 5 24 5z" fill="none" stroke="url(#lgw)" stroke-width="3" stroke-linejoin="round"/><g fill="none" stroke="url(#lgw)" stroke-width="3" stroke-linecap="round"><path class="b" d="M16 20v6"/><path class="b" d="M21 15v16"/><path class="b" d="M26 12v22"/><path class="b" d="M31 17v12"/><path class="b" d="M36 21v4"/></g></svg>';
const G_SVG = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
const logoEl = () => { const s = h('span', { class: 'w-logo' }); s.innerHTML = LOGO_SVG; return s; };
const A = { el: null, screen: 'welcome', busy: false, seq: 0, timer: 0 };
const RESERVED = ['admin', 'administrador', 'soundfeed', 'soporte', 'moderador', 'root'];
const COMMON_PW = ['password', 'contrasena', 'contraseña', '1234567890', '12345678910', 'qwertyuiop', 'abcdefghij', 'soundfeed123', 'password123', 'contraseña123', 'iloveyou123'];
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
function pwCheck(p, email) {
  const local = (email || '').split('@')[0].toLowerCase();
  const r = { len: p.length >= 10, mix: /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p),
    common: p.length > 0 && !COMMON_PW.includes(p.toLowerCase()) && !(local.length > 2 && p.toLowerCase().includes(local)) };
  const n = Object.values(r).filter(Boolean).length, ok = r.len && r.mix && r.common;
  return { r, ok, s: !p ? 0 : ok ? (p.length >= 14 ? 4 : 3) : (n >= 2 ? 2 : 1) };
}
function authErr(e) {
  const c = e && e.code;
  if (c === 'auth/email-already-in-use') return 'Ya existe una cuenta con ese correo. Probá iniciar sesión.';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-email') return 'Correo o contraseña incorrectos.';
  if (c === 'auth/too-many-requests') return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
  if (c === 'auth/network-request-failed') return 'Sin conexión. Revisá tu internet y probá de nuevo.';
  if (c === 'auth/operation-not-allowed') return 'El acceso con correo todavía no está habilitado.';
  if (c === 'auth/weak-password') return 'Elegí una contraseña más segura.';
  return 'No se pudo completar. Probá de nuevo.';
}
async function resendVerify(e) {
  const b = e.currentTarget; b.disabled = true;
  try { await store.resendVerification(); b.textContent = 'Correo enviado'; } catch (_) { b.textContent = 'Probá más tarde'; }
}
const AUTH_HTML = '<div class="a-wrap">'
  + '<section class="a-screen" data-s="welcome" aria-label="Acceso">'
  + '<div class="a-brand"><span data-logo></span><span class="a-word">Sound<i>Feed</i></span></div>'
  + '<div class="a-fan" aria-hidden="true"><div class="a-tile t1" style="--h1:38;--h2:12"></div><div class="a-tile t3" style="--h1:205;--h2:255"></div><div class="a-tile t2" style="--h1:265;--h2:325">♪</div>'
  + '<div class="a-bub b1"><i></i><i></i><i></i> ¿La escuchan de noche?</div><div class="a-bub b2">Ese solo final</div></div>'
  + '<div class="a-hero"><h1><span class="w" style="--k:0">Descubrí</span> <span class="w" style="--k:1">una</span> <span class="w" style="--k:2">canción</span> <span class="w" style="--k:3">y</span> <em class="w" style="--k:4">entrá a la charla.</em></h1><p>Contanos cómo te sentís o buscá cualquier tema. Cada canción abre su propio foro, donde la comunidad analiza la letra y debate sobre el artista.</p></div>'
  + '<div class="a-grow"></div>'
  + '<div class="a-actions"><div class="a-err" role="alert"></div>'
  + '<button type="button" class="a-btn primary" data-go="login">Iniciar sesión</button>'
  + '<button type="button" class="a-btn" data-go="signup">Registrarme</button>'
  + '<div class="a-sep">o</div>'
  + '<button type="button" class="a-btn google" data-google>' + G_SVG + 'Continuar con Google</button>'
  + '<button type="button" class="a-visit" data-visit>Entrar como visita (solo lectura)</button></div>'
  + '<p class="a-legal">Al continuar aceptás los términos y la política de privacidad.</p>'
  + '</section>'
  + '<section class="a-screen" data-s="signup" aria-label="Registro">'
  + '<button type="button" class="a-back" data-go="welcome"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>Volver</button>'
  + '<div class="a-steps" aria-hidden="true"><i class="on"></i><i></i></div>'
  + '<h2 class="a-title">Creá tu cuenta</h2>'
  + '<p class="a-sub">Con tu correo y una contraseña segura. Después elegís cómo te llamamos.</p>'
  + '<form id="a-fsignup" novalidate>'
  + '<div class="a-field"><div class="a-in"><input id="a-se" type="email" autocomplete="email" inputmode="email" placeholder=" " required><label for="a-se">Correo electrónico</label><svg class="a-chk" viewBox="0 0 24 24" aria-hidden="true"><circle class="ring" cx="12" cy="12" r="10"/><path pathLength="1" d="M7 12.5l3.5 3.5L17 9"/></svg></div><div class="a-hint" id="a-seh"></div></div>'
  + '<div class="a-field"><div class="a-in"><input id="a-sp" type="password" autocomplete="new-password" placeholder=" " required><label for="a-sp">Contraseña</label><button type="button" class="a-eye" data-eye="a-sp">Ver</button></div>'
  + '<div class="a-meter" id="a-meter" data-s="0" aria-hidden="true"><i></i><i></i><i></i><i></i></div>'
  + '<ul class="a-rules" id="a-rules"><li data-r="len"><i class="dotc"><svg class="ck" viewBox="0 0 24 24"><path pathLength="1" d="M4.5 12.5l5 5L19.5 7"/></svg></i>10 caracteres o más</li><li data-r="mix"><i class="dotc"><svg class="ck" viewBox="0 0 24 24"><path pathLength="1" d="M4.5 12.5l5 5L19.5 7"/></svg></i>Mayúsculas, minúsculas y un número</li><li data-r="common"><i class="dotc"><svg class="ck" viewBox="0 0 24 24"><path pathLength="1" d="M4.5 12.5l5 5L19.5 7"/></svg></i>No es una contraseña común ni tu correo</li></ul></div>'
  + '<div class="a-field"><div class="a-in"><input id="a-sp2" type="password" autocomplete="new-password" placeholder=" " required><label for="a-sp2">Repetí la contraseña</label><button type="button" class="a-eye" data-eye="a-sp2">Ver</button></div><div class="a-hint" id="a-sp2h"></div></div>'
  + '<div class="a-err" role="alert"></div>'
  + '<button class="a-btn primary" id="a-sbtn" disabled>Crear cuenta</button>'
  + '</form>'
  + '<p class="a-small">Te mandamos un correo para confirmar tu dirección. Tu contraseña se guarda cifrada y nadie del equipo puede verla.</p>'
  + '</section>'
  + '<section class="a-screen" data-s="login" aria-label="Iniciar sesión">'
  + '<button type="button" class="a-back" data-go="welcome"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>Volver</button>'
  + '<h2 class="a-title">Qué bueno verte de nuevo</h2>'
  + '<p class="a-sub">Entrá con tu correo y contraseña.</p>'
  + '<form id="a-flogin" novalidate>'
  + '<div class="a-field"><div class="a-in"><input id="a-le" type="email" autocomplete="email" inputmode="email" placeholder=" "><label for="a-le">Correo electrónico</label></div></div>'
  + '<div class="a-field"><div class="a-in"><input id="a-lp" type="password" autocomplete="current-password" placeholder=" "><label for="a-lp">Contraseña</label><button type="button" class="a-eye" data-eye="a-lp">Ver</button></div>'
  + '<button type="button" class="a-link" id="a-forgot">¿Te olvidaste la contraseña?</button></div>'
  + '<div class="a-err" role="alert"></div>'
  + '<button class="a-btn primary" id="a-lbtn">Entrar</button>'
  + '</form>'
  + '<div class="a-sep">o</div>'
  + '<button type="button" class="a-btn google" data-google>' + G_SVG + 'Continuar con Google</button>'
  + '<p class="a-small" style="text-align:center">¿Todavía no tenés cuenta? <button type="button" class="a-link inline" data-go="signup">Registrate</button></p>'
  + '</section>'
  + '<section class="a-screen" data-s="name" aria-label="Nombre de usuario">'
  + '<div class="a-steps" aria-hidden="true" style="margin-top:14px"><i class="on"></i><i class="on"></i></div>'
  + '<div class="a-uav empty" id="a-uav" aria-hidden="true">?</div>'
  + '<h2 class="a-title big">¿Cómo querés que te llamemos?</h2>'
  + '<p class="a-sub">Es el nombre que van a ver los demás en los foros. Elegilo con cuidado: por ahora no se puede cambiar.</p>'
  + '<div class="a-namewrap"><div class="a-namebox" id="a-nbox"><span class="a-at">@</span><input id="a-nin" type="text" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="tu_nombre" aria-describedby="a-nstat"><span class="a-state" id="a-nstate" aria-hidden="true"></span></div>'
  + '<div class="a-status" id="a-nstat" role="status" aria-live="polite">De 3 a 20 letras, números o guion bajo.</div><div class="a-chips" id="a-sugg" hidden></div></div>'
  + '<div class="a-grow"></div>'
  + '<button type="button" class="a-btn primary" id="a-nbtn" disabled>Continuar</button>'
  + '<button type="button" class="a-visit" data-logout>Usar otra cuenta</button>'
  + '</section></div>';
function setScreen(s) {
  A.screen = s;
  A.el.querySelectorAll('.a-screen').forEach((e) => e.classList.toggle('on', e.dataset.s === s));
  A.el.scrollTop = 0;
  const f = A.el.querySelector('.a-screen.on input');
  if (f && s !== 'welcome') setTimeout(() => { try { f.focus({ preventScroll: true }); } catch (_) {} }, 350);
}
function buildAuth() {
  const el = h('div', { class: 'auth', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Acceso a SoundFeed' });
  el.innerHTML = AUTH_HTML; A.el = el; el.prepend(ambEl());
  const q = (s) => el.querySelector(s);
  const say = (msg, ok) => { const n = q('.a-screen.on .a-err'); if (!n) return; n.textContent = msg || ''; n.classList.toggle('ok', !!ok); };
  el.querySelectorAll('[data-logo]').forEach((n) => n.replaceWith(logoEl()));
  if (!store.configured) say('Falta configurar Firebase: completá js/config.js (mirá el README).');
  el.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]'); if (go) { e.preventDefault(); say(''); setScreen(go.dataset.go); return; }
    const eye = e.target.closest('[data-eye]');
    if (eye) { const i = q('#' + eye.dataset.eye); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; eye.textContent = show ? 'Ocultar' : 'Ver'; return; }
    if (e.target.closest('[data-visit]')) { setGuest(true); route(); return; }
    if (e.target.closest('[data-logout]')) { store.logout(); return; }
    if (e.target.closest('[data-google]')) googleIn();
  });
  async function googleIn() {
    if (!store.configured) return;
    try { await store.signInGoogle(); }
    catch (e) { if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') say('No se pudo continuar con Google. Probá de nuevo.'); }
  }
  /* registro */
  const se = q('#a-se'), sp = q('#a-sp'), sp2 = q('#a-sp2'), sbtn = q('#a-sbtn');
  const checkSignup = () => {
    const e = se.value.trim(), p = sp.value, p2 = sp2.value, st = pwCheck(p, e);
    q('#a-meter').dataset.s = st.s;
    el.querySelectorAll('#a-rules li').forEach((li) => li.classList.toggle('ok', !!st.r[li.dataset.r]));
    const badE = !!e && !validEmail(e), eh = q('#a-seh');
    eh.textContent = badE ? 'Revisá el correo: parece que le falta algo.' : ''; eh.className = 'a-hint' + (badE ? ' bad' : '');
    se.closest('.a-field').classList.toggle('good', validEmail(e)); se.closest('.a-field').classList.toggle('bad', badE);
    const same = !!p2 && p === p2, h2 = q('#a-sp2h');
    h2.textContent = p2 ? (same ? 'Coinciden' : 'No coinciden todavía') : ''; h2.className = 'a-hint' + (p2 ? (same ? ' ok' : ' bad') : '');
    const was = sbtn.disabled; sbtn.disabled = A.busy || !(validEmail(e) && st.ok && same);
    if (was && !sbtn.disabled) { sbtn.classList.remove('enable'); void sbtn.offsetWidth; sbtn.classList.add('enable'); }
  };
  [se, sp, sp2].forEach((i) => i.addEventListener('input', checkSignup));
  q('#a-fsignup').addEventListener('submit', async (e) => {
    e.preventDefault(); if (sbtn.disabled) return;
    A.busy = true; sbtn.disabled = true; sbtn.textContent = 'Creando cuenta…'; say('');
    try { await store.signUpEmail(se.value.trim(), sp.value); sp.value = ''; sp2.value = ''; }
    catch (err) { say(authErr(err)); }
    finally { A.busy = false; sbtn.textContent = 'Crear cuenta'; if (A.el === el) checkSignup(); }
  });
  /* iniciar sesión */
  q('#a-flogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const em = q('#a-le').value.trim(), pw = q('#a-lp').value, btn = q('#a-lbtn');
    if (!validEmail(em) || !pw) return say('Escribí tu correo y tu contraseña.');
    say(''); btn.disabled = true; btn.textContent = 'Entrando…';
    try { await store.signInEmail(em, pw); q('#a-lp').value = ''; }
    catch (err) { say(authErr(err)); }
    finally { btn.disabled = false; btn.textContent = 'Entrar'; }
  });
  q('#a-forgot').addEventListener('click', async () => {
    const em = q('#a-le').value.trim();
    if (!validEmail(em)) return say('Escribí tu correo arriba y tocá de nuevo.');
    const msg = 'Si ese correo tiene una cuenta, te mandamos un enlace para cambiar la contraseña.';
    try { await store.resetPassword(em); say(msg, true); }
    catch (err) { if (err && err.code === 'auth/network-request-failed') say(authErr(err)); else say(msg, true); }
  });
  /* nombre de usuario */
  const nin = q('#a-nin'), nbtn = q('#a-nbtn'), nbox = q('#a-nbox');
  const setName = (state, text, cls) => {
    nbox.className = 'a-namebox ' + (cls || '');
    const SVGS = { '✓': '<svg class="a-stt" viewBox="0 0 24 24"><circle class="ring" cx="12" cy="12" r="10"/><path pathLength="1" d="M7 12.5l3.5 3.5L17 9"/></svg>', '✕': '<svg class="a-stt x" viewBox="0 0 24 24"><circle class="ring" cx="12" cy="12" r="10"/><path pathLength="1" d="M8.5 8.5l7 7M15.5 8.5l-7 7"/></svg>' };
    q('#a-nstate').innerHTML = SVGS[state] || state;
    const s = q('#a-nstat'); s.textContent = text; s.className = 'a-status ' + (cls || '');
  };
  const suggest = (base) => {
    const box = q('#a-sugg');
    const alts = [base + '_', base + (10 + Math.floor(Math.random() * 89)), 'la_' + base].filter((a) => a.length <= 20);
    box.replaceChildren(...alts.map((a, i) => h('button', { type: 'button', vars: { '--k': i }, onclick: () => { nin.value = a; nin.dispatchEvent(new Event('input')); } }, '@' + a)));
    box.hidden = !alts.length;
  };
  const uav = q('#a-uav');
  nin.addEventListener('input', () => {
    const raw = nin.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); if (raw !== nin.value) nin.value = raw;
    const ch = raw ? raw.charAt(0).toUpperCase() : '?';
    if (uav.textContent !== ch) { uav.textContent = ch; uav.classList.toggle('empty', !raw); uav.classList.remove('pulse'); void uav.offsetWidth; uav.classList.add('pulse'); }
    clearTimeout(A.timer); nbtn.disabled = true; q('#a-sugg').hidden = true; const my = ++A.seq;
    if (!raw) return setName('', 'De 3 a 20 letras, números o guion bajo.');
    if (raw.length < 3) return setName('', 'Necesita al menos 3 caracteres.');
    if (RESERVED.includes(raw)) return setName('✕', 'Ese nombre está reservado. Elegí otro.', 'bad');
    setName('<span class="a-spin"></span>', 'Verificando disponibilidad…');
    A.timer = setTimeout(async () => {
      try {
        const free = await store.usernameFree(raw); if (my !== A.seq) return;
        if (free) { setName('✓', '¡@' + raw + ' está disponible!', 'ok'); nbtn.disabled = false; }
        else { setName('✕', '@' + raw + ' ya está en uso. Probá con otro:', 'bad'); suggest(raw); }
      } catch (_) { if (my === A.seq) setName('', 'No pudimos verificarlo ahora. Probá de nuevo en un momento.', 'bad'); }
    }, 450);
  });
  nin.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !nbtn.disabled) nbtn.click(); });
  nbtn.addEventListener('click', async () => {
    const name = nin.value; if (!name || !S.user) return;
    nbtn.disabled = true; nbtn.textContent = 'Guardando…';
    try { await store.claimUsername(S.user, name); S.user = { ...S.user, name, needsName: false }; route(); }
    catch (err) {
      nbtn.textContent = 'Continuar';
      if (err && err.code === 'permission-denied') { setName('✕', '@' + name + ' ya está en uso. Probá con otro:', 'bad'); suggest(name); }
      else { setName('', 'No se pudo guardar. Probá de nuevo.', 'bad'); nbtn.disabled = false; }
    }
  });
  document.body.classList.add('noscroll'); document.body.append(el);
}
function openAuth(want) {
  if (!A.el) { buildAuth(); setScreen(want); return; }
  if (want === 'name' ? A.screen !== 'name' : A.screen === 'name') setScreen(want);
}
function closeAuth() { if (!A.el) return; A.el.remove(); A.el = null; document.body.classList.remove('noscroll'); }

/* ---------- inicio ---------- */
function wave(seed) {
  let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  const bars = [];
  for (let i = 0; i < 28; i++) { x = (x * 1103515245 + 12345) >>> 0; bars.push(h('span', { vars: { '--h': 25 + (x % 76), '--i': i } })); }
  return h('div', { class: 'wave', 'aria-hidden': 'true' }, bars);
}
function leaveForum() { if (S.off) { S.off(); S.off = null; } if (F.off) { F.off(); F.off = null; } S.slug = null; S.data = null; }
function buildHome() {
  leaveForum();
  if (S.today.moods.length && !S.recs) { S.picked = new Set(S.today.moods); S.recs = recommend([...S.picked], '', S.premium ? PREMIUM_RECS : FREE_RECS); S.recNote = TODAY_NOTE; }
  const chips = MOODS.map((m) => h('button', { class: 'chip mood', type: 'button', vars: { '--mc': moodColor(m) }, 'aria-pressed': String(S.picked.has(m)),
    onclick: (e) => { S.picked.has(m) ? S.picked.delete(m) : S.picked.add(m); e.currentTarget.setAttribute('aria-pressed', String(S.picked.has(m))); } }, moodLabel(m)));
  const ta = h('textarea', { id: 'feel', maxlength: '300', placeholder: 'Ej: Terminé un examen difícil y quiero algo para celebrar. Me gusta el rock en español.' });
  ta.value = S.text; ta.addEventListener('input', () => { S.text = ta.value; });
  const sq = h('input', { type: 'text', id: 'sq', maxlength: '80', placeholder: 'Ej: Gustavo Cerati Crimen' });
  const ui = S.ui = { results: h('div'), trend: h('div'), sres: h('div', { class: 'sresults' }) };
  const go = h('button', { class: 'btn cta', type: 'button', onclick: () => { S.recs = recommend([...S.picked], S.text, S.premium ? PREMIUM_RECS : FREE_RECS); S.recNote = S.premium ? 'Elegidas según tu ánimo' : `Elegidas según tu ánimo · el plan Premium muestra hasta ${PREMIUM_RECS}`; renderResults(true); ui.results.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Recomendarme canciones');
  const sgo = h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
    const term = sq.value.trim(); if (term.length < 2) return;
    ui.sres.replaceChildren(h('span', { class: 'hint' }, 'Buscando…'));
    try {
      const rows = await music.itunesSearch(term);
      S.recs = rows.map((r) => ({ title: r.title, artist: r.artist, genre: r.genre, cover: r.cover, moods: [] })); S.recNote = 'Resultados de tu búsqueda';
      ui.sres.replaceChildren(S.recs.length ? '' : h('span', { class: 'hint' }, 'Sin resultados.')); renderResults(true);
      if (S.recs.length) ui.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) { ui.sres.replaceChildren(h('span', { class: 'hint' }, 'No se pudo buscar ahora.')); }
  } }, 'Buscar');
  sq.addEventListener('keydown', (e) => { if (e.key === 'Enter') sgo.click(); });
  view.replaceChildren(
    '',
    S.spotifyMsg && h('div', { class: 'notice', role: 'status' }, S.spotifyMsg),
    todayStrip(), S.today.moods.length ? ui.results : '',
    h('div', { class: 'picker' },
      h('fieldset', {}, h('legend', {}, '¿Cómo te sentís?'), h('div', { class: 'chips' }, chips)),
      h('div', {}, h('label', { class: 'lbl', for: 'feel' }, 'O contalo con tus palabras'), ta),
      h('div', { class: 'row' }, go),
      h('div', {}, h('label', { class: 'lbl', for: 'sq' }, 'O buscá cualquier canción o artista'), h('div', { class: 'search' }, sq, sgo), ui.sres)),
    S.today.moods.length ? '' : ui.results,
    adBox(),
    h('div', { class: 'section-title' }, h('h2', {}, 'Foros recientes')), ui.trend);
  S.spotifyMsg = '';
  renderResults();
  ui.trend.replaceChildren(h('div', { class: 'empty' }, 'Cargando foros…'));
  if (S.offRecent) S.offRecent();
  S.offRecent = store.watchRecentForums((forums) => {
    if (S.slug || !S.ui.trend) return;
    if (!forums.length) return S.ui.trend.replaceChildren(h('div', { class: 'empty' }, 'Todavía no hay foros. Pedí una recomendación y entrá a una canción para abrir el primero.'));
    S.ui.trend.className = 'trend';
    S.ui.trend.replaceChildren(...forums.map((f) => h('button', { type: 'button', onclick: () => { location.hash = 'foro-' + f.slug; } },
      h('span', {}, h('b', {}, f.title), h('br'), h('small', {}, f.artist)), h('small', {}, ago(f.createdAt)))));
  }, () => S.ui.trend && S.ui.trend.replaceChildren(h('div', { class: 'empty' }, 'No se pudieron cargar los foros.')));
}
function adBox() {
  return h('div', { class: 'ad', hidden: S.premium, role: 'complementary', 'aria-label': 'Anuncio' },
    h('span', {}, h('b', {}, 'Anuncio'), ' · Espacio publicitario del plan gratuito.'), h('span', {}, 'Con Premium no ves anuncios.'));
}
function renderFavs() {
  if (S.ui && S.ui.fbody) { renderFavsPage(); return; }
  const box = S.ui && S.ui.favs; if (!box) return;
  if (!S.premium || !S.favs.length) { box.replaceChildren(); return; }
  box.replaceChildren(h('div', { class: 'section-title' }, h('h2', {}, 'Mis favoritos'), h('span', { class: 'source' }, 'Plan Premium')),
    h('div', { class: 'trend' }, S.favs.map((f) => h('button', { type: 'button', onclick: () => { location.hash = 'foro-' + f.slug; } },
      h('span', {}, h('b', {}, f.title), h('br'), h('small', {}, f.artist)), h('small', {}, 'Abrir foro')))));
}
function favBtn(t) {
  const isFav = S.favs.some((f) => f.slug === t.slug), heart = ico('heart');
  const lab = h('span', {}, isFav ? 'En favoritos' : S.premium || !S.user ? 'Guardar en favoritos' : 'Favoritos (Premium)');
  const b = h('button', { class: 'fav', type: 'button', 'aria-pressed': String(isFav), disabled: !S.user || !S.premium,
    title: !S.user ? 'Iniciá sesión' : S.premium ? null : 'Los favoritos son parte del plan Premium' }, heart, lab);
  b.addEventListener('click', async () => {
    b.disabled = true; b.setAttribute('aria-pressed', String(!isFav)); lab.textContent = isFav ? 'Guardar en favoritos' : 'En favoritos';
    if (!isFav) fx.burst(heart);
    try { await store.toggleFavorite(S.user.uid, t, isFav); }
    catch (e) { setNotice(errMsg(e), true); b.disabled = false; b.setAttribute('aria-pressed', String(isFav)); lab.textContent = isFav ? 'En favoritos' : 'Guardar en favoritos'; }
  });
  return b;
}
function renderPlan() {
  paintAccount();
  document.querySelectorAll('.ad').forEach((a) => { a.hidden = S.premium; });
  if (S.recNote === TODAY_NOTE && S.ui && S.ui.results && S.recs && S.recs.length !== (S.premium ? PREMIUM_RECS : FREE_RECS)) { S.recs = recommend([...S.picked], '', S.premium ? PREMIUM_RECS : FREE_RECS); renderResults(); }
  renderFavs();
  if (S.ui && S.ui.favBox && S.data && S.data.forum) S.ui.favBox.replaceChildren(favBtn(S.data.forum));
  if (S.data && S.ui && S.ui.list) renderForum();
}
function watchAccount(uid) {
  if (S.offPlan) { S.offPlan(); S.offPlan = null; } if (S.offFavs) { S.offFavs(); S.offFavs = null; }
  if (S.offFol) { S.offFol(); S.offFol = null; } if (S.offMe) { S.offMe(); S.offMe = null; }
  S.premium = false; S.favs = []; S.following = new Set(); S.me = null;
  if (!uid) return;
  S.offFol = store.watchFollowing(uid, (set) => { S.following = set; PF.rerender(); });
  S.offMe = store.watchProfile(uid, (p) => { S.me = p; paintAccount(); });
  S.offPlan = store.watchPlan(uid, (p) => { S.premium = p; renderPlan(); });
  S.offFavs = store.watchFavorites(uid, (f) => { S.favs = f; renderPlan(); });
}
function coverBox(r) {
  const box = h('div', { class: 'rc-cover', 'aria-hidden': 'true', vars: { '--a': hue(r.title + r.artist) } }, h('b', {}, (r.title || '?').trim().charAt(0).toUpperCase()));
  const set = (u) => {
    if (!u) return;
    const im = h('img', { src: u, alt: '', referrerpolicy: 'no-referrer', onload: () => box.classList.add('ok'), onerror: () => im.remove() });
    box.append(im);
  };
  if (r.cover) set(String(r.cover).replace('600x600', '300x300')); else music.coverFor(r.title, r.artist).then((u) => set(u && String(u).replace('600x600', '300x300')));
  return box;
}
function renderResults(anim) {
  const box = S.ui.results; if (!box) return;
  if (!S.recs || !S.recs.length) { box.replaceChildren(); return; }
  box.replaceChildren(
    h('div', { class: 'section-title' }, h('h2', {}, S.recNote === TODAY_NOTE ? 'Para tu ánimo hoy' : 'Para vos'), h('span', { class: 'source' }, S.recNote)),
    h('div', { class: 'grid' }, S.recs.map((r, ri) => h('button', { class: 'card', type: 'button', onclick: () => openTrack(r) },
      playBtn(r, ri), // player:
      h('div', { class: 'rc-top' }, coverBox(r), h('div', { class: 'rc-txt' }, h('h3', {}, r.title), h('div', { class: 'by' }, [r.artist, r.genre].filter(Boolean).join(' · ')))),
      wave(slugify(r.artist, r.title)),
      h('div', { class: 'tags' }, (r.moods || []).map((m) => h('span', { class: 'tag' }, moodLabel(m)))),
      r.reason && h('div', { class: 'why' }, r.reason),
      h('div', { class: 'foot' }, h('span', { class: 'stat' }, 'Foro de la canción'), h('span', { class: 'go' }, 'Entrar al foro →'))))));
  if (anim) fx.stagger(box, '.grid > *');
}
function playBtn(r, i) { // player:
  const b = h('span', { class: 'rc-play', role: 'button', tabindex: '0', 'aria-label': 'Escuchar ' + r.title });
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const go = (e) => { e.stopPropagation(); e.preventDefault(); Player.playList(S.recs, i); };
  b.addEventListener('click', go); b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') go(e); });
  return b;
}
async function openTrack(r) {
  const slug = slugify(r.artist, r.title);
  if (S.user) {
    try { await store.ensureForum(S.user, { slug, title: r.title.slice(0, 80), artist: r.artist.slice(0, 60), genre: (r.genre || '').slice(0, 40), moods: (r.moods || []).slice(0, 4) }); }
    catch (e) { S.ui.sres && S.ui.sres.replaceChildren(h('span', { class: 'hint' }, errMsg(e))); return; }
  }
  location.hash = 'foro-' + slug;
}

/* ---------- foro ---------- */
function buildForum(slug) {
  leaveForum(); if (S.offRecent) { S.offRecent(); S.offRecent = null; }
  S.slug = slug; S.cat = 'todo'; S.threadId = null; S.data = null; S.ui = {};
  view.replaceChildren(h('a', { class: 'back', href: '#inicio' }, ico('back'), 'Volver a las recomendaciones'), h('p', { class: 'hint' }, 'Abriendo el foro…'));
  S.off = store.watchForum(slug, (d) => { if (S.slug !== slug) return; S.data = d; onForumData(); },
    () => { view.replaceChildren(h('a', { class: 'back', href: '#inicio' }, ico('back'), 'Volver'), h('div', { class: 'notice err', role: 'alert' }, 'No se pudo abrir el foro.')); });
}
function onForumData() {
  const d = S.data;
  if (!d.forum) {
    view.replaceChildren(h('a', { class: 'back', href: '#inicio' }, ico('back'), 'Volver'),
      h('div', { class: 'notice' }, S.user ? 'Este foro todavía no existe. Volvé al inicio y entrá desde una canción para abrirlo.' : 'Este foro todavía no existe. Iniciá sesión para abrirlo.'));
    S.ui = {}; return;
  }
  if (!S.ui.list) buildForumShell();
  renderForum();
}
function buildForumShell() {
  const t = S.data.forum, ui = S.ui = {};
  ui.notice = h('div', { role: 'status', hidden: true });
  ui.stat = h('div', { class: 'meta' }); ui.cats = h('div', { class: 'cats', role: 'group', 'aria-label': 'Filtrar hilos' });
  ui.list = h('div', { class: 'threads' }); ui.detail = h('div', { class: 'panel' }); ui.newBox = h('div'); ui.aside = h('aside', { 'aria-label': 'Reproductor' }); ui.favBox = h('div');
  view.replaceChildren(
    h('a', { class: 'back', href: '#inicio' }, ico('back'), 'Volver a las recomendaciones'),
    h('div', { class: 'forum' }, h('div', { class: 'main' },
      h('header', { class: 'fhead' }, h('div', { class: 'eyebrow' }, 'Foro de la canción'), h('h1', {}, t.title),
        h('div', { class: 'by' }, [t.artist, t.genre].filter(Boolean).join(' · ')),
        h('div', { class: 'tags' }, (t.moods || []).map((m) => h('span', { class: 'tag' }, moodLabel(m)))), ui.stat),
      ui.notice, ui.favBox, adBox(),
      h('div', { class: 'room' }, h('div', {}, ui.cats, ui.newBox, ui.list), ui.detail)), ui.aside));
  setNotice(S.user ? '' : 'Estás en modo visita: podés leer, pero para publicar o dar me gusta tenés que iniciar sesión.');
  ui.favBox.replaceChildren(favBtn(t));
  buildNewThread(); renderCats(); loadPlayer(S.slug, t);
}
function setNotice(msg, err) { const n = S.ui.notice; if (!n) return; n.textContent = msg || ''; n.hidden = !msg; n.className = 'notice' + (err ? ' err' : ''); }
const forumRepostable = (th) => ({ ...th, slug: S.slug, ftitle: S.data.forum.title, fartist: S.data.forum.artist });
function threadsView() {
  const { forum, threads, posts, likes } = S.data;
  const all = [...seedThreads(forum, forum.createdAt), ...threads];
  return all.map((t) => {
    const ps = posts.filter((p) => p.threadId === t.id);
    return { ...t, replies: ps.length, likes: likes.filter((l) => l.targetId === t.id).length, reposters: (S.data.reposts || []).filter((r) => r.threadId === t.id).map((r) => r.uid),
      last: Math.max(t.createdAt, ...ps.map((p) => p.createdAt)) };
  }).sort((a, b) => b.last - a.last);
}
function renderForum() {
  const list = threadsView(), msgs = S.data.posts.length;
  S.ui.stat.textContent = `${list.length} hilos · ${msgs} mensajes`;
  renderThreads(list); renderDetail(list);
  const open = S.ui.newBox.querySelector('button'); if (open) open.disabled = !S.user;
}
function buildNewThread() {
  const open = h('button', { class: 'btn cta wide', type: 'button', disabled: !S.user }, h('span', { class: 'plus', 'aria-hidden': 'true' }, '+'), 'Abrir un hilo nuevo');
  const sel = h('select', { id: 'nt-cat' }, Object.entries(CATS).map(([k, v]) => h('option', { value: k }, v)));
  const title = h('input', { type: 'text', id: 'nt-title', maxlength: '120', placeholder: 'Título del hilo' });
  const body = h('textarea', { id: 'nt-body', maxlength: '1500', placeholder: 'Tu opinión, análisis o pregunta' });
  const send = h('button', { class: 'btn cta small', type: 'button' }, 'Publicar hilo');
  const form = h('div', { class: 'compose', hidden: true },
    h('label', { for: 'nt-cat' }, 'Categoría'), sel, h('label', { for: 'nt-title' }, 'Título'), title, h('label', { for: 'nt-body' }, 'Mensaje'), body,
    h('div', { class: 'row' }, send, h('button', { class: 'btn ghost small', type: 'button', onclick: () => { form.hidden = true; open.hidden = false; } }, 'Cancelar')));
  open.addEventListener('click', () => { form.hidden = false; open.hidden = true; title.focus(); });
  send.addEventListener('click', async () => {
    const ti = title.value.trim(), bo = body.value.trim();
    if (ti.length < 3 || !bo) return setNotice('Escribí un título de al menos 3 letras y un mensaje.', true);
    send.disabled = true;
    try {
      const ref = await store.addThread(S.user, S.slug, sel.value, ti, bo, S.premium, S.data.forum);
      title.value = ''; body.value = ''; form.hidden = true; open.hidden = false; setNotice(''); S.cat = 'todo'; renderCats(); S.threadId = ref.id; S.ui.thread = null; renderForum();
    } catch (e) { setNotice(errMsg(e), true); } finally { send.disabled = false; }
  });
  S.ui.newBox.replaceChildren(open, form);
}
function renderCats() {
  S.ui.cats.replaceChildren(...[['todo', 'Todo'], ...Object.entries(CATS)].map(([k, v]) =>
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.cat === k), onclick: () => { S.cat = k; renderCats(); renderThreads(threadsView()); } }, v)));
}
function renderThreads(list) {
  const shown = list.filter((t) => S.cat === 'todo' || t.category === S.cat);
  S.ui.list.replaceChildren(...(shown.length ? shown.map((t) => h('button', { class: 'thread', type: 'button', 'data-cat': t.category, 'aria-current': String(t.id === S.threadId),
    onclick: () => { S.threadId = t.id; S.ui.thread = null; renderForum(); if (window.innerWidth <= 760) S.ui.detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
    h('b', {}, t.title), h('small', {}, `${CATS[t.category] || 'Debate'} · ${t.author} · ${t.replies} resp. · ${t.likes} me gusta`))) : [h('div', { class: 'empty' }, 'No hay hilos en esta categoría todavía.')]));
}
function likeBtn(targetId) {
  const likes = S.data.likes.filter((l) => l.targetId === targetId), mine = !!S.user && likes.some((l) => l.uid === S.user.uid);
  const hs = ico('heart');
  const b = h('button', { class: 'like', type: 'button', 'aria-pressed': String(mine), disabled: !S.user, title: S.user ? null : 'Iniciá sesión para dar me gusta' }, hs, h('span', {}, `Me gusta · ${likes.length}`));
  b.addEventListener('click', async () => {
    b.disabled = true; b.setAttribute('aria-pressed', String(!mine)); b.classList.add('pop'); if (!mine) fx.burst(hs);
    try { await store.toggleLike(S.user, S.slug, targetId, mine); } catch (e) { setNotice(errMsg(e), true); b.disabled = false; b.setAttribute('aria-pressed', String(mine)); }
  });
  return b;
}
function renderDetail(list) {
  const { ui } = S, th = S.threadId && list.find((x) => x.id === S.threadId);
  if (!th) { ui.thread = null; ui.detail.replaceChildren(h('h2', {}, 'Elegí un hilo'), h('p', { class: 'hint' }, 'Leé lo que dice la comunidad y sumá tu opinión sobre la canción.')); return; }
  if (!ui.thread || ui.thread.id !== th.id) {
    const ta = h('textarea', { id: 'reply', maxlength: '1500', placeholder: S.user ? 'Escribí tu respuesta' : 'Iniciá sesión para responder', disabled: !S.user });
    const btn = h('button', { class: 'btn cta small', type: 'button', disabled: !S.user }, 'Responder');
    btn.addEventListener('click', async () => {
      const v = ta.value.trim(); if (!v) return;
      btn.disabled = true;
      try { await store.addPost(S.user, S.slug, th.id, v, S.premium); ta.value = ''; setNotice(''); } catch (e) { setNotice(errMsg(e), true); } finally { btn.disabled = !S.user; }
    });
    ui.thread = { id: th.id, head: h('div'), posts: h('div', { class: 'posts' }) };
    ui.detail.replaceChildren(ui.thread.head, ui.thread.posts, h('div', { class: 'form' }, h('label', { class: 'hint', for: 'reply' }, 'Tu respuesta'), ta, h('div', { class: 'row' }, btn)));
  }
  ui.thread.head.replaceChildren(
    h('div', { class: 'meta' }, h('span', {}, CATS[th.category] || 'Debate'), '·', authorLink(th.uid, th.author, 'plain'), th.premium && h('span', { class: 'badge' }, 'Premium'), '·', h('span', {}, ago(th.createdAt))),
    h('h2', {}, th.title), h('div', { class: 'body' }, th.body), h('div', { class: 'acts' }, likeBtn(th.id), repostBtn(forumRepostable(th))));
  const posts = S.data.posts.filter((p) => p.threadId === th.id);
  ui.thread.posts.replaceChildren(...(posts.length ? posts.map((p) => h('div', { class: 'post' },
    h('div', { class: 'meta' }, authorLink(p.uid, p.author), p.premium && h('span', { class: 'badge' }, 'Premium'), '·', h('span', {}, ago(p.createdAt))), h('div', { class: 'body' }, p.body), likeBtn(p.id)))
    : [h('p', { class: 'hint' }, 'Todavía nadie respondió. Podés abrir la charla.')]));
}

/* ---------- portada y reproductor ---------- */
// Si un nombre es más ancho que la tarjeta, se desliza de lado a lado (y se desvanece en los bordes).
function fitNames(root) {
  root.querySelectorAll('.mq').forEach((el) => {
    const s = el.firstElementChild, d = s ? s.scrollWidth - el.clientWidth : 0;
    el.classList.toggle('scroll', d > 2);
    if (d > 2) { el.style.setProperty('--d', d + 'px'); el.style.setProperty('--t', Math.max(6, d / 20 + 4) + 's'); }
  });
}
window.addEventListener('resize', () => fitNames(document)); async function loadPlayer(slug, t) {
  const aside = S.ui.aside;
  const paint = (kids) => { if (S.slug === slug && S.ui.aside === aside) { aside.replaceChildren(h('div', { class: 'player' }, kids)); requestAnimationFrame(() => fitNames(aside)); if (document.fonts) document.fonts.ready.then(() => fitNames(aside)); } };
  const head = (cover) => [h('div', { class: 'cover' }, cover ? h('img', { src: cover, alt: `Portada de ${t.title}`, referrerpolicy: 'no-referrer' }) : t.title.trim().charAt(0).toUpperCase()),
    h('div', { class: 'names' }, h('div', { class: 'tt mq' }, h('span', {}, t.title)), h('div', { class: 'sm mq' }, h('span', {}, t.artist)))];
  paint([...head(null), h('div', { class: 'sm', role: 'status' }, 'Buscando la canción…')]);
  const early = music.coverFor(t.title, t.artist);
  early.then((u) => { const c = aside.querySelector('.cover'); if (u && c && !c.querySelector('img')) c.replaceChildren(h('img', { src: u, alt: 'Portada de ' + t.title, referrerpolicy: 'no-referrer' })); });
  const p = await music.playback(t.title, t.artist);
  const kids = head(p.cover || await early);
  if (p.kind === 'spotify' && /^[A-Za-z0-9]{22}$/.test(p.spotifyId)) {
    kids.push(h('iframe', { src: `https://open.spotify.com/embed/track/${p.spotifyId}?utm_source=generator&theme=0`, height: '152', title: 'Reproductor de Spotify', allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture', loading: 'lazy' }),
      h('div', { class: 'sm' }, p.premium ? 'Spotify Premium: canción completa.' : 'Cuenta gratuita de Spotify: puede sonar solo un fragmento.'));
  } else if (p.kind === 'youtube' && /^[\w-]{11}$/.test(p.youtubeId)) {
    kids.push(h('iframe', { class: 'yt', src: `https://www.youtube-nocookie.com/embed/${p.youtubeId}?autoplay=${Player.active() ? 0 : 1}&rel=0`, title: 'Reproductor de YouTube', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen' }),
      h('div', { class: 'sm' }, 'Reproducción completa con YouTube.'));
  } else if (p.kind === 'preview' && p.preview) {
    const au = h('audio', { controls: true, preload: 'auto', src: p.preview, 'aria-label': `Fragmento de ${t.title}` });
    kids.push(au, h('div', { class: 'sm' }, 'Fragmento de 30 s.' + (music.spotifyAvailable() && !music.spotifyConnected() ? ' Conectá Spotify para escucharla completa.' : '')));
    if (!Player.active()) au.play().catch(() => {});
  } else kids.push(h('div', { class: 'sm' }, 'No encontramos una muestra de esta canción.'));
  if (p.link) kids.push(h('a', { class: 'ext', href: p.link, target: '_blank', rel: 'noopener noreferrer' }, 'Escuchar en Apple Music ↗'));
  paint(kids);
}

/* ---------- navegación, foros (feed) y favoritos ---------- */
const MOOD_COLOR = { feliz: '#ffd166', triste: '#6c8cff', energico: '#ff7a45', relajado: '#4fe3b1', nostalgico: '#c79bff', romantico: '#ff5fa2', motivado: '#2be3f2', intenso: '#ff4d6d', reflexivo: '#9fb3c8' };
const F = { off: null, forums: [], threads: [], tab: 'recientes', song: null, ready: false };
function moodColor(m) { return MOOD_COLOR[moodLabel(m).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] || '#7c5cff'; }
function hue(seed) { let x = 0; for (const c of String(seed)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; }
const NAV_ORDER = ['foros', 'inicio', 'favoritos'];
const NAV_ICON = { foros: '<svg class="ic" viewBox="0 0 32 32" aria-hidden="true"><path class="ln" d="M5 7.5A3.5 3.5 0 0 1 8.5 4h15A3.5 3.5 0 0 1 27 7.5v9a3.5 3.5 0 0 1-3.5 3.5H15l-5.2 4.4a.6.6 0 0 1-1-.46V20h-.3A3.5 3.5 0 0 1 5 16.5z"/><circle class="dot" cx="11" cy="12" r="1.5"/><circle class="dot" cx="16" cy="12" r="1.5"/><circle class="dot" cx="21" cy="12" r="1.5"/><path class="ln" d="M21 23.2h2.2l3.6 3.1V23.2H27a3 3 0 0 0 3-3v-5" opacity=".55"/></svg>', inicio: '<svg class="ic lupa" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mrim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eafcff"/><stop offset=".3" stop-color="#2be3f2"/><stop offset=".68" stop-color="#7c5cff"/><stop offset="1" stop-color="#ff3d9a"/></linearGradient><linearGradient id="mhan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f70b8"/><stop offset=".45" stop-color="#cbbff5"/><stop offset="1" stop-color="#2f2552"/></linearGradient><linearGradient id="mcol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5f1ff"/><stop offset=".5" stop-color="#9a8bd6"/><stop offset="1" stop-color="#3a2f66"/></linearGradient><radialGradient id="mgl" cx=".32" cy=".28" r=".95"><stop offset="0" stop-color="#d6fbff" stop-opacity=".6"/><stop offset=".55" stop-color="#5aa8ff" stop-opacity=".16"/><stop offset="1" stop-color="#7c5cff" stop-opacity=".26"/></radialGradient><clipPath id="mclip"><circle cx="26" cy="26" r="15.2"/></clipPath></defs><ellipse cx="33" cy="58" rx="17" ry="2.6" fill="#000" opacity=".28"/><g transform="rotate(45 26 26)"><rect x="43.5" y="21.5" width="7" height="13" rx="2.2" transform="translate(0 -1.5)" fill="url(#mcol)"/><rect x="49.5" y="23" width="14" height="10" rx="4.5" transform="translate(-1 -1)" fill="url(#mhan)"/><g stroke="#1d1538" stroke-width="1.1" opacity=".55" stroke-linecap="round"><path d="M54 24.2v7.6M57 24.2v7.6M60 24.2v7.6"/></g><path d="M51 24.4h10" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round"/></g><circle cx="26" cy="26" r="15.2" fill="url(#mgl)"/><g clip-path="url(#mclip)"><g transform="rotate(24 26 26)"><rect class="sweep" x="-6" y="0" width="9" height="56" fill="#fff" opacity=".55"/></g></g><circle cx="26" cy="26" r="18" fill="none" stroke="url(#mrim)" stroke-width="4.6"/><circle cx="26" cy="26" r="15.2" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width=".9"/><circle cx="26" cy="26" r="20.4" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width=".8"/><path d="M14.2 22.6A12.6 12.6 0 0 1 22 14.3" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2.4" stroke-linecap="round"/><circle cx="17.6" cy="17.2" r="1.3" fill="#fff"/><path d="M36.4 33.6a12.6 12.6 0 0 1-3.2 3.7" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/></svg>', favoritos: '<svg class="ic" viewBox="0 0 32 32" aria-hidden="true"><path class="ln heart-s" d="M16 27.2S4.5 20.4 4.5 12.2A6.2 6.2 0 0 1 16 8.9a6.2 6.2 0 0 1 11.5 3.3C27.5 20.4 16 27.2 16 27.2z"/></svg>' };
const NAV_LABEL = { foros: 'Foros', inicio: 'Descubrir', favoritos: 'Favoritos' };
function paintNav(hash) {
  const cur = hash === 'foros' || /^foro-/.test(hash) || /^perfil-/.test(hash) ? 'foros' : hash === 'favoritos' ? 'favoritos' : 'inicio';
  const nav = $('#nav'), i = NAV_ORDER.indexOf(cur);
  if (!nav.querySelector('.bub')) {
    nav.style.setProperty('--i', i); nav.dataset.i = String(i);
    nav.replaceChildren(h('span', { class: 'bub', 'aria-hidden': 'true' }), ...NAV_ORDER.map((k) => {
      const a = h('a', { class: 'ni' + (k === 'inicio' ? ' mid' : ''), href: '#' + k, 'aria-label': NAV_LABEL[k], 'data-k': k }, h('span', {}, NAV_LABEL[k]));
      a.insertAdjacentHTML('afterbegin', NAV_ICON[k]); return a;
    }));
  } else if (nav.dataset.i !== String(i)) {
    nav.dataset.i = String(i); nav.style.setProperty('--i', i);
    const bub = nav.querySelector('.bub'); bub.classList.remove('jelly'); void bub.offsetWidth; bub.classList.add('jelly');
  }
  nav.querySelectorAll('.ni').forEach((a) => { if (a.dataset.k === cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
function tweet(t) {
  const same = !t.body || t.body.indexOf(t.title) === 0;
  const av = h('span', { class: 'av-pic', 'aria-hidden': 'true', 'data-uid': t.uid || null, vars: { '--s': '44px', '--a': hue(t.uid || t.author) } }, h('b', {}, (t.author || '?').charAt(0).toUpperCase()));
  return h('article', { class: 'tw' },
    t.uid ? h('a', { class: 'tw-av', href: '#perfil-' + t.uid, 'aria-label': 'Perfil de ' + t.author }, av) : av,
    h('div', { class: 'tw-main' },
      t.repostBy && h('div', { class: 'tw-rp' }, ico('repost'), t.repostUid === (S.user && S.user.uid) ? 'Reposteaste' : [h('a', { href: '#perfil-' + t.repostUid }, t.repostBy), ' reposteó']),
      h('div', { class: 'tw-head' }, authorLink(t.uid, t.author), t.premium && h('span', { class: 'badge' }, 'Premium'),
        h('a', { class: 'songchip', href: '#foro-' + t.slug, title: 'Ir al foro de ' + t.ftitle }, '♪ ' + t.ftitle, h('span', {}, ' · ' + t.fartist)),
        h('span', { class: 'when' }, ago(t.createdAt))),
      h('div', { class: 'tw-body' }, same ? (t.body || t.title) : [h('b', { class: 'tw-title' }, t.title), h('br'), t.body]),
      h('div', { class: 'tags' }, h('span', { class: 'tag' }, CATS[t.category] || 'Debate'), (t.fmoods || []).slice(0, 2).map((m) => h('span', { class: 'tag' }, moodLabel(m)))),
      h('div', { class: 'tw-acts' }, repostBtn(t))));
}
function renderFeed() {
  const ui = S.ui; if (!ui || !ui.feed) return;
  ui.tabs.replaceChildren(...[['recientes', 'Recientes'], ['animo', 'Mi ánimo'], ['mias', 'Mis canciones']].map(([k, v]) =>
    h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(F.tab === k), onclick: () => { F.tab = k; renderFeed(); } }, v)));
  let list = F.threads, note = '';
  if (F.tab === 'animo') { if (!S.picked.size) note = 'Elegí tus ánimos en Descubrir para ver hilos que combinan con vos.'; else list = list.filter((t) => (t.fmoods || []).some((m) => S.picked.has(m))); }
  if (F.tab === 'mias') { const own = new Set(S.favs.map((f) => f.slug)); list = list.filter((t) => own.has(t.slug) || (S.user && t.uid === S.user.uid)); }
  ui.feed.replaceChildren(...(note ? [h('div', { class: 'empty' }, note)] : list.length ? list.map(tweet)
    : [h('div', { class: 'empty' }, F.ready ? 'Todavía no hay hilos acá. Elegí una canción y abrí la charla.' : 'Cargando hilos…')]));
  PF.fillAvatars(ui.feed);
  ui.side.replaceChildren(...(F.forums.length ? F.forums.slice(0, 6).map((f) => h('a', { class: 'sidesong', href: '#foro-' + f.slug }, h('b', {}, f.title), h('small', {}, f.artist)))
    : [h('span', { class: 'hint' }, 'Sin foros todavía.')]));
  ui.quick.replaceChildren(...F.forums.slice(0, 6).map((f) => h('button', { class: 'sr-item', type: 'button',
    onclick: () => ui.setSong({ title: f.title, artist: f.artist, genre: f.genre || '', moods: f.moods || [], slug: f.slug }) }, h('b', {}, f.title), ' · ', f.artist)));
}
function buildFeed() {
  leaveForum(); if (S.offRecent) { S.offRecent(); S.offRecent = null; }
  F.song = null; F.threads = []; F.forums = []; F.ready = false;
  const ui = S.ui = { feed: h('div', { class: 'tweets' }), side: h('div', { class: 'songs' }), tabs: h('div', { class: 'tabs', role: 'tablist' }), pick: h('div', { class: 'pickbox', hidden: true }), chip: h('div'), quick: h('div', { class: 'sresults' }) };
  const ta = h('textarea', { id: 'fx', maxlength: '600', placeholder: S.user ? '¿Qué estás escuchando? Contale a la comunidad.' : 'Iniciá sesión para publicar', disabled: !S.user });
  const msg = h('div', { role: 'status', class: 'hint' });
  const sq = h('input', { type: 'text', maxlength: '80', placeholder: 'Buscá una canción o artista', 'aria-label': 'Buscar canción' });
  const sres = h('div', { class: 'sresults' });
  const setSong = (s) => {
    F.song = s; ui.pick.hidden = true;
    ui.chip.replaceChildren(s ? h('span', { class: 'songchip' }, '♪ ' + s.title, h('span', {}, ' · ' + s.artist), h('button', { class: 'x', type: 'button', 'aria-label': 'Quitar canción', onclick: () => setSong(null) }, '×')) : '');
  };
  ui.setSong = setSong;
  const find = async () => {
    const term = sq.value.trim(); if (term.length < 2) return;
    sres.replaceChildren(h('span', { class: 'hint' }, 'Buscando…'));
    try {
      const rows = await music.itunesSearch(term);
      sres.replaceChildren(...(rows.length ? rows.slice(0, 6).map((r) => h('button', { class: 'sr-item', type: 'button',
        onclick: () => setSong({ title: r.title, artist: r.artist, genre: r.genre || '', moods: [], slug: slugify(r.artist, r.title) }) }, h('b', {}, r.title), ' · ', r.artist)) : [h('span', { class: 'hint' }, 'Sin resultados.')]));
    } catch (_) { sres.replaceChildren(h('span', { class: 'hint' }, 'No se pudo buscar ahora.')); }
  };
  sq.addEventListener('keydown', (e) => { if (e.key === 'Enter') find(); });
  ui.pick.append(h('div', { class: 'search' }, sq, h('button', { class: 'btn ghost small', type: 'button', onclick: find }, 'Buscar')), sres, h('div', { class: 'hint' }, 'O elegí un foro reciente:'), ui.quick);
  const choose = h('button', { class: 'songbtn', type: 'button', disabled: !S.user, onclick: () => { ui.pick.hidden = !ui.pick.hidden; if (!ui.pick.hidden) sq.focus(); } }, '♪ Elegir canción');
  const send = h('button', { class: 'btn cta', type: 'button', disabled: !S.user }, 'Publicar');
  send.addEventListener('click', async () => {
    const text = ta.value.trim();
    if (text.length < 3) { msg.textContent = 'Escribí algo para publicar.'; return; }
    if (!F.song) { msg.textContent = 'Elegí la canción de la que querés hablar.'; return; }
    send.disabled = true; msg.textContent = '';
    try {
      const s = F.song;
      await store.ensureForum(S.user, { slug: s.slug, title: s.title.slice(0, 80), artist: s.artist.slice(0, 60), genre: (s.genre || '').slice(0, 40), moods: (s.moods || []).slice(0, 4) });
      await store.addThread(S.user, s.slug, 'debate', text.split('\n')[0].slice(0, 120), text, S.premium, { title: s.title, artist: s.artist });
      ta.value = ''; setSong(null);
    } catch (e) { msg.textContent = errMsg(e); } finally { send.disabled = !S.user; }
  });
  view.replaceChildren(h('div', { class: 'feedpage' },
    h('section', { class: 'feedcol' },
      h('div', { class: 'pagehead' }, h('h1', {}, 'Foros'), h('p', { class: 'lead' }, 'Lo que se dice sobre la música, en un solo lugar.')),
      ui.tabs,
      h('div', { class: 'compose-box' }, h('span', { class: 'av me', 'aria-hidden': 'true' }, S.user ? S.user.name.charAt(0).toUpperCase() : '?'),
        h('div', { class: 'cb-main' }, h('label', { class: 'sr', for: 'fx' }, 'Nuevo hilo'), ta, ui.chip, ui.pick, msg, h('div', { class: 'row cb-actions' }, choose, h('span', { class: 'grow' }), send))),
      ui.feed),
    h('aside', { class: 'sidecol', 'aria-label': 'Canciones en conversación' }, h('h2', {}, 'Canciones en conversación'), ui.side)));
  renderFeed();
  F.off = store.watchFeed((d) => { if (S.ui !== ui) return; F.forums = d.forums; F.threads = d.threads; F.ready = true; renderFeed(); },
    () => { if (S.ui === ui) { F.ready = true; ui.feed.replaceChildren(h('div', { class: 'empty' }, 'No se pudieron cargar los hilos.')); } });
}
function buildFavs() {
  leaveForum(); if (S.offRecent) { S.offRecent(); S.offRecent = null; }
  S.ui = { fbody: h('div') }; S.favMood = S.favMood || 'todas';
  view.replaceChildren(h('section', { class: 'pagehead' }, h('span', { class: 'eyebrow' }, 'Premium'), h('h1', {}, 'Tus favoritos'), h('p', { class: 'lead' }, 'Las canciones que guardaste, listas para volver a su foro.')), S.ui.fbody);
  renderFavsPage();
}
function bigCover(f) {
  const box = h('div', { class: 'big-cover', 'aria-hidden': 'true' }, h('span', {}, (f.title || '?').trim().charAt(0).toUpperCase()));
  music.coverFor(f.title, f.artist).then((u) => { if (u) box.append(h('img', { src: String(u), alt: '', referrerpolicy: 'no-referrer', onerror: (e) => e.target.remove() })); }).catch(() => {});
  return box;
}
function renderFavsPage() {
  const box = S.ui && S.ui.fbody; if (!box) return;
  if (!S.user) { box.replaceChildren(h('div', { class: 'empty' }, 'Iniciá sesión para guardar y ver tus favoritos.')); return; }
  if (!S.premium) { box.replaceChildren(h('div', { class: 'lock' }, h('span', { class: 'badge' }, 'Premium'), h('h2', {}, 'Los favoritos son parte del plan Premium'),
    h('p', {}, 'Guardá las canciones que más te gustan y volvé a sus foros cuando quieras. Además, sin anuncios y con más recomendaciones.'))); return; }
  if (!S.favs.length) { box.replaceChildren(h('div', { class: 'empty' }, 'Todavía no guardaste canciones. Tocá "Guardar en favoritos" dentro del foro de una canción.')); return; }
  const moods = [...new Set(S.favs.flatMap((f) => f.moods || []))];
  if (S.favMood !== 'todas' && !moods.includes(S.favMood)) S.favMood = 'todas';
  const shown = S.favs.filter((f) => S.favMood === 'todas' || (f.moods || []).includes(S.favMood));
  box.replaceChildren(
    h('div', { class: 'chips favfilter' }, [['todas', 'Todas'], ...moods.map((m) => [m, moodLabel(m)])].map(([k, v]) =>
      h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.favMood === k), onclick: () => { S.favMood = k; renderFavsPage(); } }, v))),
    h('div', { class: 'favgrid' }, shown.map((f) => {
      const card = h('article', { class: 'fv', vars: { '--a': hue(f.slug) } },
        h('div', { class: 'cov' }, bigCover(f),
          h('div', { class: 'cap' }, h('h3', {}, f.title), h('span', {}, [f.artist, f.genre].filter(Boolean).join(' · '))),
          h('button', { class: 'unfav', type: 'button', 'aria-label': 'Quitar ' + f.title + ' de favoritos', onclick: () => {
            card.classList.add('gone');
            setTimeout(() => store.toggleFavorite(S.user.uid, f, true).catch(() => card.classList.remove('gone')), 380);
          } }, ico('heart'))),
        h('div', { class: 'body' }, h('div', { class: 'tags' }, (f.moods || []).map((m) => h('span', { class: 'tag' }, moodLabel(m)))),
          h('a', { class: 'btn cta favgo', href: '#foro-' + f.slug }, 'Abrir foro →')));
      return card;
    })));
}

/* ---------- ánimo del día ---------- */
function todayStrip() {
  const t = S.today;
  return h('div', { class: 'todaybar' },
    t.moods.length ? [h('span', { class: 'hint' }, 'Hoy te sentís:'), ...t.moods.map((m) => h('span', { class: 'todaychip', vars: { '--mc': moodColor(m) } }, moodLabel(m))), h('button', { class: 'btn ghost small', type: 'button', onclick: openSplash }, 'Cambiar')]
      : [h('span', { class: 'hint' }, 'Todavía no elegiste tu ánimo de hoy.'), h('button', { class: 'btn small', type: 'button', onclick: openSplash }, 'Elegir ánimo')]);
}
function openSplash() {
  if ($('#splash')) return;
  const changing = !S.today.pending, pick = new Set(S.today.moods), N = MOODS.length, STEP = 360 / N;
  const reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const date = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  let rot = 0, W = 0, H = 0, R = 200, D = 84, cx = 0, cy = 0, focus = -1, anim = null, drag = null, wt = 0;
  const norm = (a) => { a %= 360; if (a > 180) a -= 360; if (a < -180) a += 360; return a; };

  const ov = h('div', { id: 'splash', class: 'wsplash', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tu ánimo de hoy' });
  const phone = h('div', { class: 'w-phone' }), aura = h('div', { class: 'w-aura', 'aria-hidden': 'true' });
  const wheel = h('div', { class: 'w-wheel' }), ring = h('div', { class: 'w-ring' }), glow = h('div', { class: 'w-glow' });
  const pointer = h('div', { class: 'w-pointer', 'aria-hidden': 'true' });
  wheel.append(glow, ring);
  const stage = h('div', { class: 'w-stage', 'aria-label': 'Ruleta de ánimos: arrastrá para girar, tocá para elegir' }, wheel, pointer);
  const nowEl = h('div', { class: 'w-now', 'aria-live': 'polite' });
  const tip = h('p', { class: 'w-tip' }, 'Girá la ruleta con el dedo.', h('br'), 'Tocá un ánimo para elegirlo.');
  const go = h('button', { class: 'btn big w-go', type: 'button' });
  const modeBtn = h('button', { class: 'w-chip', type: 'button', onclick: () => { const on = phone.classList.toggle('is-list'); modeBtn.textContent = on ? 'Ver ruleta' : 'Ver lista'; } }, 'Ver lista');

  const orbs = MOODS.map((m, i) => {
    const b = h('button', { class: 'w-orb', type: 'button', 'aria-pressed': String(pick.has(m)), 'data-i': i, vars: { '--mc': moodColor(m) }, onfocus: () => { if (!drag) bringTop(i); } }, moodLabel(m));
    wheel.append(b); return b;
  });
  const rows = MOODS.map((m, i) => h('button', { class: 'w-row', type: 'button', 'aria-pressed': String(pick.has(m)), vars: { '--mc': moodColor(m) }, onclick: () => toggle(i, false) }, h('i'), moodLabel(m)));

  const logo = h('span', { class: 'w-logo' });
  logo.innerHTML = LOGO_SVG;
  const word = h('div', { class: 'w-word', 'aria-hidden': 'true' }, 'Sound'.split('').map((c, i) => h('span', { vars: { '--i': i } }, c)), 'Feed'.split('').map((c, i) => h('span', { class: 'fd', vars: { '--i': i + 5 } }, c)));
  const dateTxt = date.charAt(0).toUpperCase() + date.slice(1);
  const top = h('div', { class: 'w-top' }, h('div', { class: 'w-bar' }, modeBtn),
    h('div', { class: 'w-brand', role: 'img', 'aria-label': 'SoundFeed' }, logo, word),
    h('p', { class: 'w-date' }, dateTxt), h('h1', { class: 'w-q' }, '¿Cómo te sentís hoy?'), nowEl, tip);
  const list = h('div', { class: 'w-list' }, h('h2', {}, 'Elegí tus ánimos'), h('div', { class: 'w-grid' }, rows));
  const skip = h('button', { class: 'w-skip', type: 'button', onclick: () => finish(changing ? null : []) }, changing ? 'Cancelar' : 'Omitir por hoy');
  const foot = h('div', { class: 'w-foot' }, go, skip);
  phone.append(aura, stage, list, top, foot); ov.append(ambEl(), phone);

  function layout() {
    const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
    top.style.paddingTop = Math.max(64, Math.round(H * 0.15)) + 'px';
    const topB = top.getBoundingClientRect().bottom - r.top;
    cx = W / 2; cy = H * 0.81;
    D = Math.max(70, Math.min(W * 0.215, 88));
    R = Math.max(120, Math.min(W * 0.56, 240, cy - topB - 90));
    wheel.style.left = cx + 'px'; wheel.style.top = cy + 'px';
    ring.style.width = ring.style.height = (2 * R) + 'px';
    glow.style.width = glow.style.height = (2 * R * 0.9) + 'px';
    pointer.style.top = (cy - R - D * 0.61 - 22) + 'px';
    render();
  }
  function render() {
    let best = 0, bd = 999;
    for (let i = 0; i < N; i++) {
      const th = i * STEP + rot, t = th * Math.PI / 180, d = Math.abs(norm(th));
      const x = R * Math.sin(t), y = -R * Math.cos(t), k = Math.max(0, 1 - d / 60), s = 0.92 + 0.3 * k * k, b = orbs[i];
      b.style.width = b.style.height = D + 'px';
      b.style.marginLeft = b.style.marginTop = (-D / 2) + 'px';
      b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
      b.style.opacity = (0.5 + 0.5 * (1 + Math.cos(t)) / 2).toFixed(2);
      b.style.zIndex = Math.round(k * 10);
      if (d < bd) { bd = d; best = i; }
    }
    if (best !== focus) { focus = best; nowEl.textContent = moodLabel(MOODS[best]); nowEl.style.color = moodColor(MOODS[best]); aura.style.setProperty('--aura', moodColor(MOODS[best])); }
  }
  function stopAnim() { if (anim) { cancelAnimationFrame(anim.id); anim = null; } }
  function tween(to, ms) {
    stopAnim();
    if (reduce) { rot = to; render(); return; }
    const from = rot, t0 = performance.now(), a = anim = { id: 0 };
    const step = (now) => {
      if (anim !== a) return;
      const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      rot = from + (to - from) * e; render();
      if (p < 1) a.id = requestAnimationFrame(step); else anim = null;
    };
    a.id = requestAnimationFrame(step);
  }
  const snap = () => tween(Math.round(rot / STEP) * STEP, 280);
  function bringTop(i) { tween(rot + norm(-i * STEP - rot), 380); }
  function inertia(omega) {
    stopAnim();
    if (reduce) { snap(); return; }
    let last = performance.now(); const a = anim = { id: 0 };
    const step = (now) => {
      if (anim !== a) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      rot += omega * dt; omega *= Math.exp(-dt * 3.2); render();
      if (Math.abs(omega) < 16) { anim = null; snap(); return; }
      a.id = requestAnimationFrame(step);
    };
    a.id = requestAnimationFrame(step);
  }
  function paint() {
    MOODS.forEach((m, i) => { const on = pick.has(m); orbs[i].setAttribute('aria-pressed', String(on)); rows[i].setAttribute('aria-pressed', String(on)); });
    go.disabled = !pick.size;
    go.textContent = pick.size ? 'Continuar con ' + pick.size + (pick.size === 1 ? ' ánimo' : ' ánimos') : 'Elegí al menos un ánimo';
  }
  function toggle(i, spin) { const m = MOODS[i]; if (pick.has(m)) pick.delete(m); else { pick.add(m); fx.burst(spin ? orbs[i] : rows[i], [moodColor(m), '#ffffff', moodColor(m), '#ffd166']); } paint(); if (spin) bringTop(i); }

  const ang = (e) => { const r = stage.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + cx), -(e.clientY - (r.top + cy))) * 180 / Math.PI; };
  stage.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    stopAnim();
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), last: ang(e), moved: 0, target: e.target.closest ? e.target.closest('.w-orb') : null, s: [] };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0));
    if (drag.moved <= 6) return;
    stage.classList.add('grabbing');
    const a = ang(e), d = norm(a - drag.last); drag.last = a; rot += d; render();
    const now = performance.now(); drag.s.push({ t: now, d });
    while (drag.s.length && now - drag.s[0].t > 110) drag.s.shift();
    tip.classList.add('hide');
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const g = drag; drag = null; stage.classList.remove('grabbing');
    if (g.moved <= 6 && performance.now() - g.t0 < 600) { if (g.target) toggle(+g.target.dataset.i, true); return; }
    let sum = 0, span = 0;
    if (g.s.length > 1) { for (const q of g.s) sum += q.d; span = (g.s[g.s.length - 1].t - g.s[0].t) / 1000; }
    const omega = span > 0.01 ? sum / span : 0;
    if (Math.abs(omega) > 40) inertia(Math.max(-900, Math.min(900, omega))); else snap();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); stopAnim(); rot -= (e.deltaY + e.deltaX) * 0.25; render(); clearTimeout(wt); wt = setTimeout(snap, 140); tip.classList.add('hide'); }, { passive: false });

  const onKey = (e) => {
    if (e.key === 'Escape') { finish(changing ? null : []); return; }
    if (phone.classList.contains('is-list')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); tween(Math.round(rot / STEP) * STEP + STEP, 260); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); tween(Math.round(rot / STEP) * STEP - STEP, 260); }
  };
  function finish(moods) {
    if (moods) {
      S.today = { date: dayKey(), moods, pending: false };
      try { localStorage.setItem('sf_today', JSON.stringify({ date: S.today.date, moods })); } catch (_) {}
      S.picked = new Set(moods); S.recs = null; S.recNote = '';
    }
    stopAnim(); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', layout);
    ov.classList.add('out');
    setTimeout(() => { ov.remove(); document.body.classList.remove('noscroll'); if (moods) route(); }, 450);
  }
  go.addEventListener('click', () => { if (pick.size) finish([...pick]); });
  document.addEventListener('keydown', onKey); window.addEventListener('resize', layout);
  document.body.classList.add('noscroll'); document.body.append(ov);
  layout(); paint();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (ov.isConnected) layout(); });
  if (!reduce) { rot = -80; render(); setTimeout(() => { if (ov.isConnected && !drag) tween(0, 1500); }, 250); }
}

/* ---------- perfiles ---------- */
Player.init({ music, h, toast }); // player:
const PF = initProfile({ h, S, fx, ico, hue, ago, errMsg, showSheet, closeSheet, view, avatarEl, toast, onMeSaved: () => PF.invalidate(S.user.uid) });
function authorLink(uid, name, cls) { return uid ? h('a', { class: 'author' + (cls ? ' ' + cls : ''), href: '#perfil-' + uid }, name || 'Oyente') : h(cls === 'plain' ? 'span' : 'b', {}, name || 'Oyente'); }
// Botón de repost: un repost por persona e hilo.
function repostBtn(t, after) {
  const mine = !!S.user && (t.reposters || []).includes(S.user.uid), n = (t.reposters || []).length;
  const ic = ico('repost'), c = h('span', {}, String(n));
  const b = h('button', { class: 'act rep', type: 'button', 'aria-pressed': String(mine), 'aria-label': mine ? 'Quitar repost' : 'Repostear', disabled: !S.user, title: S.user ? null : 'Iniciá sesión para repostear' }, ic, c);
  b.addEventListener('click', async () => {
    if (!t.slug || !t.uid) return;
    const now = b.getAttribute('aria-pressed') !== 'true'; b.disabled = true; b.setAttribute('aria-pressed', String(now)); c.textContent = String(Math.max(0, +c.textContent + (now ? 1 : -1)));
    ic.classList.remove('spin'); void ic.offsetWidth; ic.classList.add('spin'); if (now) fx.burst(ic);
    try { await store.setRepost(S.user, t, now); if (after) after(now); toast(now ? 'Reposteaste este hilo' : 'Quitaste tu repost'); }
    catch (e) { b.setAttribute('aria-pressed', String(!now)); c.textContent = String(n); toast(errMsg(e)); } finally { b.disabled = !S.user; }
  });
  if (!t.uid) b.hidden = true;
  return b;
}

/* ---------- rutas y arranque ---------- */
let ROUTE_KEY = null;
const PERFIL = /^perfil-[A-Za-z0-9]{6,40}$/;
function build(hash) {
  if (hash === 'foros') return buildFeed();
  if (hash === 'favoritos') return buildFavs();
  if (/^foro-[a-z0-9-]{1,80}$/.test(hash)) { const slug = hash.slice(5); if (S.slug !== slug || !S.data) buildForum(slug); return; }
  if (PERFIL.test(hash)) { leaveForum(); if (S.offRecent) { S.offRecent(); S.offRecent = null; } S.ui = {}; return PF.build(hash.slice(7)); }
  buildHome();
}
function swapMode(prev, key) {
  const a = NAV_ORDER.indexOf(prev), b = NAV_ORDER.indexOf(key);
  if (a >= 0 && b >= 0) return b > a ? 1 : -1;
  return /^(foro|perfil)-/.test(key) ? 'push' : 'pop';
}
function route() {
  paintAccount();
  if (!S.ready) return;
  if (S.user && S.user.needsName) { ROUTE_KEY = null; leaveForum(); if (S.offRecent) { S.offRecent(); S.offRecent = null; } $('#nav').replaceChildren(); return openAuth('name'); }
  if (!S.user && !S.guest) { ROUTE_KEY = null; leaveForum(); if (S.offRecent) { S.offRecent(); S.offRecent = null; } $('#nav').replaceChildren(); return openAuth('welcome'); }
  closeAuth();
  const hash = location.hash.slice(1); paintNav(hash); if (S.today.pending) openSplash();
  const key = /^foro-[a-z0-9-]{1,80}$/.test(hash) || PERFIL.test(hash) ? hash : NAV_ORDER.includes(hash) ? hash : 'inicio';
  const prev = ROUTE_KEY, changed = prev !== null && key !== prev; ROUTE_KEY = key;
  const g = changed ? fx.ghost(view) : null;
  build(hash);
  if (changed) fx.swap(view, g, swapMode(prev, key));
  else if (prev === null && !document.getElementById('boot')) fx.stagger(view);
}
window.addEventListener('hashchange', route);
/* ---------- pantalla de carga ---------- */
function bootDone() {
  const b = document.getElementById('boot'); if (!b || b.dataset.go) return; b.dataset.go = '1';
  const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
  const wait = new Promise((r) => setTimeout(r, Math.max(0, 1400 - performance.now())));
  Promise.all([fonts, wait]).then(() => { b.classList.add('out'); setTimeout(() => b.remove(), 800); fx.stagger(view); });
}
(async function init() {
  const cb = await music.spotifyHandleCallback().catch(() => ({ error: 'No se pudo conectar Spotify.' }));
  if (cb) S.spotifyMsg = cb.ok ? 'Spotify conectado. Ahora las canciones suenan completas.' : cb.error;
  let first = true;
  store.watchUser((u) => {
    const was = S.user; S.user = u; S.ready = true;
    if (!was || !u || was.uid !== u.uid) watchAccount(u && u.uid);
    if (u) setGuest(false);
    if (first || !!was !== !!u) { first = false; S.slug = null; S.data = null; route(); }
    else { paintAccount(); if (S.data) renderForum(); }
    bootDone();
  });
})();
