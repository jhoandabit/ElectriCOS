# Bitácora de errores y decisiones

> Guía, plantilla B ("Registro de error") y módulo 14: «Nunca borrar un error simplemente para que desaparezca. Primero hay que entenderlo.»
> Estos son errores **reales** de la construcción de ElectriCOs. Sirven como casos de estudio.

---

### E01 · Las fotos nunca encontraban nada (25 sep 2026)

| Campo | Respuesta |
|---|---|
| Error observado | Con foto, todos los campos salían "No detectado", aunque el texto reconocido sí traía los números |
| Mensaje exacto | Ninguno: el código no fallaba, solo no encontraba coincidencias |
| Pasos para reproducirlo | Subir cualquier foto de factura en la versión de `main` del 25/09 |
| Hipótesis | Las expresiones regulares no coinciden con el texto del OCR |
| Prueba realizada | Leer el código: las regex decían `\\s` y `\\d` en lugar de `\s` y `\d` |
| Causa | Las barras invertidas estaban duplicadas (causa probable: al generar o pegar el código, se escaparon dos veces). `\\s` busca una barra seguida de la letra "s", no un espacio |
| Solución | Reescribir el lector en módulos con pruebas automáticas (`tests/factura.test.ts`) |
| Aprendizaje | Un código que "no falla" puede estar mal. Las pruebas con datos reales detectan lo que la compilación no ve |

### E02 · El PDF decía 12 kWh en lugar de 353 (28 sep)

| Campo | Respuesta |
|---|---|
| Error observado | Consumo 12 kWh, lecturas 268 → 280 |
| Hipótesis | El buscador de "tres números donde A − B = C" encontró números del histórico |
| Prueba realizada | En el histórico aparecen 268 y 280 (julio y junio), y 12 existe en otra parte de la factura: 280 − 268 = 12 |
| Causa | Se aceptaban tres números aunque estuvieran lejos entre sí |
| Solución | Exigir que los tres números estén seguidos, y reconocer la fila del medidor por su estructura completa (`estructura.ts`) |
| Aprendizaje | Una regla matemática correcta aplicada a los datos equivocados da un resultado falso con apariencia de verdadero |

### E03 · "Your project has been denied access" (28 sep)

| Campo | Respuesta |
|---|---|
| Error observado | La IA nunca respondía; la app usaba la lectura sin conexión |
| Mensaje exacto | `Gemini respondió 403: Your project has been denied access. Please contact support.` |
| Cómo se diagnosticó | Registros de ejecución de Vercel (Runtime Logs) de la ruta `/api/factura` |
| Causa | Google bloqueó el proyecto de la primera clave. Es un problema de la cuenta, no del código |
| Solución | Clave nueva de otro proyecto + respaldo sin IA (texto del PDF, OCR y lectura guiada) |
| Aprendizaje | Los servicios externos fallan por razones ajenas a nosotros. La app debe seguir sirviendo sin ellos |

### E04 · "AI Gateway requires a valid credit card" (28 sep)

| Campo | Respuesta |
|---|---|
| Mensaje exacto | `AI Gateway requires a valid credit card on file to service requests.` |
| Decisión | No registrar tarjeta en un proyecto escolar |
| Aprendizaje | "Gratis" a veces exige una tarjeta. Leer las condiciones antes de elegir un servicio |

### E05 · Probar antes de que el cambio esté publicado (28 sep)

| Campo | Respuesta |
|---|---|
| Error observado | Después de configurar la clave nueva, la prueba seguía fallando con el error viejo |
| Prueba realizada | Hora de la prueba (17:42) vs. hora del despliegue nuevo (17:43) en los registros |
| Causa | Las variables de entorno solo se aplican en despliegues nuevos, y la prueba se hizo un minuto antes |
| Aprendizaje | Antes de concluir que algo "no funciona", confirmar qué versión se está probando |

### E06 · Build fallido: "Cannot find name 'conGateway'" (28 sep)

| Campo | Respuesta |
|---|---|
| Mensaje exacto | `Type error: Cannot find name 'conGateway'. ./app/lib/factura/ia.ts:165:19` |
| Causa | Al mover código a `lib/ia/gemini.ts` se recortó un bloque de más |
| Solución | Recuperar la función desde el historial de Git (`git show <commit>:archivo`) |
| Aprendizaje | Git guarda cada versión: nada se pierde si se hizo commit. La verificación de tipos de `npm run build` atrapa este tipo de error antes de publicar |

### E07 · Lecturas al revés aceptadas como 900 kWh (28 sep)

| Campo | Respuesta |
|---|---|
| Error observado | Lectura anterior 500, actual 400 → la app calculaba 900 kWh |
| Cómo se encontró | Recorrido automático de la interfaz (caso de prueba T05) |
| Causa | Cualquier lectura menor se trataba como si el medidor hubiera "dado la vuelta" (999 → 000) |
| Solución | Solo es vuelta si la anterior está cerca del máximo (≥ 90 %) y la actual cerca de cero (≤ 10 %) |
| Aprendizaje | Probar también con datos equivocados, no solo con los que funcionan |

### E08 · La segunda clave de Gemini tampoco funcionó; se retira la IA en la nube (28 sep)

| Campo | Respuesta |
|---|---|
| Error observado | Las fotos no se leían; el PDF sí |
| Mensaje exacto | `Gemini respondió 401: Request had invalid authentication credentials. Expected OAuth 2 access token` |
| Causa | Las claves nuevas con prefijo "AQ." fallan en varios proyectos; en los foros de Google no hay solución oficial |
| Decisión | Retirar la IA en la nube. En su lugar, PaddleOCR dentro del celular: gratis, sin claves, y la foto no sale del dispositivo |
| Prueba | Comparación en Chromium con la misma factura: PaddleOCR leyó 353 kWh incluso en la captura de 616×500 donde Tesseract falló ([lector-facturas.md](lector-facturas.md)) |
| Aprendizaje | Depender de un servicio externo gratuito es frágil. Una solución que corre en el propio dispositivo es más confiable y más privada |

### E09 · "27 días" en lugar de 28 (28 sep)

| Campo | Respuesta |
|---|---|
| Error observado | En fotos, los días facturados salían 27 |
| Causa | Del 14 de agosto al 10 de septiembre hay 27 días de diferencia, pero la empresa cuenta ambos extremos: 28 |
| Solución | Cuando el número no aparece escrito, se calcula la diferencia + 1; prueba agregada |
| Aprendizaje | "Cuántos días hay entre dos fechas" depende de si se cuentan los extremos: hay que saber qué convención usa la fuente |

---

## Decisiones

| Fecha | Decisión | Por qué |
|---|---|---|
| 28/09 | El periodo se nombra por el mes en que termina la lectura | Así lo hace el histórico de la factura; si no, dos consumos distintos quedarían como "agosto" |
| 28/09 | Normalizar consumos a 30 días | Los periodos duran entre 28 y 33 días |
| 28/09 | La IA no calcula; solo lee texto en fotos | Los cálculos deben ser verificables y tener pruebas |
| 28/09 | Lector de fotos dentro del celular (PaddleOCR) en vez de IA en la nube | Gratis, privado, sin claves; probado con la factura de referencia |
| 28/09 | No guardar fotos ni datos personales | Los usuarios son menores de edad; no se necesitan |
| 28/09 | Funciones de seguridad en el esquema `privado` | El asesor de Supabase advirtió que se podían llamar desde la API |
