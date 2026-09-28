-- =====================================================================
-- ElectriCOs · Ajustes sugeridos por el asesor de seguridad de Supabase
--
-- Problema detectado: las funciones "security definer" del esquema public
-- quedaban expuestas en la API (/rest/v1/rpc/...), y cualquiera podía
-- llamarlas. Solución: moverlas a un esquema "privado", que la API no
-- publica. Las políticas RLS siguen funcionando porque apuntan a la función,
-- no a su nombre.
-- =====================================================================

create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

alter function public.es_docente() set schema privado;
alter function public.es_dueno_hogar(uuid) set schema privado;
alter function public.crear_perfil() set schema privado;

-- crear_perfil solo lo usa el disparador de auth.users: nadie más debe llamarlo.
revoke all on function privado.crear_perfil() from public, anon, authenticated;

-- Índices para las llaves foráneas que no tenían uno.
create index if not exists baselines_household_idx on public.baselines (household_id);
create index if not exists consumption_created_by_idx on public.consumption_records (created_by);
create index if not exists invoices_record_idx on public.invoices (consumption_record_id);
create index if not exists goals_baseline_idx on public.reduction_goals (baseline_id);
