# Instrucciones del proyecto

## Producto y colaboración

- Extensión de Chrome de uso personal, sin comercialización ni distribución prevista.
- Guardar preguntas, opciones, respuestas elegidas y resultados observables de exámenes de Platzi.
- Contemplar múltiples formatos de preguntas y feedback asíncrono y fugaz.
- Nunca inventar un resultado: si falta evidencia, conservar «sin confirmar».
- Ejecutar la captura exclusivamente en Platzi y activarla ante una ruta y estructura de examen reconocidas.
- Empezar con almacenamiento local de la extensión y exportación; evaluar servicios externos solo cuando sean necesarios.
- Priorizar un producto mínimo funcional, cambios pequeños y resultados concretos. No agregar funciones futuras sin pedirlas.
- Responder en español, de forma concisa y directa. Explicar decisiones en profundidad solo si el usuario lo solicita.
- El usuario carga manualmente la extensión descomprimida y se ubica en el examen cuando sea necesario.
- El agente inspecciona el navegador, realiza las pruebas autorizadas y ajusta los selectores usando HTML real.
- Avisar de los efectos de pruebas reales: responder puede consumir vidas y avanzar el examen.
- No almacenar cookies, credenciales, HTML completo ni datos ajenos al examen.
- Mostrar dentro del examen un elemento HTML con las respuestas anteriores de la misma pregunta: respuestas correctas confirmadas, respuestas o combinaciones incorrectas y registros sin confirmar claramente separados.
- Asociar preguntas por curso, enunciado, formato y opciones; el orden aleatorio de las opciones no cambia la identidad.
- Para ordenar, conectar, clasificar o rellenar, conservar pasos y asociaciones. Un fallo global no implica que cada parte individual sea incorrecta.
- El usuario autorizó recorrer y resolver el examen completo para inspeccionar todos los formatos, aunque haya fallos.
- La IA sugiere únicamente: nunca seleccionar opciones ni enviar respuestas automáticamente. Consultar al pulsar el botón del examen o, con la opción automática activada explícitamente, al reconocer una pregunta sin respuestas previas ni sugerencia guardada. La opción viene apagada y no reintenta errores automáticamente.
- Guardar sugerencias de IA separadas del historial de respuestas reales; reutilizarlas adaptando las letras al orden actual. Limpiar historial y sugerencias desde Configuración con confirmación, conservando claves y ajustes.
- Configuración admite Gemini, OpenRouter y MiniMax (Token Plan / M Plan, API global, modelos MiniMax-M3.1-Flash y MiniMax-M3). Guardar las API keys solo en el origen privado de la extensión; nunca en el DOM de Platzi, prompts, logs ni exportaciones del historial.
- Enviar al proveedor elegido solo el curso, enunciado, opciones y asociaciones necesarias para resolver la pregunta actual. Mostrar respuestas breves sin explicaciones y separadas de los resultados confirmados.
- Mostrar historial y sugerencias en un panel flotante contraíble y redimensionable, fuera de la tarjeta del examen para evitar el recorte de los contenedores de Platzi.
- Reservar espacio para la cabecera nativa de Platzi: el panel no debe tapar tiempo, vidas, progreso ni el botón de cerrar.

## Efficiency and scope

Prefer the smallest correct change.

Do not perform broad repository-wide validation unless it is necessary
for the requested change.

After modifying code:

1. Run the narrowest relevant test first.
2. Run broader tests only if the narrow test fails or the change affects shared infrastructure.
3. Do not run dependency installation commands (`npm ci`, `npm install`, etc.) unless dependencies actually changed or are missing.
4. Do not run clean/rebuild commands unless required.
5. Do not repeatedly run the same validation after it has already passed.
6. Do not perform unrelated security, lint, race, compatibility, or architectural checks unless requested or directly relevant.
7. Do not create temporary files inside the repository unless strictly necessary.
8. Do not implement additional improvements discovered during the task. Report them at the end instead.
9. If validation requires installing system dependencies or substantially expanding the task, stop and report it instead of doing it automatically.

For small fixes, prefer: inspect -> edit -> targeted validation -> report.

Do not turn a localized task into a repository-wide refactor or audit.

## Validation budget

For a localized change, use at most 2 validation commands by default.

Additional validation commands require a concrete reason caused by the change being made.

Passing validation must not trigger additional exploratory validation.
