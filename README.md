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

Los tiques muestran el total destacado y el resumen. Cuando comercio, fecha,
cantidades y precios están completos, las líneas suman el total y no hay lecturas
dudosas o coincidencias ambiguas, «Guardar compra» guarda directamente desde
ese resumen. «Corregir lectura» permite editar la transcripción. En los demás
casos se abre la revisión para completar los datos; cuadrar la suma por sí solo
no demuestra que todos los campos sean correctos.

El progreso y los errores aparecen junto al botón, incluso ante un fallo al
recoger un campo del formulario. La confirmación espera la transacción y su
relectura, con un límite de espera y reintento idempotente. La foto se archiva
**después** de verificar la compra; un bloqueo o error de IndexedDB no impide
registrar el gasto. Si el archivo local tarda más de 2,5 segundos se informa de
que la compra se guardó sin poder confirmar el archivo de la foto.

La revisión enumera cada producto y el campo pendiente (cantidad, nombre,
importe o cantidad para casa). Los avisos abren el producto y enfocan ese campo;
los campos inválidos tienen una marca visible y `aria-invalid`. Al corregirlos
se retira su aviso. La suma siempre incluye los importes válidos ya leídos,
aunque falte una cantidad. Un descuadre real indica cuánto falta o sobra sin
inventar qué producto se omitió.

Cada artículo dudoso conserva el texto original leído y, si hay coordenadas,
un recorte de su línea en la foto. El precio de la línea admite coma decimal.
«Validar artículo» confirma esa línea por separado; no guarda aún la compra.
Los artículos pendientes impiden el guardado final aunque la suma ya cuadre.
Cambiar después un precio, cantidad o destino invalida esa confirmación.
Al añadir otra línea se conservan las correcciones y confirmaciones existentes.

La revisión despliega los productos dudosos y permite abrir los demás. Cuando hay
coordenadas del OCR muestra un recorte de la foto junto al producto. Las
correcciones de nombre confirmadas se recuerdan por comercio en
`cook.receiptAliases`; nunca cambian automáticamente un importe.

Las compras parciales restan unidades de la lista y conservan el resto. Para
productos por peso se confirma cuántas unidades de la lista se han comprado.
El historial permite deshacer importaciones nuevas mediante un registro de los
campos afectados: gasto, existencias, lista, precios y habituales. La transacción
se detiene si esos datos cambiaron después. Los tickets anteriores a esta versión
no tienen un registro para deshacer con seguridad. Una compra anulada conserva
su historial con gasto cero; volver a importarla no crea dos registros con el
mismo identificador.

Las fotos/PDF originales se conservan en IndexedDB **solo en el dispositivo de
subida**, tras verificar la compra, y se consultan desde el historial. No
se insertan imágenes en `hogar/estado`, no se publican en GitHub y no se ha
configurado Firebase Storage. Borrar los datos del navegador elimina esas copias;
otro móvil muestra que no dispone de la foto. Los artículos y gastos siguen
sincronizándose por Firestore. Si falla el archivo local, se informa sin impedir el guardado del gasto.

Al terminar una compra se ofrece fotografiar el ticket o guardarla con el ticket
pendiente. El aviso persiste en `buys[].receiptPending`, aparece en Compras y el
historial y se sincroniza con la casa. Cancelar la selección de foto conserva el
pendiente. Repetir ese intento desde el mismo carro reutiliza el borrador.

Al comprobar más tarde se completa el mismo registro, reemplazando el importe
provisional por el total confirmado. `pendingInventory` registra las cantidades
que ya se añadieron a casa: la revisión permite relacionarlas con las líneas del
ticket y añadir solo la diferencia, incluyendo los productos extra. Las reducciones
que dejarían existencias negativas se detienen. Los productos del carro no detectados
se señalan para revisión y no se eliminan silenciosamente de las existencias.
El aviso desaparece tras guardar y verificar el ticket; no es una notificación push.

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

## Orden de Novedades

Novedades muestra primero los productos detectados más recientemente como nuevos
para el código postal y almacén configurados. `newSince` conserva esa fecha en el
catálogo diario; no representa una fecha oficial de lanzamiento. Las fechas del
catálogo inicial se reconstruyeron de su historial Git. Ver un producto no cambia
su posición, y al entrar se abre el filtro Todo. Si varias novedades tienen la
misma fecha de detección se ordenan por nombre.

## Producto a Compras mediante foto

La versión 70 ofrece cámara/galería y recorte de etiquetas en Compras, coincidencias y búsqueda para asociar
la foto al producto. Tolera etiquetas parciales y pequeñas erratas. Exige confirmar los envases y recuerda las asociaciones
confirmadas en el estado compartido del hogar, sin subir las fotos. Consultar
[validación, límites y pruebas](docs/foto-productos.md).


## Productos de tickets anteriores

En el historial de compras, tocar el nombre de un producto abre una ficha breve
para elegir la cantidad y añadirlo a la cesta de la lista abierta o guardarlo en
Habituales. También funciona con nombres antiguos sin enlace al catálogo. Los
artículos ya presentes en esa lista se indican para evitar duplicarlos. Las
casillas permiten seguir repitiendo varios artículos a la vez; los descuentos
no se vuelven a añadir como productos. Estas acciones no modifican el gasto del
ticket ni las existencias de casa.

Prueba de navegador con datos ficticios y Firebase bloqueado:

```sh
node tests/history-products.cjs
```
