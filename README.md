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

1. **IA de visión** (`app/api/factura`): lee fotos y PDF con Gemini o Claude, según la clave configurada.
2. **Texto del PDF** (`app/lib/factura/extraer-texto.ts`): lee el texto digital del PDF sin internet. Si hay IA, sirve de segunda opinión.
3. **OCR local** (`app/lib/factura/ocr-local.ts`): Tesseract en el navegador, cuando no hay IA ni texto digital.

Toda lectura pasa por `app/lib/factura/validar.ts`: compara el consumo con las lecturas del
medidor, con el promedio de la factura y con rangos razonables, y le dice a la persona qué revisar.
La factura no se guarda, y a la IA se le pide no devolver nombres, direcciones ni números de cuenta.

### Configurar la IA

En Vercel → Settings → Environment Variables agrega `GEMINI_API_KEY`
(clave gratuita en https://aistudio.google.com/apikey) y vuelve a desplegar.
Sin clave, la app sigue funcionando con el texto del PDF y el OCR local. Ver `.env.example`.

## Arquitectura

- Next.js + React, enfoque mobile-first.
- Supabase para datos, autenticación y almacenamiento.
- IA de visión + OCR para lectura de facturas.
- IA para interpretación y recomendaciones.

## Estado

MVP en construcción: lectura de facturas lista; siguen diagnóstico, huella, metas y seguimiento.
