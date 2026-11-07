# Foto de producto a la lista de la compra

Versión 68. Publicación autorizada con propuestas, búsqueda manual y
asociaciones confirmadas por el usuario. La confirmación es obligatoria incluso
cuando existe una asociación anterior.

En Compras, «Añadir producto con foto» permite usar la cámara trasera o elegir una
imagen. Reutiliza RapidOCR de CASA, compara las palabras de la etiqueta con el
catálogo y muestra propuestas con variedad, envase, tamaño y precio estimado.
No necesita una clave de IA y no envía la imagen a un servidor. La imagen solo
permanece en memoria mientras está abierta la ficha.

El usuario debe seleccionar una propuesta y confirmar la cantidad. La operación
usa la lista abierta y las funciones actuales de cesta/guardado; si el producto
ya estaba en esa lista, suma envases. No registra compras ni modifica inventario.
Una lectura fallida, cerrar la ficha o cancelar no añade nada ni enseña una asociación. Se puede corregir
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

## Límites y validación adicional

Ampliar la muestra con fotografías reales de productos distintos, fondos de casa,
envases curvos, laterales, formatos casi idénticos, ausencia de texto y productos
no disponibles en el catálogo. Validar también en un iPhone físico (cámara,
HEIC, memoria y velocidad); Chromium móvil no demuestra esas condiciones.

La descarga de las imágenes oficiales de `prod-mercadona.imgix.net` está
bloqueada por la política de red del entorno. Hay un borrador que añade ese
dominio conservando los permisos anteriores, pendiente de revisión y aplicación
en los ajustes del entorno. Publicar esa configuración de entorno no publica CASA.

Ningún conjunto finito de pruebas garantiza cero errores con cualquier producto
y cualquier foto. La confirmación humana sigue siendo necesaria. La publicación se autoriza con
ese paso de revisión y una búsqueda manual, sin garantía de reconocimiento universal.

## Asociaciones confirmadas

La búsqueda está encima de las propuestas y se puede utilizar durante la lectura
para elegir el producto manualmente. Al confirmar y añadir, CASA guarda en el
mapa compartido `prodMap` el identificador del producto asociado a dos huellas
SHA-256: archivo original y texto fiable de su etiqueta. Las claves usan el
prefijo `photo:v1:` y no alteran los alias de ingredientes existentes.

Solo se aprende tras confirmar. Una selección cancelada o una lectura sin confirmar
no modifica las asociaciones. Repetir la foto o leer la misma etiqueta puede dar
prioridad a la elección anterior, que aparece como «Asociado anteriormente por
vosotros». No se selecciona ni añade automáticamente. Buscar y confirmar otro
producto sustituye la asociación de esa foto y de la etiqueta leída.

Se conserva el tamaño, la variedad y las negaciones al calcular la huella de la
etiqueta. El aprendizaje solo ayuda si coincide la huella de la foto o el texto
normalizado: no entrena un modelo visual ni garantiza reconocer fotos nuevas cuyo
texto cambie. Las asociaciones siguen la sincronización y la fusión por claves
que ya utiliza CASA; no se suben fotos ni transcripciones para este aprendizaje.

Pruebas adicionales: huellas estables, variantes distintas, producto retirado,
correcciones y conservación de los alias anteriores. En Playwright se verifican
la persistencia después de recargar, la corrección mediante búsqueda y la
reutilización del estado compartido en un segundo navegador simulado. Esto no
sustituye una comprobación de sincronización en dos teléfonos reales conectados
a Firestore.

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

## Corrección de etiquetas parciales en la versión 70

Una etiqueta puede decir «Elimina olores» y el catálogo empezar por «Limpiahogar».
Ya no se exige que aparezca la primera palabra del catálogo si hay al menos dos
palabras coincidentes y suficiente cobertura del nombre. Se tolera una errata en
palabras de cinco o más caracteres solo si hay una única corrección posible en
el vocabulario. Una pista aislada como «olores» o «Perú» sigue sin justificar una
propuesta de otro producto.

Se reprodujo la ausencia de coincidencias con un recorte del producto mostrado
en una captura externa. El OCR lee «ELININA» y «OLORES» y ahora propone el
limpiahogar correspondiente. La prueba usa el OCR local real, exige confirmación
y comprueba que solo se añade la unidad solicitada. No es el archivo original de
la cámara; otras degradaciones del recorte pequeño pueden seguir sin texto
suficiente. No se incluyen la captura ni el recorte en este repositorio público.

«Acercar etiqueta y volver a leer» reutiliza el recorte local existente de CASA,
con indicaciones específicas para productos. La asociación puede conservar la
huella de la foto inicial y la del recorte confirmado. Recortar o cancelar por sí
solos no modifica la lista ni enseña asociaciones. Los mensajes distinguen una
lectura sin texto de una etiqueta con texto pero sin coincidencias fiables.

Validación: 65 pruebas unitarias, flujo de cámara/galería y recorte en Playwright,
y caso externo real con confirmación. El clasificador actualizado conserva los
resultados esperados al reaplicarlo a los 36 casos positivos y 18 negativos del
informe anterior; eso no representa nuevas fotografías ni precisión universal.

```sh
node tests/product-photo-case.cjs /tmp/foto-producto.jpg 24076
```
