-- Prueba de seguridad (guía, módulo 10: "intentar una operación que el rol
-- no debería poder realizar y demostrar que el sistema la bloquea").
-- Todo ocurre dentro de una transacción que se deshace al final: no deja datos.
-- Cómo usarlo: pegar todo en Supabase → SQL Editor → Run.
-- Resultado esperado: un error final "RESULTADOS" con todas las pruebas en OK.
-- Ese error es a propósito: aborta la transacción para que no quede ningún dato de prueba.

begin;

-- Usuarios de prueba (ids fijos para leer el resultado fácilmente)
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'ana@prueba.local', '{"nombre_visible":"Ana"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'beto@prueba.local', '{"nombre_visible":"Beto"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'profe@prueba.local', '{"nombre_visible":"Profe"}', 'authenticated', 'authenticated');

-- El rol docente lo asigna un administrador (aquí, este script como superusuario).
update public.profiles set rol = 'docente' where id = '00000000-0000-0000-0000-00000000000d';

create temporary table resultados (n serial, prueba text, ok boolean) on commit drop;
grant all on resultados to authenticated, anon;
grant usage on sequence resultados_n_seq to authenticated, anon;

insert into resultados (prueba, ok) values ('T0 El disparador creó 3 perfiles', (select count(*) = 3 from public.profiles));

-- ===== Ana crea su hogar y un consumo =====
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

insert into public.households (id, municipio, estrato, personas)
values ('10000000-0000-0000-0000-00000000000a', 'Cartago', 4, 4);
insert into public.consumption_records (household_id, periodo, consumo_kwh, fuente)
values ('10000000-0000-0000-0000-00000000000a', '2026-09-01', 353, 'factura');

insert into resultados (prueba, ok) values ('T1 Ana ve su hogar', (select count(*) = 1 from public.households));
insert into resultados (prueba, ok) values ('T2 Ana ve su consumo', (select count(*) = 1 from public.consumption_records));

-- Ana intenta volverse docente: debe fallar (sin permiso sobre la columna rol)
do $$ begin
  update public.profiles set rol = 'docente' where id = '00000000-0000-0000-0000-00000000000a';
  insert into resultados (prueba, ok) values ('T3 Ana NO puede cambiar su rol', false);
exception when insufficient_privilege then
  insert into resultados (prueba, ok) values ('T3 Ana NO puede cambiar su rol', true);
end $$;

-- ===== Beto intenta ver y tocar lo de Ana =====
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

insert into resultados (prueba, ok) values ('T4 Beto NO ve el hogar de Ana', (select count(*) = 0 from public.households));
insert into resultados (prueba, ok) values ('T5 Beto NO ve el consumo de Ana', (select count(*) = 0 from public.consumption_records));

do $$ begin
  insert into public.consumption_records (household_id, periodo, consumo_kwh, fuente)
  values ('10000000-0000-0000-0000-00000000000a', '2026-10-01', 1, 'manual');
  insert into resultados (prueba, ok) values ('T6 Beto NO escribe en el hogar de Ana', false);
exception when insufficient_privilege then
  insert into resultados (prueba, ok) values ('T6 Beto NO escribe en el hogar de Ana', true);
end $$;

with borrados as (
  delete from public.households where id = '10000000-0000-0000-0000-00000000000a' returning 1
)
insert into resultados (prueba, ok) values ('T7 Beto NO borra el hogar de Ana', (select count(*) = 0 from borrados));

do $$ begin
  insert into public.households (owner_id, municipio, estrato, personas)
  values ('00000000-0000-0000-0000-00000000000a', 'Cartago', 1, 1);
  insert into resultados (prueba, ok) values ('T8 Beto NO crea hogares a nombre de Ana', false);
exception when insufficient_privilege then
  insert into resultados (prueba, ok) values ('T8 Beto NO crea hogares a nombre de Ana', true);
end $$;

-- ===== La docente ve, pero no modifica =====
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';

insert into resultados (prueba, ok) values ('T9 Docente ve el consumo de Ana', (select count(*) = 1 from public.consumption_records));

with cambiados as (
  update public.consumption_records set consumo_kwh = 1 returning 1
)
insert into resultados (prueba, ok) values ('T10 Docente NO modifica consumos', (select count(*) = 0 from cambiados));

-- ===== Anónimo =====
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$ begin
  perform 1 from public.households;
  insert into resultados (prueba, ok) values ('T11 Anónimo NO lee hogares', false);
exception when insufficient_privilege then
  insert into resultados (prueba, ok) values ('T11 Anónimo NO lee hogares', true);
end $$;

insert into resultados (prueba, ok) values ('T12 Anónimo lee parámetros oficiales', (select count(*) = 3 from public.energy_parameters));

reset role;

-- Muestra el resultado como error para deshacer todo lo anterior.
do $$
declare informe text;
begin
  select string_agg(prueba || ' → ' || case when ok then 'OK' else 'FALLA' end, E'\n' order by n)
  into informe from resultados;
  raise exception E'RESULTADOS (todo se deshace)\n%', informe;
end $$;
