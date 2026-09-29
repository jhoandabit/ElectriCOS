-- La UPME oficializó el factor del SIN 2024 para inventarios de GEI (0,220)
-- en la Resolución 000085 de 2026. El valor no cambia; se actualiza la fuente.
update public.energy_parameters
set fuente = 'UPME · Resolución 000085 de 2026, art. 1: factor del SIN 2024 para inventarios de GEI',
    url = 'https://docs.upme.gov.co/Normatividad/085_2026.pdf'
where clave = 'factor_emision_sin' and vigencia = 2024;
