# Mi historial de exámenes de Platzi

Extensión personal de Chrome (Manifest V3), sin dependencias ni compilación.

## Instalar en Chrome paso a paso

No necesitas instalar paquetes ni compilar el proyecto. Realiza estos pasos antes de iniciar un examen:

1. Ten el proyecto en una carpeta local. En este equipo está en `C:\alejmendez\dev\platzi-exam`. Si recibiste un ZIP, extráelo primero.
2. Abre Chrome con el perfil donde utilizas Platzi.
3. Escribe `chrome://extensions` en la barra de direcciones y pulsa **Enter**.
4. Activa **Modo de desarrollador**, en la esquina superior derecha.
5. Pulsa **Cargar descomprimida** y selecciona la carpeta que contiene `manifest.json`, no un archivo individual ni la carpeta `icons`.
6. Comprueba que aparezca **Platzi · Mi historial de exámenes** y que su interruptor esté activado. Conserva la carpeta en su ubicación: Chrome carga la extensión desde allí.
7. Abre el menú de extensiones de Chrome (icono de pieza de rompecabezas) y fija la extensión con la chincheta para tenerla a mano.
8. Pulsa su icono para abrir el historial. Desde allí puedes pausar la captura, buscar, exportar JSON y entrar en **Configuración**. **Abrir historial** muestra la interfaz en una pestaña completa.
9. Abre Platzi o recarga una pestaña de Platzi que ya estuviera abierta; después entra al examen. El panel de historial aparece cuando se reconoce una pregunta. La captura funciona sin configurar IA.

### Actualizar una instalación existente

1. Guarda los cambios del proyecto en la misma carpeta usada al instalar.
2. En `chrome://extensions`, busca la tarjeta de la extensión y pulsa **Recargar** (flecha circular).
3. Cierra y vuelve a abrir el popup o recarga la pestaña del historial para ver los cambios de su interfaz.
4. Para aplicar cambios al panel y a la captura, recarga también la pestaña de Platzi, preferiblemente antes de iniciar un examen. Recargar solo la extensión no actualiza los scripts de una pestaña ya abierta.

Recargar conserva el historial y las claves guardadas. No hace falta desinstalar ni volver a cargar la carpeta; desinstalar elimina los datos de la extensión. En las pruebas, recargar y reanudar un examen hizo que Platzi dejara de mostrar sus indicadores nativos de tiempo, vidas y progreso, incluso con la extensión desactivada.

## Alcance de la versión 0.3

- Solo se inyecta en `https://platzi.com/*` y `https://www.platzi.com/*`. Solo captura en rutas de examen reconocidas y con una pregunta reconocida.
- Selección múltiple, ordenación con MagnetCards, conexión con MatchCards, rellenar afirmaciones con FillTheGap y clasificación con SwipeCards mediante botones o flechas del teclado. Conserva las secuencias y asociaciones, incluso incompletas.
- Muestra un panel flotante a la derecha, debajo de la cabecera, con tu historial para esa pregunta: respuestas correctas, respuestas que NO fueron correctas y registros sin confirmar. Identifica por curso, enunciado, formato y opciones, aunque las opciones cambien de orden.
- Guarda al seleccionar; observa el feedback HTML «¡Correcto!», la opción marcada con error y los anuncios de clasificación por tarjeta. Los contadores de aciertos y vidas siguen siendo una señal adicional. Cada resultado conserva su evidencia; si falta, queda **Sin confirmar**.
- Distingue resultados por paso y de la pregunta completa. Un fallo global de una combinación no convierte cada parte de ella en incorrecta.
- Una pregunta no contestada no genera registro; **Saltar** registra **Omitida**.
- No obtiene respuestas correctas ocultas ni deduce resultados de la nota final.
- Los selectores se basan en el HTML observado de exámenes reales. Rellenar conserva la afirmación con identificadores estables para los huecos y lee sus palabras y estados del DOM. Otros formatos, como respuestas abiertas, requieren inspección y adaptación; el estado avisa si no reconoce el formato. La clasificación por arrastre aún no se captura: usar botones o flechas.
- El identificador de intento se renueva al recargar la página o cambiar de ruta. No agrupa todavía un intento que continúe tras una recarga.
- No hay captura retroactiva de preguntas anteriores a la instalación o de feedback que una versión anterior no registró. Los registros antiguos sin confirmar mantienen ese estado.

## Datos

Usa `chrome.storage.local`, separado del almacenamiento de la web. El historial no se envía a ningún servidor. Cada respuesta tiene una clave independiente; las escrituras de una pestaña se procesan en orden.

## Sugerencias con IA

1. Recarga la extensión en `chrome://extensions` y la pestaña de Platzi para activar la nueva versión.
2. Abre la extensión (icono de cuaderno con una marca verde) y entra en **Configuración**.
3. Elige **Gemini** u **OpenRouter**, introduce tu API key y guarda. Para Gemini, usa el enlace **Generar o administrar mi API key de Gemini** debajo del campo de la clave, que abre [Google AI Studio](https://aistudio.google.com/api-keys?hl=es-419). Chrome pedirá permiso de conexión únicamente para el proveedor elegido. El campo queda vacío tras guardar; dejarlo vacío al actualizar conserva la clave existente.
4. En el panel flotante a la derecha, debajo de la cabecera del examen, pulsa **Sugerir con IA**. Usa **Contraer / Expandir** para ocultar o ver su contenido y arrastra su esquina inferior izquierda para ampliar o reducir el tamaño. Las respuestas largas tienen desplazamiento interno. La extensión envía solo el curso, enunciado, opciones y asociaciones de esa pregunta. Nunca selecciona ni envía respuestas por ti.

La sugerencia muestra letra y texto en selección múltiple, posiciones en ordenación, palabras por hueco en afirmaciones y pares de textos en conexión o clasificación. No incluye explicaciones. Se comprueba que cada opción exista, que las parejas sean válidas y que no falten pasos. Si cambia la pregunta durante la consulta, la respuesta antigua se descarta.

Los modelos iniciales son `gemini-3.5-flash-lite` y `openrouter/free`; puedes cambiarlos. La disponibilidad y el acceso gratuito dependen del proveedor, modelo y cuenta: [tarifas de Gemini](https://ai.google.dev/gemini-api/docs/pricing) y [router gratuito de OpenRouter](https://openrouter.ai/docs/guides/routing/routers/free-router). Las solicitudes usan las API documentadas de [Gemini](https://ai.google.dev/api/generate-content) y [OpenRouter](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request).

Las claves se guardan en IndexedDB bajo el origen de la extensión, separado de los scripts que se ejecutan en Platzi y del historial. No se sincronizan ni se incluyen en las exportaciones. **Eliminar clave** quita la clave del proveedor seleccionado. El almacenamiento local no es una caja fuerte cifrada frente a alguien que controle tu perfil de Chrome.

La IA puede equivocarse; sus sugerencias no se convierten en aciertos confirmados ni se guardan como respuestas del usuario. Cada consulta es manual, con límite de salida y tiempo de espera, sin reintentos automáticos.

La versión 0.3.2 separa el panel de los contenedores con recorte de Platzi. Se verificaron en Chrome una sugerencia real de Gemini, contraer/expandir y ampliar/reducir el panel. El tamaño elegido se conserva al actualizar la sugerencia o contraer/expandir durante esa página.

La versión 0.3.3 reserva espacio superior para no superponer el panel a la cabecera nativa ni a su botón de cerrar; su posición se comprobó en el examen de Verbo To Be. En ese examen, tiempo, vidas y progreso estaban visibles antes de recargar, pero desaparecieron al recargar y reanudar, y no regresaron al avanzar una pregunta. En Entorno en Linux también faltaban con la extensión desactivada y al reabrir desde el curso. La corrección del panel no restaura los indicadores que Platzi deja de generar. Recuperarlos en un intento afectado sigue pendiente; la extensión no inventa el tiempo ni las vidas ausentes. Al agotar el intento de Linux, Platzi impuso una espera de unos 30 minutos para repetirlo.

El límite local habitual es 10 MB. Si una escritura falla, el estado de la extensión lo indica. Exporta periódicamente: desinstalar la extensión elimina sus datos. Los archivos JSON son respaldos consultables; esta versión no los importa.

Alternativas: **IndexedDB** para un historial local mucho mayor; **Firebase** si se necesita sincronizar entre equipos, con autenticación y reglas de acceso. Para este MVP, el almacenamiento local evita configuración externa.

## Validar

Pruebas focalizadas sin instalar paquetes: `node --test tests/ai.test.cjs` para la IA; `node --test tests/capture.test.cjs` para captura, aviso HTML e integración del botón. Las pruebas de proveedores usan respuestas simuladas; una prueba de conexión real requiere configurar una clave desde la interfaz.

Prueba real: con la extensión cargada y la pestaña recargada, responder una pregunta, esperar al avance y abrir el historial. Comparar selección y resultado con el contador de Platzi; exportar el JSON. El agente realiza la comprobación en el navegador cuando el usuario confirme que está listo.

Pruebas realizadas: se recorrió el examen de Estrategias para Aprender Inglés hasta la pantalla «Has aprobado el curso» y se inspeccionaron aciertos, errores, clasificación y conexión. Se inspeccionó FillTheGap en el examen de Verbo To Be. Se verificó el aviso HTML en una pregunta real con la versión 0.2 instalada. El JSON exportado confirmó dos registros sin contadores: un acierto con evidencia `visible-feedback` y un fallo con evidencia `visible-option-error`. Las pruebas automatizadas cubren además ordenación, conexión, clasificación, huecos y avisos de respuestas anteriores. No se han probado todos los gestos y variantes de cada formato en vivo.

El control del navegador permite inspeccionar Platzi, pero bloquea las páginas `chrome-extension://`. Para verificar el historial, el usuario debe confirmar lo visible o facilitar el archivo JSON exportado. No intentar eludir esa restricción.

Referencias: [content scripts de Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) y [almacenamiento de extensiones](https://developer.chrome.com/docs/extensions/reference/api/storage).
