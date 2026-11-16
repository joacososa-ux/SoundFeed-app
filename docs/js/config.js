// Configuración pública de SoundFeed. Estos valores NO son secretos (van en el navegador):
// la seguridad la dan las reglas de Firestore (firestore.rules) y las restricciones de dominio.

// 1) Firebase: consola de Firebase > Configuración del proyecto > Tus apps > App web > "Config".
export const firebaseConfig = {
  apiKey: 'PEGAR_AQUI',
  authDomain: 'PEGAR_AQUI',
  projectId: 'PEGAR_AQUI',
  storageBucket: 'PEGAR_AQUI',
  messagingSenderId: 'PEGAR_AQUI',
  appId: 'PEGAR_AQUI',
};

// 2) Spotify (opcional): Client ID de developer.spotify.com/dashboard. Usa PKCE, sin secreto.
export const spotifyClientId = '';

// 3) YouTube (opcional): clave de YouTube Data API v3, restringida a tu dominio de GitHub Pages.
export const youtubeApiKey = '';
