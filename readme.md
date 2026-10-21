# Mi historial de exámenes de Platzi

Extensión personal de Chrome (Manifest V3), sin dependencias ni compilación.

## Instalar

1. Abre `chrome://extensions` y activa **Modo de desarrollador**.
2. Elige **Cargar descomprimida** y selecciona `C:\alejmendez\dev\platzi-exam`.
3. Recarga la pestaña de Platzi para iniciar la captura. Si hay un examen en curso, espera a un momento adecuado: recargar podría afectar el intento.
4. Abre la extensión desde el menú de extensiones. Muestra estado, pausa, historial, búsqueda y exportación JSON.

Tras modificar archivos, pulsa **Recargar** en la tarjeta de la extensión y recarga Platzi. Los registros existentes se conservan al recargar la extensión.

## Alcance de la versión 0.2

- Solo se inyecta en `https://platzi.com/*` y `https://www.platzi.com/*`. Solo captura en rutas de examen reconocidas y con una pregunta reconocida.
- Selección múltiple, ordenación con MagnetCards, conexión con MatchCards, rellenar afirmaciones con FillTheGap y clasificación con SwipeCards mediante botones o flechas del teclado. Conserva las secuencias y asociaciones, incluso incompletas.
- Muestra un aviso HTML bajo el enunciado con tu historial para esa pregunta: respuestas correctas, respuestas que NO fueron correctas y registros sin confirmar. Identifica por curso, enunciado, formato y opciones, aunque las opciones cambien de orden.
- Guarda al seleccionar; observa el feedback HTML «¡Correcto!», la opción marcada con error y los anuncios de clasificación por tarjeta. Los contadores de aciertos y vidas siguen siendo una señal adicional. Cada resultado conserva su evidencia; si falta, queda **Sin confirmar**.
- Distingue resultados por paso y de la pregunta completa. Un fallo global de una combinación no convierte cada parte de ella en incorrecta.
- Una pregunta no contestada no genera registro; **Saltar** registra **Omitida**.
- No obtiene respuestas correctas ocultas ni deduce resultados de la nota final.
- Los selectores se basan en el HTML observado de exámenes reales. Rellenar conserva la afirmación con identificadores estables para los huecos y lee sus palabras y estados del DOM. Otros formatos, como respuestas abiertas, requieren inspección y adaptación; el estado avisa si no reconoce el formato. La clasificación por arrastre aún no se captura: usar botones o flechas.
- El identificador de intento se renueva al recargar la página o cambiar de ruta. No agrupa todavía un intento que continúe tras una recarga.
- No hay captura retroactiva de preguntas anteriores a la instalación o de feedback que una versión anterior no registró. Los registros antiguos sin confirmar mantienen ese estado.

## Datos

Usa `chrome.storage.local`, separado del almacenamiento de la web. Sin servidor, cuentas adicionales ni envío de datos. Cada respuesta tiene una clave independiente; las escrituras de una pestaña se procesan en orden.

El límite local habitual es 10 MB. Si una escritura falla, el estado de la extensión lo indica. Exporta periódicamente: desinstalar la extensión elimina sus datos. Los archivos JSON son respaldos consultables; esta versión no los importa.

Alternativas: **IndexedDB** para un historial local mucho mayor; **Firebase** si se necesita sincronizar entre equipos, con autenticación y reglas de acceso. Para este MVP, el almacenamiento local evita configuración externa.

## Validar

Pruebas focalizadas sin instalar paquetes: `node --test tests/capture.test.cjs`.

Prueba real: con la extensión cargada y la pestaña recargada, responder una pregunta, esperar al avance y abrir el historial. Comparar selección y resultado con el contador de Platzi; exportar el JSON. El agente realiza la comprobación en el navegador cuando el usuario confirme que está listo.

Pruebas realizadas: se recorrió el examen de Estrategias para Aprender Inglés hasta la pantalla «Has aprobado el curso» y se inspeccionaron aciertos, errores, clasificación y conexión. Se inspeccionó FillTheGap en el examen de Verbo To Be. Se verificó el aviso HTML en una pregunta real con la versión 0.2 instalada. El JSON exportado confirmó dos registros sin contadores: un acierto con evidencia `visible-feedback` y un fallo con evidencia `visible-option-error`. Las pruebas automatizadas cubren además ordenación, conexión, clasificación, huecos y avisos de respuestas anteriores. No se han probado todos los gestos y variantes de cada formato en vivo.

El control del navegador permite inspeccionar Platzi, pero bloquea las páginas `chrome-extension://`. Para verificar el historial, el usuario debe confirmar lo visible o facilitar el archivo JSON exportado. No intentar eludir esa restricción.

Referencias: [content scripts de Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) y [almacenamiento de extensiones](https://developer.chrome.com/docs/extensions/reference/api/storage).
