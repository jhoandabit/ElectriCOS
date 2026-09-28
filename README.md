# ElectriCOs

Sistema educativo para estimar la huella asociada al consumo eléctrico familiar.

## Flujo

CONSUMO → DIAGNÓSTICO → HUELLA → META → ACCIÓN → SEGUIMIENTO

## Entrada de consumo

- Foto o PDF de la factura: carga, lectura inteligente, revisión y confirmación.
- Manual: ingreso directo de los datos.

Ambas entradas usan el mismo modelo de consumo (`app/lib/factura/tipos.ts`) y el mismo motor de cálculo.

## Lector de facturas

Pensado para Energía de Pereira; también reconoce CHEC, Celsia y EPM.

1. **IA de visión** (`app/api/factura`): lee fotos y PDF con Vercel AI Gateway (sin claves dentro de Vercel); Gemini o Claude como respaldo si hay clave.
2. **Texto del PDF** (`app/lib/factura/extraer-texto.ts` y `estructura.ts`): lee el texto digital del PDF sin internet, incluso cuando las etiquetas son parte del diseño (Energía de Pereira). Si hay IA, sirve de segunda opinión.
3. **OCR local** (`app/lib/factura/ocr-local.ts`): Tesseract en el navegador, cuando no hay IA ni texto digital.
4. **Lectura guiada de fotos** (`app/lib/factura/ocr-guiado.ts`): la persona encierra con el dedo la fila del
   medidor; se recorta a resolución completa, se endereza, se borran las líneas de la tabla y se lee renglón
   por renglón. Gratis, sin internet y sin enviar la foto a ningún servicio.

Toda lectura pasa por `app/lib/factura/validar.ts`: compara el consumo con las lecturas del
medidor, con el promedio de la factura y con rangos razonables, y le dice a la persona qué revisar.
La factura no se guarda, y a la IA se le pide no devolver nombres, direcciones ni números de cuenta.

### Configurar la IA

En Vercel no hace falta configurar nada: la ruta usa **Vercel AI Gateway** con el token OIDC del proyecto.
Opcionales (Vercel → Settings → Environment Variables): `AI_GATEWAY_API_KEY` para probar en local,
`GEMINI_API_KEY` o `ANTHROPIC_API_KEY` como respaldo. Sin IA, la app sigue funcionando con el texto
del PDF y el OCR local. Ver `.env.example`.

## Arquitectura

- Next.js + React, enfoque mobile-first.
- Supabase para datos, autenticación y almacenamiento.
- IA de visión + OCR para lectura de facturas.
- IA para interpretación y recomendaciones.

## Estado

MVP en construcción: lectura de facturas lista; siguen diagnóstico, huella, metas y seguimiento.
