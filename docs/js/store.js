// Acceso a Firebase (login con Google y base de datos Firestore). Todo lo de Firebase vive en este archivo.
import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc, collection, query, where, orderBy, limit, onSnapshot, serverTimestamp, writeBatch, increment }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export const configured = !Object.values(firebaseConfig).some((v) => !v || String(v).startsWith('PEGAR'));
let app, auth, db;
if (configured) { app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app); }

const ms = (t) => (t && t.toMillis ? t.toMillis() : Date.now()); // serverTimestamp() llega null hasta confirmarse

/* ---------- sesión ---------- */
export function watchUser(cb) {
  if (!configured) return cb(null);
  let seq = 0;
  return onAuthStateChanged(auth, async (u) => {
    const my = ++seq;
    if (!u) return cb(null);
    let username = null, unknown = false;
    try { const p = await getDoc(doc(db, 'profiles', u.uid)); if (p.exists()) username = p.data().username; } catch (_) { unknown = true; }
    if (my !== seq) return;
    cb({ uid: u.uid, name: username || u.displayName || (u.email || 'Oyente').split('@')[0], photo: u.photoURL || null, email: u.email || '',
      verified: !!u.emailVerified, password: u.providerData.some((p) => p.providerId === 'password'), needsName: !username && !unknown });
  });
}
export async function signUpEmail(email, pass) {
  const c = await createUserWithEmailAndPassword(auth, email, pass);
  try { await sendEmailVerification(c.user); } catch (_) {}
  return c.user;
}
export const signInEmail = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
export const resendVerification = () => sendEmailVerification(auth.currentUser);
export async function usernameFree(name) { return !(await getDoc(doc(db, 'usernames', name))).exists(); }
export async function claimUsername(user, name) {
  const b = writeBatch(db);
  b.set(doc(db, 'usernames', name), { uid: user.uid, createdAt: serverTimestamp() });
  b.set(doc(db, 'profiles', user.uid), { username: name, createdAt: serverTimestamp() });
  await b.commit();
  try { await updateProfile(auth.currentUser, { displayName: name }); } catch (_) {}
}
export const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const logout = () => signOut(auth);

/* ---------- foros ---------- */
export function watchRecentForums(cb, onErr) {
  if (!configured) return () => {};
  return onSnapshot(query(collection(db, 'forums'), orderBy('createdAt', 'desc'), limit(8)),
    (s) => cb(s.docs.map((d) => ({ slug: d.id, ...d.data(), createdAt: ms(d.data().createdAt) }))), onErr);
}
export async function ensureForum(user, f) {
  const ref = doc(db, 'forums', f.slug);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, { title: f.title, artist: f.artist, genre: f.genre || '', moods: f.moods || [], createdAt: serverTimestamp(), createdBy: user.uid });
}
// Escucha el foro completo (datos, hilos, respuestas y me gusta). Devuelve la función para dejar de escuchar.
export function watchForum(slug, cb, onErr) {
  const state = { forum: undefined, threads: [], posts: [], likes: [], reposts: [] };
  const push = () => { if (state.forum !== undefined) cb({ ...state }); };
  const sub = (name, key, order, soft) => onSnapshot(order ? query(collection(db, 'forums', slug, name), orderBy('createdAt', 'asc')) : collection(db, 'forums', slug, name),
    (s) => { state[key] = s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt) })); push(); }, soft ? () => {} : onErr);
  const offs = [
    onSnapshot(doc(db, 'forums', slug), (d) => { state.forum = d.exists() ? { slug, ...d.data(), createdAt: ms(d.data().createdAt) } : null; push(); }, onErr),
    sub('threads', 'threads', true), sub('posts', 'posts', true), sub('likes', 'likes', false), sub('reposts', 'reposts', false, true),
  ];
  return () => offs.forEach((f) => f());
}
// Publica el hilo y, en el mismo envío, su copia en el perfil del autor y el contador de hilos.
export async function addThread(user, slug, category, title, body, premium, meta) {
  const ref = doc(collection(db, 'forums', slug, 'threads')), b = writeBatch(db);
  b.set(ref, { category, title, body, uid: user.uid, author: user.name, createdAt: serverTimestamp(), ...(premium ? { premium: true } : {}) });
  b.set(doc(db, 'profiles', user.uid, 'threads', slug + '_' + ref.id), { slug, threadId: ref.id, ftitle: (meta && meta.title) || '', fartist: (meta && meta.artist) || '', category, title, body, createdAt: serverTimestamp() });
  b.update(doc(db, 'profiles', user.uid), { threads: increment(1) });
  try { await b.commit(); }
  catch (e) {
    // Si las reglas nuevas todavía no están publicadas, se publica el hilo solo (sin copia en el perfil).
    if (!e || e.code !== 'permission-denied') throw e;
    await setDoc(ref, { category, title, body, uid: user.uid, author: user.name, createdAt: serverTimestamp(), ...(premium ? { premium: true } : {}) });
  }
  return ref;
}
export const addPost = (user, slug, threadId, body, premium) =>
  addDoc(collection(db, 'forums', slug, 'posts'), { threadId, body, uid: user.uid, author: user.name, createdAt: serverTimestamp(), ...(premium ? { premium: true } : {}) });

/* ---------- plan Premium y favoritos ---------- */
// El plan lo marca el administrador en Firestore (users/<uid> con plan: 'premium'); la app solo lo lee.
export function watchPlan(uid, cb) {
  if (!configured) return () => {};
  return onSnapshot(doc(db, 'users', uid), (d) => cb(d.exists() && d.data().plan === 'premium'), () => cb(false));
}
export function watchFavorites(uid, cb) {
  if (!configured) return () => {};
  return onSnapshot(collection(db, 'users', uid, 'favorites'), (s) => cb(s.docs.map((d) => ({ slug: d.id, ...d.data() }))), () => cb([]));
}
export async function toggleFavorite(uid, f, isFav) {
  const ref = doc(db, 'users', uid, 'favorites', f.slug);
  if (isFav) await deleteDoc(ref);
  else await setDoc(ref, { title: f.title, artist: f.artist, genre: f.genre || '', moods: f.moods || [], createdAt: serverTimestamp() });
}
export async function toggleLike(user, slug, targetId, liked) {
  const ref = doc(db, 'forums', slug, 'likes', `${targetId}_${user.uid}`);
  if (liked) await deleteDoc(ref); else await setDoc(ref, { targetId, uid: user.uid });
}


/* ---------- feed global de hilos ---------- */
// Escucha los foros más recientes y los hilos de cada uno; entrega todo junto, del más nuevo al más viejo.
export function watchFeed(cb, onErr) {
  if (!configured) return () => {};
  const subs = new Map(), data = new Map(), rdata = new Map(); let forums = [];
  const emit = () => {
    const items = [];
    for (const [slug, ts] of data) {
      const reps = rdata.get(slug) || [];
      for (const t of ts) {
        const mine = reps.filter((r) => r.threadId === t.id), th = { ...t, reposters: mine.map((r) => r.uid), sortAt: t.createdAt };
        items.push(th);
        for (const r of mine) items.push({ ...th, repostBy: r.name || 'Alguien', repostUid: r.uid, sortAt: r.createdAt });
      }
    }
    cb({ forums, threads: items.sort((a, b) => b.sortAt - a.sortAt) });
  };
  const stop = onSnapshot(query(collection(db, 'forums'), orderBy('createdAt', 'desc'), limit(12)), (s) => {
    forums = s.docs.map((d) => ({ slug: d.id, ...d.data(), createdAt: ms(d.data().createdAt) }));
    const keep = new Set(forums.map((f) => f.slug));
    for (const [k, offs] of subs) if (!keep.has(k)) { offs.forEach((o) => o()); subs.delete(k); data.delete(k); rdata.delete(k); }
    for (const f of forums) {
      if (subs.has(f.slug)) continue;
      subs.set(f.slug, [
        onSnapshot(collection(db, 'forums', f.slug, 'threads'), (ts) => {
          data.set(f.slug, ts.docs.map((d) => ({ id: d.id, ...d.data(), slug: f.slug, ftitle: f.title, fartist: f.artist, fmoods: f.moods || [], createdAt: ms(d.data().createdAt) })));
          emit();
        }, onErr),
        onSnapshot(collection(db, 'forums', f.slug, 'reposts'), (rs) => {
          rdata.set(f.slug, rs.docs.map((d) => ({ ...d.data(), createdAt: ms(d.data().createdAt) })));
          emit();
        }, () => {}),
      ]);
    }
    emit();
  }, onErr);
  return () => { stop(); subs.forEach((os) => os.forEach((o) => o())); };
}

/* ---------- perfiles, seguidores y reposts ---------- */
// profiles/<uid>: datos livianos (estado, miniatura, contadores). Las imágenes grandes viven en profiles/<uid>/media/main.
export async function getProfile(uid) { const d = await getDoc(doc(db, 'profiles', uid)); return d.exists() ? { uid, ...d.data() } : null; }
export function watchProfile(uid, cb) {
  if (!configured) return () => {};
  return onSnapshot(doc(db, 'profiles', uid), (d) => cb(d.exists() ? { uid, ...d.data() } : null), () => cb(null));
}
export async function getMedia(uid) {
  try { const d = await getDoc(doc(db, 'profiles', uid, 'media', 'main')); return d.exists() ? d.data() : {}; } catch (_) { return {}; }
}
export async function saveProfile(uid, p) {
  const b = writeBatch(db);
  b.set(doc(db, 'profiles', uid, 'media', 'main'), { avatar: p.avatar || null, banner: p.banner || null });
  b.update(doc(db, 'profiles', uid), { thumb: p.thumb || null, bannerIdx: p.bannerIdx | 0, status: { e: p.e || '', t: p.t || '' } });
  await b.commit();
}
export async function setFollow(me, target, on) {
  const b = writeBatch(db), f = doc(db, 'follows', me + '_' + target);
  if (on) b.set(f, { from: me, to: target, createdAt: serverTimestamp() }); else b.delete(f);
  b.update(doc(db, 'profiles', target), { followers: increment(on ? 1 : -1) });
  b.update(doc(db, 'profiles', me), { following: increment(on ? 1 : -1) });
  await b.commit();
}
export function watchFollowing(uid, cb) {
  if (!configured) return () => {};
  return onSnapshot(query(collection(db, 'follows'), where('from', '==', uid), limit(500)), (s) => cb(new Set(s.docs.map((d) => d.data().to))), () => cb(new Set()));
}
export async function listFollows(uid, kind) {
  const f = kind === 'followers' ? 'to' : 'from', o = kind === 'followers' ? 'from' : 'to';
  const s = await getDocs(query(collection(db, 'follows'), where(f, '==', uid), limit(50)));
  return s.docs.map((d) => d.data()[o]);
}
export async function setRepost(user, t, on) {
  const b = writeBatch(db), rid = t.id + '_' + user.uid, mid = t.slug + '_' + t.id;
  const a = doc(db, 'forums', t.slug, 'reposts', rid), m = doc(db, 'profiles', user.uid, 'reposts', mid);
  if (on) {
    b.set(a, { threadId: t.id, uid: user.uid, name: user.name, createdAt: serverTimestamp() });
    b.set(m, { slug: t.slug, threadId: t.id, ftitle: t.ftitle || '', fartist: t.fartist || '', title: t.title, body: String(t.body || '').slice(0, 300), author: t.author || '', tuid: t.uid || '', category: t.category || 'debate', createdAt: serverTimestamp() });
  } else { b.delete(a); b.delete(m); }
  await b.commit();
}
const sub = (uid, name) => getDocs(query(collection(db, 'profiles', uid, name), orderBy('createdAt', 'desc'), limit(20)))
  .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt) })));
export const listProfileThreads = (uid) => sub(uid, 'threads');
export const listProfileReposts = (uid) => sub(uid, 'reposts');
