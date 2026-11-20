// Efectos del aspecto premium: onda al presionar, luz del cristal, transiciones entre pantallas,
// explosión de partículas y el interruptor de "cristal líquido".
const root = document.documentElement;
const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const EASE = 'cubic-bezier(.22,1,.36,1)';

/* ---------- cristal líquido (se guarda en el navegador; por defecto activado) ---------- */
export const isGlass = () => root.classList.contains('glass');
export function setGlass(on) {
  root.classList.toggle('glass', !!on);
  try { localStorage.setItem('sf_glass', on ? '1' : '0'); } catch (_) {}
}

/* ---------- onda al presionar ---------- */
const RIPPLE = '.btn,.chip,.a-btn,.mi,.tab,.songbtn,.like,.fav,.w-row,.w-chip,.thread,.card,.sr-item,.sheet-x,.trend button,.ni,.favgo,.w-go,.a-eye,.a-chips button,.sidesong';
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest && e.target.closest(RIPPLE);
  if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, x = document.createElement('span');
  x.className = 'rip'; x.style.width = x.style.height = s + 'px';
  x.style.left = (e.clientX - r.left - s / 2) + 'px'; x.style.top = (e.clientY - r.top - s / 2) + 'px';
  b.appendChild(x); setTimeout(() => x.remove(), 700);
}, { passive: true });

/* ---------- luz que sigue al puntero sobre el cristal ---------- */
const GLASS = '.card,.trend button,.panel,.player,.thread,.feedcol,.sidecol,.favcard,.compose,.picker,.lock,.pickbox,.sr-item,.acct,.nav,.fv';
let lx = 0, ly = 0, lt = null, raf = 0;
function light() {
  raf = 0; if (!lt || !isGlass()) return;
  for (let el = lt; el && el !== document.body; el = el.parentElement) {
    if (el.matches && el.matches(GLASS)) { const r = el.getBoundingClientRect(); el.style.setProperty('--lx', (lx - r.left) + 'px'); el.style.setProperty('--ly', (ly - r.top) + 'px'); }
  }
}
const track = (e) => { lx = e.clientX; ly = e.clientY; lt = e.target; if (!raf) raf = requestAnimationFrame(light); };
document.addEventListener('pointermove', track, { passive: true });
document.addEventListener('pointerdown', track, { passive: true });

/* ---------- partículas ---------- */
export function burst(el, colors) {
  if (reduce() || !el) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, cols = colors || ['#ff3d9a', '#2be3f2', '#7c5cff', '#ffd166'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('i'); p.className = 'fx-pt'; p.style.left = (cx - 4) + 'px'; p.style.top = (cy - 4) + 'px'; p.style.background = cols[i % cols.length];
    document.body.appendChild(p);
    const a = i / 14 * Math.PI * 2 + Math.random() * .4, d = 48 + Math.random() * 44;
    const an = p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(0)`, opacity: 0 }], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)' });
    an.onfinish = () => p.remove();
  }
}

/* ---------- transición entre pantallas ---------- */
// 1) ghost(view): copia visual (sin iframes) del contenido actual, antes de reconstruirlo.
// 2) swap(view, ghost, mode): sale la copia y entra el contenido nuevo.
//    mode: -1 / 1 (izquierda o derecha según el orden de la barra), 'push' (entrar a un foro), 'pop' (volver).
export function ghost(view) {
  if (reduce() || !view.firstChild || !view.offsetHeight) return null;
  window.scrollTo(0, 0);
  const g = view.cloneNode(true);
  g.querySelectorAll('iframe,audio,video,[id]').forEach((n) => { if (n.matches('iframe,audio,video')) n.remove(); else n.removeAttribute('id'); });
  g.removeAttribute('id'); g.classList.add('view-ghost'); g.setAttribute('aria-hidden', 'true');
  g.style.left = view.offsetLeft + 'px'; g.style.top = view.offsetTop + 'px'; g.style.width = view.offsetWidth + 'px';
  view.parentElement.appendChild(g);
  return g;
}
export function swap(view, g, mode) {
  if (reduce()) { if (g) g.remove(); return; }
  const blur = (n) => `blur(${n}px)`;
  let out, inn;
  if (mode === 'push') { out = [{ opacity: 1, transform: 'none', filter: blur(0) }, { opacity: 0, transform: 'scale(.94)', filter: blur(8) }]; inn = [{ opacity: 0, transform: 'translateY(48px) scale(.97)', filter: blur(10) }, { opacity: 1, transform: 'none', filter: blur(0) }]; }
  else if (mode === 'pop') { out = [{ opacity: 1, transform: 'none', filter: blur(0) }, { opacity: 0, transform: 'translateY(48px) scale(.97)', filter: blur(8) }]; inn = [{ opacity: 0, transform: 'scale(.94)', filter: blur(10) }, { opacity: 1, transform: 'none', filter: blur(0) }]; }
  else { const d = mode || 1; out = [{ opacity: 1, transform: 'none', filter: blur(0) }, { opacity: 0, transform: `translateX(${-d * 38}px) scale(.97)`, filter: blur(8) }]; inn = [{ opacity: 0, transform: `translateX(${d * 48}px) scale(.97)`, filter: blur(10) }, { opacity: 1, transform: 'none', filter: blur(0) }]; }
  if (g) { const a = g.animate(out, { duration: 260, easing: 'ease-in', fill: 'forwards' }); a.onfinish = () => g.remove(); setTimeout(() => g.remove(), 700); }
  const run = view.animate(inn, { duration: 620, easing: EASE });
  run.onfinish = () => { view.style.filter = ''; };
  stagger(view);
}

/* ---------- entrada escalonada de los bloques de una pantalla ---------- */
export function stagger(box, sel) {
  if (reduce() || !box) return;
  const items = [...box.querySelectorAll(sel || ':scope > *, :scope > .feedpage > *, :scope .grid > *, :scope .favgrid > *')].slice(0, 12);
  items.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(22px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 90 + i * 55, easing: EASE, fill: 'backwards' }));
}
