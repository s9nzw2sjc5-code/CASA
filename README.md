# Casa

La app de la casa (tareas, compras, calendario, menú, Ringo y recordatorios),
lista para usarla fuera de Claude como una web normal que se instala en el móvil.

- `casa/` — la app (un solo `index.html`, funciona sin servidor propio).
- `.github/workflows/pages.yml` — la publica gratis en GitHub Pages en cada cambio.

Dirección de la app: **https://s9nzw2sjc5-code.github.io/CASA/** (lleva a `casa/`)

La app es **privada**: al abrirla pide email y contraseña y no enseña nada
hasta entrar. Solo funcionan las cuentas que pongas en las reglas (tú y Juanma).
Lo que veáis los dos está sincronizado entre vuestros móviles.

## 1. Acceso privado con Firebase (una sola vez, ~10 min, gratis)

1. Entra en <https://console.firebase.google.com> → **Crear proyecto** (sin Analytics).
2. **Build → Authentication → Comenzar → Correo electrónico/contraseña → Habilitar.**
   - Pestaña **Users → Añadir usuario**: crea tu cuenta y la de Juanma (email + contraseña).
   - Pestaña **Settings → Acciones de usuario**: **desmarca «Habilitar creación (registro)»**,
     para que nadie más pueda crearse una cuenta.
3. **Build → Firestore Database → Crear base de datos** (ubicación `eur3` o la más cercana,
   modo producción). En **Reglas**, pega el contenido de `casa/firestore.rules`
   con vuestros dos emails y pulsa **Publicar**.
4. **Configuración del proyecto (⚙️) → Tus apps → Web (`</>`)** → registra la app y copia
   el objeto `firebaseConfig`.
5. En este repositorio, edita `casa/config.js` y pon esos valores en `window.CASA_FIREBASE`
   (hay un ejemplo en el archivo).

Los valores de `config.js` no son secretos (cualquier web con Firebase los muestra);
lo que protege los datos son las reglas del paso 3: aunque alguien encuentre la
dirección de la app, sin una de vuestras cuentas no ve nada.

## 2. Publicarla (una sola vez)

1. En GitHub, abre el repositorio → **Settings** → **Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Ve a la pestaña **Actions**, abre «Publicar la app Casa» y pulsa **Run workflow**.
   En un minuto la app está en la dirección de arriba. Cada cambio se publica solo.

## 3. Instalarla en el móvil

- **iPhone (Safari):** abre la dirección → botón Compartir → **Añadir a pantalla de inicio**.
- **Android (Chrome):** abre la dirección → menú ⋮ → **Instalar aplicación**.

Entra con tu email y contraseña la primera vez; después se queda la sesión abierta.
«Cerrar sesión» (abajo del todo en la app) borra los datos guardados en ese móvil.

## 4. Pasar tus datos desde Claude

1. En la app de Claude: **Copias de seguridad** (abajo del todo) → **Descargar archivo**.
2. En la app nueva, ya dentro: **Copias de seguridad** → **Restaurar desde un archivo**.

Tus datos **nunca** se guardan en este repositorio: viven en tu Firebase y en vuestros móviles.

## Importar desde el atajo de iPhone «Recetas IA a Notas»

Casa acepta el texto de una receta en el fragmento `#receta=` de su dirección.
El atajo sigue usando su acción «Usar ChatGPT»; Casa no llama a otra IA para esta importación.

Sin eliminar las acciones existentes, añade al final del atajo:

1. **Texto**: inserta la variable **Respuesta** de «Usar ChatGPT» completa. En otra línea escribe `Link: ` e inserta la variable **Entrada de atajo** con el enlace original.
2. **Codificar URL**: codifica ese texto completo como componente de URL.
3. **Texto**: escribe `https://s9nzw2sjc5-code.github.io/CASA/casa/#receta=` y añade inmediatamente el resultado codificado, sin espacios ni saltos de línea.
4. **Abrir URLs**: abre el texto anterior.

La respuesta debe incluir un título, un encabezado `Ingredientes` y un encabezado `Pasos`, seguidos de sus listas. Casa abre una revisión; solo **Guardar** añade la receta a la cuenta que tenga la sesión iniciada. Si el texto está incompleto, se muestra el formulario de importación para corregirlo. La nota de Apple sigue guardándose si se conservan sus acciones. Se mantiene el enlace original y se evitan duplicados por ese enlace.

El fragmento no forma parte de la petición HTTP y Casa lo retira de la dirección al procesarlo. El atajo continúa dependiendo del acceso que tenga al contenido de cada publicación; no implica que analice el audio o las imágenes del vídeo.
