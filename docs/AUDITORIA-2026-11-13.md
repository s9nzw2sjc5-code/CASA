# Auditoría funcional de CASA — 13 de noviembre de 2026

Se ha ejecutado la aplicación real con Playwright y Chromium, siguiendo los
flujos de uso y las peticiones del historial. La base inicial era la versión
99; las correcciones se publican en la **versión 100**. El catálogo se ha
actualizado desde el cambio automático del repositorio del mismo día.

El resultado requiere distinguir tres cosas: los recorridos funcionales pasan
las comprobaciones descritas, se han corregido cinco fallos reproducibles, y
el reconocimiento de fotos **no puede darse por perfecto**. No se han escrito
compras, tareas, contactos ni documentos de prueba en el hogar real.

## Fallos corregidos

| Fallo reproducido | Comportamiento anterior | Corrección y comprobación |
| --- | --- | --- |
| Editar o borrar una realización de Ringo | La fecha antigua reaparecía desde `pet.log`, y la próxima fecha seguía dependiendo de una realización corregida o eliminada. | Se mantienen coherentes el registro detallado, las fechas del cuidado y su última realización. Edición, borrado y Deshacer pasan; una realización vinculada no admite una fecha futura. |
| Resúmenes de gasto distintos | Semana y mes sumaban el historial bruto, mientras el desglose descartaba compras anuladas, duplicadas y futuras. | Todos usan el mismo criterio de compras válidas y suman en céntimos. En un ejemplo sintético el resumen mostraba 25,60 € frente a 4,45 € válidos; ahora ambos coinciden. |
| Cesta sin actualizar mientras se escribe | Mantener el foco del buscador podía impedir el repintado: el producto se añadía internamente pero el contador seguía en cero. | Se actualizan resultados, resumen y cesta conservando el mismo campo, foco, posición e imágenes cargadas. También funciona Borrar búsqueda con el foco retenido. |
| Restauración de copias incompatibles | Bastaban `tasks` e `items` para aceptar un JSON, aunque otras colecciones fueran incompatibles y provocasen un error al renderizar. | Se valida la estructura antes de ofrecer o aplicar la restauración, tanto desde archivo como desde una copia guardada. Una copia incompatible no cambia el estado. |
| Lista desbordada en pantallas estrechas | Después de registrar compras, el texto del botón del historial sobresalía de su ancho y producía desplazamiento horizontal. | El botón admite varias líneas y conserva todo su texto. La lista con gastos, su botón de historial y las herramientas desplegadas pasan la comprobación a 320 px. |

También se han corregido dos textos: la activación de IA ya no anuncia recetas
retiradas ni estima una cantidad de usos por saldo; la compra de Mercadillo
indica «Guardar compra», que describe la acción que realiza.

## Cobertura de uso

| Apartado | Recorridos y opciones comprobados | Resultado |
| --- | --- | --- |
| Inicio y acceso | Pantalla privada, validación de acceso, contraseña incorrecta, cuenta sin permiso, recuperación simulada, entrada, descarga real de copia y cierre de sesión. | Pasa con Auth y transporte simulado; sin cuentas ni correos reales. |
| Hoy y Tareas | Añadir, editar, personas, filtros, fechas, horas, recurrencias, tarea atrasada, posponer, completar, borrar, Deshacer y duración del aviso. | Pasa. No se avanza una tarea pendiente por el mero paso del tiempo. |
| Rutinas de limpieza | Crear, vincular tareas existentes, responsables y fechas originales, pasos compartidos, posponer solo pendientes, completar una ronda sin avanzar dos veces y archivar/restaurar. | Pasa entre dos dispositivos independientes con transporte simulado. |
| Calendario | Vista mensual actual, día seleccionado, eventos, hora final inválida, repeticiones, lugar, enlaces de Google Calendar, mantenimiento, garantías y vencimientos. | Pasa. La vista semanal está retirada intencionadamente. |
| Ringo | Cuidados, próxima fecha, realización, historial, corrección, borrado y Deshacer; citas de peluquería y calendario; ausencia del duplicado superior de peluquería. | Pasa después de la corrección. |
| Compras y cesta | Listas, cantidades, tachado, terminar compra, ticket inmediato o pendiente, stock y gastos sin doble incorporación; gasto manual y Mercadillo con coma decimal. | Pasa. La incorporación opcional a casa no modifica la cesta. |
| Productos | Búsqueda, filtros, teclado, cesta, referencias, novedades y selección de producto. | Pasa, incluida actualización con foco retenido. |
| Habituales | Ámbito de cada lista, fotografías o alternativa estable, referencias retiradas, búsqueda, reposición cada X días desde la ficha y conservación del desplazamiento. | Pasa. La incorporación automática por plazo se ejecuta al abrir CASA. |
| «¿No se te olvida…?» | Plegado inicial, orden bajo estimación, añadir, «Todavía tengo», aplazar, afinar plazo, desactivar, deduplicación y persistencia. | Pasa. |
| En casa | Categorías, fotos pequeñas, filas con nombre cuando falta foto, detalle, última compra, asociación al catálogo, papelera, carrito y agotado escrito con sugerencias. | Pasa. |
| Tickets y transcripciones | Total resaltado, revisión compacta, errores por campo, cantidades y precios, confirmación conjunta, borradores, recorte, guardar, tiempo de espera, reintento y lectura final; stock y lista. | Pasan los flujos funcionales. El OCR real conserva los límites descritos abajo. |
| Historial y dinero | Repetir productos, habitual desde un ticket, cantidades, precios comparables, gastos manuales, presupuestos, desglose mensual y exclusión de duplicados/anulaciones. | Pasa después de unificar los resúmenes. |
| Importantes | Conservación y edición de recordatorios, notas y mensajes internos; teléfonos, notas de póliza, edición, búsquedas, enlace de llamada, borrado y Deshacer. | Pasa. Los mensajes de prueba fueron locales. |
| Electrodomésticos y documentos | Ficha, mantenimiento, garantía, PDF y foto desde los tres selectores, notas, vínculo, vencimiento, búsqueda, archivo, reintento y consulta desde otro dispositivo. | Pasa con PDF y fotos sintéticos, incluidas HEIC, transparencia, orientación y foto grande. |
| Copias y uso sin conexión | Copia manual, JSON descargado, importación, validación, restauración, copia previa, service worker real, recarga y escritura sin red, reconexión y caché de versión. | Pasa. Las referencias de documentos se conservan; los archivos compartidos se descargan con conexión. |
| Presentación | Seis apartados principales y cinco paneles de Compras a 320, 390 y 1280 px, temas claro y oscuro, desplazamiento y acciones enlazadas. | Sin errores de JavaScript ni desbordamiento horizontal en los casos probados. |

## Comprobaciones ejecutadas

- 167 pruebas de lógica JavaScript y 7 pruebas Python del catálogo.
- 12 recorridos de navegador existentes y 2 recorridos nuevos: uso diario y
  acceso privado. Los nuevos cubren las regresiones de esta auditoría.
- Validación con el SDK oficial de Firebase **10.14.1**, igual que el SDK usado
  por la aplicación: tres variantes de guardado válidas se serializan; las
  funciones y arrays anidados reproducen y rechazan los errores históricos.
  No se llama a `commit` ni se contacta con Firestore en esa comprobación.
- Pruebas reales de OCR, distintas de los recorridos que simulan una lectura,
  con imágenes e informes privados guardados fuera del repositorio.

Los recorridos anteriores se ejecutaron sobre la base de la auditoría. Tras
las correcciones se volvieron a comprobar los recorridos afectados, el uso
diario, acceso, búsqueda/desplazamiento, dinero, lógica y referencias de la
versión 100. No se interpreta el número de aserciones como una garantía de
que no pueda existir otro defecto.

## Lectura real de fotos: resultado y límites

### Ticket de referencia facilitado en la conversación

Se probó el lector local real con el original y tres variantes calculadas de
luz y arrugas. Las modificaciones no sustituyeron texto ni cifras. El criterio
estricto exige que nombre, cantidad, precio, fecha y total coincidan con la
referencia, además de superar la validación.

| Condición | Líneas detectadas | Coincidencias exactas en orden | Importe total |
| --- | --- | --- | --- |
| Original | 37 | 36/37 | Coincide |
| Más luz | 37 | 36/37 | Coincide |
| Menos luz | 37 | 34/37 | Coincide |
| Arrugas simuladas | 37 | 36/37 | Coincide |

Las diferencias observadas incluyen caracteres y espacios en los nombres.
En el original y con menos luz la validación también pide confirmar cantidades
que no se han podido observar con suficiente seguridad. Que el total cuadre
no prueba por sí solo una transcripción literal perfecta. Ninguna de las cuatro
variantes cumple el criterio estricto completo; estos resultados se conservan
como límites de calidad, no se convierten artificialmente en pruebas aprobadas.

### Identificación de productos por foto

Se usaron 7 imágenes con 5 variantes cada una, sin asociaciones personales
guardadas: original, más luz, menos luz, giro y perspectiva.

- En 25 casos de productos esperados, la referencia apareció entre las
  sugerencias en 6. Los recortes pequeños de envases dieron resultados pobres.
- En los 10 casos negativos sin información suficiente se rechazó sugerir un
  producto, como se esperaba.
- La búsqueda manual, elección, confirmación, asociación aprendida, corrección
  de asociación y recuperación tras recargar sí pasan en el recorrido de uso.

Este conjunto pequeño, que incluye recortes de capturas, no es una estimación
estadística de precisión general. Sí demuestra que no está justificado
prometer identificación perfecta de cualquier envase, luz o ángulo. Deben
mantenerse las coincidencias, la búsqueda y la confirmación antes de añadir.

## Catálogo y publicación automática

Se ha comprobado el CP 18210 y la actualización de catálogo del 13/11/2026,
con 4017 productos en la revisión consultada. El workflow de precios terminó
correctamente y activó después la publicación de Pages mediante `workflow_run`.
La rama por defecto coincide con la rama de publicación de CASA. No se han
cambiado el código postal, los ajustes del repositorio ni la configuración
Firebase.

- [Actualización de precios comprobada](https://github.com/s9nzw2sjc5-code/CASA/actions/runs/43430659145)
- [Publicación posterior comprobada](https://github.com/s9nzw2sjc5-code/CASA/actions/runs/43430893440)
- [Publicación de las correcciones de la versión 100](https://github.com/s9nzw2sjc5-code/CASA/actions/runs/43438084949): finalizada correctamente.

El proxy de esta sesión devuelve 403 también al acceder directamente a la URL
pública de Pages. La publicación se ha verificado en GitHub Actions; los
recorridos de navegador se ejecutaron sirviendo localmente el código real.

## Comprobaciones externas pendientes y alcance

- Firebase real: no hay sesión ni credenciales administrativas en el entorno.
  Se ha probado el adaptador existente con transporte simulado; no se certifican
  las reglas desplegadas, la disponibilidad del servidor ni los datos actuales
  de las dos cuentas reales. No se ha cambiado su configuración.
- iPhone físico: no se han probado cámara nativa, teclado de Safari, instalación
  de PWA, marcador de llamadas, descarga/compartición de iOS ni inserción final
  en Google Calendar. Se probaron selectores, enlaces, foco retenido y tamaños
  de pantalla en Chromium con emulación móvil.
- Fotos del catálogo: el proxy del entorno devuelve 403 al abrir el CDN de
  imágenes. Se han probado carga simulada, estabilidad, asociación y alternativa
  al fallar una imagen; no se certifica la disponibilidad actual de ese CDN.
- IA de la nevera: la opción exige una clave y facturación de Anthropic. Se
  comprobó la interfaz y el rechazo de una clave inválida; no se enviaron
  consultas de pago ni se validaron modelo/proveedor con una clave real.
- Avisos móviles y recetas: se mantienen respectivamente aplazados y retiradas
  de la navegación según las decisiones anteriores. No se activó ni envió ningún
  aviso móvil real.
- Yuka y ofertas/cesta de Lidl: no hay una integración operativa en esta versión.
  Lidl puede figurar como comercio de un gasto; eso no constituye un catálogo
  actual de ofertas ni una comparación automática de cesta.

Los informes OCR con imágenes y referencias privadas permanecen en `/tmp`.
Este documento y las pruebas publicadas contienen únicamente resultados
agregados y datos sintéticos.

## Repetir las pruebas

```sh
node --test tests/*.test.cjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/daily-life-flow.cjs
node tests/auth-flow.cjs
node tests/home-files-routines.cjs
node tests/receipt-flow.cjs
node tests/receipt-review-flow.cjs
node tests/product-photo-flow.cjs
node tests/casa-workflows.cjs
node tests/shopping-recommendations-flow.cjs
node tests/habit-scroll.cjs
node tests/habit-recovery.cjs
node tests/fav-lists.cjs
node tests/inventory-grid.cjs
node tests/history-products.cjs
node tests/finished-pantry.cjs
```

`tests/receipt-sdk.cjs` admite `CASA_FIREBASE_TEST_SDK` para indicar un SDK de
prueba instalado fuera del repositorio. Los benchmarks `receipt-ocr-quality.cjs`
y `product-photo-quality.cjs` reciben por argumentos sus fotos y referencias;
deben apuntar a archivos fuera del repositorio público.
