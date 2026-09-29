# Guía para estudiar ElectriCOs (docente)

> Cómo usar esta versión completa con la *Guía de construcción 9.º–11.º*. La idea: ElectriCOs ya funciona; cada equipo **lo estudia, lo modifica y lo defiende**. Para cada semana: qué leer, qué preguntar y un reto de modificación comprobable.

| Semana (guía) | Leer | Preguntas de andamiaje | Reto de modificación |
|---|---|---|---|
| 1 · Problema | `README.md`, `docs/arquitectura.md` | ¿Qué problema resuelve? ¿Quién la usa? ¿Qué entra y qué sale? | Explicar ElectriCOs en 3 minutos a alguien que no programa |
| 2 · Requisitos | Pantallas de la app | ¿Qué historia de usuario cumple cada pantalla? | Escribir 5 historias "Como…, quiero…, para…" que la app ya cumple y 3 que no |
| 3 · Arquitectura | `docs/arquitectura.md` | ¿Dónde se genera, transforma y guarda el consumo? ¿Qué pasa si el lector no reconoce la foto? | Dibujar el recorrido del dato "353 kWh" |
| 4–5 · Entorno y Git | `package.json`, historial de commits | ¿Qué cambió en cada commit? ¿Por qué hay una rama `lector-facturas-ia`? | Hacer un commit pequeño que cambie un texto y describirlo bien |
| 6 · Frontend | `app/page.tsx`, `app/components/` | ¿Cómo sabe la app qué pantalla mostrar? ¿Qué hace `Pantalla.tsx`? | Agregar una acción nueva al catálogo (`recomendaciones.ts`) y verla en Meta |
| 7 · Datos | `docs/modelo-datos.md`, migración 100 | ¿Por qué `unique (household_id, periodo)`? ¿Por qué guardar la línea base? | Proponer una tabla nueva (p. ej. electrodomésticos) con sus relaciones |
| 8 · Supabase | `app/lib/supabase/datos.ts` | ¿Qué función guarda un consumo? ¿Qué es un *upsert*? | Mostrar en Inicio cuántas facturas se han leído (tabla `invoices`) |
| 9 · Auth | `AuthScreen.tsx` | ¿Dónde se guardan las contraseñas? ¿Qué es una sesión? | Cambiar un mensaje de error de ingreso y probarlo |
| 10 · Roles/RLS | `docs/seguridad.md`, migración 200, `supabase/tests/prueba_rls.sql` | ¿Qué impide que Beto vea lo de Ana? ¿Por qué Ana no puede volverse docente? | Agregar una prueba T13 al script de RLS |
| 11–14 · Módulos | `motor.ts`, `MetaScreen.tsx`, `ProgresoScreen.tsx` | ¿Por qué normalizar a 30 días? ¿Qué pasa si no hay 3 meses? | Agregar una opción de 20 % a la meta; escribir su prueba en `tests/calculos.test.ts` |
| 15 · IA | `docs/lector-facturas.md`, `app/lib/factura/ocr-paddle.ts` | ¿Qué hacen las dos redes neuronales de PaddleOCR? ¿Por qué corre en el celular? ¿Qué es la confianza? | Hacer el experimento de 10 facturas y reportar aciertos y fallos |
| 16–17 · Pruebas y depuración | `docs/pruebas.md`, `docs/bitacora.md` | ¿Cómo se encontró el error E07? ¿Qué hipótesis tenían? | Ejecutar la matriz de pruebas y registrar un error nuevo con la plantilla |
| 18 · Vercel | Panel de Vercel, variables de entorno | ¿Qué variables son públicas (`NEXT_PUBLIC_`) y por qué no es peligroso? | Revisar un despliegue y leer sus registros |
| 19 · Documentación | Todo `docs/` | ¿Qué falta explicar? | Completar "Integrantes" y "Versiones" en el README |
| 20 · Defensa | Guía, sección 24 | Preguntas de defensa de cada `docs/*.md` | Demostración en vivo |

## Roles sugeridos por equipo (rotan)

| Rol | Archivos que "cuida" |
|---|---|
| Líder técnico | `app/page.tsx`, `docs/arquitectura.md` |
| Frontend | `app/components/`, `app/globals.css` |
| Datos | `supabase/migrations/`, `app/lib/supabase/` |
| IA | `app/lib/factura/`, `scripts/preparar-ocr.mjs` |
| QA | `tests/`, `supabase/tests/`, `docs/pruebas.md` |
| Documentación | `README.md`, `docs/bitacora.md` |

## Cómo trabajar sin romper la versión publicada

1. Cada equipo trabaja en su rama: `git checkout -b equipo-3-meta-20`.
2. Al subirla, Vercel crea una vista previa solo para esa rama.
3. `npm test` debe pasar antes de pedir que se fusione a `main`.
4. La docente revisa el *pull request* y lo fusiona.

## Qué evitar (guía, sección 27)

- Que un solo integrante entienda el lector de facturas: es la parte más compleja. Repartan `extraer-texto.ts`, `estructura.ts` y `validar.ts`.
- Aceptar cambios de IA sin prueba: todo cambio al motor necesita su prueba en `tests/`.
