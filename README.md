# ElectriCOs

Sistema educativo para estimar la huella asociada al consumo eléctrico familiar.

## Flujo
CONSUMO -> DIAGNOSTICO -> HUELLA -> META -> ACCION -> SEGUIMIENTO

## Entrada de consumo
- Foto o factura: captura/carga, lectura inteligente, revision y confirmacion.
- Manual: ingreso directo de los datos.

Ambas entradas usan el mismo modelo de consumo y el mismo motor de calculo.

## Arquitectura inicial
- Next.js + React, enfoque mobile-first.
- Supabase para datos, autenticacion y almacenamiento.
- OCR para lectura de facturas.
- IA para interpretacion y recomendaciones.

## Estado
Base inicial del MVP.
