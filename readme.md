# Mi historial de exámenes de Platzi

Extensión personal de Chrome (Manifest V3), sin dependencias ni compilación. Incluye empaquetado automático en GitHub Actions.

## Descargar el ZIP e instalarlo

El ZIP es un paquete para descargar y extraer: **no se instala directamente como archivo ZIP en Chrome**. Para uso personal se carga la carpeta descomprimida. Los archivos `.crx` fuera de la tienda tienen restricciones en Windows y macOS; no se generan aquí. Consulta la [documentación de distribución de Chrome](https://developer.chrome.com/docs/extensions/how-to/distribute).

1. Abre las [Releases del proyecto](https://github.com/alejmendez/platzi-exam/releases) y elige la versión deseada.
2. En **Assets**, descarga `platzi-exam-VERSION.zip`, no los archivos automáticos **Source code** de GitHub.
3. Extrae el ZIP en una carpeta permanente. `manifest.json` debe quedar directamente dentro de esa carpeta.
4. Sigue los pasos de instalación de la siguiente sección desde el paso 2.

Para actualizar conservando la instalación, cierra el examen y extrae el nuevo paquete sobre la **misma carpeta** que Chrome ya tiene cargada; después sigue «Actualizar una instalación existente». No cargues cada versión desde una carpeta distinta si quieres conservar la misma instalación y sus datos.

## Instalar en Chrome paso a paso

No necesitas instalar paquetes ni compilar el proyecto. Realiza estos pasos antes de iniciar un examen:

1. Ten el proyecto o el paquete extraído en una carpeta local. En este equipo el proyecto está en `C:\alejmendez\dev\platzi-exam`.
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

## Paquetes automáticos y versiones en GitHub

El flujo [Empaquetar extensión](.github/workflows/package.yml) se ejecuta al subir cambios a cualquier rama, al subir una etiqueta que empiece por `v` y manualmente desde **Actions → Empaquetar extension → Run workflow**. No requiere instalar dependencias ni agregar claves de Gemini a GitHub.

- **Commit:** guarda un cambio del proyecto. El empaquetado remoto se ejecuta al hacer `push`, no al guardar archivos ni al hacer un commit solo local.
- **Artifact:** paquete que produce cada ejecución de Actions. Se conserva durante 30 días; cada ejecución tiene su propio número, aunque la versión del manifiesto no cambie.
- **Tag:** etiqueta que identifica el commit de una versión, por ejemplo `v0.3.3`.
- **Release:** página de descarga asociada a ese tag, con el ZIP y notas generadas por GitHub. Se crea automáticamente al subir el tag y no depende de la caducidad del artifact.

### Descargar el paquete de cualquier cambio

1. Sube los commits a GitHub.
2. Abre [Actions del proyecto](https://github.com/alejmendez/platzi-exam/actions) y selecciona la ejecución **Empaquetar extension** correspondiente.
3. Espera a que termine correctamente y descarga el elemento de **Artifacts** (necesitas iniciar sesión en GitHub).
4. Extrae la descarga de Actions: dentro encontrarás `platzi-exam-VERSION.zip`. Extrae también ese ZIP y carga su carpeta en Chrome. Esta doble extracción se debe al envoltorio que GitHub añade al artifact.

### Publicar una versión descargable

1. Cambia `version` en `manifest.json` cuando prepares una nueva versión. Usa números, por ejemplo `0.3.4`.
2. Guarda los cambios en un commit y súbelo a GitHub.
3. Crea y sube una etiqueta con la misma versión precedida de `v`. Ejemplo para una futura versión `0.3.4`:

   ```powershell
   git tag v0.3.4
   git push origin v0.3.4
   ```

4. Actions comprueba que etiqueta y manifiesto coincidan, genera el ZIP y crea la Release con el archivo adjunto. Si no coinciden, falla sin publicar una Release.
5. Abre [Releases](https://github.com/alejmendez/platzi-exam/releases) y descarga el ZIP desde **Assets**. Cada versión debe usar un tag nuevo; no reutilices una etiqueta ya publicada.

Los archivos del flujo deben estar guardados y subidos a GitHub para que la automatización funcione. Si Actions está desactivado en el repositorio, actívalo en su pestaña **Actions**. No se publica nada en Chrome Web Store ni se actualizan automáticamente las instalaciones de Chrome.

### Generar el ZIP localmente

Desde la carpeta del proyecto, ejecuta en PowerShell:

```powershell
./scripts/package.ps1
```

Se genera `dist/platzi-exam-VERSION.zip`, tomando la versión de `manifest.json`. El paquete contiene únicamente los archivos necesarios de la extensión, con el manifiesto en la raíz. Excluye pruebas, documentación, Git y archivos locales de respaldo; tampoco contiene el historial ni las claves guardadas en Chrome. La carpeta `dist` no se sube a Git.

## Alcance de la versión 0.6

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
3. Elige **Gemini**, **OpenRouter** o **MiniMax (Token Plan)**, introduce tu API key y guarda. Para Gemini, usa el enlace **Generar o administrar mi API key de Gemini** debajo del campo de la clave, que abre [Google AI Studio](https://aistudio.google.com/api-keys?hl=es-419). Para MiniMax, sigue la sección siguiente. Chrome pedirá permiso de conexión únicamente para el proveedor elegido. El campo queda vacío tras guardar; dejarlo vacío al actualizar conserva la clave existente.
4. En el panel flotante a la derecha, debajo de la cabecera del examen, pulsa **Sugerir con IA**. Usa **Contraer / Expandir** para ocultar o ver su contenido y arrastra su esquina inferior izquierda para ampliar o reducir el tamaño. Las respuestas largas tienen desplazamiento interno. La extensión envía solo el curso, enunciado, opciones y asociaciones de esa pregunta. Nunca selecciona ni envía respuestas por ti.

La sugerencia muestra letra y texto en selección múltiple, posiciones en ordenación, palabras por hueco en afirmaciones y pares de textos en conexión o clasificación. No incluye explicaciones. Se comprueba que cada opción exista, que las parejas sean válidas y que no falten pasos. Si cambia la pregunta durante la consulta, la respuesta antigua se descarta.

Los modelos iniciales son `gemini-3.5-flash-lite` y `openrouter/free`; puedes cambiarlos. La disponibilidad y el acceso gratuito dependen del proveedor, modelo y cuenta: [tarifas de Gemini](https://ai.google.dev/gemini-api/docs/pricing) y [router gratuito de OpenRouter](https://openrouter.ai/docs/guides/routing/routers/free-router). Las solicitudes usan las API documentadas de [Gemini](https://ai.google.dev/api/generate-content) y [OpenRouter](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request).

Las claves se guardan en IndexedDB bajo el origen de la extensión, separado de los scripts que se ejecutan en Platzi y del historial. No se sincronizan ni se incluyen en las exportaciones. **Eliminar clave** quita la clave del proveedor seleccionado. El almacenamiento local no es una caja fuerte cifrada frente a alguien que controle tu perfil de Chrome.

### MiniMax con Token Plan / M Plan

1. Recarga la extensión, vuelve a abrir **Configuración** y selecciona **MiniMax (Token Plan)**.
2. Obtén tu **Subscription Key** desde tu plan de MiniMax; hay un enlace junto al campo de la clave. Es la clave de suscripción que usas en herramientas como OpenCode, no una clave estándar de pago por uso. Pégala solo en la extensión.
3. El modelo predeterminado es `MiniMax-M3.1-Flash`. El campo **Modelo** ofrece también `MiniMax-M3`.
4. Pulsa **Guardar configuración** y acepta el permiso para conectar con `https://api.minimax.io/*`.
5. Con la pestaña de Platzi actualizada, usa **Sugerir con IA** o activa las consultas automáticas. Si ya hay una sugerencia guardada de otro proveedor, pulsa **Volver a consultar IA** para reemplazarla con MiniMax.

La integración usa `https://api.minimax.io/v1/chat/completions`, con autenticación Bearer y sin instalar un SDK. MiniMax documenta el uso de la clave de suscripción en [herramientas compatibles con OpenAI](https://platform.minimax.io/docs/m-plan/other-tools); sus [instrucciones del plan](https://platform.minimax.io/docs/m-plan/quickstart) distinguen esa clave de la de pago por uso. La disponibilidad y los límites dependen de tu suscripción. Solo está configurada la API global, no la regional de China.

Desde 0.6.1, Configuración muestra **Proveedor activo** con el modelo guardado. Conservar claves de Gemini y MiniMax no activa ambos: se usa el proveedor del último guardado. Cambiar el desplegable sin guardar no cambia el proveedor activo. El panel de Platzi distingue **Proveedor activo para nuevas consultas** del proveedor y modelo que generaron la sugerencia mostrada. Una sugerencia guardada o recibida antes de cambiar de proveedor puede seguir identificada como Gemini; **Volver a consultar IA** genera otra con la configuración activa, sin borrar las claves de otros proveedores.

Para reducir la espera, M3.1 Flash usa razonamiento `low` y M3 usa respuesta directa sin razonamiento; ambos comportamientos están documentados en la [API de MiniMax](https://platform.minimax.io/docs/api-reference/text-openai-api). Solo se muestra el contenido final validado, no el razonamiento. La prueba automatizada simula ambos modelos; la conexión real requiere tu clave y queda pendiente hasta configurarla en la extensión.

La IA puede equivocarse; sus sugerencias no se convierten en aciertos confirmados ni se guardan como respuestas del usuario. Las consultas tienen límite de salida y tiempo de espera, sin reintentos automáticos.

### Consulta automática y sugerencias guardadas

En **Configuración**, marca **Consultar IA automáticamente en preguntas nuevas** y pulsa **Guardar configuración**. Viene apagada: si no la activas, las consultas siguen siendo manuales. Al activarla se envía la pregunta al proveedor configurado cuando no hay una respuesta elegida anteriormente ni una sugerencia guardada. Una pregunta omitida sin selección no cuenta como respondida. Puede consumir cuota o saldo del proveedor; nunca selecciona opciones ni envía respuestas al examen.

Las consultas correctas del servicio se guardan localmente en una caché independiente del historial. Al reconocer de nuevo el mismo curso, enunciado, formato, opciones y grupos, el panel muestra **Sugerencia guardada** sin una nueva petición, incluso con el modo automático apagado. Si cambia el orden de las opciones, se adapta la letra a su posición actual. **Volver a consultar IA** solicita una nueva sugerencia y reemplaza la guardada. Una sugerencia guardada no significa que Platzi haya confirmado un acierto. Si cambias de proveedor o modelo, puedes usar ese botón para actualizarla.

El modo automático realiza como máximo un intento por aparición de la pregunta; un error se muestra en el panel y no provoca reintentos por cambios del HTML. Puedes reintentar con el botón. Las sugerencias usan el mismo espacio local que el historial, pero no se incluyen en su exportación JSON. No es necesario borrar registros anteriores para usar esta versión.

Desde la versión 0.4.1, al detectar la página recargada se cancela la consulta que pertenecía a la página anterior. Su respuesta se descarta y no bloquea la consulta del nuevo documento. Esto no evita los efectos que una recarga pueda tener sobre los indicadores nativos de Platzi.

Desde la versión 0.4.2, cada consulta espera hasta 90 segundos, en lugar de 25. El panel avisa mientras espera al proveedor. Si se supera ese tiempo, muestra el error y permite reintentar con **Sugerir con IA**, sin reintentos automáticos. Ampliar el límite no garantiza una respuesta: la conexión y la disponibilidad del proveedor pueden seguir impidiendo completar la consulta.

### Limpiar preguntas y sugerencias

En **Configuración → Limpiar datos**, pulsa **Eliminar historial y sugerencias** y confirma. Borra todas las respuestas, sugerencias y diagnósticos guardados, conservando las API keys, la configuración y el estado de captura. Es irreversible: exporta antes el historial si lo necesitas. Una consulta de IA que estuviera pendiente se descarta para no volver a guardar sus resultados tras la limpieza. La pregunta visible no se consulta automáticamente de nuevo como efecto de limpiar; las siguientes preguntas vuelven a evaluarse normalmente.

### Diagnóstico de consultas a la API

Desde la versión 0.6.0, abre la pestaña **Diagnóstico API** del popup o del historial. **Abrir en pestaña** permite revisar los detalles con más espacio. No hace falta abrir las herramientas de desarrollo de Chrome.

- **Fetch invocado:** la extensión llamó a `fetch` con la solicitud mostrada. No demuestra por sí solo que el servidor la haya recibido.
- **HTTP:** estado real recibido del proveedor. Si no hay respuesta HTTP, el registro lo indica; también muestra errores, cancelaciones y duración.
- **Caché reutilizada:** se mostró una sugerencia guardada sin una nueva consulta de red.
- **Ver URL, cabeceras y parámetros enviados:** despliega método, URL y cuerpo JSON de la solicitud, incluidos prompts, opciones, modelo y límites. Las cabeceras de autenticación se sustituyen por `[OCULTA]` antes de guardar el registro. Las claves no se envían a esta interfaz.

Los registros se actualizan mientras está abierta la pestaña y también puedes pulsar **Actualizar**. Se conservan los últimos 20, solo en este navegador; contienen el texto de las preguntas. No se guardan respuestas crudas ni razonamiento del proveedor y no se incluyen en el JSON del historial. **Limpiar diagnóstico** borra solo estos registros, conservando historial, caché, claves y ajustes. Las consultas previas a esta versión no se pueden reconstruir. Si Chrome interrumpe la extensión durante una consulta, un registro puede quedar sin resultado final; no debe interpretarse como una respuesta recibida.

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
