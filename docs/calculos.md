# Motor matemático

> Código: `app/lib/calculos/motor.ts` · Parámetros: `app/lib/calculos/parametros.ts` · Pruebas: `tests/calculos.test.ts`
>
> Regla del proyecto: **la IA no reemplaza estos cálculos.** Son funciones puras: mismos números de entrada → mismo resultado, siempre.

## Ejemplo trabajado con la factura de referencia

Energía de Pereira · Cartago · estrato 4 · 4 personas · periodo 14 ago – 10 sep 2026 (28 días).

| Paso | Fórmula | Resultado |
|---|---|---|
| Consumo | lectura actual − lectura anterior = 19 840 − 19 487 | **353 kWh** |
| Comprobación | franja 0–173 + franja >173 = 173 + 180 | 353 kWh ✓ |
| Consumo en 30 días | 353 ÷ 28 × 30 | 378,2 kWh |
| Huella | 353 kWh × 0,220 kg CO₂e/kWh | **77,7 kg CO₂e** |
| Por persona | 353 ÷ 4 · 77,7 ÷ 4 | 88,3 kWh · 19,4 kg |
| Frente a subsistencia | 378,2 − 173 (Cartago < 1000 m) | 205 kWh por encima |

## Parámetros oficiales

| Parámetro | Valor | Fuente |
|---|---|---|
| Factor de emisión del SIN (inventarios / consumo) | 0,220 kg CO₂e/kWh (2024) | [UPME, Factores de emisión del SIN 2024](https://docs.upme.gov.co/Normatividad/Soporte_calculo_Factor_de_Emision_2024.pdf) |
| Subsistencia < 1000 m s. n. m. | 173 kWh/mes | [Resolución UPME 355 de 2004, art. 1](https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_upme_0355_2004.htm) |
| Subsistencia ≥ 1000 m s. n. m. | 130 kWh/mes | Ídem |

- **No usar los factores "MDL" (≈ 0,6).** Son del margen combinado para proyectos de reducción de emisiones, no para la huella de un consumo.
- El factor cambia cada año (2024 fue un año seco, con más generación térmica). Para actualizarlo: una fila nueva en `energy_parameters` y el valor en `parametros.ts`.
- **La subsistencia no es un límite ni una meta:** es el consumo que la regulación reconoce como básico para subsidiar a los estratos 1, 2 y 3.

## Línea base

Con los últimos 6 meses (mínimo 3), cada uno llevado a 30 días:

- **Promedio**: la referencia para la meta.
- **Mínimo y máximo**: el rango habitual.
- **Desviación estándar muestral** y **variación** (desviación ÷ promedio): qué tan estable es el consumo.
- **Tendencia**: la pendiente de la recta de mínimos cuadrados, en kWh por mes (+ sube, − baja).

¿Por qué mínimo 3 meses? Con 1 o 2, un mes raro (vacaciones, visitas) mueve demasiado el promedio.

## Meta y avance

```
meta = línea base × (1 − porcentaje / 100)
ejemplo de la migración: 180,5 × (1 − 0,05) = 171,5 kWh
```

La meta empieza el mes siguiente al último mes de la línea base. Cada mes registrado desde entonces se compara:

- **Cumple** si el consumo (en 30 días) ≤ meta.
- **Ahorro** = línea base − consumo del mes (negativo si se consumió más).
- **Emisiones evitadas** = ahorro × factor.
- **Dinero aproximado** = ahorro × valor del kWh de la última factura.

## Preguntas para la defensa

- ¿Por qué 353 kWh en 28 días no se compara directamente con 415 kWh en 33 días?
- Si el factor de emisión de 2025 fuera 0,15, ¿qué cambiaría en la app y qué no?
- ¿Qué pasa con la línea base si un mes se registra dos veces? (Pista: `ordenarRegistros`.)
- ¿Por qué la meta se guarda con su línea base, en lugar de recalcularse?
