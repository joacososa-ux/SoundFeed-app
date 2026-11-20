# SoundFeed (versión web: GitHub Pages + Firebase)

Sitio estático (HTML, CSS y JavaScript) que se publica en GitHub Pages. El login con Google y los foros usan Firebase (Authentication + Firestore). No hay servidor propio.

## 1. Crear el proyecto de Firebase
1. https://console.firebase.google.com → **Crear un proyecto** → nombre "soundfeed" (Analytics no hace falta).
2. **Compilación → Authentication → Comenzar → Google → Habilitar**; elegí tu correo como correo de asistencia y guardá.
3. **Compilación → Firestore Database → Crear base de datos** → ubicación cercana (por ejemplo `southamerica-east1`) → **modo de producción**.
4. Pestaña **Reglas** de Firestore: pegá el contenido de `firestore.rules` y **Publicar**.
5. **Configuración del proyecto (engranaje) → Tus apps → `</>` (Web)** → registrá la app (sin Hosting) y copiá el objeto `firebaseConfig`.
6. Pegá esos valores en `js/config.js`. Son públicos: la seguridad la dan las reglas del paso 4.

## 2. Publicar en GitHub Pages
1. En el repositorio: **Settings → Pages → Build and deployment**: *Deploy from a branch*, rama `main`, carpeta **/docs** → Save.
2. Tu link queda como `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.
3. En Firebase → **Authentication → Configuración → Dominios autorizados** → agregá `TU-USUARIO.github.io` (sin la ruta). Sin esto el login con Google falla.

## 3. Probar en tu PC (opcional)
Con la extensión **Live Server** de VS Code abrí `docs/index.html` (queda en `http://127.0.0.1:5500/...`); `127.0.0.1` y `localhost` ya están autorizados en Firebase. El login no funciona abriendo el archivo con doble clic (`file://`).

## 4. Spotify para escuchar la canción completa (opcional)
1. https://developer.spotify.com/dashboard → **Create app** → *Web API*.
2. **Redirect URI**: la dirección exacta de tu sitio, con barra final: `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/` (para probar local, agregá también la de Live Server, por ejemplo `http://127.0.0.1:5500/docs/`).
3. Copiá el **Client ID** en `spotifyClientId` de `js/config.js`. No uses el *Client Secret* (no va en el navegador).
4. En modo desarrollo, Spotify solo deja entrar a quienes agregues en **User Management** (hasta 25 personas).
5. Cada usuario toca **Conectar Spotify** en la app. Con Premium suena completa; con cuenta gratuita, un fragmento.

## 5. YouTube para la canción completa (opcional)
1. Google Cloud (el mismo proyecto de Firebase sirve) → **APIs y servicios → Biblioteca → YouTube Data API v3 → Habilitar**.
2. **Credenciales → Crear credencial → Clave de API**, y en *Restricciones de la aplicación* elegí **Sitios web** con `https://TU-USUARIO.github.io/*`. Restringila a esa API.
3. Pegala en `youtubeApiKey`. La cuota gratuita alcanza para unos cientos de búsquedas por día.

## 6. Perfiles, seguidores, reposts y reproductor
- Cada vez que cambie `firestore.rules`, copiá todo el archivo en Firestore → **Reglas** y **Publicar**. Los perfiles, seguir y repostear no funcionan hasta que lo hagas.
- Foto y portada se guardan en Firestore ya comprimidas (los GIF livianos, de hasta ~240 KB la foto y ~380 KB la portada, se guardan animados). No se usa Firebase Storage.
- El reproductor flotante (`js/player.js`, `player.css`) es una prueba: para sacarlo, borrá esos dos archivos, su `<link>` en `index.html` y las líneas marcadas `player:` en `js/app.js`.

## Cómo funciona
- Visitas: leen foros y oyen fragmentos de 30 s (iTunes). Con Google: abren foros, publican y dan me gusta.
- Los hilos iniciales de cada foro se generan en el navegador (no se guardan); lo que escribe la gente va a Firestore.
- Reglas de seguridad (`firestore.rules`): lectura pública; escribir exige sesión, el `uid` debe ser el propio, hay límites de largo, un "me gusta" por persona y nadie puede editar o borrar lo ya publicado.

## Archivos
```
index.html, style.css   interfaz
js/config.js            configuración pública (Firebase, Spotify, YouTube)
js/store.js             Firebase: login y Firestore
js/music.js             portada y reproducción (iTunes, YouTube, Spotify)
js/recommend.js         recomendador por ánimo y hilos iniciales
js/catalog.js           catálogo base
js/app.js               pantallas
js/profile.js           perfiles, seguidores y edición de imágenes
js/player.js            reproductor flotante (prueba)
firestore.rules         reglas de seguridad
```

## 7. App instalable y avisos

- `manifest.webmanifest`, `sw.js` e `icons/` hacen que SoundFeed se pueda instalar (iPhone: Compartir → Agregar a inicio; Android/Chrome: Instalar app).
- Avisos de nuevo seguidor y de hilos nuevos de la gente que seguís: campana en el menú de cuenta. Llegan con la app abierta o en segundo plano. Para avisar con la app cerrada del todo hace falta un servidor (Cloud Functions + Firebase Cloud Messaging), que exige el plan Blaze.
- Hay que volver a publicar `docs/firestore.rules` (se agregaron `notifs` y `feedEvents`).
