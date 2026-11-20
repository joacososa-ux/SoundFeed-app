// Perfiles: foto, portada, estado, seguidores y pestañas de hilos / reposts. Las pantallas se arman con las piezas que pasa app.js (ctx).
import * as store from './store.js?v=13';

export const BANNERS = ['linear-gradient(135deg,#7c5cff,#ff3d9a)', 'linear-gradient(135deg,#2be3f2,#7c5cff)', 'linear-gradient(135deg,#ff9a3d,#ff3d9a)',
  'linear-gradient(135deg,#5ee6a8,#2be3f2)', 'linear-gradient(135deg,#1b1530,#7c5cff 60%,#2be3f2)', 'linear-gradient(135deg,#ff3d9a,#1b1530 70%)'];
const EMOJIS = ['🎧', '🔥', '🌙', '✨', '🎸', '💜', '😴', '🎹'];
const LIM = { avatar: { w: 256, h: 256, kb: 60, gif: 240 }, banner: { w: 800, h: 300, kb: 120, gif: 380 } };
const bannerBg = (p, media) => (media && media.banner ? `url("${media.banner}")` : BANNERS[(p && p.bannerIdx) | 0] || BANNERS[0]);
const okImg = (s) => typeof s === 'string' && /^data:image\/(jpeg|gif|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);

/* ---------- imágenes: se achican en el navegador antes de guardarlas ---------- */
const readURL = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('No se pudo leer la imagen.')); r.readAsDataURL(file); });
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Esa imagen no se pudo abrir.')); i.src = src; }); }
function crop(img, w, h, q, limKB) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
  x.imageSmoothingQuality = 'high'; x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  let out = c.toDataURL('image/jpeg', q), kb = Math.round(out.length * 0.75 / 1024);
  while (limKB && kb > limKB && q > 0.4) { q -= 0.08; out = c.toDataURL('image/jpeg', q); kb = Math.round(out.length * 0.75 / 1024); }
  return { url: out, kb };
}
// Devuelve { url, kb, gif, thumb }. Un GIF liviano se guarda animado; si pesa mucho, queda como imagen fija.
export async function processImage(file, kind) {
  if (!/^image\//.test(file.type)) throw new Error('Elegí un archivo de imagen.');
  const L = LIM[kind], raw = await readURL(file), img = await loadImg(raw);
  const thumb = kind === 'avatar' ? crop(img, 64, 64, 0.8, 8).url : null;
  if (file.type === 'image/gif' && file.size <= L.gif * 1024) return { url: raw, kb: Math.round(file.size / 1024), gif: true, thumb };
  const r = crop(img, L.w, L.h, 0.82, L.kb);
  return { url: r.url, kb: r.kb, gif: false, tooBig: file.type === 'image/gif', thumb };
}

export function initProfile(ctx) {
  const { h, S, fx, ico, hue, ago, errMsg, showSheet, closeSheet, view } = ctx;
  const cache = new Map();
  const lite = (uid) => { if (!cache.has(uid)) cache.set(uid, store.getProfile(uid).catch(() => null)); return cache.get(uid); };
  const pic = (u, size) => ctx.avatarEl({ uid: u.uid, name: u.username || u.name, thumb: u.thumb || null }, size);

  // Pone la foto de cada autor en los avatares que la página dejó marcados con data-uid.
  function fillAvatars(root) {
    (root || document).querySelectorAll('.av-pic[data-uid]:not([data-f])').forEach((el) => {
      el.dataset.f = '1';
      lite(el.dataset.uid).then((p) => { if (p && okImg(p.thumb) && el.isConnected) el.append(h('img', { src: p.thumb, alt: '' })); });
    });
  }

  /* ---------- página de perfil ---------- */
  let cur = null;
  function build(uid) {
    const me = !!S.user && S.user.uid === uid, st = { uid, p: undefined, media: {}, threads: null, reposts: null, tab: 0, me };
    cur = st;
    const root = h('div', { class: 'pf' });
    view.replaceChildren(h('a', { class: 'back', href: '#foros', onclick: (e) => { if (history.length > 1) { e.preventDefault(); history.back(); } } }, ico('back'), 'Volver'), root);
    st.root = root; st.render = () => render(st);
    S.off = store.watchProfile(uid, (p) => { if (cur !== st) return; st.p = p; render(st); });
    Promise.all([store.getMedia(uid), store.listProfileThreads(uid).catch(() => []), store.listProfileReposts(uid).catch(() => [])]).then(([m, t, r]) => {
      if (cur !== st) return; st.media = m || {}; st.threads = t; st.reposts = r; render(st);
    });
    render(st);
  }
  function stat(label, value, onclick) {
    const b = h(onclick ? 'button' : 'div', { class: 'pf-stat', type: onclick ? 'button' : null, onclick }, h('b', {}, String(value || 0)), h('span', {}, label));
    return b;
  }
  function render(st) {
    const { root, p } = st;
    if (p === undefined) { root.replaceChildren(h('p', { class: 'hint' }, 'Abriendo el perfil…')); return; }
    if (p === null) { root.replaceChildren(h('div', { class: 'notice' }, 'Este perfil no existe.')); return; }
    const me = !!S.user && S.user.uid === st.uid, following = S.following.has(st.uid);
    const avSrc = okImg(st.media.avatar) ? st.media.avatar : okImg(p.thumb) ? p.thumb : null;
    const av = h('div', { class: 'pf-av', vars: { '--a': hue(st.uid) } }, h('span', {}, (p.username || '?').charAt(0).toUpperCase()), avSrc && h('img', { src: avSrc, alt: '' }));
    const status = (p.status && p.status.t)
      ? h('div', { class: 'pf-status' }, h('span', { class: 'em' }, p.status.e || '💬'), h('span', {}, p.status.t))
      : h('div', { class: 'pf-status empty' }, me ? 'Agregá un estado desde “Editar perfil”.' : 'Sin estado por ahora.');
    let act;
    if (me) act = h('button', { class: 'btn cta pf-wide', type: 'button', onclick: () => openEditor(st) }, 'Editar perfil');
    else if (!S.user) act = h('p', { class: 'hint' }, 'Iniciá sesión para seguir a ' + p.username + '.');
    else act = followBtn(st.uid, false);
    const list = st.tab === 0 ? st.threads : st.reposts;
    root.replaceChildren(
      h('div', { class: 'pf-banner' + (okImg(st.media.banner) ? ' img' : ''), vars: { '--bg': bannerBg(p, okImg(st.media.banner) ? st.media : null) } }),
      h('div', { class: 'pf-head' }, av, h('h1', {}, '@' + p.username), status),
      h('div', { class: 'pf-stats' }, stat('Hilos', p.threads), stat('Seguidores', p.followers, () => openList(st, 'followers')), stat('Siguiendo', p.following, () => openList(st, 'following'))),
      h('div', { class: 'pf-act' }, act),
      h('div', { class: 'pf-tabs', role: 'tablist', style: `--t:${st.tab}` }, h('span', { class: 'ind', 'aria-hidden': 'true' }),
        ...['Hilos', 'Reposts'].map((l, i) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(st.tab === i), onclick: () => { st.tab = i; render(st); } }, l))),
      h('div', { class: 'pf-list' }, list === null ? h('p', { class: 'hint' }, 'Cargando…')
        : list.length ? list.map((it) => card(it, st.tab === 1))
        : h('div', { class: 'empty' }, st.tab === 0 ? (me ? 'Todavía no publicaste hilos.' : 'Todavía no publicó hilos.') : (me ? 'Todavía no reposteaste nada.' : 'Todavía no reposteó nada.'))));
  }
  function card(it, rep) {
    const when = ago(it.createdAt);
    return h('article', { class: 'pf-card' },
      rep && h('div', { class: 'pf-rp' }, ico('repost'), 'Repost' + (it.author ? ' de ' : ''), it.tuid ? h('a', { href: '#perfil-' + it.tuid }, it.author) : it.author),
      h('a', { class: 'songchip', href: '#foro-' + it.slug }, '♪ ' + it.ftitle, h('span', {}, it.fartist ? ' · ' + it.fartist : '')),
      h('h3', {}, it.title), h('p', {}, it.body), h('small', {}, when));
  }
  function followBtn(uid, small) {
    const on = S.following.has(uid);
    const b = h('button', { class: 'btn ' + (on ? 'following' : 'cta') + (small ? ' small' : ' pf-wide'), type: 'button', 'aria-pressed': String(on), 'data-follow': uid }, on ? 'Siguiendo ✓' : 'Seguir');
    b.addEventListener('click', async () => {
      const now = !S.following.has(uid); b.disabled = true;
      if (now) S.following.add(uid); else S.following.delete(uid);
      b.className = 'btn ' + (now ? 'following' : 'cta') + (small ? ' small' : ' pf-wide'); b.textContent = now ? 'Siguiendo ✓' : 'Seguir'; if (now) fx.burst(b);
      try { await store.setFollow(S.user.uid, uid, now); }
      catch (e) { if (now) S.following.delete(uid); else S.following.add(uid); b.className = 'btn ' + (!now ? 'following' : 'cta') + (small ? ' small' : ' pf-wide'); b.textContent = !now ? 'Siguiendo ✓' : 'Seguir'; ctx.toast(errMsg(e)); }
      finally { b.disabled = false; }
    });
    return b;
  }
  async function openList(st, kind) {
    const box = h('div', { class: 'pf-users' }, h('p', { class: 'hint' }, 'Cargando…'));
    showSheet(kind === 'followers' ? 'Seguidores' : 'Siguiendo', [box]);
    try {
      const ids = await store.listFollows(st.uid, kind);
      const ps = (await Promise.all(ids.map(lite))).filter(Boolean);
      box.replaceChildren(...(ps.length ? ps.map((u) => h('div', { class: 'pf-user' },
        h('a', { href: '#perfil-' + u.uid, class: 'pf-ulink', onclick: () => closeSheet(true) }, pic(u, 44), h('span', {}, h('b', {}, '@' + u.username), u.status && u.status.t ? h('small', {}, (u.status.e || '') + ' ' + u.status.t) : '')),
        S.user && S.user.uid !== u.uid ? followBtn(u.uid, true) : ''))
        : [h('div', { class: 'empty' }, kind === 'followers' ? 'Todavía no tiene seguidores.' : 'Todavía no sigue a nadie.')]));
    } catch (_) { box.replaceChildren(h('div', { class: 'notice err' }, 'No se pudo cargar la lista.')); }
  }

  /* ---------- editor ---------- */
  function openEditor(st) {
    const p = st.p, d = { avatar: okImg(st.media.avatar) ? st.media.avatar : null, banner: okImg(st.media.banner) ? st.media.banner : null, thumb: p.thumb || null,
      bannerIdx: (p.bannerIdx | 0), e: (p.status && p.status.e) || '🎧', t: (p.status && p.status.t) || '', kbA: '', kbB: '' };
    const note = h('p', { class: 'snote', role: 'status' }, 'Las imágenes se recortan y se achican en tu dispositivo antes de guardarse. Los GIF livianos se guardan animados.');
    const ban = h('div', { class: 'pf-ebanner', vars: { '--bg': bannerBg({ bannerIdx: d.bannerIdx }, d.banner ? { banner: d.banner } : null) } });
    const eav = h('div', { class: 'pf-eav', vars: { '--a': hue(st.uid) } }, h('span', {}, (p.username || '?').charAt(0).toUpperCase()), d.avatar && h('img', { src: d.avatar, alt: '' }));
    const kbA = h('small', { class: 'pf-kb' }), kbB = h('small', { class: 'pf-kb' });
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true }); let kind = null;
    const pick = (k) => { kind = k; file.click(); };
    file.addEventListener('change', async () => {
      const f = file.files[0]; file.value = ''; if (!f || !kind) return;
      const k = kind; note.textContent = 'Preparando la imagen…';
      try {
        const r = await processImage(f, k);
        if (k === 'avatar') { d.avatar = r.url; d.thumb = r.thumb; eav.querySelector('img') ? eav.querySelector('img').src = r.url : eav.append(h('img', { src: r.url, alt: '' })); kbA.textContent = r.kb + ' KB' + (r.gif ? ' · GIF animado' : ''); }
        else { d.banner = r.url; ban.style.setProperty('--bg', `url("${r.url}")`); sw.forEach((b) => b.setAttribute('aria-pressed', 'false')); kbB.textContent = r.kb + ' KB' + (r.gif ? ' · GIF animado' : ''); }
        note.textContent = r.tooBig ? 'Ese GIF pesa demasiado para guardarlo animado: se usó como imagen fija. Probá con uno de menos de ' + LIM[k].gif + ' KB.' : 'Listo: se guardan ' + r.kb + ' KB.';
      } catch (e) { note.textContent = e.message || 'No se pudo usar esa imagen.'; }
    });
    const sw = BANNERS.map((g, i) => h('button', { type: 'button', class: 'pf-sw', style: 'background:' + g, 'aria-label': 'Portada ' + (i + 1), 'aria-pressed': String(!d.banner && d.bannerIdx === i),
      onclick: () => { d.banner = null; d.bannerIdx = i; kbB.textContent = ''; ban.style.setProperty('--bg', g); sw.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); } }));
    const emos = EMOJIS.map((e) => h('button', { type: 'button', 'aria-pressed': String(d.e === e), onclick: () => { d.e = e; emos.forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === e))); } }, e));
    const txt = h('input', { type: 'text', maxlength: '60', value: d.t, placeholder: '¿Qué estás escuchando?', 'aria-label': 'Estado' });
    const cnt = h('small', { class: 'pf-cnt' }, d.t.length + '/60'); txt.addEventListener('input', () => { cnt.textContent = txt.value.length + '/60'; });
    const save = h('button', { class: 'btn cta pf-wide', type: 'button' }, 'Guardar cambios');
    save.addEventListener('click', async () => {
      save.disabled = true; note.textContent = 'Guardando…';
      try {
        await store.saveProfile(st.uid, { avatar: d.avatar, banner: d.banner, thumb: d.thumb, bannerIdx: d.bannerIdx, e: d.e, t: txt.value.trim() });
        cache.delete(st.uid); st.media = { avatar: d.avatar, banner: d.banner }; closeSheet(); ctx.toast('Perfil actualizado ✓');
        if (ctx.onMeSaved) ctx.onMeSaved();
      } catch (e) { note.textContent = errMsg(e); save.disabled = false; }
    });
    showSheet('Editar perfil', [
      h('div', { class: 'pf-eb' }, ban, h('button', { class: 'btn ghost small pf-bpick', type: 'button', onclick: () => pick('banner') }, 'Subir portada'),
        h('div', { class: 'pf-eavrow' }, eav, h('button', { class: 'btn ghost small', type: 'button', onclick: () => pick('avatar') }, 'Cambiar foto'))),
      h('div', { class: 'pf-lbl' }, 'Portada ', kbB), h('div', { class: 'pf-sws' }, sw),
      h('div', { class: 'pf-lbl' }, 'Foto ', kbA),
      h('div', { class: 'pf-lbl' }, 'Estado'), h('div', { class: 'pf-emos' }, emos), txt, cnt, note, file, save]);
  }

  return { build, lite, fillAvatars, followBtn, invalidate: (uid) => cache.delete(uid), rerender: () => { if (cur && cur.root && cur.root.isConnected) render(cur); } };
}
