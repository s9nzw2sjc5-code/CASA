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

El progreso y los errores aparecen junto al botón, en una barra visible durante
el desplazamiento. Se distinguen conexión, sincronización, escritura y
verificación, y cada espera de red tiene un límite. Una lectura de servidor
correcta permite recuperarse de un aviso antiguo de desconexión, sin evitar las
reglas de acceso a Firestore.

Al confirmar el guardado, se conserva una transcripción pendiente en el navegador
antes de enviar la compra. Si la red falla o no se puede verificar, aparece en
Compras con «Retomar», incluso al recargar. El reintento conserva la huella y las
selecciones de la compra; comprueba primero los datos remotos. No crea un gasto
provisional adicional. El borrador solo se retira después de verificar el guardado.
Los borradores están separados por proyecto y se borran al cerrar sesión, como
los demás datos locales de la cuenta. No sustituyen al historial compartido.

La foto se archiva localmente en IndexedDB desde la revisión y en paralelo al envío para conservarla
también si este falla; no bloquea la escritura en Firestore. Al retomar se recupera
si está disponible en ese dispositivo. Un error o una espera de más de 2,5 segundos
al archivar no impide registrar el gasto y se indica cuando no pudo conservarse.

La revisión muestra en una tarjeta el total del ticket, la suma de artículos y
la diferencia. Los importes se pueden editar directamente en cada fila; abrir
el producto permite cambiar cantidad, medida y precio unitario. «Listo» cierra
la edición de esa fila; no inventa un importe ni resuelve por sí solo un descuadre.
Los filtros «Todos» y «Por revisar» conservan los campos escritos. Las
opciones de inventario y lista permanecen disponibles en un desplegable.
La barra de acciones está fuera del área desplazable y no tapa los productos.
Se ha probado el editor en temas claro y oscuro y anchos de 320 a 430 píxeles.

Cuando el ticket trae precio por unidad, se conserva al editar en vez de
recalcularlo dividiendo el importe. Una inconsistencia muestra la cuenta concreta
(cantidad × precio por unidad) y permite aplicar ese importe explícitamente.
Nunca se utiliza la diferencia global para inventar el precio de un producto.
Si solo hay un descuadre sin un campo identificado, se puede consultar la foto,
editar los importes o añadir la línea que falta; no se señala un producto al azar.

Las correcciones se conservan localmente desde la revisión, antes de intentar
el guardado, incluso al salir o recargar. Cambiar solo el formato de un número
no borra su confirmación. Releer un recorte o la misma foto conserva los datos
corregidos cuando existe una coincidencia inequívoca; una corrección sin
coincidencia queda visible para decidir, sin descartarla ni sumarla en silencio.
Solo el guardado verificado en Firestore completa la compra. Las revisiones
locales no cuentan como gastos y no sustituyen al historial compartido.

El intérprete conserva las líneas de artículos cuyo precio no se haya leído,
con su texto original y el importe en blanco. Admite nombres partidos en varias
líneas y espacios en los separadores decimales sin perder confianza ni coordenadas.
Si al menos dos filas demuestran las columnas de precio unitario e importe,
una cifra aislada en P.Unit no se trata como el importe de la línea.
Las filas se alinean compensando la inclinación y, cuando se distinguen las
cabeceras y el total, la curvatura entre ambas columnas. Así se evita asociar
un precio al producto de arriba o de abajo. Un separador «:» leído en la columna
de importes de un artículo se puede normalizar a coma con contexto suficiente;
se conserva el texto original y se marca la lectura como ajustada para confirmar.
Las horas de la cabecera no se cambian. También se conservan los números que
forman parte del nombre del producto al separar la cantidad comprada.

Las cantidades que no se leen y los importes ausentes siguen necesitando un dato
real. El OCR continúa siendo local; estas mejoras no garantizan leer cualquier
foto ni identifican una omisión a partir del descuadre por sí solo.

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
node tests/receipt-review-flow.cjs
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

Desde la versión 85, «Añadir producto con foto» incluye «Probar sin añadir a
Compras». Permite elegir una foto, comprobar las propuestas y usar «Validar y
recordar» para guardar la asociación correcta sin añadir artículos, cambiar la
despensa ni registrar gastos. Cancelar no enseña la asociación. La casilla vuelve
al modo normal al abrir la siguiente foto.


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


## Habituales por lista

Los Habituales existentes se conservan en Súper. Farmacia, Para la casa y las
listas nuevas tienen sus propios favoritos. Las estrellas de un artículo y las
acciones del historial usan la lista correspondiente; el catálogo de Mercadona
mantiene las estrellas de Súper. Quitar un favorito de una lista no lo quita de
las demás. La reposición automática sigue asociada a su lista.

Se conserva `cook.fav` para Súper y las demás listas guardan sus claves de
favoritos en campos independientes `cook["favList:" + listId]`. Esto utiliza la
sincronización por claves existente, sin borrar ni redistribuir favoritos antiguos.

```sh
node --test tests/fav-lists.test.cjs
node tests/fav-lists.cjs
```


## Habituales que faltan en el catálogo

La versión 74 mantiene los nombres e imágenes disponibles en la información del
favorito, registros de la casa y etiquetas archivadas del catálogo público.
`tools/mercadona.py` conserva las etiquetas retiradas en `mercadona.json.retired`,
fuera de los productos y precios actuales; el archivo inicial se reconstruyó de
las versiones públicas guardadas en Git. No se han cambiado los precios activos.

Un identificador perdido nunca se usa como nombre recortado ni se añade como
un número a la cesta. Si no se puede recuperar la ficha, «Identificar» permite
asociar el favorito a otro producto o quitarlo de esa lista. Las reposiciones de
ese favorito en la misma lista conservan sus plazos al volver a asociarlo. Si
falla una foto, se muestra un marcador manteniendo el nombre. Los favoritos de
otras listas y los tickets anteriores se conservan.

```sh
node tests/habit-recovery.cjs
node --test tests/habit-metadata.test.cjs
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -p 'test_retired_products.py'
```

## Apuntar lo que se ha acabado

En «En casa», encima de la foto de la nevera, «¿Qué se ha acabado?» abre una entrada
rápida de texto. Acepta el nombre o frases como «se ha acabado la leche». Muestra
coincidencias de la despensa, mantiene las variedades y negaciones del nombre y
pide elegir cuando hay varias coincidencias. Se apunta un producto cada vez.

Desde la versión 86 también sugiere referencias de Mercadona mientras se escribe,
con foto, tamaño y precio. Al elegir una, el producto llega a Compras con su
referencia e imagen. Si ya existía una línea manual, se actualiza sin aumentar su
cantidad ni desmarcar lo comprado. Si se corresponde con algo apuntado en casa,
ese registro se vincula y queda agotado; cuando hay varios posibles se pide cuál.
Las existencias no se inventan para productos aún no registrados y los gastos
anteriores se conservan. La búsqueda no reconstruye el teclado ni pierde el foco.

Al confirmar, el producto seleccionado queda con cantidad cero y se añade una
unidad a la lista Súper si no estaba allí. También se comprueban los productos ya
tachados en el carro para no duplicarlos ni aumentar su cantidad. Si no existe en
la despensa, se añade el nombre a Compras sin crear existencias ficticias. La
ventana permanece abierta para apuntar el siguiente producto; las acciones se
pueden deshacer con el mecanismo existente de Casa. Los gastos no se modifican.

```sh
node --test tests/finished-pantry.test.cjs
node tests/finished-pantry.cjs
```

## Inventario visual sin medir lo que queda

Desde la versión 84, «En casa» usa miniaturas para los productos con foto y filas
con el nombre para los que no tienen foto o no pueden cargarla. Los productos
siguen agrupados por categorías y con filtros de ubicación. Solo hay una papelera y un carrito 🛒 sin fondo;
este último se desactiva cuando el producto ya está agotado y en Compras. Al tocar la foto o el nombre
se abre una imagen grande, el nombre, la última compra
registrada y su comercio, la ubicación y el estado. La fecha se obtiene del
historial de compras por producto o vínculo al inventario, excluyendo tickets
anulados; si no hay registro se indica. Editar la ficha no inventa una compra.
Los campos para cambiar nombre, ubicación o caducidad están plegados.
«Asociar foto y categoría», visible en la ficha, permite buscar un producto del
catálogo y ver su foto y categoría antes de guardar. Al confirmar, la fila pasa
a miniatura dentro de esa categoría. Se conserva el nombre, el estado, las medidas,
la ubicación y la caducidad, sin añadir compras ni marcarlo como habitual. La
asociación se guarda con el producto y se sincroniza con el resto de la casa.
Cancelar conserva la ficha anterior y una referencia ya asociada a otro artículo
se rechaza para evitar duplicados.
El buscador de asociación muestra coincidencias por nombre y precio pagado en
compras anteriores de Mercadona. Compara precio por envase o por kg, muestra la
fecha del precio anterior y el precio actual, y mantiene visibles las alternativas
para confirmar. Excluye tickets anulados, importes sin cantidades comprobables,
ajustes negativos y precios estimados de la cesta. Una referencia identificada
previamente puede aparecer aunque su precio haya cambiado. Las sugerencias no
modifican artículos, gastos ni existencias antes de confirmar y guardar.
Se mantienen los estados «En casa» y «Agotado», sin barras, porcentajes ni cantidades.
El carrito 🛒 marca el producto como agotado y lo añade a Súper sin duplicarlo.
Se ha retirado el botón general «Añadir agotados a Compras».
En la ficha, «En casa» lo marca como disponible. También se puede seguir escribiendo su nombre
en «¿Qué se ha acabado?».

Al terminar una compra o guardar un ticket, los productos comprados vuelven a
estar disponibles. Los nuevos productos de Súper se incorporan a casa; si no se
conoce su peso se registran como envases, sin inventar gramos. Las medidas ya
guardadas se conservan y las compras pendientes mantienen los créditos del
importador de tickets para evitar sumar existencias o gastos dos veces. No hay
migración masiva ni cambios en Firebase.

```sh
node --test tests/inventory-presence.test.cjs
node --test tests/pantry-purchase-history.test.cjs
node --test tests/pantry-price-matches.test.cjs
node tests/inventory-grid.cjs
```


## Recomendaciones de reposición a partir de tus compras

Desde la versión 92, «¿No se te olvida…?» aparece plegado en la lista Súper: se
abre y se cierra al tocar el título. Permanece abierto mientras añades productos
o respondes a las sugerencias y vuelve a empezar plegado al abrir de nuevo la app.

Desde la versión 91, este apartado usa los artículos de
los tickets y las compras guardadas del último año. No hace falta volver a subir
los tickets anteriores. Agrupa por referencia de producto y por asociaciones
confirmadas; los nombres sin referencia solo se unen cuando la coincidencia es
inequívoca. Mantiene separadas las variedades. Excluye compras anuladas, tickets
pendientes, duplicados, descuentos y bolsas de compra.

Con dos fechas de compra empieza a mostrar una estimación prudente; con más
compras usa la mediana de los intervalos recientes. Muestra foto cuando hay una
referencia identificada, frecuencia y última compra. Si figura en casa, pide
comprobar si queda: la presencia en el inventario no mide lo que se ha consumido.
No recomienda lo que ya está en la lista o en el carro y deja de insistir en los
productos que llevan mucho tiempo sin comprarse.

«Añadir» lleva el producto a Súper sin duplicarlo; solo propone varios envases
cuando la cantidad se ha repetido con suficiente consistencia. Usa el precio
actual del catálogo o, para artículos manuales, el último precio unitario
comprobable como estimación. «Todavía tengo» aplaza el aviso durante parte del
intervalo estimado y «Hoy no» lo oculta hasta mañana. Una nueva compra reinicia
el ciclo. Desde «Afinar» se puede buscar en el historial, fijar los días incluso
con una sola compra, volver a la frecuencia automática, ocultar un producto y
recuperarlo desde «Ocultos».

Las preferencias se guardan por producto en el campo `cook` existente y se
sincronizan con la casa sin reemplazar las de otros productos. Las sugerencias
se calculan en el dispositivo; no envían los tickets a ningún servicio de IA ni
requieren claves o servicios adicionales. No modifican el gasto ni las
existencias. En el modo de aprendizaje solo añaden a la lista al pulsar «Añadir»;
el modo «Cada ciertos días» permite activar explícitamente la incorporación
automática al abrir CASA.

```sh
node --test tests/shopping-suggestions.test.cjs
node tests/shopping-recommendations-flow.cjs
```

Las pruebas de navegador usan compras sintéticas, persistencia local y una
transferencia de estado entre dos sesiones; no escriben en Firebase de producción.


## Uso diario más directo (versión 93)

La barra superior muestra si los cambios están guardados solo en ese móvil,
pendientes de sincronizar, enviándose o sincronizados con la casa. Una lectura
de caché no anuncia una sincronización nueva con el servidor. El estado se
actualiza con la cola, la escritura confirmada y los errores de la conexión ya
existente; no se han cambiado la configuración ni las reglas de Firebase.
Se ha corregido también el fallo al abrir Recordar con mantenimientos mezclados
con otros avisos: la posición de un elemento en una lista no se interpreta como
una fecha de repetición.

En Compras, la lista y la cesta actual aparecen primero. La cesta estima todos
los productos de esa lista y distingue el importe ya tachado en el carro. El
botón Terminar se mantiene visible junto al total cuando hay productos tachados.
«Añadir» lleva al formulario existente, y «Gastos, tickets y herramientas» agrupa
los resúmenes y la edición de listas en un desplegable. Las cinco pestañas de
Compras siguen accesibles, sin desplazamiento horizontal en la pantalla de lista.
«¿No se te olvida…?» continúa plegado al abrir la app.

«Buscar» está disponible desde cualquier sección. La búsqueda reúne productos de
En casa, todas las listas, favoritos, compras guardadas y catálogo. Muestra dónde
figuran y la última compra. La ficha permite elegir la lista de destino, añadir
sin repetir un producto ya pendiente o tachado, guardar un habitual de esa lista,
abrir la ficha de inventario y consultar sus precios. Escribir no reconstruye el
campo ni interrumpe el teclado. Las variedades y referencias ambiguas se conservan
separadas; buscar no registra compras ni crea existencias.

Habituales y Afinar abren la misma configuración de reposición por producto y
lista: aprender de las compras, cada ciertos días o no recomendar. Los plazos
manuales anteriores se respetan antes de aplicar una preferencia explícita nueva.
Cambiar a aprendizaje o desactivar deshabilita la regla automática anterior;
no recomendar también evita el aviso de «Se está acabando» de esa regla. En modo
manual puede elegirse la incorporación automática al abrir CASA, desde una fecha
de referencia válida y sin duplicar lo ya pendiente o en el carro. Las respuestas
«Todavía tengo» y «Hoy no» aplazan también esa incorporación durante el ciclo
actual. Un ticket más reciente reinicia el ciclo. No hay tareas programadas ni
nuevos avisos push.

El historial de precios conserva las cantidades verificables del ticket. Solo
muestra una variación frente al catálogo actual cuando coinciden referencia,
comercio y formato, o la unidad por kg. Los tickets nuevos guardan la categoría y
el formato identificados durante la revisión. Los antiguos sin formato confirmado
siguen mostrando el precio por envase, sin inventar una subida o bajada ni alterar
el ticket original.

El historial de compras incorpora un desglose mensual de alimentación, limpieza
e higiene. Los nombres o categorías desconocidos, descuentos y diferencias entre
líneas y total quedan en «Sin clasificar y ajustes». Los gastos manuales sin
artículos se incluyen ahí; las compras aún pendientes de ticket tienen su propio
apartado. El desglose suma el importe registrado en céntimos y excluye compras
anuladas y duplicados identificados por la huella del ticket.

```sh
node --test tests/*.test.cjs
node tests/casa-workflows.cjs
node tests/shopping-recommendations-flow.cjs
node tests/habit-scroll.cjs
node tests/fav-lists.cjs
node tests/inventory-grid.cjs
node tests/history-products.cjs
node tests/receipt-flow.cjs
node tests/receipt-review-flow.cjs
```

Las comprobaciones usan datos sintéticos y transporte simulado; no escriben en
el hogar real ni certifican el comportamiento de un iPhone físico.


Desde la versión 95, el orden de Compras es: estimación de la cesta,
«¿No se te olvida…?» plegado, Habituales y lista de productos. Las acciones
«Añadir» y «Todavía tengo» de las recomendaciones son más compactas y se
ajustan al texto. Se mantiene la posición del carrusel al añadir habituales.


## Archivo de casa y rutinas de limpieza (versiones 96–97)

En Importantes y Calendario, «Electrodomésticos y documentos» abre el archivo compartido.
Desde la versión 97, el acceso principal está fuera de Hoy; el apartado Recordar
se llama Importantes desde la versión 98.
Las fichas guardan nombre, tipo, marca, modelo y fin de garantía. Fecha de compra,
número de serie y notas quedan en un desplegable. Cada ficha reúne sus PDF y
permite añadir mantenimientos con el formulario y calendario existentes.
La fecha de garantía se introduce según el documento, sin asumir su duración.

Documentos admite PDF de hasta 5 MiB: garantías, manuales, facturas, documentos
de casa, seguros, salud y otros. Se pueden buscar, vincular a un electrodoméstico,
consultar desde otro dispositivo, editar sus datos y archivar/restaurar. Archivar
conserva el archivo; no borra los bytes. Las fechas de garantía y vencimiento
aparecen en el calendario. Una garantía vinculada con la misma fecha de vencimiento
no genera dos entradas equivalentes.

Los archivos usan la conexión privada de Firestore ya existente. No se configura
Firebase Storage, no se publican URL de descarga ni se suben PDF al repositorio.
Los bytes se guardan como partes inmutables bajo
`hogar/estado/documentos/{sha256}/partes/{n}` y un manifiesto en
`hogar/estado/documentos/{sha256}`. El límite de 5 MiB y las partes de 192 KiB
mantienen cada documento y la transacción por debajo de sus límites: esta vía
está pensada para pocos PDF domésticos pequeños, no para vídeo ni un archivo
masivo. Cada carga consume lecturas/escrituras normales de Firestore.

El formato, tamaño, terminación de PDF, número de partes y hash se comprueban.
Una transacción lee todas las referencias antes de crear únicamente las que
faltan, rechaza colisiones y no reemplaza archivos existentes. Un reintento o dos
móviles subiendo el mismo PDF producen una sola referencia. Después de la carga
se releen el manifiesto y el índice del hogar antes de anunciar el guardado.
Al abrir se reconstruye y verifica SHA-256; los PDF incompletos no se presentan
como correctos. La descarga requiere conexión. Las copias JSON guardan fichas y
referencias; para una copia independiente del PDF se descarga desde su visor.

La autorización sigue dependiendo de las reglas desplegadas del proyecto y de
la sesión del usuario. No se han modificado `config.js`, `firestore.rules` ni los
usuarios. La CLI del entorno no tiene una sesión administrativa de Firebase y
no pudo consultar la edición ni las reglas desplegadas; se mantiene la conexión
compat 10.14.1 y la base ya usadas por CASA, sin aprovisionar ni migrar bases.
La prueba de integración usa ese adaptador con un transporte autenticado simulado;
no certifica la configuración del servidor de producción.

En Tareas → Rutinas de limpieza, «Usar mis tareas programadas» permite vincular
las tareas reales que ya existen. Las sugerencias se forman con las tareas de
limpieza que tienen la misma fecha, repetición y responsable; no se presupone
una agenda personal ni se crean tareas al mostrar las propuestas. Se pueden
revisar, buscar y seleccionar otras tareas programadas antes de guardar.
Se conservan los ID, títulos, fechas, repeticiones, responsables e instrucciones
originales. Una tarea solo puede pertenecer a una rutina vinculada activa.
Los modelos genéricos y la creación manual quedan en «Crear otra rutina».

Las rutinas vinculadas guardan referencias a `tasks`, no copias de sus tareas.
La lista y el calendario consultan las fechas reales de las tareas pendientes.
Cada casilla completa la tarea original con la misma regla de repetición de
Tareas; al completar desde Tareas también se actualiza la rutina. Se añade una
marca de finalización con fecha, instante y autor para reconocer la ronda
sin confundir un simple cambio de fecha con una tarea realizada. «Terminar
rutina» guarda un registro y prepara la nueva ronda, sin avanzar otra vez las
fechas originales. Una tarea eliminada se indica y se puede desvincular al editar.

El desmarcado de una tarea recurrente comprueba un registro de antes/después
en `cook`: solo restaura sus campos de programación si nadie los ha cambiado
después. Se conservan los demás datos y las tareas ajenas a la rutina. Las
revisiones abiertas antes de terminar una ronda exigen reabrirse. Los
registros de finalización conservan las últimas 24 rondas de cada rutina.

Las rutinas manuales siguen admitiendo hasta 30 pasos, responsable, fecha y
repetición semanal, quincenal, mensual, cada ciertos días o una sola vez.
Sus casillas se sincronizan con una clave por rutina, ronda y paso en `cook`.
También se pueden vincular a tareas programadas desde su edición. Una rutina
pendiente aparece en Hoy y en Calendario en su fecha real.

Una rutina sin terminar conserva su fecha aunque esté atrasada: no avanza sola.
«Posponer un día» mantiene las casillas y la ronda. En una rutina vinculada,
retrasa únicamente las tareas originales pendientes; las ya realizadas conservan
su siguiente fecha. Si una tarea está atrasada, pasa a mañana; si ya era futura,
se retrasa un día desde esa fecha. Las rutinas manuales calculan la repetición
al terminarlas, y las vinculadas respetan la repetición de cada tarea original.
Se puede archivar o restaurar sin perder el historial. No hay nuevos avisos push.

```sh
node --test tests/*.test.cjs
node tests/home-files-routines.cjs
node tests/casa-workflows.cjs
node tests/receipt-flow.cjs
```

Las pruebas utilizan PDF sintéticos, dos contextos de navegador independientes,
un transporte con revisiones y conflictos, carga repetida/sin conexión,
verificación interrumpida, apertura real de un PDF y reconstrucción byte a byte
en el segundo dispositivo. No se accede al hogar real. Se revisa el diseño en
320 y 390 píxeles, con tema claro y oscuro.


## Importantes y teléfonos de interés (versión 98)

La pestaña Recordar ahora se llama Importantes, tanto en la navegación como en
el título y los mensajes. Conserva todos los recordatorios y notas anteriores.
Desde allí se siguen añadiendo, editando y completando recordatorios con sus
fechas, repeticiones y calendario habituales. Se mantiene la clave interna
`recordar` para respetar las preferencias guardadas. Electrodomésticos y
documentos permanecen dentro del mismo apartado.

«Teléfonos de interés» permite guardar nombre, número, tipo y notas opcionales
(póliza, horario o instrucciones). Se muestran tres accesos directos y, cuando
hay más, «Ver los N teléfonos» abre la lista completa con búsqueda por nombre,
número, tipo y notas. El icono de llamada abre el marcador del dispositivo con
un enlace `tel:`; se pueden editar, eliminar y deshacer la eliminación.

Los contactos se guardan en `contacts` dentro del estado compartido del hogar,
con ID estable, y usan la fusión por ID y las copias existentes. El campo está
vacío por defecto: no se añaden contactos, números ni pólizas predeterminados.
Se conserva la presentación del número, y el enlace de llamada elimina solo
separadores y convierte el prefijo 00 en +. Los valores que no sean números
de teléfono no generan enlaces de llamada. Una edición desactualizada se
detiene si el mismo contacto cambió en otro móvil para evitar reemplazarlo
silenciosamente. No cambia la configuración ni las reglas de Firebase.

La prueba de navegador de `tests/home-files-routines.cjs` comprueba la
conservación de recordatorios y notas, creación y edición de recordatorios
en Importantes, altas simultáneas desde dos dispositivos, sincronización,
conflictos, validación, enlace de llamada, edición, eliminación y deshacer,
búsqueda y presentación en móvil. Usa números sintéticos reservados para
ejemplos y un transporte Firebase simulado; no realiza llamadas ni accede
a los datos reales de la casa.


## Fotos de documentos y garantías (versión 99)

En Importantes → Electrodomésticos y documentos se puede hacer una foto,
elegirla de la galería o seleccionar un PDF. Las mismas opciones aparecen al
añadir un documento desde la ficha de un electrodoméstico. Se muestra una
vista previa y se conserva el vínculo con el aparato, tipo, nombre, notas y
fecha de vencimiento. La foto guardada se abre dentro de su ficha, se puede
ampliar y descargar, y se consulta desde ambos móviles.

Las fotos JPG, PNG, WebP y HEIC/HEIF se preparan en el dispositivo: se respeta
la orientación, la transparencia se coloca sobre blanco y se genera un JPEG
sin los metadatos EXIF originales. Se admiten entradas de hasta 30 MiB, con
ajuste inicial a 4096 píxeles de lado mayor y unos 12 megapíxeles. Se ajustan
calidad y tamaño para guardar un máximo de 5 MiB por imagen. No se promete
conservar el archivo original sin cambios; se conserva la imagen preparada.

Primero se intenta la lectura nativa de HEIC. Si el navegador no la admite,
se carga únicamente entonces el conversor local **heic-to 1.6.7**, basado en
libheif, como archivo separado y reemplazable. No se envían las imágenes a
un servicio de conversión externo. El código de terceros sin modificar,
licencias LGPL/GPL y enlaces al código fuente están en
[`casa/vendor/heic-to/NOTICE.md`](casa/vendor/heic-to/NOTICE.md). La dependencia
no forma parte de la descarga inicial del archivo de la app; se almacena en
la caché del dispositivo después de usarla.

La foto usa el mismo almacenamiento privado por partes inmutables y SHA-256
que los PDF; no se cambia la configuración ni las reglas de Firebase. El
manifiesto mantiene la versión 1 y permite `image/jpeg` además de
`application/pdf`; los manifiestos y archivos PDF anteriores siguen válidos
y no se migran. El estado del hogar guarda únicamente los metadatos y la
referencia, nunca los bytes de la foto. La subida lee antes de crear, no
reemplaza partes existentes, verifica las referencias y relee el hogar antes
de anunciar el guardado.

El hash del archivo de origen permite reconocer la misma foto aunque otro
navegador genere un JPEG diferente. Los reintentos reutilizan la preparación
y recuperan la referencia existente sin duplicar documentos ni modificar su
nombre anterior. La copia JSON contiene las referencias: para conservar una
copia independiente de la foto, se usa «Descargar foto». Abrir un archivo
compartido requiere conexión, igual que los PDF.

Se han comprobado los tres botones de selección, imagen inválida, subida sin
conexión, verificación interrumpida y reintento, vista ampliada y recuperación
byte a byte desde otro dispositivo independiente. También se prueban giro
EXIF, PNG transparente, el conversor HEIC real con una imagen sintética,
reducción de fotos mayores de 5 MiB, integridad de los archivos y presentación
a 320/390 píxeles en temas claro y oscuro. Las pruebas usan transporte de
Firestore simulado; no escriben datos en la casa real ni prueban la cámara
física del iPhone. Las imágenes de prueba son sintéticas.
