# Pruebas

> Guía, módulo 14: probar es definir una entrada, un resultado esperado y un criterio de aceptación.

## 1. Pruebas automáticas (motor y lector)

```powershell
npm install
npm test
```

16 pruebas en `tests/`: motor matemático (huella, 30 días, línea base, meta, avance, subsistencia) y lector (factura de referencia anonimizada, trampas numéricas, fila del medidor, formatos colombianos, vuelta del medidor).

## 2. Pruebas de seguridad (RLS)

En Supabase → SQL Editor, pegar `supabase/tests/prueba_rls.sql` y ejecutar. El resultado sale como un "error" a propósito, para que se deshaga todo y no queden datos de prueba. Resultado del 28 de septiembre de 2026 en el proyecto real:

```
T0 El disparador creó 3 perfiles → OK
T1 Ana ve su hogar → OK
T2 Ana ve su consumo → OK
T3 Ana NO puede cambiar su rol → OK
T4 Beto NO ve el hogar de Ana → OK
T5 Beto NO ve el consumo de Ana → OK
T6 Beto NO escribe en el hogar de Ana → OK
T7 Beto NO borra el hogar de Ana → OK
T8 Beto NO crea hogares a nombre de Ana → OK
T9 Docente ve el consumo de Ana → OK
T10 Docente NO modifica consumos → OK
T11 Anónimo NO lee hogares → OK
T12 Anónimo lee parámetros oficiales → OK
```

## 3. Matriz de pruebas funcionales (para ejecutar en clase)

| ID | Funcionalidad | Entrada | Esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| T01 | Ingreso válido | Correo y contraseña correctos | Entra a la app | Recorrido automático 28/09 | ✓ |
| T02 | Ingreso inválido | Contraseña incorrecta | "Correo o contraseña incorrectos" (sin decir cuál falló) | Recorrido automático 28/09 | ✓ |
| T03 | Crear hogar | Sin municipio | "Escribe el municipio." | Recorrido automático 28/09 | ✓ |
| T04 | Registrar consumo | Lecturas 19 487 → 19 840, 28 días | 353 kWh · 378,2 kWh/30 d · 77,7 kg CO₂e | Recorrido automático 28/09 | ✓ |
| T05 | Lecturas al revés | 500 → 400 | "Las lecturas no son coherentes" | Falló (900 kWh) → corregido → ✓ | ✓ |
| T06 | Línea base | 1 mes registrado | "Faltan 2 meses" | Recorrido automático 28/09 | ✓ |
| T07 | Meta sin acciones | 10 %, ninguna acción | "Elige al menos una acción" | Recorrido automático 28/09 | ✓ |
| T08 | Meta | 4 meses, 10 % | Meta = base × 0,9; inicia el mes siguiente | 323,7 → 291,3 · octubre | ✓ |
| T09 | Progreso | Pasar el dedo por una columna | Tooltip con mes, kWh y cumplimiento | Recorrido automático 28/09 | ✓ |
| T10 | Recomendaciones sin IA | Sin conexión a la API | Recomendaciones por reglas | Recorrido automático 28/09 | ✓ |
| T11 | Borrar registro | Confirmar borrado | Desaparece del historial | Recorrido automático 28/09 | ✓ |
| T12 | PDF de referencia | Factura EEP en PDF | 353 kWh, Cartago, 4, 28 días, 19 487 → 19 840 | `npm test` | ✓ |
| T13 | Foto con lectura guiada | Foto de la factura, encerrar fila Activa | 353 kWh | Probado con foto simulada; **falta foto real** | ◐ |
| T14 | Foto con IA | Foto con Gemini activo | "LECTURA INTELIGENTE" | **Pendiente**: depende de la clave | ☐ |
| T15 | Error de red | Sin internet al guardar | "Revisa tu conexión a internet" | Pendiente en clase | ☐ |
| T16 | Acceso no autorizado | Estudiante B abre datos de A | 0 filas | Prueba RLS T4–T8 | ✓ |

El "recorrido automático" usa la interfaz real en un navegador (Chromium) con un Supabase simulado; las pruebas de seguridad sí corren contra la base de datos real.
