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

## Importación de tiques

El lector reutiliza Tesseract en español, cargado desde jsDelivr. También admite
el PDF del tique o un archivo de texto corregido (`.txt`). La compra se
valida en céntimos: comercio y fecha son obligatorios y las líneas deben sumar
exactamente el total. Solo se guarda automáticamente una lectura de alta
confianza, con productos identificados y sin posibles gastos duplicados. En los
demás casos se abre una revisión para corregir datos, cantidades y destinos en
casa, o añadir líneas que el OCR haya omitido. En fotos, la revisión ofrece
«Recortar foto y volver a leer» para aislar el papel sin salir de Casa; mantiene
la huella del archivo original para no duplicar una compra al releerla.

La importación exige sesión iniciada, conexión y una lectura del servidor.
`receipts.js` prepara una actualización de los campos de `hogar/estado` usados
por la app; `transactPatch` de `sync.js` la aplica con `transaction.update`,
sin reemplazar el documento ni crear colecciones. La compra conserva una huella
SHA-256 de fecha, total y comercio, otra de sus líneas y el hash del archivo.
Las comprobaciones se repiten dentro de la transacción para que reintentos o dos
móviles no dupliquen el gasto ni las existencias. Una relectura del servidor
verifica el registro antes de anunciar éxito. Completar un gasto previo conserva
su ID y no vuelve a incrementar el inventario. Las semanas van de lunes a domingo
según la fecha de compra, no la fecha de subida.

Pruebas sin credenciales ni datos personales:

```sh
node --test tests/receipts.test.cjs
node tests/receipt-flow.cjs
```

La segunda usa Playwright y Chromium (`/usr/bin/chromium`, configurable mediante
`CHROMIUM_PATH`). Ejecuta la app y su adaptador real de Firebase con un transporte
simulado; no demuestra acceso o escritura en el Firestore de producción.
