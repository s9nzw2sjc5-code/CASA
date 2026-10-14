# Casa

La app de la casa (tareas, compras, calendario, menú, Ringo y recordatorios),
lista para usarla fuera de Claude como una web normal que se instala en el móvil.

- `casa/` — la app (un solo `index.html`, funciona sin servidor propio).
- `.github/workflows/pages.yml` — la publica gratis en GitHub Pages en cada cambio.

Dirección de la app (cuando la publiques): **https://s9nzw2sjc5-code.github.io/Videos/**

## 1. Publicarla (una sola vez)

1. En GitHub, abre el repositorio → **Settings** → **Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Ve a la pestaña **Actions**, abre «Publicar la app Casa» y pulsa **Re-run all jobs**
   (o **Run workflow**). En un minuto la app está en la dirección de arriba.

## 2. Instalarla en el móvil

- **iPhone (Safari):** abre la dirección → botón Compartir → **Añadir a pantalla de inicio**.
- **Android (Chrome):** abre la dirección → menú ⋮ → **Instalar aplicación**.

Se abre a pantalla completa con su icono y funciona sin conexión.

## 3. Pasar tus datos desde Claude

1. En la app de Claude: **Copias de seguridad** (abajo del todo) → **Descargar archivo**.
2. En la app nueva: **Copias de seguridad** → **Restaurar desde un archivo** → elige ese archivo.

Tus datos **nunca** se guardan en este repositorio (es público): viven en tu móvil
y, si activas la sincronización, en tu propio Firebase.

## 4. Sincronizar entre vuestros móviles (opcional)

Sin este paso, cada móvil guarda sus datos por separado. Para compartir la casa
con Juanma como en Claude, se usa Firebase (gratis para este uso):

1. Entra en <https://console.firebase.google.com> → **Crear proyecto** (sin Analytics).
2. **Build → Authentication → Comenzar → Correo electrónico/contraseña → Habilitar.**
   En la pestaña **Users**, **Añadir usuario** para ti y para Juanma (email + contraseña).
3. **Build → Firestore Database → Crear base de datos** (ubicación `eur3` o la más cercana,
   modo producción). En **Reglas**, pega el contenido de `casa/firestore.rules`
   con vuestros dos emails y pulsa **Publicar**.
4. **Configuración del proyecto (⚙️) → Tus apps → Web (`</>`)** → registra la app y copia
   el objeto `firebaseConfig`.
5. En este repositorio, edita `casa/config.js` y pon esos valores en `window.CASA_FIREBASE`
   (hay un ejemplo en el archivo). Al guardar, la app se vuelve a publicar sola.
6. Abre la app: te pedirá email y contraseña una vez en cada móvil.

Los valores de `config.js` no son secretos; lo que protege los datos son las reglas
del paso 3 (solo vuestros dos emails pueden leer o escribir).
