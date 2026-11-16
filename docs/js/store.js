// Acceso a Firebase (login con Google y base de datos Firestore). Todo lo de Firebase vive en este archivo.
import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, addDoc, deleteDoc, collection, query, orderBy, limit, onSnapshot, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export const configured = !Object.values(firebaseConfig).some((v) => !v || String(v).startsWith('PEGAR'));
let app, auth, db;
if (configured) { app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app); }

const ms = (t) => (t && t.toMillis ? t.toMillis() : Date.now()); // serverTimestamp() llega null hasta confirmarse

/* ---------- sesión ---------- */
export function watchUser(cb) {
  if (!configured) return cb(null);
  return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, name: u.displayName || (u.email || 'Oyente').split('@')[0], photo: u.photoURL || null } : null));
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
  const state = { forum: undefined, threads: [], posts: [], likes: [] };
  const push = () => { if (state.forum !== undefined) cb({ ...state }); };
  const sub = (name, key, order) => onSnapshot(order ? query(collection(db, 'forums', slug, name), orderBy('createdAt', 'asc')) : collection(db, 'forums', slug, name),
    (s) => { state[key] = s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt) })); push(); }, onErr);
  const offs = [
    onSnapshot(doc(db, 'forums', slug), (d) => { state.forum = d.exists() ? { slug, ...d.data(), createdAt: ms(d.data().createdAt) } : null; push(); }, onErr),
    sub('threads', 'threads', true), sub('posts', 'posts', true), sub('likes', 'likes', false),
  ];
  return () => offs.forEach((f) => f());
}
export const addThread = (user, slug, category, title, body, premium) =>
  addDoc(collection(db, 'forums', slug, 'threads'), { category, title, body, uid: user.uid, author: user.name, createdAt: serverTimestamp(), ...(premium ? { premium: true } : {}) });
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
