# ElectriCOs

Aplicación educativa para medir el consumo eléctrico de un hogar, estimar su huella de carbono, proponer una meta de reducción y hacer seguimiento. Proyecto integrador STEM/STEAM, I. E. Ramón Martínez Benítez (Cartago).

## Descripción

```
CONSUMO → DIAGNÓSTICO → HUELLA → META → ACCIÓN → SEGUIMIENTO
MEDIR   → COMPRENDER  →          ACTUAR       → VERIFICAR
```

El consumo entra de dos formas, que terminan en el mismo modelo de datos y el mismo motor de cálculo:

- **Factura**: PDF de la empresa, foto con cámara o de la galería. Lectura con IA, con el texto del PDF o con OCR, siempre validada y confirmada por la persona.
- **Manual**: lecturas del medidor o consumo en kWh.

## Objetivo

Que las familias comprendan su consumo con datos reales y oficiales, y que los estudiantes de 9.º a 11.º puedan explicar, modificar y defender cómo está construida la plataforma.

## Integrantes

_Completar por el equipo: nombre, grado y rol (líder técnico, frontend, datos, IA, QA, documentación)._

## Tecnologías

| Herramienta | Uso |
|---|---|
| Next.js 15 + React 19 + TypeScript | Interfaz y rutas de servidor |
| Supabase (PostgreSQL + Auth + RLS) | Datos, cuentas y seguridad |
| PDF.js | Texto y coordenadas de facturas en PDF |
| Tesseract.js | OCR en el navegador (sin internet) |
| Gemini (opcional) | Lectura de facturas difíciles y recomendaciones |
| Vercel | Compilación y publicación |
| tsx + node:test | Pruebas automáticas |

## Arquitectura

Ver [docs/arquitectura.md](docs/arquitectura.md).

```
app/
├── page.tsx              contenedor: sesión → hogar → pantallas
├── components/           pantallas y piezas de la interfaz
├── api/factura/          lectura de facturas con IA (servidor)
├── api/recomendaciones/  recomendaciones con IA (servidor)
└── lib/
    ├── calculos/         motor matemático y parámetros oficiales
    ├── factura/          lector de facturas y validación
    ├── ia/               llamada a Gemini
    └── supabase/         cliente y capa de datos
supabase/migrations/      esquema, RLS y ajustes de seguridad
supabase/tests/           prueba de seguridad (RLS)
tests/                    pruebas del motor y del lector
docs/                     documentación para estudiar y defender
```

## Instalación

```powershell
git clone https://github.com/jhoandabit/ElectriCOS.git
cd ElectriCOS
npm install
Copy-Item .env.example .env.local
npm run dev
```

Luego abrir http://localhost:3000. Completar `.env.local` con los valores de la tabla siguiente.

## Variables de entorno

| Variable | Dónde | Pública |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (clave `anon`) | Sí (RLS protege los datos) |
| `GEMINI_API_KEY` | aistudio.google.com/apikey | **No**: solo servidor |
| `IA_PROVEEDOR` | `gemini` | — |

Nunca subir `.env.local` a GitHub ni usar la clave `service_role` en la app. Ver [docs/seguridad.md](docs/seguridad.md).

## Base de datos

7 tablas con RLS en todas: `profiles`, `households`, `consumption_records`, `invoices`, `energy_parameters`, `baselines`, `reduction_goals`. Ver [docs/modelo-datos.md](docs/modelo-datos.md).

## Funcionalidades

- Cuenta con correo y contraseña; perfil estudiante o docente.
- Hogar: municipio, estrato, personas, altitud (para la subsistencia).
- Lectura de facturas (Energía de Pereira, CHEC, Celsia, EPM y otras) con validación cruzada y lectura guiada para fotos.
- Importación del histórico impreso en la factura.
- Diagnóstico del mes: kWh, kWh en 30 días, huella, por persona, frente al promedio y a la subsistencia.
- Línea base (promedio, mínimo, máximo, variación, tendencia) y meta de reducción con acciones.
- Progreso: gráfico, tabla, energía, emisiones y dinero ahorrados.
- Recomendaciones con IA o, sin ella, por reglas.

Fórmulas y fuentes: [docs/calculos.md](docs/calculos.md). Lector: [docs/lector-facturas.md](docs/lector-facturas.md).

## Pruebas

```powershell
npm test
```

Seguridad: `supabase/tests/prueba_rls.sql`. Matriz completa: [docs/pruebas.md](docs/pruebas.md).

## Problemas y soluciones

Errores reales de la construcción, con causa y aprendizaje: [docs/bitacora.md](docs/bitacora.md).

## Versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 0.1 | 25/09/2026 | Interfaz móvil, ingreso manual, primer OCR |
| 0.2 | 28/09/2026 | Lector de facturas validado, cuentas, Supabase con RLS, línea base, huella, metas, progreso, recomendaciones, pruebas y documentación |

## Despliegue

Cada `git push` a una rama crea una vista previa en Vercel; `main` se publica en https://electri-cos.vercel.app. Lista de producción: guía, módulo 15.

## Mejoras futuras

- Vista de docente con el resumen del curso.
- Registro de electrodomésticos y su consumo estimado.
- Lectura del medidor con cámara (sin factura) y sensores IoT.
- Factores de emisión por año cuando la UPME publique los nuevos.

## Para docentes

Plan de estudio por semanas, preguntas y retos de modificación: [docs/guia-docente.md](docs/guia-docente.md).
