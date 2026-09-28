-- =====================================================================
-- ElectriCOs · Seguridad (guía, módulos 7, 8 y 10)
--
-- Autenticación: ¿quién eres?          → Supabase Auth (correo + contraseña)
-- Autorización de datos: ¿qué filas?   → RLS en cada tabla
--
-- Matriz de permisos
-- | Tabla                | Estudiante (dueño)        | Docente            | Anónimo |
-- |----------------------|---------------------------|--------------------|---------|
-- | profiles             | ver/editar el suyo (no rol) | ver todos        | —       |
-- | households           | CRUD de los suyos          | ver todos         | —       |
-- | consumption_records  | CRUD de su hogar           | ver todos         | —       |
-- | invoices             | crear/ver/borrar su hogar  | ver todos         | —       |
-- | baselines            | crear/ver/borrar su hogar  | ver todos         | —       |
-- | reduction_goals      | CRUD de su hogar           | ver todos         | —       |
-- | energy_parameters    | ver                        | ver               | ver     |
-- Nadie cambia parámetros ni roles desde la app: solo un administrador por SQL.
-- =====================================================================

-- ---------- Funciones auxiliares ----------
-- security definer: se ejecutan con permisos del dueño para poder consultar
-- profiles/households sin que las mismas políticas se llamen en bucle.
-- search_path vacío: evita que alguien "suplante" tablas con otro esquema.

create or replace function public.es_docente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and rol = 'docente'
  );
$$;

create or replace function public.es_dueno_hogar(hogar uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.households
    where id = hogar and owner_id = (select auth.uid())
  );
$$;

revoke all on function public.es_docente() from public, anon;
revoke all on function public.es_dueno_hogar(uuid) from public, anon;
grant execute on function public.es_docente() to authenticated;
grant execute on function public.es_dueno_hogar(uuid) to authenticated;

-- ---------- Perfil automático al registrarse ----------
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nombre_visible)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'nombre_visible', ''), 60));
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------- Activar RLS en todas las tablas ----------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.consumption_records enable row level security;
alter table public.invoices enable row level security;
alter table public.energy_parameters enable row level security;
alter table public.baselines enable row level security;
alter table public.reduction_goals enable row level security;

-- ---------- profiles ----------
create policy "ver mi perfil o docente ve todos" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.es_docente()));

create policy "editar mi perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- El rol NO se puede cambiar desde la app: solo se permite actualizar estas columnas.
revoke update on public.profiles from authenticated;
grant update (nombre_visible, grado) on public.profiles to authenticated;

-- ---------- households ----------
create policy "ver mis hogares o docente" on public.households
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.es_docente()));

create policy "crear mi hogar" on public.households
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "editar mi hogar" on public.households
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "borrar mi hogar" on public.households
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------- consumption_records ----------
create policy "ver consumos de mi hogar o docente" on public.consumption_records
  for select to authenticated
  using ((select public.es_dueno_hogar(household_id)) or (select public.es_docente()));

create policy "crear consumos en mi hogar" on public.consumption_records
  for insert to authenticated
  with check ((select public.es_dueno_hogar(household_id)) and created_by = (select auth.uid()));

create policy "editar consumos de mi hogar" on public.consumption_records
  for update to authenticated
  using ((select public.es_dueno_hogar(household_id)))
  with check ((select public.es_dueno_hogar(household_id)));

create policy "borrar consumos de mi hogar" on public.consumption_records
  for delete to authenticated
  using ((select public.es_dueno_hogar(household_id)));

-- ---------- invoices (no se editan: son evidencia) ----------
create policy "ver facturas de mi hogar o docente" on public.invoices
  for select to authenticated
  using ((select public.es_dueno_hogar(household_id)) or (select public.es_docente()));

create policy "registrar facturas en mi hogar" on public.invoices
  for insert to authenticated
  with check ((select public.es_dueno_hogar(household_id)));

create policy "borrar facturas de mi hogar" on public.invoices
  for delete to authenticated
  using ((select public.es_dueno_hogar(household_id)));

-- ---------- energy_parameters (solo lectura para todos) ----------
create policy "parametros publicos" on public.energy_parameters
  for select to anon, authenticated
  using (true);

-- ---------- baselines (no se editan: una meta depende de ellas) ----------
create policy "ver lineas base de mi hogar o docente" on public.baselines
  for select to authenticated
  using ((select public.es_dueno_hogar(household_id)) or (select public.es_docente()));

create policy "crear lineas base en mi hogar" on public.baselines
  for insert to authenticated
  with check ((select public.es_dueno_hogar(household_id)));

create policy "borrar lineas base de mi hogar" on public.baselines
  for delete to authenticated
  using ((select public.es_dueno_hogar(household_id)));

-- ---------- reduction_goals ----------
create policy "ver metas de mi hogar o docente" on public.reduction_goals
  for select to authenticated
  using ((select public.es_dueno_hogar(household_id)) or (select public.es_docente()));

create policy "crear metas en mi hogar" on public.reduction_goals
  for insert to authenticated
  with check ((select public.es_dueno_hogar(household_id)));

create policy "editar metas de mi hogar" on public.reduction_goals
  for update to authenticated
  using ((select public.es_dueno_hogar(household_id)))
  with check ((select public.es_dueno_hogar(household_id)));

create policy "borrar metas de mi hogar" on public.reduction_goals
  for delete to authenticated
  using ((select public.es_dueno_hogar(household_id)));

-- ---------- Permisos por tabla (mínimo privilegio) ----------
revoke all on all tables in schema public from anon;
grant select on public.energy_parameters to anon;
