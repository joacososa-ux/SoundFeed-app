// Configuración pública de SoundFeed. Estos valores NO son secretos (van en el navegador):
// la seguridad la dan las reglas de Firestore (firestore.rules) y las restricciones de dominio.

// 1) Firebase: consola de Firebase > Configuración del proyecto > Tus apps > App web > "Config".
export const firebaseConfig = {
  apiKey: 'AIzaSyAqhN4NHmfEig-yF44T4QE8ZP_C_0BuM9E',
  authDomain: 'soundfeed-52ee5.firebaseapp.com',
  projectId: 'soundfeed-52ee5',
  storageBucket: 'soundfeed-52ee5.firebasestorage.app',
  messagingSenderId: '827920206282',
  appId: '1:827920206282:web:0b95f072d7354010646733',
};

// 2) Spotify (opcional): Client ID de developer.spotify.com/dashboard. Usa PKCE, sin secreto.
export const spotifyClientId = '3e29998515964033bfa582f5ef047731';

// 3) YouTube (opcional): clave de YouTube Data API v3, restringida a tu dominio de GitHub Pages.
export const youtubeApiKey = 'AIzaSyBE7DwvR-0P8zSBfTijrLtNuJB3BhLtsKw';
