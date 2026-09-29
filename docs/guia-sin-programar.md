---
title: "ElectriCOs explicado sin programar"
subtitle: "Guía para estudiantes de 9.º a 11.º que nunca han programado · I. E. Ramón Martínez Benítez (Cartago)"
date: "Versión 0.3 · 28 de septiembre de 2026"
---

::: {.idea}
**Para quién es esta guía.** Para cualquier estudiante del equipo, sepa o no programar. No hace falta escribir código para entender ElectriCOs, probarlo, mejorarlo ni defenderlo. Cuando aparezca una palabra técnica, está explicada en el momento y también en el **glosario** del final.

**Cómo leerla.** En orden, un capítulo por sesión. Cada capítulo termina con **"Compruebo lo que aprendí"**. Las respuestas están en el Anexo A.
:::

# 1. El problema: ¿cuánta energía usa mi casa y qué significa?

## 1.1 La energía eléctrica se mide en kWh

Un **kilovatio-hora (kWh)** es la energía que gasta un aparato de 1000 vatios funcionando durante 1 hora.

| Aparato (aproximado) | Potencia | Tiempo | Energía |
|---|---|---|---|
| Bombillo LED | 10 W | 10 horas | 0,1 kWh |
| Televisor | 100 W | 5 horas | 0,5 kWh |
| Ducha eléctrica | 3500 W | 10 minutos | ≈ 0,58 kWh |
| Plancha | 1200 W | 1 hora | 1,2 kWh |

La fórmula es sencilla: **energía (kWh) = potencia (kW) × horas**. Una ducha eléctrica de 3,5 kW durante 10 minutos (1/6 de hora) gasta 3,5 × 1/6 ≈ 0,58 kWh. Diez minutos de ducha gastan lo mismo que un bombillo LED prendido casi 60 horas.

## 1.2 El medidor y la factura

En cada casa hay un **medidor**: un contador que solo sube, como el cuentakilómetros de una moto. Cada mes, la empresa de energía anota el número del medidor.

- **Lectura anterior**: el número del mes pasado.
- **Lectura actual**: el número de este mes.
- **Consumo** = lectura actual − lectura anterior.

## 1.3 La huella de carbono

Producir electricidad en Colombia genera gases de efecto invernadero, sobre todo cuando se usan plantas térmicas (carbón, gas). La **huella de carbono** de la electricidad de una casa es cuánto CO₂ equivalente (CO₂e) se emitió para producir la energía que esa casa usó.

Para calcularla se usa un **factor de emisión**: cuántos kilogramos de CO₂e se emiten, en promedio, por cada kWh del sistema eléctrico colombiano. La UPME (la entidad del Estado que planea la energía) publicó para 2024: **0,220 kg CO₂e por kWh**.

## 1.4 El consumo de subsistencia

El Estado define un **consumo de subsistencia**: la energía básica que necesita un hogar al mes. Hasta ese consumo, los estratos 1, 2 y 3 reciben subsidio.

- Municipios por debajo de 1000 m sobre el nivel del mar (como Cartago): **173 kWh/mes**.
- Municipios a 1000 m o más: **130 kWh/mes** (hace menos calor, se usa menos energía para refrescar).

::: {.idea}
**Idea clave.** La subsistencia **no es una meta ni un límite**. Es una referencia de la regulación para saber qué consumo se considera básico.
:::

## 1.5 El problema que resuelve ElectriCOs

Las familias reciben la factura, miran cuánto pagar y la guardan. Casi nunca responden estas preguntas:

- ¿Consumimos mucho o poco, comparado con otros meses?
- ¿Cuánto CO₂ generamos?
- ¿Qué podemos cambiar, y cómo sabemos si funcionó?

ElectriCOs acompaña a la familia por seis pasos:

```
CONSUMO → DIAGNÓSTICO → HUELLA → META → ACCIÓN → SEGUIMIENTO
 medir     comprender    calcular  decidir  hacer     verificar
```

::: {.ejercicio}
**Compruebo lo que aprendí (capítulo 1)**

1. Una nevera usa 150 W y está conectada todo el día. ¿Cuántos kWh gasta en un día?
2. El medidor marcaba 12 500 el mes pasado y hoy marca 12 680. ¿Cuál fue el consumo?
3. Si una casa consume 200 kWh, ¿cuál es su huella de carbono?
4. ¿Por qué la subsistencia es distinta en Cartago y en Manizales?
:::

<div class="salto"></div>

# 2. Leer una factura de energía

Usaremos la **factura de referencia** del proyecto: Energía de Pereira, un hogar de Cartago, estrato 4. Es la misma con la que se prueba la aplicación.

## 2.1 Los datos que importan

| Dato en la factura | Valor | Para qué sirve |
|---|---|---|
| Empresa | Energía de Pereira | Saber qué formato de factura es |
| Municipio | Cartago | Subsistencia (173 kWh, porque está a menos de 1000 m) |
| Estrato | 4 | Comparaciones y subsidios |
| Periodo facturado | 14/AGO/2026 – 10/SEP/2026 | Qué mes se está cobrando |
| Días facturados | 28 | Comparar meses de distinto largo |
| Lectura anterior | 19 487 | Primer número del medidor |
| Lectura actual | 19 840 | Último número del medidor |
| Consumo | 353 kWh | El dato principal |
| Valor del kWh | $905,05 | Cuánto cuesta cada kWh |

## 2.2 Comprobar el consumo de dos formas

**Forma 1, por las lecturas:** 19 840 − 19 487 = **353 kWh**.

**Forma 2, por la liquidación.** La factura cobra el consumo por "franjas" o rangos:

| Rango | Consumo |
|---|---|
| 0 a 173 kWh | 173 |
| Más de 173 kWh | 180 |
| **Total** | 173 + 180 = **353 kWh** |

Las dos formas dan lo mismo. **Eso es una validación cruzada**: comprobar un dato por dos caminos distintos. ElectriCOs lo hace automáticamente.

## 2.3 Números que parecen consumo y no lo son

Una factura tiene muchos números. Estos **no** son el consumo en kWh:

| Número | Qué es en realidad |
|---|---|
| 905,0529 | Pesos por cada kWh |
| 156 574 y 162 910 | Pesos que cuesta cada franja |
| 349 864 | Total a pagar, en pesos |
| 173 y 180 | Las franjas (sumadas sí dan el consumo) |
| 267 | Consumo **promedio** de meses anteriores |

::: {.idea}
**Idea clave.** Confundir pesos con kWh es el error más grave que puede cometer la aplicación. Por eso siempre valida el consumo con las lecturas del medidor.
:::

::: {.ejercicio}
**Compruebo lo que aprendí (capítulo 2)**

1. Con las lecturas 8 210 → 8 395, ¿cuál es el consumo?
2. Una factura dice "Consumo 186 kWh" y las lecturas son 5 000 → 5 186. ¿Es coherente?
3. ¿Por qué 349 864 no puede ser un consumo mensual de una casa?
:::

<div class="salto"></div>

# 3. Usar ElectriCOs paso a paso

ElectriCOs es una **aplicación web**: se abre en el navegador del celular (Chrome, por ejemplo) escribiendo su dirección. No hay que instalar nada desde la tienda.

## 3.1 Crear la cuenta

1. Abrir la dirección de ElectriCOs.
2. Elegir **Crear cuenta**, escribir un correo y una contraseña.
3. Iniciar sesión con esos mismos datos.

La contraseña no la ve nadie, ni siquiera la docente. Se guarda "cifrada" (convertida en un código que no se puede revertir).

## 3.2 Registrar el hogar

| Campo | Qué escribir | Cuidado |
|---|---|---|
| Nombre del hogar | Un apodo: "Casa de la abuela" | **Nunca** direcciones ni apellidos |
| Municipio | Cartago, Pereira… | Define la subsistencia |
| Estrato | 1 a 6 | Está en la factura |
| Personas | Cuántas viven ahí | Para calcular el consumo por persona |
| Altitud | Marcar si el municipio está a 1000 m o más | La app lo propone para municipios conocidos |

## 3.3 Registrar el consumo: tres caminos

En la pestaña **Consumo** aparecen dos botones: **Leer factura** e **Ingresar manualmente**, y debajo el historial de meses.

**Camino A — PDF de la factura (el más preciso).** Botón **PDF** y elegir el archivo que envía la empresa. Tarda un segundo y casi nunca se equivoca, porque el PDF ya trae el texto escrito.

**Camino B — Foto de la factura.** Botones **Tomar foto** o **Galería**. La primera vez tarda más, porque el celular descarga el "lector" (unos 6 MB). Después, cada foto tarda de 5 a 15 segundos. Para una buena foto:

- De frente, sin inclinar.
- Con buena luz y sin sombras.
- Que la factura llene la pantalla, sin zoom digital.

**Camino C — A mano.** Botón **Ingresar manualmente** y escribir las lecturas o el consumo.

## 3.4 La tarjeta "Datos detectados"

Después de leer la factura, la app muestra lo que encontró:

- **Recuadro verde**: dato leído y comprobado.
- **Recuadro amarillo**: dato que falta, que se **estimó** o que hay que revisar. Por ejemplo, "Periodo (estimado)" o "Días facturados (supuesto)" cuando la foto no deja leerlos.
- **Confianza alta, media o baja**: qué tan segura está la app del consumo. Es alta cuando las lecturas del medidor coinciden con el consumo.
- **Avisos**: mensajes con ✓ (todo bien) o ! (revisar).

Si la app no encuentra el consumo en una foto, ofrece la **lectura guiada**: con el dedo se dibuja un recuadro alrededor de la fila del medidor y la app lee solo esa parte, ampliada.

::: {.idea}
**Idea clave.** La app **nunca guarda nada sin que la persona lo revise y confirme**. La lectura automática es una ayuda, no la última palabra.
:::

## 3.5 El resultado del mes

Al guardar, y siempre en **Inicio** (con el último mes registrado), ElectriCOs muestra seis tarjetas pequeñas. Cada una responde **una pregunta** con un número grande. Al **tocarla** se amplía y muestra qué significa y la cuenta que lo produjo; con mouse, al pasar por encima crece un poco para invitar a tocarla:

| Tarjeta | Ejemplo (factura de referencia) | Qué explica |
|---|---|---|
| ⚡ ¿Cuánta energía usó tu casa? | 353 kWh en 28 días · 12,6 kWh por día | Qué es un kWh, la resta del contador y el ajuste a 30 días (378,2 kWh) |
| 💵 ¿Cuánto costó esa energía? | $319.484 · unos $11.410 por día | 353 × $905; aclara que la factura también cobra alumbrado, aseo, etc. |
| 🌎 ¿Cuánta contaminación produjo? | 77,7 kg de CO₂ · casi lo que pesa una persona adulta | Qué es el CO₂ y de dónde sale el 0,22 |
| 👨‍👩‍👧 ¿Cuánto le toca a cada persona? | 88,3 kWh y 19,4 kg de CO₂ por persona | El reparto entre quienes viven en la casa |
| 🏠 ¿Es mucho o poco? | 205 kWh más que lo básico · 2,2 veces | Barra "lo básico vs. tu casa", el consumo de subsistencia y el subsidio según el estrato |
| 📅 ¿Comparado con otros meses? | 47 % más que tu promedio de 257,1 kWh | El promedio de los meses anteriores |

## 3.6 Meta y progreso

Casi todas las facturas traen impresos los **últimos 6 meses** (kWh, valor y días). Al guardar una factura, ElectriCOs muestra esa tabla y, si la casilla "Guardar también estos meses" está marcada (viene marcada), los guarda. Así la familia tiene su promedio desde el primer día.

Con **3 meses o más** registrados, en la pestaña **Meta**:

1. La app calcula la **línea base** (el consumo "normal" del hogar).
2. La familia elige cuánto reducir: **3 %, 5 %, 10 % o 15 %**.
3. Elige acciones de una lista (por ejemplo: "Cambiar bombillos por LED", "Acortar el tiempo de la ducha eléctrica", "Desconectar cargadores y aparatos que quedan en espera").

En **Progreso**, un gráfico de columnas muestra cada mes frente a la meta, y cuánta energía, CO₂ y dinero se ha ahorrado.

La barra de abajo tiene cuatro secciones: **Inicio** (tarjetas del último mes), **Consumo** (registrar e historial), **Meta** y **Progreso**.

::: {.ejercicio}
**Compruebo lo que aprendí (capítulo 3)**

1. ¿Por qué el PDF es más preciso que la foto?
2. Si la tarjeta dice "Días facturados (supuesto): 30", ¿qué debe hacer la persona?
3. ¿Por qué el nombre del hogar no debe ser una dirección?
4. ¿Cuántos meses se necesitan para proponer una meta?
:::

<div class="salto"></div>

# 4. Las matemáticas de ElectriCOs

Todo lo que calcula la app se puede hacer con lápiz y calculadora. Esto es importante: **si la app da un número, ustedes deben poder comprobarlo**.

## 4.1 Llevar el consumo a 30 días

Los periodos de facturación no duran lo mismo: 28, 30, 33 días… Un periodo largo "parece" más consumo aunque la familia no haya cambiado nada. Por eso se lleva todo a un mes de 30 días:

::: {.formula}
consumo en 30 días = consumo ÷ días facturados × 30
:::

Con la factura de referencia: 353 ÷ 28 × 30 = **378,2 kWh**.

## 4.2 Huella de carbono

::: {.formula}
huella (kg CO₂e) = consumo (kWh) × 0,220
:::

353 × 0,220 = **77,7 kg CO₂e**. Si en la casa viven 4 personas: 77,7 ÷ 4 = **19,4 kg CO₂e por persona**, y 353 ÷ 4 = **88,3 kWh por persona**.

## 4.3 Comparación con la subsistencia

378,2 − 173 = **205,2 kWh por encima** de la subsistencia de Cartago.

## 4.4 La línea base: el consumo "normal" de la casa

**¿Para qué sirve?** Para saber si la familia ahorró, primero hay que saber cuánto gasta **normalmente**. Un solo mes no sirve: puede haber sido un mes con visitas o de vacaciones. Por eso se miran varios meses (mínimo 3, máximo los últimos 6) y se resumen en unos pocos números.

**Paso 1. Poner todos los meses en la misma medida (30 días).** Cada mes dura distinto, así que primero se lleva cada uno a 30 días (capítulo 4.1):

| Mes | kWh de la factura | Días | Cuenta | kWh en 30 días |
|---|---|---|---|---|
| Marzo | 207 | 31 | 207 ÷ 31 × 30 | 200,3 |
| Abril | 178 | 30 | 178 ÷ 30 × 30 | 178,0 |
| Mayo | 256 | 31 | 256 ÷ 31 × 30 | 247,7 |
| Junio | 280 | 30 | 280 ÷ 30 × 30 | 280,0 |
| Julio | 268 | 31 | 268 ÷ 31 × 30 | 259,4 |
| Agosto | 415 | 33 | 415 ÷ 33 × 30 | 377,3 |

**Paso 2. El promedio = la línea base.** Se suman los 6 meses y se divide entre 6:

::: {.formula}
(200,3 + 178,0 + 247,7 + 280,0 + 259,4 + 377,3) ÷ 6 = 1.542,7 ÷ 6 = 257,1 kWh
:::

Quiere decir: **"en un mes normal, esta casa usa unos 257 kWh"**. Es como el promedio de notas de un periodo: ninguna nota sola dice cómo le fue al estudiante, pero el promedio sí.

**Paso 3. El mínimo y el máximo.** El mes que menos gastó (abril: 178,0) y el que más (agosto: 377,3). Dicen entre qué valores se mueve la casa.

**Paso 4. La desviación estándar: ¿los meses son parecidos o muy distintos?** Mide qué tanto se alejan los meses del promedio, "en promedio". Se calcula así:

| Mes | kWh | Diferencia con 257,1 | Diferencia al cuadrado |
|---|---|---|---|
| Marzo | 200,3 | −56,8 | 3.226,2 |
| Abril | 178,0 | −79,1 | 6.256,8 |
| Mayo | 247,7 | −9,4 | 88,4 |
| Junio | 280,0 | +22,9 | 524,4 |
| Julio | 259,4 | +2,3 | 5,3 |
| Agosto | 377,3 | +120,2 | 14.448,0 |
| **Suma** | | | **24.549,1** |

1. Se resta el promedio a cada mes (unos quedan por debajo, con signo −, y otros por encima, con +).
2. Se eleva cada diferencia al cuadrado. Así los negativos no cancelan a los positivos, y las diferencias grandes pesan más.
3. Se suman: 24.549,1.
4. Se divide entre (número de meses − 1) = 5: 24.549,1 ÷ 5 = 4.909,8.
5. Se saca la raíz cuadrada: √4.909,8 = **70,1 kWh**.

Quiere decir: **"un mes típico se aleja unos 70 kWh del promedio"**, hacia arriba o hacia abajo.

**Paso 5. La variación: ¿70 kWh es mucho?** Depende del tamaño del consumo. Por eso se compara con el promedio: 70,1 ÷ 257,1 = 0,273 = **27,3 %**. Una guía sencilla:

| Variación | Qué significa |
|---|---|
| Menos de 10 % | Consumo muy estable: todos los meses se parecen |
| 10 % a 25 % | Cambia algo de un mes a otro |
| Más de 25 % | Cambia bastante: hay meses muy distintos (aquí, agosto) |

**Paso 6. La tendencia: ¿el consumo viene subiendo o bajando?** Imaginen los 6 meses como puntos en una gráfica y una regla puesta de forma que pase lo más cerca posible de todos los puntos. La inclinación de esa regla es la tendencia. Aquí es **+33,2 kWh por mes**: en estos 6 meses, el consumo subió en promedio unos 33 kWh cada mes. Si fuera negativa, el consumo vendría bajando.

Una forma fácil de comprobarlo sin fórmulas: el promedio de los primeros 3 meses (marzo a mayo) es 208,7 kWh y el de los últimos 3 (junio a agosto) es 305,6 kWh. La segunda mitad es claramente más alta: el consumo viene subiendo.

(Para quien quiera la fórmula: se numeran los meses 1 a 6; la pendiente de mínimos cuadrados es Σ(x − 3,5)(y − 257,1) ÷ Σ(x − 3,5)² = 580,7 ÷ 17,5 = 33,2.)

**¿Por qué mínimo 3 meses?** Con 1 o 2, un solo mes raro cambia todo el promedio.

## 4.5 La meta

**¿Qué es?** El consumo al que la familia se compromete a bajar. Se parte de la línea base y se le quita un porcentaje:

::: {.formula}
meta = línea base × (1 − porcentaje ÷ 100)
:::

**Así se lee, paso a paso, con 10 %:**

1. 10 ÷ 100 = 0,10 (el 10 % escrito como decimal).
2. 1 − 0,10 = 0,90 (si se quita el 10 %, queda el 90 %).
3. 257,1 × 0,90 = **231,4 kWh**.

Es lo mismo que calcular cuánto se quita y restarlo: el 10 % de 257,1 es 25,7; y 257,1 − 25,7 = 231,4. Es igual que un descuento en una tienda: una camisa de $50.000 con 10 % de descuento queda en $45.000.

| Si eligen reducir | Hay que bajar | La meta queda en |
|---|---|---|
| 3 % | 7,7 kWh | 249,4 kWh al mes |
| 5 % | 12,9 kWh | 244,3 kWh al mes |
| 10 % | 25,7 kWh | 231,4 kWh al mes |
| 15 % | 38,6 kWh | 218,5 kWh al mes |

¿Cuánto es 25,7 kWh al mes? Por ejemplo, bajar 5 minutos diarios de ducha eléctrica (3.500 W) ahorra unos 0,29 kWh al día, cerca de 9 kWh al mes. Con eso y otras dos acciones parecidas se llega a la meta del 10 %.

La meta empieza a contar el mes siguiente al último mes de la línea base.

## 4.6 El avance

Cada mes desde que empieza la meta:

- **Cumple** si el consumo en 30 días ≤ meta.
- **Ahorro** = línea base − consumo del mes (si sale negativo, se consumió más).
- **CO₂ evitado** = ahorro × 0,220.
- **Dinero aproximado** = ahorro × valor del kWh.

Ejemplo: si en octubre el consumo en 30 días fuera 225 kWh → cumple (225 ≤ 231,4). Ahorro = 257,1 − 225 = 32,1 kWh → 7,1 kg CO₂e → unos $29 000 (a $905 el kWh).

::: {.ejercicio}
**Compruebo lo que aprendí (capítulo 4)**

1. Una factura de 310 kWh en 31 días: ¿cuánto es en 30 días?
2. Un hogar tiene línea base de 200 kWh y elige reducir 5 %. ¿Cuál es la meta?
3. Si septiembre, en 30 días, fue 378,2 kWh y la línea base es 257,1 kWh, ¿en qué porcentaje está por encima?
4. ¿Por qué no se comparan directamente 353 kWh en 28 días con 415 kWh en 33 días?
:::

<div class="salto"></div>

# 5. ¿Cómo está construida la aplicación? (sin código)

## 5.1 La analogía del restaurante

| En un restaurante | En ElectriCOs | Nombre técnico |
|---|---|---|
| El salón, la carta, el mesero | Las pantallas que se ven en el celular | **Frontend** (interfaz) |
| El cocinero que sigue recetas exactas | Las fórmulas del capítulo 4 | **Motor de cálculo** |
| El que lee las comandas escritas a mano | El lector de facturas | **Lector (OCR)** |
| La despensa y el archivo de pedidos | Donde se guardan hogares y consumos | **Base de datos** |
| El portero que revisa quién entra a cada cuarto | Las reglas de quién ve qué | **Seguridad (RLS)** |
| El local donde funciona el restaurante | Los computadores de Vercel en internet | **Servidor / hosting** |

## 5.2 Las piezas y sus nombres reales

```
   Celular del estudiante
   ┌─────────────────────────────────────────────┐
   │  Pantallas (Next.js + React)                │
   │     │                     │                 │
   │     ▼                     ▼                 │
   │  Lector de facturas    Motor de cálculo     │
   │  (PDF.js + PaddleOCR)  (fórmulas)           │
   └─────────────┬───────────────────────────────┘
                 │ internet (solo números confirmados)
                 ▼
   ┌─────────────────────────────────────────────┐
   │  Supabase: base de datos + cuentas + reglas │
   └─────────────────────────────────────────────┘

   Vercel: publica la aplicación en internet
   GitHub: guarda el código y su historia
```

- **Next.js y React**: herramientas para construir pantallas web. Cada pantalla es un "componente", como una pieza de Lego.
- **TypeScript**: el idioma en que está escrito el código. Es JavaScript con "tipos": avisa si, por ejemplo, se intenta sumar un número con una palabra.
- **Supabase**: un servicio que presta una base de datos (PostgreSQL), las cuentas de usuario y las reglas de seguridad.
- **Vercel**: toma el código y lo publica en internet.
- **GitHub**: guarda el código y **toda su historia**. Cada cambio queda registrado con fecha, autor y explicación.

## 5.3 El recorrido de un dato: "353 kWh"

1. **Nace** en el medidor de la casa: 19 487 → 19 840.
2. **Se imprime** en la factura.
3. **Entra** a ElectriCOs como PDF, foto o escrito a mano.
4. **Se lee y se comprueba** en el celular: 19 840 − 19 487 = 353 y 173 + 180 = 353.
5. **La persona lo confirma** o lo corrige.
6. **Se guarda** en la base de datos (tabla de consumos).
7. **Se calcula**: 378,2 kWh en 30 días; 77,7 kg CO₂e.
8. **Se consulta**: solo lo ven el dueño del hogar y la docente.

## 5.4 ¿Qué pasa si algo falla?

| Si falla… | ElectriCOs… |
|---|---|
| La foto está borrosa | Ofrece la lectura guiada o escribir a mano |
| Los números no cuadran | Muestra "revisar" y baja la confianza |
| No hay internet al guardar | Avisa "Revisa tu conexión a internet" |
| Alguien intenta ver datos ajenos | La base de datos no los entrega |

::: {.ejercicio}
**Compruebo lo que aprendí (capítulo 5)**

1. En la analogía del restaurante, ¿qué papel cumple la base de datos?
2. ¿Para qué sirve GitHub, además de guardar el código?
3. Dibujen el recorrido del dato "353 kWh" con flechas.
:::

<div class="salto"></div>

# 6. La inteligencia artificial que lee fotos

## 6.1 ¿Qué es OCR?

**OCR** (reconocimiento óptico de caracteres) es convertir una **imagen** con letras en **texto** que el computador puede buscar y procesar. Para el computador, una foto es solo una cuadrícula de puntos de colores (píxeles). No "sabe" que ahí dice "353".

## 6.2 PaddleOCR: dos redes neuronales pequeñas

ElectriCOs usa **PaddleOCR**, un lector gratuito y de código abierto. Tiene dos **redes neuronales** (programas que aprendieron viendo millones de ejemplos, en vez de seguir reglas escritas a mano):

| Red | Tarea | Analogía |
|---|---|---|
| Detección (1,8 MB) | Encontrar **dónde** hay texto y encerrarlo en cajas | Subrayar cada palabra de una hoja |
| Reconocimiento (4,5 MB) | Leer **qué dice** cada caja | Leer en voz alta lo subrayado |

Cada lectura trae una **confianza**: un número de 0 a 1 que dice qué tan segura está la red.

## 6.3 ¿Por qué la IA corre dentro del celular?

Antes, ElectriCOs enviaba la foto a una IA en internet (Gemini, de Google). Tuvo problemas: las claves dejaron de funcionar y otra opción pedía tarjeta de crédito. Además, **la foto viajaba a otra empresa**, con nombre y dirección de la familia.

Ahora PaddleOCR funciona **dentro del celular**:

- **Gratis**: sin claves ni cuentas.
- **Privado**: la foto nunca sale del teléfono. Importa mucho porque los usuarios son menores de edad.
- **Confiable**: no depende de que un servicio externo funcione.

## 6.4 Después de leer: reglas y comprobaciones

La IA solo entrega texto. Luego, reglas escritas por el equipo buscan los datos:

- **Por etiqueta**: buscar "Estrato:" y tomar el número que sigue.
- **Por estructura**: reconocer la fila del medidor por su forma: *número de medidor · marca · lectura · lectura · diferencia · factor · consumo · promedio*. Por ejemplo: `1408001303 GNS 19840 19487 353 1 353 267`. La fila solo se acepta si 19 840 − 19 487 = 353.

## 6.5 Los límites de la IA (un caso real)

Con una captura de pantalla pequeña (616 × 500 píxeles), la letra del periodo medía unos 5 píxeles de alto. La IA leyó:

| En la factura dice | La IA leyó |
|---|---|
| 14/AGO/2026 - 10/SEP/2026 | `6MAG0行026-105EPG224` |
| Días facturados 28 | `Dim factur 21` |
| CT0172  4 (transformador y estrato) | `Cro172  4` |
| Cartago | `Ctago` |

**Lo que hizo el equipo:**

- Aceptar confusiones típicas ("Cro" en vez de "CT0"; "Ctago" se parece a Cartago).
- Si el periodo es ilegible, **estimarlo** con la fecha de emisión (que se lee bien) y **marcarlo "(estimado)"**.
- Si los días son ilegibles, **no usar el 21 falso**: poner 30 marcado como "(supuesto)", que no altera los cálculos, y avisar.

::: {.idea}
**Idea clave.** Una IA no puede leer lo que la imagen no muestra. Cuando un dato no se puede leer, es mejor **decirlo o estimarlo con aviso** que inventarlo. Y la IA **nunca** hace los cálculos: los hacen fórmulas que se pueden comprobar.
:::

::: {.ejercicio}
**Compruebo lo que aprendí (capítulo 6)**

1. ¿Qué diferencia hay entre la red de detección y la de reconocimiento?
2. Den dos razones para que la IA funcione dentro del celular y no en internet.
3. ¿Por qué la app no aceptó los "21 días" que leyó la IA?
4. ¿Qué haría la app si la IA leyera "19840 19487 350"?
:::

<div class="salto"></div>

# 7. Seguridad y privacidad

## 7.1 Dos preguntas distintas

| Pregunta | Nombre | Ejemplo en ElectriCOs |
|---|---|---|
| ¿Quién eres? | **Autenticación** | Correo y contraseña |
| ¿Qué puedes ver o hacer? | **Autorización** | Ana ve su hogar; Beto no ve el de Ana |

## 7.2 Las reglas de la base de datos (RLS)

**RLS** significa "seguridad a nivel de fila". Cada fila de la base de datos (cada consumo, cada hogar) tiene dueño, y la base de datos solo entrega las filas que le pertenecen a quien pregunta. Es como un archivador donde cada cajón tiene una cerradura, y la llave es la cuenta de cada estudiante.

| Quién | Qué puede hacer |
|---|---|
| Estudiante | Ver, crear, cambiar y borrar **solo** lo de su hogar |
| Docente | **Ver** todo; no puede cambiar nada |
| Persona sin cuenta | Solo ver los parámetros oficiales (0,220; 173; 130) |

Estas reglas se probaron con 13 casos. Algunos: Beto intenta ver el hogar de Ana → recibe 0 filas; Ana intenta volverse docente → rechazado; alguien sin cuenta intenta leer hogares → rechazado.

## 7.3 Privacidad de menores de edad

- No se guardan fotos de facturas.
- No se guardan nombres completos, direcciones ni número de matrícula.
- El "nombre del hogar" es un apodo.
- La factura se lee dentro del celular.

## 7.4 Claves y secretos

Algunas claves son **públicas por diseño**: identifican el proyecto, pero no abren nada sin las reglas RLS. Otras son **secretas** y nunca deben aparecer en el código, en un chat ni en una foto. Si una clave secreta se filtra, se **revoca** (se anula) y se crea otra.

::: {.ejercicio}
**Compruebo lo que aprendí (capítulo 7)**

1. ¿Autenticación o autorización? "La docente puede ver, pero no modificar".
2. ¿Qué recibe Beto si pide los consumos de Ana?
3. ¿Por qué no se guardan las fotos de las facturas?
:::

<div class="salto"></div>

# 8. Los datos: cómo se guardan

Una **base de datos** es como un cuaderno con varias hojas de cálculo relacionadas. Cada hoja es una **tabla**; cada renglón, un **registro**; cada columna, un **campo**.

| Tabla | Qué guarda | Ejemplo de renglón |
|---|---|---|
| `profiles` (perfiles) | Quién usa la app y su rol | Ana · estudiante · 10.º |
| `households` (hogares) | Los hogares | "Casa de la abuela" · Cartago · estrato 4 · 4 personas |
| `consumption_records` (consumos) | Un consumo por mes | septiembre 2026 · 353 kWh · 28 días |
| `invoices` (facturas leídas) | Qué leyó la app y qué confirmó la persona | método: foto · confianza 95 |
| `energy_parameters` (parámetros) | Valores oficiales | factor de emisión 0,220 · UPME 2024 |
| `baselines` (líneas base) | Promedios usados para metas | 257,1 kWh · marzo a agosto |
| `reduction_goals` (metas) | Metas y acciones | 10 % · 231,4 kWh · 3 acciones |

**Reglas que cuida la propia base de datos:**

- Un solo consumo por hogar y por mes: si se registra septiembre dos veces, se actualiza, no se duplica.
- El estrato debe ser de 1 a 6 y los días, de 1 a 120.
- Una sola meta activa por hogar.
- Si se borra un hogar, se borran sus consumos y metas.

¿Por qué guardar la línea base en vez de recalcularla? Porque la meta se hizo contra **esa** línea base. Si después cambian los datos, la meta no pierde su punto de partida.

::: {.ejercicio}
**Compruebo lo que aprendí (capítulo 8)**

1. ¿En qué tabla queda el dato "353 kWh"?
2. ¿Qué pasa si registro dos veces el mismo mes?
3. ¿Para qué sirve comparar "lo que leyó la app" con "lo que confirmó la persona"?
:::

<div class="salto"></div>

# 9. Cómo se prueba una aplicación

Probar no es "abrir la app y ver si funciona". Es definir, antes de empezar:

1. **Entrada**: qué se hace o qué datos se ponen.
2. **Resultado esperado**: qué debería pasar.
3. **Resultado obtenido**: qué pasó de verdad.
4. **Estado**: ✓ si coinciden, ✗ si no.

## 9.1 Pruebas que cualquiera puede hacer (sin programar)

| ID | Qué probar | Entrada | Esperado |
|---|---|---|---|
| P1 | Ingreso con contraseña equivocada | Correo bien, contraseña mal | "Correo o contraseña incorrectos" |
| P2 | Hogar sin municipio | Dejar el municipio vacío | "Escribe el municipio." |
| P3 | Consumo a mano | Lecturas 19 487 → 19 840, 28 días | 353 kWh · 378,2 en 30 días · 77,7 kg CO₂e |
| P4 | Lecturas al revés | 500 → 400 | Mensaje de lecturas no coherentes |
| P5 | PDF de la factura | Factura en PDF | 353 kWh, Cartago, estrato 4, 28 días |
| P6 | Foto de frente con buena luz | Foto de la factura en papel | 353 kWh con confianza alta |
| P7 | Foto borrosa o torcida | Foto mala a propósito | Avisos, lectura guiada o datos marcados |
| P8 | Meta sin acciones | Elegir 10 % y ninguna acción | "Elige al menos una acción" |
| P9 | Sin internet | Modo avión al guardar | "Revisa tu conexión a internet" |

## 9.2 Pruebas automáticas

El equipo técnico escribió **23 pruebas automáticas**: pequeños programas que revisan que las fórmulas y el lector den los resultados correctos. Se ejecutan con un comando y responden "pass" (pasó) o "fail" (falló). Antes de publicar cualquier cambio, todas deben pasar.

::: {.idea}
**Idea clave.** Una prueba que **falla** no es un fracaso: es la prueba haciendo su trabajo. Lo grave es un error que nadie detecta.
:::

## 9.3 Plantilla para registrar un error

| Campo | Qué escribir |
|---|---|
| Error observado | Qué pasó (con captura de pantalla) |
| Pasos para repetirlo | 1, 2, 3… |
| Resultado esperado | Qué debería haber pasado |
| Hipótesis | Por qué creemos que pasó |
| Prueba realizada | Qué hicimos para comprobar la hipótesis |
| Causa | La razón real |
| Solución | Qué se cambió |
| Aprendizaje | Qué nos llevamos |

<div class="salto"></div>

# 10. Errores reales y lo que aprendimos

Estos errores ocurrieron de verdad al construir ElectriCOs. Son parte del proyecto, no algo que esconder.

| Error | Qué pasó | Qué aprendimos |
|---|---|---|
| Fotos sin datos | Las reglas de búsqueda tenían un error de escritura y nunca encontraban nada | Un programa que "no falla" puede estar mal. Hay que probar con datos reales |
| El PDF decía 12 kWh | Se tomaron tres números del histórico que casualmente cumplían 280 − 268 = 12 | Una regla matemática correcta con los datos equivocados da un resultado falso que parece verdadero |
| La IA en internet dejó de funcionar | Google bloqueó las claves | Depender de un servicio externo gratis es frágil |
| "Gratis" pedía tarjeta | Otro servicio exigía tarjeta de crédito | Leer las condiciones antes de elegir |
| Lecturas 500 → 400 daban 900 kWh | La app creía que el medidor "había dado la vuelta" | Probar también con datos equivocados |
| 27 días en vez de 28 | Del 14 de agosto al 10 de septiembre hay 27 días de diferencia, pero la empresa cuenta ambos extremos | Saber qué regla usa la fuente de los datos |
| Imagen pequeña ilegible | La letra medía 5 píxeles | La IA tiene límites: estimar con aviso, nunca inventar |

<div class="salto"></div>

# 11. Roles del equipo (muchos no requieren programar)

| Rol | Qué hace | ¿Programa? |
|---|---|---|
| Líder técnico | Coordina, entiende el mapa completo, revisa cambios | Un poco |
| Frontend | Pantallas, textos, colores, facilidad de uso | Sí |
| Datos | Tablas, reglas de la base de datos | Un poco |
| IA / lector | Experimentos con facturas: qué lee bien y qué no | Poco o nada |
| QA (calidad) | Diseña y ejecuta pruebas, registra errores | **No** |
| Documentación | Explica, ordena, prepara la defensa | **No** |
| Matemáticas | Comprueba cada fórmula a mano | **No** |
| Comunicación | Presenta la app a familias, recoge opiniones | **No** |

## 11.1 Actividades sin programar

1. **Experimento de 10 facturas.** Leer 10 facturas distintas (PDF y fotos con distinta luz, ángulo y distancia). Anotar el consumo real, el leído, si acertó y la confianza. Calcular el porcentaje de aciertos.
2. **Auditoría matemática.** Tomar 3 facturas reales y hacer a mano todos los cálculos del capítulo 4. Comparar con la app.
3. **Prueba con usuarios.** Pedir a 3 familiares que registren una factura sin ayuda. Anotar dónde dudan.
4. **Ideas de acciones.** Proponer 3 acciones nuevas para el catálogo de ahorro, con una estimación de cuántos kWh ahorran.
5. **Cartilla para familias.** Una hoja que explique, sin palabras técnicas, cómo usar ElectriCOs.

<div class="salto"></div>

# 12. Preparar la defensa

En la defensa, el jurado pregunta. Estas son preguntas probables, con ideas para responder **con sus propias palabras**:

**¿Qué problema resuelve ElectriCOs?**
Las familias no entienden su consumo ni su impacto. La app mide, explica, propone una meta y verifica si se cumplió.

**¿Cómo sabe la app que el consumo es correcto?**
Lo comprueba por dos caminos: lectura actual − anterior y suma de franjas. Además, la persona siempre confirma.

**¿Por qué llevan el consumo a 30 días?**
Porque los periodos duran entre 28 y 33 días; sin eso, comparar meses sería injusto.

**¿La IA hace los cálculos?**
No. La IA solo lee texto de las fotos. Los cálculos son fórmulas fijas que se pueden comprobar a mano.

**¿Qué pasa con la privacidad?**
La foto se lee dentro del celular y no se guarda. Cada hogar solo ve lo suyo, y la docente solo puede mirar.

**¿Qué pasa si la IA se equivoca?**
Las validaciones lo detectan y bajan la confianza. Hay lectura guiada y siempre se puede escribir a mano. Los datos dudosos se marcan en amarillo.

**¿De dónde salen 0,220 y 173?**
De la UPME: factor de emisión del sistema eléctrico 2024 y Resolución 355 de 2004.

**¿Qué errores tuvieron y cómo los resolvieron?**
Elijan uno del capítulo 10 y cuéntenlo con su causa y su aprendizaje.

**¿Qué mejorarían?**
Vista para la docente con el resumen del curso, registro de electrodomésticos, lectura directa del medidor con la cámara, actualizar el factor de emisión cada año.

::: {.idea}
**Consejo.** Si no saben una respuesta, digan: "No lo sabemos todavía; así lo averiguaríamos…". Eso también demuestra que entienden el proyecto.
:::

<div class="salto"></div>

# Anexo A. Respuestas

**Capítulo 1.** (1) 150 W = 0,15 kW × 24 h = 3,6 kWh. (2) 12 680 − 12 500 = 180 kWh. (3) 200 × 0,220 = 44 kg CO₂e. (4) Manizales está a más de 1000 m: hace menos calor y la regulación fija 130 kWh; Cartago, por debajo, tiene 173.

**Capítulo 2.** (1) 8 395 − 8 210 = 185 kWh. (2) Sí: 5 186 − 5 000 = 186. (3) Es el total a pagar en pesos; 349 864 kWh sería el consumo de cientos de casas durante años.

**Capítulo 3.** (1) El PDF ya trae el texto escrito; la foto hay que "leerla" y puede estar borrosa. (2) Revisar la factura y escribir los días correctos si aparecen. (3) Por privacidad: los usuarios son menores de edad y una dirección identifica a la familia. (4) Tres.

**Capítulo 4.** (1) 310 ÷ 31 × 30 = 300 kWh. (2) 200 × 0,95 = 190 kWh. (3) (378,2 − 257,1) ÷ 257,1 × 100 ≈ 47,1 %. (4) Porque tienen distinto número de días; hay que llevarlos a 30: 378,2 y 377,3 kWh, casi iguales.

**Capítulo 5.** (1) Guardar los datos, como la despensa y el archivo de pedidos. (2) Guarda la historia de cada cambio: quién, cuándo y por qué. (3) Medidor → factura → PDF/foto → lector → validación → confirmación → base de datos → cálculo → consulta.

**Capítulo 6.** (1) La detección encuentra dónde hay texto; el reconocimiento lee qué dice. (2) Gratis, privado (la foto no sale del celular), no depende de un servicio externo. (3) Porque no se pudo comprobar y era falso (28); un número equivocado alteraría el consumo en 30 días. (4) 19 840 − 19 487 = 353 ≠ 350: no aceptaría esa fila como válida y buscaría el consumo por otro camino o pediría revisar.

**Capítulo 7.** (1) Autorización. (2) Cero filas: la base de datos no se los entrega. (3) Porque traen datos personales de menores y sus familias, y no se necesitan: basta con los números del consumo.

**Capítulo 8.** (1) `consumption_records`. (2) Se actualiza el registro de ese mes; no se duplica. (3) Para medir qué tan bien lee la app y en qué datos se equivoca.

<div class="salto"></div>

# Anexo B. Glosario

| Palabra | Significado |
|---|---|
| Aplicación web | Programa que se usa desde el navegador, sin instalarlo |
| Autenticación | Comprobar quién es alguien (correo y contraseña) |
| Autorización | Decidir qué puede ver o hacer alguien |
| Base de datos | Lugar organizado donde se guardan los datos, en tablas |
| Clave (API key) | Código que identifica y da permiso para usar un servicio |
| Código | Instrucciones escritas para que el computador las siga |
| Commit | Un cambio guardado en la historia del proyecto (GitHub), con su explicación |
| Componente | Pieza de una pantalla (un botón, un formulario, una tarjeta) |
| Confianza | Qué tan segura está la app de un dato (alta, media, baja) |
| Consumo de subsistencia | Consumo básico definido por la regulación (173 o 130 kWh/mes) |
| Desviación estándar | Cuánto se alejan, en promedio, los datos de su promedio |
| Despliegue | Publicar una versión nueva de la app en internet |
| Factor de emisión | kg de CO₂e emitidos por cada kWh (0,220 en Colombia, 2024) |
| Frontend | La parte de la app que se ve y se toca |
| GitHub | Sitio que guarda el código y su historia |
| Huella de carbono | CO₂ equivalente emitido por una actividad |
| kWh | Kilovatio-hora: unidad de energía eléctrica |
| Línea base | Consumo promedio "normal" del hogar, punto de partida de la meta |
| Normalizar | Llevar a una misma escala para comparar (aquí, a 30 días) |
| OCR | Convertir texto de una imagen en texto digital |
| PaddleOCR | Lector de texto con IA, gratuito, que funciona en el celular |
| Píxel | Cada punto de color que forma una imagen digital |
| Prueba automática | Programa que comprueba que otro programa da el resultado correcto |
| Rama (branch) | Copia paralela del proyecto para trabajar sin dañar la versión publicada |
| Red neuronal | Programa que aprende de ejemplos en lugar de seguir reglas escritas a mano |
| RLS | Reglas de la base de datos que deciden qué filas ve cada persona |
| Supabase | Servicio con base de datos, cuentas y reglas de seguridad |
| Tendencia | Si el consumo viene subiendo (+) o bajando (−), en kWh por mes |
| UPME | Unidad de Planeación Minero Energética, entidad oficial de Colombia |
| Validación cruzada | Comprobar un dato por dos caminos distintos |
| Vercel | Servicio que publica la aplicación en internet |

<div class="salto"></div>

# Anexo C. Fuentes oficiales

- UPME, *Factores de emisión del Sistema Interconectado Nacional 2024*: https://docs.upme.gov.co/Normatividad/Soporte_calculo_Factor_de_Emision_2024.pdf
- Resolución UPME 355 de 2004 (consumo de subsistencia): https://gestornormativo.creg.gov.co/gestor/entorno/docs/resolucion_upme_0355_2004.htm
- PaddleOCR (código abierto, licencia Apache-2.0): https://github.com/PaddlePaddle/PaddleOCR
- Código de ElectriCOs: https://github.com/jhoandabit/ElectriCOS
