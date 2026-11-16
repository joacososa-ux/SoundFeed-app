import * as store from './store.js';
import * as music from './music.js';
import { recommend, seedThreads, slugify, LABEL, MOODS } from './recommend.js';

const CATS = { letra: 'Análisis de letra', debate: 'Debate', anecdotas: 'Anécdotas', similares: 'Si te gusta esto' };
const $ = (s, el) => (el || document).querySelector(s);
const view = $('#view');
const S = { user: null, ready: false, guest: false, picked: new Set(), text: '', recs: null, recNote: '', ui: {},
  slug: null, data: null, cat: 'todo', threadId: null, off: null, offRecent: null, notice: '', spotifyMsg: '', premium: false, favs: [], offPlan: null, offFavs: null };
const FREE_RECS = 3, PREMIUM_RECS = 9;
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
function leaveForum() { if (S.off) { S.off(); S.off = null; } S.slug = null; S.data = null; }
function buildHome() {
  leaveForum();
  const chips = MOODS.map((m) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(S.picked.has(m)),
    onclick: (e) => { S.picked.has(m) ? S.picked.delete(m) : S.picked.add(m); e.currentTarget.setAttribute('aria-pressed', String(S.picked.has(m))); } }, moodLabel(m)));
  const ta = h('textarea', { id: 'feel', maxlength: '300', placeholder: 'Ej: Terminé un examen difícil y quiero algo para celebrar. Me gusta el rock en español.' });
  ta.value = S.text; ta.addEventListener('input', () => { S.text = ta.value; });
  const sq = h('input', { type: 'text', id: 'sq', maxlength: '80', placeholder: 'Ej: Gustavo Cerati Crimen' });
  const ui = S.ui = { results: h('div'), trend: h('div'), sres: h('div', { class: 'sresults' }), favs: h('div') };
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
    h('div', { class: 'picker' },
      h('fieldset', {}, h('legend', {}, '¿Cómo te sentís?'), h('div', { class: 'chips' }, chips)),
      h('div', {}, h('label', { class: 'lbl', for: 'feel' }, 'O contalo con tus palabras'), ta),
      h('div', { class: 'row' }, go),
      h('div', {}, h('label', { class: 'lbl', for: 'sq' }, 'O buscá cualquier canción o artista'), h('div', { class: 'search' }, sq, sgo), ui.sres)),
    ui.results, ui.favs,
    adBox(),
    h('div', { class: 'section-title' }, h('h2', {}, 'Foros recientes')), ui.trend);
  S.spotifyMsg = '';
  renderResults(); renderFavs();
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
    h('div', { class: 'section-title' }, h('h2', {}, 'Para vos'), h('span', { class: 'source' }, S.recNote)),
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
async function loadPlayer(slug, t) {
  const aside = S.ui.aside;
  const paint = (kids) => { if (S.slug === slug && S.ui.aside === aside) aside.replaceChildren(h('div', { class: 'player' }, kids)); };
  const head = (cover) => [h('div', { class: 'cover' }, cover ? h('img', { src: cover, alt: `Portada de ${t.title}`, referrerpolicy: 'no-referrer' }) : t.title.trim().charAt(0).toUpperCase()),
    h('div', {}, h('div', { class: 'tt' }, t.title), h('div', { class: 'sm' }, t.artist))];
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

/* ---------- rutas y arranque ---------- */
function route() {
  paintAccount();
  if (!S.ready) return;
  if (!S.user && !S.guest) { leaveForum(); if (S.offRecent) { S.offRecent(); S.offRecent = null; } return buildGate(); }
  const hash = location.hash.slice(1);
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
