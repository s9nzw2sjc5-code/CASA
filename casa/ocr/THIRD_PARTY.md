# Lector local de CASA

El pipeline de `worker.js` adapta el preprocesado, DB postprocesado, recorte por
perspectiva, clasificación de orientación y decodificación CTC de RapidOCR 1.4.4
(RapidAI/PaddlePaddle, Apache-2.0). La reconstrucción geométrica de filas y la
interfaz de revisión son código de CASA. No se ha portado todo RapidOCR.

- Modelos `det.onnx`, `rec.onnx`, `cls.onnx`: copias de
  `ch_PP-OCRv4_det_infer.onnx`, `ch_PP-OCRv4_rec_infer.onnx` y
  `ch_ppocr_mobile_v2.0_cls_infer.onnx` del wheel `rapidocr-onnxruntime==1.4.4`
  descargado de PyPI. Licencia Apache-2.0 en `models/LICENSE.txt`.
  `characters.json` procede de los metadatos del modelo de reconocimiento.
  https://github.com/RapidAI/RapidOCR/tree/v1.4.4
- ONNX Runtime Web **1.20.1**, bundle WASM y runtime SIMD de un hilo.
  https://github.com/microsoft/onnxruntime/tree/v1.20.1
  Licencia MIT en `vendor/ONNXRUNTIME-LICENSE.txt`.
- OpenCV.js **4.10.0-release.1**, distribución npm `@techstark/opencv-js` con WASM
  incluido en JavaScript. https://github.com/TechStark/opencv-js
  Licencia Apache-2.0 en `vendor/OPENCV-LICENSE.txt`.
- Clipper.js **6.4.2**, paquete npm `clipper-lib`, copyright Angus Johnson y
  colaboradores del port JavaScript. Licencia Boost en `vendor/CLIPPER-LICENSE.txt`.

Los runtimes npm se descargaron de jsDelivr con versiones fijadas y TLS validado;
se distribuyen localmente para no depender de CDN al leer fotos. `assets.sha256`
registra las copias distribuidas. No contiene fotos ni datos de compras.

Los modelos y runtimes se cargan al leer una foto, no al abrir CASA. Al cambiar
estos archivos debe cambiarse la versión de `OCR_CACHE` en el service worker.
La lectura está limitada a 400 cajas, 2000 píxeles de lado mayor para inferencia
y tres minutos; la cancelación termina el worker. El formulario exige confirmar
antes de escribir en Firestore y conserva su mecanismo de idempotencia.
