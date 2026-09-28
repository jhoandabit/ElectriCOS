-- =====================================================================
-- ElectriCOs · Esquema inicial
-- Cada tabla responde a una pregunta del proyecto (guía, módulo 6):
--   profiles            ¿Quién usa ElectriCOs y con qué rol?
--   households          ¿De qué hogar hablamos?
--   consumption_records ¿Cuánto consumió el hogar cada mes?
--   invoices            ¿De dónde salió cada dato? (valor extraído vs confirmado)
--   energy_parameters   ¿Con qué factores oficiales calculamos?
--   baselines           ¿Contra qué promedio se definió una meta?
--   reduction_goals     ¿Qué meta se propuso el hogar y qué acciones?
--
-- Privacidad: NO se guardan nombres, direcciones, matrículas ni imágenes de
-- facturas. Los estudiantes son menores de edad: guardamos lo mínimo.
-- =====================================================================

-- ---------- Perfiles y roles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre_visible text check (char_length(nombre_visible) <= 60),
  grado text check (char_length(grado) <= 10),
  rol text not null default 'estudiante' check (rol in ('estudiante', 'docente')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Un perfil por usuario. El rol solo lo cambia un administrador por SQL.';

-- ---------- Hogares ----------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  alias text not null default 'Mi hogar' check (char_length(alias) between 1 and 40),
  municipio text not null check (char_length(municipio) between 2 and 60),
  estrato smallint not null check (estrato between 1 and 6),
  personas smallint not null check (personas between 1 and 20),
  sobre_1000_msnm boolean not null default false,
  empresa text check (char_length(empresa) <= 60),
  created_at timestamptz not null default now()
);

create index households_owner_idx on public.households (owner_id);

-- ---------- Consumo mensual ----------
create table public.consumption_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  periodo date not null check (extract(day from periodo) = 1), -- primer día del mes
  consumo_kwh numeric(8, 2) not null check (consumo_kwh > 0 and consumo_kwh < 5000),
  dias smallint check (dias between 1 and 120),
  lectura_anterior numeric(12, 2) check (lectura_anterior >= 0),
  lectura_actual numeric(12, 2) check (lectura_actual >= 0),
  valor_kwh numeric(10, 4) check (valor_kwh > 0),
  fuente text not null check (fuente in ('manual', 'factura', 'historico')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (household_id, periodo)
);

create index consumption_household_idx on public.consumption_records (household_id, periodo);

-- ---------- Trazabilidad de la lectura de facturas ----------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  consumption_record_id uuid references public.consumption_records (id) on delete set null,
  empresa text,
  metodo text not null check (metodo in ('ia', 'pdf-texto', 'ocr-local', 'guiada', 'manual')),
  confianza smallint check (confianza between 0 and 100),
  datos_extraidos jsonb not null,  -- lo que leyó la app
  datos_confirmados jsonb not null, -- lo que la persona aceptó o corrigió
  created_at timestamptz not null default now()
);

create index invoices_household_idx on public.invoices (household_id);

-- ---------- Parámetros oficiales ----------
create table public.energy_parameters (
  id bigint generated always as identity primary key,
  clave text not null,
  valor numeric not null,
  unidad text not null,
  vigencia smallint not null,
  fuente text not null,
  url text,
  unique (clave, vigencia)
);

insert into public.energy_parameters (clave, valor, unidad, vigencia, fuente, url) values
  ('factor_emision_sin', 0.220, 'kg CO2e/kWh', 2024,
   'UPME · Factores de emisión del SIN para el año 2024',
   'https://docs.upme.gov.co/Normatividad/Soporte_calculo_Factor_de_Emision_2024.pdf'),
  ('subsistencia_bajo_1000', 173, 'kWh/mes', 2004,
   'UPME · Resolución 355 de 2004, art. 1 (< 1000 m s. n. m.)',
   'https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_upme_0355_2004.htm'),
  ('subsistencia_sobre_1000', 130, 'kWh/mes', 2004,
   'UPME · Resolución 355 de 2004, art. 1 (≥ 1000 m s. n. m.)',
   'https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_upme_0355_2004.htm');

-- ---------- Línea base y metas ----------
create table public.baselines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  desde date not null,
  hasta date not null check (hasta >= desde),
  meses smallint not null check (meses >= 3),
  promedio_kwh numeric(8, 2) not null,
  minimo_kwh numeric(8, 2) not null,
  maximo_kwh numeric(8, 2) not null,
  desviacion_kwh numeric(8, 2) not null,
  tendencia_kwh_mes numeric(8, 2) not null,
  created_at timestamptz not null default now()
);

create table public.reduction_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  baseline_id uuid not null references public.baselines (id) on delete restrict,
  porcentaje numeric(4, 1) not null check (porcentaje > 0 and porcentaje <= 50),
  meta_kwh numeric(8, 2) not null check (meta_kwh > 0),
  inicio date not null check (extract(day from inicio) = 1),
  estado text not null default 'activa' check (estado in ('activa', 'cumplida', 'cerrada')),
  acciones text[] not null default '{}',
  acciones_hechas text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index goals_household_idx on public.reduction_goals (household_id);

-- Solo una meta activa por hogar.
create unique index goals_una_activa on public.reduction_goals (household_id) where estado = 'activa';
