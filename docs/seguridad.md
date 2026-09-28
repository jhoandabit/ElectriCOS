# Seguridad y privacidad

> Guía, módulos 7, 8 y 10. SQL: `supabase/migrations/20260928000200_seguridad_rls.sql` y `..._300_funciones_privadas_indices.sql`.

## Autenticación vs. autorización

| Pregunta | Concepto | En ElectriCOs |
|---|---|---|
| ¿Quién eres? | Autenticación | Supabase Auth con correo y contraseña. Las contraseñas no pasan por nuestras tablas |
| ¿Qué función puedes usar? | Autorización de aplicación | Estudiante: registrar y proponer metas. Docente: ver |
| ¿Qué filas puedes ver o cambiar? | Autorización de datos (RLS) | Cada política compara `auth.uid()` con el dueño del hogar |

## Matriz de permisos

| Tabla | Estudiante (dueño) | Docente | Sin sesión |
|---|---|---|---|
| profiles | ver y editar el suyo (menos el rol) | ver todos | — |
| households | crear, ver, editar y borrar los suyos | ver todos | — |
| consumption_records | todo en su hogar | ver | — |
| invoices | crear, ver y borrar en su hogar | ver | — |
| baselines | crear, ver y borrar en su hogar | ver | — |
| reduction_goals | todo en su hogar | ver | — |
| energy_parameters | ver | ver | ver |

**Asignar docente** (solo un administrador, en Supabase → SQL Editor):

```sql
update public.profiles set rol = 'docente'
where id = (select id from auth.users where email = 'correo.del.docente@iermb.edu.co');
```

## Claves y secretos

| Elemento | Dónde vive | ¿Puede ir en el navegador? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Sí: son públicas por diseño. RLS protege los datos |
| `GEMINI_API_KEY` | Vercel, tipo "Sensitive" | **No.** Solo la usan `app/api/*` en el servidor |
| `service_role` de Supabase | Solo en el panel de Supabase | **Nunca.** Salta todas las reglas RLS |

`.gitignore` excluye `.env*` para que ninguna clave llegue a GitHub.

## Mapa de amenazas (evidencia del módulo 8)

| Amenaza | Vulnerabilidad | Control | Prueba |
|---|---|---|---|
| Beto quiere ver el consumo de Ana | La API permite consultar cualquier tabla | RLS: `es_dueno_hogar(household_id)` | T4, T5 → 0 filas |
| Beto cambia el `household_id` en la petición para escribir en el hogar de Ana | El cliente controla el cuerpo de la petición | `with check` en insert/update | T6 → rechazado |
| Ana se asigna el rol docente | La tabla profiles es editable | `grant update (nombre_visible, grado)`: la columna `rol` no | T3 → rechazado |
| Beto crea un hogar a nombre de Ana | `owner_id` viene del cliente | `with check (owner_id = auth.uid())` | T8 → rechazado |
| La docente modifica datos | Tiene acceso de lectura | Sin políticas de update para docente | T10 → 0 filas |
| Alguien sin sesión lee hogares | API pública | `revoke all ... from anon` | T11 → rechazado |
| Llamar funciones internas por la API | Funciones `security definer` en `public` | Movidas al esquema `privado` | Asesor de Supabase sin avisos |
| Filtrar datos personales a la IA | La factura trae nombre y dirección | Se pide a la IA no devolverlos y no se guardan; las recomendaciones reciben solo números | Revisar `datos_extraidos` en `invoices` |

Cómo repetir las pruebas: [pruebas.md](pruebas.md).

## Privacidad (estudiantes menores de edad)

- No se guardan nombres completos, direcciones, matrículas ni fotos de facturas.
- El "nombre del hogar" pide explícitamente no usar direcciones ni apellidos.
- La factura se procesa y se descarta. Con Gemini **gratuito**, Google puede usar lo enviado para mejorar sus productos: para uso con familias conviene la versión de pago o la lectura sin IA.
