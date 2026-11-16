import { CATALOG } from './catalog.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const slugify = (artist, title) => norm(`${artist} ${title}`).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export const LABEL = { feliz: 'Feliz', triste: 'Triste', energico: 'Enérgico', relajado: 'Relajado', nostalgico: 'Nostálgico', romantico: 'Romántico', motivado: 'Motivado', intenso: 'Intenso', reflexivo: 'Reflexivo' };
export const MOODS = CATALOG.moods;
const STEMS = {
  feliz: ['feliz', 'alegr', 'content', 'animad', 'happy', 'fiest'],
  triste: ['trist', 'llor', 'dolor', 'ruptur', 'deprim', 'angust', 'sad', 'extra'],
  energico: ['energi', 'bailar', 'correr', 'gimnas', 'entren', 'salt', 'pila'],
  relajado: ['relaj', 'tranquil', 'calm', 'dormir', 'estudi', 'paz', 'chill', 'descans'],
  nostalgico: ['nostalg', 'recuerd', 'infanc', 'pasado'],
  romantico: ['romant', 'amor', 'enamor', 'cita', 'pareja', 'beso'],
  motivado: ['motiv', 'supera', 'meta', 'objetiv', 'ganar', 'lograr', 'empuj'],
  intenso: ['intens', 'enoj', 'rabia', 'furia', 'bronca', 'potente', 'fuert'],
  reflexivo: ['reflex', 'pensar', 'filosof', 'profund', 'medit', 'sentido'],
};
function detectMoods(text) {
  const tokens = norm(text).split(/[^a-z]+/).filter(Boolean);
  return Object.keys(STEMS).filter((m) => tokens.some((t) => STEMS[m].some((s) => t.startsWith(s))));
}

export function recommend(moods, text, limit = 6) {
  const chosen = new Set(moods), fromText = new Set(detectMoods(text)), t = norm(text);
  const scored = CATALOG.tracks.map((track) => {
    let score = 0; const why = [];
    for (const m of track.moods) {
      if (chosen.has(m)) { score += 3; why.push(LABEL[m].toLowerCase()); }
      else if (fromText.has(m)) { score += 2; why.push(LABEL[m].toLowerCase()); }
    }
    if (t && t.includes(norm(track.artist))) { score += 4; why.push(`te gusta ${track.artist}`); }
    const words = norm(track.genre).split(/[^a-z]+/).filter((w) => w.length > 3);
    if (t && words.some((w) => t.includes(w))) { score += 2; why.push(track.genre.toLowerCase()); }
    return { track, score, why: [...new Set(why)], r: Math.random() };
  });
  const signal = scored.some((x) => x.score > 0);
  scored.sort((a, b) => (signal ? b.score - a.score : 0) || a.r - b.r);
  return scored.filter((x) => !signal || x.score > 0).slice(0, limit).map((x) => ({
    title: x.track.title, artist: x.track.artist, genre: x.track.genre, moods: x.track.moods,
    reason: x.why.length ? `Coincide con: ${x.why.join(', ')}.` : 'Una sugerencia al azar para descubrir algo nuevo.',
  }));
}

// Hilos iniciales del foro: se generan al abrir la canción (no se guardan, ids s1..s5).
export function seedThreads(t, createdAt) {
  const mood = t.moods && t.moods[0] ? LABEL[t.moods[0]].toLowerCase() : 'distinto';
  const mk = (n, category, title, body) => ({ id: 's' + n, seed: true, category, title, body, author: 'SoundFeed', createdAt });
  return [
    mk(1, 'letra', `¿Qué te transmite "${t.title}"?`, `Abrimos el análisis de la letra de "${t.title}" de ${t.artist}. Contá con tus palabras qué imagen, idea o verso te quedó y por qué. Para respetar a los autores, citá como mucho una frase corta: lo importante es tu interpretación.`),
    mk(2, 'letra', '¿De qué trata realmente? Interpretaciones', 'Cada oyente la entiende distinto. ¿Es una historia personal, una crítica, una metáfora? Compartí tu lectura y respondé a la de otros.'),
    mk(3, 'debate', `${t.artist}: ¿es esta su mejor canción?`, `Debate abierto. Defendé tu elección dentro de la discografía de ${t.artist} o proponé otra que la supere.`),
    mk(4, 'anecdotas', '¿Cuándo y dónde la escuchaste por primera vez?', 'Todas las canciones tienen una historia detrás de quien las escucha. Contanos la tuya.'),
    mk(5, 'similares', `Si te gusta "${t.title}", escuchá…`, `Recomendá artistas o temas parecidos, sobre todo para quien busca algo ${mood}. Explicá qué tienen en común.`),
  ];
}
