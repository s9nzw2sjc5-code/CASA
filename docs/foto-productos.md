# Foto de producto a la lista de la compra

Borrador local para la versión 68. **No publicar todavía**: la usuaria ha pedido
validar el reconocimiento antes del despliegue. No se ha enviado esta versión a
GitHub ni ejecutado ninguna publicación.

En Compras, «Añadir producto con foto» permite usar la cámara trasera o elegir una
imagen. Reutiliza RapidOCR de CASA, compara las palabras de la etiqueta con el
catálogo y muestra propuestas con variedad, envase, tamaño y precio estimado.
No necesita una clave de IA y no envía la imagen a un servidor. La imagen solo
permanece en memoria mientras está abierta la ficha.

El usuario debe seleccionar una propuesta y confirmar la cantidad. La operación
usa la lista abierta y las funciones actuales de cesta/guardado; si el producto
ya estaba en esa lista, suma envases. No registra compras ni modifica inventario.
Una lectura fallida, cerrar la ficha o cancelar no añade nada. Se puede corregir
la búsqueda o volver a fotografiar el producto. No se identifica automáticamente
un envase solo por su color, forma o código de barras.

## Validación del 7 de noviembre de 2026

- 61 pruebas unitarias de la app pasaron, incluidas 9 del reconocimiento nuevo.
- Playwright con Chromium de 390 × 844: OCR real de una etiqueta simulada,
  selección y cantidad en la lista abierta, suma sobre el producto existente,
  cancelación durante la lectura, archivo roto y anulación de una selección al
  cambiar la búsqueda. Sin conexión a Firebase.
- Se ejecutó el OCR real en 36 combinaciones: un recorte de un envase real de
  chorizo de pavo y tres etiquetas simuladas (arroz, café y leche), con nueve
  condiciones cada uno. Tras corregir palabras pegadas y coincidencias basadas
  en una palabra secundaria, el producto esperado figura entre las propuestas
  en las 36. **No equivale a 36 identificaciones exactas ni a 100 % de precisión:**
  puede haber otras propuestas y formatos indistinguibles por el texto visible.
- Condiciones: original, brillo 1,4 y 0,4, giros +25°, −25° y 90°, perspectiva
  trapezoidal, reflejo y desenfoque. Son transformaciones simuladas; no son nueve
  fotografías tomadas con una cámara bajo condiciones físicas diferentes.
- Se añadieron controles negativos con un envase de comida de gato que no está
  en el catálogo actual y una superficie sin etiqueta, bajo las mismas condiciones.
  Los 18 controles no propusieron ningún producto y pasaron el criterio esperado.

Fuente pública de los recortes de envases: captura
[Mercadona Images Redesign](https://github.com/ivancea/mercadona-images-extension/blob/master/docs/images/new-grid-design.png).
Las etiquetas simuladas no se presentan como fotografías reales. Las imágenes,
recortes y resultados completos se guardan fuera del repositorio.

## Pendiente antes de publicar

Ampliar la muestra con fotografías reales de productos distintos, fondos de casa,
envases curvos, laterales, formatos casi idénticos, ausencia de texto y productos
no disponibles en el catálogo. Validar también en un iPhone físico (cámara,
HEIC, memoria y velocidad); Chromium móvil no demuestra esas condiciones.

La descarga de las imágenes oficiales de `prod-mercadona.imgix.net` está
bloqueada por la política de red del entorno. Hay un borrador que añade ese
dominio conservando los permisos anteriores, pendiente de revisión y aplicación
en los ajustes del entorno. Publicar esa configuración de entorno no publica CASA.

Ningún conjunto finito de pruebas garantiza cero errores con cualquier producto
y cualquier foto. La confirmación humana sigue siendo necesaria; el criterio de
publicación solicitado aún no puede darse por cumplido.

## Repetir las pruebas

```sh
node --test tests/*.test.cjs
node tests/product-photo-flow.cjs
node tests/product-photo-quality.cjs /tmp/manifest.json /tmp/informe.json
```

Formato del manifest, con archivos y salidas fuera del repositorio:

```json
{"photos":[{"file":"/tmp/producto.jpg","expectedIds":["5044"],"source":"URL o descripción de origen"}]}
```

Para un control que no debe proponer nada, usar `expectedIds: []` y
`expectNoCandidates: true`. El código de salida 2 significa que algún ejemplo no
cumplió su resultado esperado. El informe conserva texto, confianza y propuestas
para revisar los fallos, sin modificar los datos de producción.
