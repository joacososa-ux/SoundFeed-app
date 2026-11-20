import * as store from './store.js';
import * as music from './music.js';
import { recommend, seedThreads, slugify, LABEL, MOODS } from './recommend.js';

const CATS = { letra: 'Análisis de letra', debate: 'Debate', anecdotas: 'Anécdotas', similares: 'Si te gusta esto' };
const $ = (s, el) => (el || document).querySelector(s);
const view = $('#view');
const S = { user: null, ready: false, guest: false, picked: new Set(), text: '', recs: null, recNote: '', ui: {},
  slug: null, data: null, cat: 'todo', threadId: null, off: null, offRecent: null, notice: '', spotifyMsg: '', premium: false, favs: [], offPlan: null, offFavs: null };
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
async function login() {
  try { await store.signInGoogle(); }
  catch (e) { if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') { S.notice = 'No se pudo iniciar sesión con Google.'; route(); } }
}
function paintAccount() {
  const box = $('#account');
  if (S.user) {
    box.replaceChildren(
      h('span', { class: 'pill ok' }, S.user.photo ? h('img', { class: 'avatar', src: S.user.photo, alt: '', referrerpolicy: 'no-referrer' }) : h('i'), S.user.name),
      S.premium ? h('span', { class: 'badge', title: 'Plan Premium' }, 'Premium') : h('span', { class: 'pill', title: 'El plan Premium llega pronto' }, 'Plan gratuito'),
      music.spotifyAvailable() && (music.spotifyConnected()
        ? h('span', { class: 'pill ok' }, h('i'), music.spotifyPremium() ? 'Spotify Premium' : 'Spotify conectado')
        : h('button', { class: 'btn ghost small', type: 'button', onclick: music.spotifyConnect }, 'Conectar Spotify')),
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => store.logout() }, 'Salir'));
  } else {
    box.replaceChildren(h('span', { class: 'pill' }, h('i'), 'Modo visita (solo lectura)'),
      store.configured && h('button', { class: 'btn small', type: 'button', onclick: () => { setGuest(false); route(); } }, 'Iniciar sesión'));
  }
}
function buildGate() {
  view.replaceChildren(h('section', { class: 'gate' },
    h('h1', {}, 'Entrá a SoundFeed'),
    h('p', {}, 'Con tu cuenta de Google participás en los foros y escuchás las canciones. Sin cuenta podés mirar, en modo visita.'),
    !store.configured && h('div', { class: 'notice err', role: 'alert' }, 'Falta configurar Firebase: completá js/config.js (mirá el README).'),
    S.notice && h('div', { class: 'notice err', role: 'alert' }, S.notice),
    h('button', { class: 'login google', type: 'button', disabled: !store.configured, onclick: login }, 'Continuar con Google'),
    h('button', { class: 'login guest', type: 'button', onclick: () => { setGuest(true); route(); } }, 'Entrar como visita'),
    h('p', { class: 'small' }, 'Después de entrar podés conectar tu cuenta de Spotify para escuchar la canción completa.')));
  S.notice = '';
}

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
  const go = h('button', { class: 'btn', type: 'button', onclick: () => { S.recs = recommend([...S.picked], S.text, S.premium ? PREMIUM_RECS : FREE_RECS); S.recNote = S.premium ? 'Elegidas según tu ánimo' : `Elegidas según tu ánimo · el plan Premium muestra hasta ${PREMIUM_RECS}`; renderResults(); ui.results.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Recomendarme canciones');
  const sgo = h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
    const term = sq.value.trim(); if (term.length < 2) return;
    ui.sres.replaceChildren(h('span', { class: 'hint' }, 'Buscando…'));
    try {
      const rows = await music.itunesSearch(term);
      S.recs = rows.map((r) => ({ title: r.title, artist: r.artist, genre: r.genre, moods: [] })); S.recNote = 'Resultados de tu búsqueda';
      ui.sres.replaceChildren(S.recs.length ? '' : h('span', { class: 'hint' }, 'Sin resultados.')); renderResults();
      if (S.recs.length) ui.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) { ui.sres.replaceChildren(h('span', { class: 'hint' }, 'No se pudo buscar ahora.')); }
  } }, 'Buscar');
  sq.addEventListener('keydown', (e) => { if (e.key === 'Enter') sgo.click(); });
  view.replaceChildren(
    h('section', { class: 'hero' },
      h('h1', {}, 'Descubrí una canción y ', h('em', {}, 'entrá a la charla.')),
      h('p', {}, 'Contanos cómo te sentís o buscá cualquier tema. Cada canción abre su propio foro, creado en el momento, donde la comunidad analiza la letra y debate sobre el artista.')),
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
  const isFav = S.favs.some((f) => f.slug === t.slug);
  const b = h('button', { class: 'fav', type: 'button', 'aria-pressed': String(isFav), disabled: !S.user || !S.premium,
    title: !S.user ? 'Iniciá sesión' : S.premium ? null : 'Los favoritos son parte del plan Premium' },
    isFav ? '★ En favoritos' : S.premium || !S.user ? '☆ Guardar en favoritos' : '☆ Favoritos (Premium)');
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await store.toggleFavorite(S.user.uid, t, isFav); } catch (e) { setNotice(errMsg(e), true); b.disabled = false; }
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
  S.premium = false; S.favs = [];
  if (!uid) return;
  S.offPlan = store.watchPlan(uid, (p) => { S.premium = p; renderPlan(); });
  S.offFavs = store.watchFavorites(uid, (f) => { S.favs = f; renderPlan(); });
}
function renderResults() {
  const box = S.ui.results; if (!box) return;
  if (!S.recs || !S.recs.length) { box.replaceChildren(); return; }
  box.replaceChildren(
    h('div', { class: 'section-title' }, h('h2', {}, S.recNote === TODAY_NOTE ? 'Para tu ánimo hoy' : 'Para vos'), h('span', { class: 'source' }, S.recNote)),
    h('div', { class: 'grid' }, S.recs.map((r) => h('button', { class: 'card', type: 'button', onclick: () => openTrack(r) },
      wave(slugify(r.artist, r.title)),
      h('h3', {}, r.title),
      h('div', { class: 'by' }, [r.artist, r.genre].filter(Boolean).join(' · ')),
      h('div', { class: 'tags' }, (r.moods || []).map((m) => h('span', { class: 'tag' }, moodLabel(m)))),
      r.reason && h('div', { class: 'why' }, r.reason),
      h('div', { class: 'foot' }, h('span', { class: 'stat' }, 'Foro de la canción'), h('span', { class: 'go' }, 'Entrar al foro →'))))));
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
  view.replaceChildren(h('a', { class: 'back', href: '#inicio' }, '← Volver a las recomendaciones'), h('p', { class: 'hint' }, 'Abriendo el foro…'));
  S.off = store.watchForum(slug, (d) => { if (S.slug !== slug) return; S.data = d; onForumData(); },
    () => { view.replaceChildren(h('a', { class: 'back', href: '#inicio' }, '← Volver'), h('div', { class: 'notice err', role: 'alert' }, 'No se pudo abrir el foro.')); });
}
function onForumData() {
  const d = S.data;
  if (!d.forum) {
    view.replaceChildren(h('a', { class: 'back', href: '#inicio' }, '← Volver'),
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
    h('a', { class: 'back', href: '#inicio' }, '← Volver a las recomendaciones'),
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
function threadsView() {
  const { forum, threads, posts, likes } = S.data;
  const all = [...seedThreads(forum, forum.createdAt), ...threads];
  return all.map((t) => {
    const ps = posts.filter((p) => p.threadId === t.id);
    return { ...t, replies: ps.length, likes: likes.filter((l) => l.targetId === t.id).length,
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
  const open = h('button', { class: 'btn small', type: 'button', disabled: !S.user }, 'Abrir un hilo nuevo');
  const sel = h('select', { id: 'nt-cat' }, Object.entries(CATS).map(([k, v]) => h('option', { value: k }, v)));
  const title = h('input', { type: 'text', id: 'nt-title', maxlength: '120', placeholder: 'Título del hilo' });
  const body = h('textarea', { id: 'nt-body', maxlength: '1500', placeholder: 'Tu opinión, análisis o pregunta' });
  const send = h('button', { class: 'btn small', type: 'button' }, 'Publicar hilo');
  const form = h('div', { class: 'compose', hidden: true },
    h('label', { for: 'nt-cat' }, 'Categoría'), sel, h('label', { for: 'nt-title' }, 'Título'), title, h('label', { for: 'nt-body' }, 'Mensaje'), body,
    h('div', { class: 'row' }, send, h('button', { class: 'btn ghost small', type: 'button', onclick: () => { form.hidden = true; open.hidden = false; } }, 'Cancelar')));
  open.addEventListener('click', () => { form.hidden = false; open.hidden = true; title.focus(); });
  send.addEventListener('click', async () => {
    const ti = title.value.trim(), bo = body.value.trim();
    if (ti.length < 3 || !bo) return setNotice('Escribí un título de al menos 3 letras y un mensaje.', true);
    send.disabled = true;
    try {
      const ref = await store.addThread(S.user, S.slug, sel.value, ti, bo, S.premium);
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
  const b = h('button', { class: 'like', type: 'button', 'aria-pressed': String(mine), disabled: !S.user, title: S.user ? null : 'Iniciá sesión para dar me gusta' }, `Me gusta · ${likes.length}`);
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await store.toggleLike(S.user, S.slug, targetId, mine); } catch (e) { setNotice(errMsg(e), true); b.disabled = false; }
  });
  return b;
}
function renderDetail(list) {
  const { ui } = S, th = S.threadId && list.find((x) => x.id === S.threadId);
  if (!th) { ui.thread = null; ui.detail.replaceChildren(h('h2', {}, 'Elegí un hilo'), h('p', { class: 'hint' }, 'Leé lo que dice la comunidad y sumá tu opinión sobre la canción.')); return; }
  if (!ui.thread || ui.thread.id !== th.id) {
    const ta = h('textarea', { id: 'reply', maxlength: '1500', placeholder: S.user ? 'Escribí tu respuesta' : 'Iniciá sesión para responder', disabled: !S.user });
    const btn = h('button', { class: 'btn small', type: 'button', disabled: !S.user }, 'Responder');
    btn.addEventListener('click', async () => {
      const v = ta.value.trim(); if (!v) return;
      btn.disabled = true;
      try { await store.addPost(S.user, S.slug, th.id, v, S.premium); ta.value = ''; setNotice(''); } catch (e) { setNotice(errMsg(e), true); } finally { btn.disabled = !S.user; }
    });
    ui.thread = { id: th.id, head: h('div'), posts: h('div', { class: 'posts' }) };
    ui.detail.replaceChildren(ui.thread.head, ui.thread.posts, h('div', { class: 'form' }, h('label', { class: 'hint', for: 'reply' }, 'Tu respuesta'), ta, h('div', { class: 'row' }, btn)));
  }
  ui.thread.head.replaceChildren(
    h('div', { class: 'meta' }, h('span', {}, CATS[th.category] || 'Debate'), '·', h('span', {}, th.author), th.premium && h('span', { class: 'badge' }, 'Premium'), '·', h('span', {}, ago(th.createdAt))),
    h('h2', {}, th.title), h('div', { class: 'body' }, th.body), likeBtn(th.id));
  const posts = S.data.posts.filter((p) => p.threadId === th.id);
  ui.thread.posts.replaceChildren(...(posts.length ? posts.map((p) => h('div', { class: 'post' },
    h('div', { class: 'meta' }, h('b', {}, p.author), p.premium && h('span', { class: 'badge' }, 'Premium'), '·', h('span', {}, ago(p.createdAt))), h('div', { class: 'body' }, p.body), likeBtn(p.id)))
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
  const p = await music.playback(t.title, t.artist);
  const kids = head(p.cover);
  if (p.kind === 'spotify' && /^[A-Za-z0-9]{22}$/.test(p.spotifyId)) {
    kids.push(h('iframe', { src: `https://open.spotify.com/embed/track/${p.spotifyId}?utm_source=generator&theme=0`, height: '152', title: 'Reproductor de Spotify', allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture', loading: 'lazy' }),
      h('div', { class: 'sm' }, p.premium ? 'Spotify Premium: canción completa.' : 'Cuenta gratuita de Spotify: puede sonar solo un fragmento.'));
  } else if (p.kind === 'youtube' && /^[\w-]{11}$/.test(p.youtubeId)) {
    kids.push(h('iframe', { class: 'yt', src: `https://www.youtube-nocookie.com/embed/${p.youtubeId}?autoplay=1&rel=0`, title: 'Reproductor de YouTube', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen' }),
      h('div', { class: 'sm' }, 'Reproducción completa con YouTube.'));
  } else if (p.kind === 'preview' && p.preview) {
    const au = h('audio', { controls: true, preload: 'auto', src: p.preview, 'aria-label': `Fragmento de ${t.title}` });
    kids.push(au, h('div', { class: 'sm' }, 'Fragmento de 30 s.' + (music.spotifyAvailable() && !music.spotifyConnected() ? ' Conectá Spotify para escucharla completa.' : '')));
    au.play().catch(() => {});
  } else kids.push(h('div', { class: 'sm' }, 'No encontramos una muestra de esta canción.'));
  if (p.link) kids.push(h('a', { class: 'ext', href: p.link, target: '_blank', rel: 'noopener noreferrer' }, 'Escuchar en Apple Music ↗'));
  paint(kids);
}

/* ---------- navegación, foros (feed) y favoritos ---------- */
const MOOD_COLOR = { feliz: '#ffd166', triste: '#6c8cff', energico: '#ff7a45', relajado: '#4fe3b1', nostalgico: '#c79bff', romantico: '#ff5fa2', motivado: '#2be3f2', intenso: '#ff4d6d', reflexivo: '#9fb3c8' };
const F = { off: null, forums: [], threads: [], tab: 'recientes', song: null, ready: false };
function moodColor(m) { return MOOD_COLOR[moodLabel(m).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] || '#7c5cff'; }
function hue(seed) { let x = 0; for (const c of String(seed)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; }
function paintNav(hash) {
  const cur = hash === 'foros' || /^foro-/.test(hash) ? 'foros' : hash === 'favoritos' ? 'favoritos' : 'inicio';
  $('#nav').replaceChildren(...[['inicio', 'Descubrir'], ['foros', 'Foros'], ['favoritos', 'Favoritos']].map(([k, v]) =>
    h('a', { href: '#' + k, 'aria-current': k === cur ? 'page' : null }, v)));
}
function tweet(t) {
  const same = !t.body || t.body.indexOf(t.title) === 0;
  return h('article', { class: 'tw' },
    h('span', { class: 'av', 'aria-hidden': 'true' }, (t.author || '?').charAt(0).toUpperCase()),
    h('div', { class: 'tw-main' },
      h('div', { class: 'tw-head' }, h('b', {}, t.author || 'Oyente'), t.premium && h('span', { class: 'badge' }, 'Premium'),
        h('a', { class: 'songchip', href: '#foro-' + t.slug, title: 'Ir al foro de ' + t.ftitle }, '♪ ' + t.ftitle, h('span', {}, ' · ' + t.fartist)),
        h('span', { class: 'when' }, ago(t.createdAt))),
      h('div', { class: 'tw-body' }, same ? (t.body || t.title) : [h('b', { class: 'tw-title' }, t.title), h('br'), t.body]),
      h('div', { class: 'tags' }, h('span', { class: 'tag' }, CATS[t.category] || 'Debate'), (t.fmoods || []).slice(0, 2).map((m) => h('span', { class: 'tag' }, moodLabel(m))))));
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
  const send = h('button', { class: 'btn', type: 'button', disabled: !S.user }, 'Publicar');
  send.addEventListener('click', async () => {
    const text = ta.value.trim();
    if (text.length < 3) { msg.textContent = 'Escribí algo para publicar.'; return; }
    if (!F.song) { msg.textContent = 'Elegí la canción de la que querés hablar.'; return; }
    send.disabled = true; msg.textContent = '';
    try {
      const s = F.song;
      await store.ensureForum(S.user, { slug: s.slug, title: s.title.slice(0, 80), artist: s.artist.slice(0, 60), genre: (s.genre || '').slice(0, 40), moods: (s.moods || []).slice(0, 4) });
      await store.addThread(S.user, s.slug, 'debate', text.split('\n')[0].slice(0, 120), text, S.premium);
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
    h('div', { class: 'favgrid' }, shown.map((f) => h('article', { class: 'favcard' },
      h('div', { class: 'favcover', vars: { '--a': hue(f.slug), '--b': (hue(f.slug) + 70) % 360 } },
        h('button', { class: 'unfav', type: 'button', 'aria-label': 'Quitar ' + f.title + ' de favoritos', onclick: () => store.toggleFavorite(S.user.uid, f, true).catch(() => {}) }, '♥')),
      h('h3', { class: 'fav-t' }, f.title), h('div', { class: 'by' }, [f.artist, f.genre].filter(Boolean).join(' · ')),
      h('div', { class: 'tags' }, (f.moods || []).map((m) => h('span', { class: 'tag' }, moodLabel(m)))),
      h('a', { class: 'btn small favgo', href: '#foro-' + f.slug }, 'Abrir foro →')))));
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
  const phone = h('div', { class: 'w-phone' });
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
  logo.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2be3f2"/><stop offset="1" stop-color="#ff3d9a"/></linearGradient></defs><path d="M5 6h22a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H15l-6 5v-5H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="url(#wg)"/><g stroke="#0e0b17" stroke-width="2" stroke-linecap="round"><path class="b" d="M9 14v6"/><path class="b" d="M13 11v12"/><path class="b" d="M17 9v16"/><path class="b" d="M21 12v10"/><path class="b" d="M25 14v6"/></g></svg>';
  const word = h('div', { class: 'w-word', 'aria-hidden': 'true' }, 'Sound'.split('').map((c, i) => h('span', { vars: { '--i': i } }, c)), 'Feed'.split('').map((c, i) => h('span', { class: 'fd', vars: { '--i': i + 5 } }, c)));
  const dateTxt = date.charAt(0).toUpperCase() + date.slice(1);
  const top = h('div', { class: 'w-top' }, h('div', { class: 'w-bar' }, modeBtn),
    h('div', { class: 'w-brand', role: 'img', 'aria-label': 'SoundFeed' }, logo, word),
    h('p', { class: 'w-date' }, dateTxt), h('h1', { class: 'w-q' }, '¿Cómo te sentís hoy?'), nowEl, tip);
  const list = h('div', { class: 'w-list' }, h('h2', {}, 'Elegí tus ánimos'), h('div', { class: 'w-grid' }, rows));
  const skip = h('button', { class: 'w-skip', type: 'button', onclick: () => finish(changing ? null : []) }, changing ? 'Cancelar' : 'Omitir por hoy');
  const foot = h('div', { class: 'w-foot' }, go, skip);
  phone.append(stage, list, top, foot); ov.append(phone);

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
    if (best !== focus) { focus = best; nowEl.textContent = moodLabel(MOODS[best]); nowEl.style.color = moodColor(MOODS[best]); }
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
  function toggle(i, spin) { const m = MOODS[i]; if (pick.has(m)) pick.delete(m); else pick.add(m); paint(); if (spin) bringTop(i); }

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

/* ---------- rutas y arranque ---------- */
function route() {
  paintAccount();
  if (!S.ready) return;
  if (!S.user && !S.guest) { leaveForum(); if (S.offRecent) { S.offRecent(); S.offRecent = null; } $('#nav').replaceChildren(); return buildGate(); }
  const hash = location.hash.slice(1); paintNav(hash); if (S.today.pending) openSplash();
  if (hash === 'foros') return buildFeed();
  if (hash === 'favoritos') return buildFavs();
  if (/^foro-[a-z0-9-]{1,80}$/.test(hash)) { const slug = hash.slice(5); if (S.slug !== slug || !S.data) buildForum(slug); return; }
  buildHome();
}
window.addEventListener('hashchange', route);
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
  });
})();
