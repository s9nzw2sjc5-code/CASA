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

El lector de fotos ejecuta los modelos de RapidOCR/PP-OCRv4 en el navegador con
ONNX Runtime Web y OpenCV, dentro de un worker que se libera al terminar o cancelar.
No necesita una clave de ChatGPT ni un servidor de OCR. Los modelos se descargan
solo en la primera lectura y se conservan en una caché independiente. Las fotos
no se envían a un servicio externo de reconocimiento.

Se conservan las coordenadas y la confianza del texto para reconstruir filas y
separar cantidades pegadas al nombre cuando existe evidencia de la columna.
Las cantidades que no se leen deben confirmarse en la revisión. Los importes no
se completan con el residuo de la suma. Sigue admitiendo PDF y texto corregido.
Una suma correcta no garantiza que todos los nombres y cantidades sean correctos.
El modelo probado es el distribuido con RapidOCR 1.4.4; no se promete precisión
universal ni se ha certificado su rendimiento en un iPhone real. Licencias,
versiones y hashes: `casa/ocr/THIRD_PARTY.md` y `casa/ocr/assets.sha256`.

Todos los tiques muestran primero una **transcripción editable**. «Preparar
compra» interpreta ese texto y abre una revisión; no se escribe nada hasta pulsar
«Guardar y verificar». La compra se valida en céntimos: comercio y fecha son
obligatorios y las líneas deben sumar exactamente el total. En la revisión se
pueden corregir cantidades, añadir líneas omitidas, elegir el destino y la
cantidad que añadir a casa y el producto concreto que quitar de Compras. Las
coincidencias ambiguas no se quitan sin selección. Se puede volver a la
transcripción o recortar y releer la foto manteniendo la huella original.

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
node --test tests/receipts.test.cjs tests/receipt-layout.test.cjs
node tests/receipt-flow.cjs
```

La segunda usa Playwright y Chromium (`/usr/bin/chromium`, configurable mediante
`CHROMIUM_PATH`). Ejecuta la app y su adaptador real de Firebase con un transporte
simulado; no demuestra acceso o escritura en el Firestore de producción.

Para comprobar también los valores con el SDK oficial de Firebase 10.14.1,
instálalo en una carpeta temporal y ejecuta `tests/receipt-sdk.cjs` con
`CASA_FIREBASE_TEST_SDK` apuntando al directorio del paquete `firebase`.
Esta prueba valida los datos con `WriteBatch.update` sin llamar a `commit`.
Los historiales de precios se guardan como listas de objetos, no listas anidadas,
y se conserva la lectura de historiales antiguos del almacenamiento local.

Para medir el OCR real con una foto y una transcripción revisada, guardadas fuera
de este repositorio público:

```sh
node tests/receipt-ocr-quality.cjs /tmp/ticket.jpg /tmp/referencia.json /tmp/informe.json
```

La referencia contiene `store`, `date`, `total` y `lines` con `name`, `units`,
`price` y, si procede, `kg`. La prueba ejecuta el lector de la app en la foto y
tres variaciones simuladas de brillo y arrugas; bloquea Firebase. Compara también
nombres y cantidades, no solo el número de líneas o la suma. El código de salida
2 significa que alguna condición no logró coincidencia exacta. Estas simulaciones
no sustituyen una muestra de capturas reales ni garantizan calidad universal.
