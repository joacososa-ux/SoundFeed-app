// Avisos: nuevo seguidor y hilos nuevos de la gente que seguís. Se muestran en la app (campana + aviso) y, si lo permitís, como notificación del dispositivo.
// Sin servidor propio los avisos llegan mientras la app está abierta (o en segundo plano); no se pueden mandar con la app cerrada.
import * as store from './store.js?v=16';

const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (_) { return null; } };

export function initNotifs(ctx) {
  const { h, S, toast, showSheet, closeSheet, ago, avatarEl, onChange } = ctx;
  let uid = null, offA = null, offB = null, follows = [], feed = [], raw = [], done = new Set(), known = null, since = 0;
  const key = (n) => 'sf_' + n + '_' + uid;

  const all = () => [...follows, ...feed].sort((a, b) => b.at - a.at).slice(0, 40);
  const unread = () => { const seen = LS(key('seen')) || 0; return all().filter((n) => n.at > seen).length; };
  const text = (n) => (n.type === 'follow' ? '@' + n.name + ' empezó a seguirte' : '@' + n.name + ' publicó: ' + (n.title || 'un hilo nuevo'));
  const href = (n) => (n.type === 'follow' ? '#perfil-' + n.uid : '#foro-' + n.slug);

  async function system(n) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body: n.type === 'thread' && n.ftitle ? 'en ' + n.ftitle : '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: n.type + n.id, data: { url: location.pathname + href(n) } };
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) await reg.showNotification(text(n), opts); else new Notification(text(n), opts);
    } catch (_) {}
  }
  function alert(n) { if (document.visibilityState === 'visible') toast(text(n)); else system(n); }

  function evaluate() {
    if (!uid || !S.folReady) return;
    let fresh = false;
    for (const e of raw) {
      if (done.has(e.id)) continue; done.add(e.id);
      if (e.uid === uid || !S.following.has(e.uid)) continue;
      feed.unshift(e); fresh = true; alert(e);
    }
    raw = [];
    if (fresh) { feed = feed.slice(0, 30); LS(key('feed'), feed); onChange(); }
  }

  function start(id) {
    stop(); if (!id) return;
    uid = id; feed = LS(key('feed')) || []; known = LS(key('known')); since = LS(key('since')) || Date.now();
    offA = store.watchNotifs(uid, (list) => {
      follows = list;
      if (known === null) known = list.map((n) => n.id); // primera vez: lo que ya había no se avisa
      const k = new Set(known);
      for (const n of list) if (!k.has(n.id)) { k.add(n.id); alert(n); }
      known = [...k]; LS(key('known'), known); onChange();
    });
    offB = store.watchFeedEvents(since, (evs) => {
      for (const e of evs) { raw.push(e); since = Math.max(since, e.at); }
      LS(key('since'), since); evaluate();
    });
  }
  function stop() { if (offA) offA(); if (offB) offB(); offA = offB = null; uid = null; follows = []; feed = []; raw = []; done = new Set(); known = null; }

  function open() {
    if (!uid) return;
    LS(key('seen'), Date.now()); onChange();
    const list = all(), supported = 'Notification' in window;
    const perm = supported ? Notification.permission : 'unsupported';
    const rows = list.length ? list.map((n) => h('a', { class: 'fs-row', href: href(n), onclick: () => closeSheet() },
      avatarEl({ uid: n.uid, name: n.name }, 40), h('span', {}, h('b', {}, text(n)), h('small', {}, ago(n.at))))) : [h('p', { class: 'snote' }, 'Todavía no tenés avisos. Cuando alguien te siga o alguien que seguís publique un hilo, te enteras acá.')];
    const box = h('div', { class: 'nt-perm' });
    const paint = () => {
      const p = supported ? Notification.permission : 'unsupported';
      box.replaceChildren(
        p === 'granted' ? h('p', { class: 'snote' }, 'Avisos del dispositivo activados ✓') :
        p === 'denied' ? h('p', { class: 'snote' }, 'Bloqueaste las notificaciones. Podés habilitarlas desde los ajustes del navegador o de la app.') :
        p === 'unsupported' ? h('p', { class: 'snote' }, 'Este navegador no permite avisos del dispositivo. En iPhone, agregá SoundFeed a la pantalla de inicio (Compartir → Agregar a inicio) y abrí la app desde ahí.') :
        h('button', { class: 'btn cta', type: 'button', onclick: async () => { try { await Notification.requestPermission(); } catch (_) {} paint(); } }, 'Activar avisos del dispositivo'),
        p === 'granted' || p === 'default' ? h('p', { class: 'snote' }, 'Los avisos llegan con la app abierta o en segundo plano. Con la app cerrada del todo no se pueden enviar sin un servidor.') : '');
    };
    paint();
    showSheet('Avisos', [box, h('div', { class: 'fs-list' }, rows)]);
  }
  return { start, stop, evaluate, open, unread };
}
