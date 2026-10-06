import { test } from "node:test";
import assert from "node:assert/strict";
import { almacenMemoria } from "../app/lib/local/almacen";
import { encolar, fusionar, listarPendientes, sincronizar } from "../app/lib/local/pendientes";

const mes = (periodo: string, kwh: number, fuente: "manual" | "factura" | "historico" = "factura") => ({
  periodo, consumo_kwh: kwh, dias: 30, lectura_anterior: null, lectura_actual: null, valor_kwh: null, fuente,
});
const redFalla = (e: unknown) => /Failed to fetch/.test((e as Error).message);

test("sin conexión: los consumos quedan en cola y se envían todos al volver, sin duplicarse", async () => {
  const a = almacenMemoria();
  await encolar(a, "h1", mes("2026-10", 385), false);
  await encolar(a, "h1", mes("2026-09", 313, "historico"), true);
  await encolar(a, "h1", mes("2026-10", 385), false); // reintento del mismo mes: sigue siendo uno
  assert.equal((await listarPendientes(a, "h1")).length, 2);

  const enviadosAlServidor = new Map<string, number>();
  let hayRed = false;
  const enviar = async (p: { periodo: string; consumo_kwh: number }) => {
    if (!hayRed) throw new Error("TypeError: Failed to fetch");
    enviadosAlServidor.set(p.periodo, p.consumo_kwh); // upsert por mes
  };
  const sinRed = await sincronizar(a, "h1", enviar, redFalla);
  assert.deepEqual([sinRed.enviados, sinRed.pendientes, sinRed.sinRed], [0, 2, true]);

  hayRed = true;
  const conRed = await sincronizar(a, "h1", enviar, redFalla);
  assert.deepEqual([conRed.enviados, conRed.pendientes], [2, 0]);
  assert.equal(enviadosAlServidor.size, 2);
  assert.equal((await sincronizar(a, "h1", enviar, redFalla)).enviados, 0); // ya no queda nada
});

test("si el servidor rechaza un mes queda sync_error con el motivo y los demás se envían", async () => {
  const a = almacenMemoria();
  await encolar(a, "h1", mes("2026-08", 9999), false);
  await encolar(a, "h1", mes("2026-09", 313), false);
  const r = await sincronizar(a, "h1", async (p) => { if (p.periodo === "2026-08") throw new Error("valor fuera del rango"); }, redFalla);
  assert.deepEqual([r.enviados, r.pendientes, r.conError], [1, 1, 1]);
  const [malo] = await listarPendientes(a, "h1");
  assert.equal(malo.estado, "sync_error");
  assert.equal(malo.error, "valor fuera del rango");
});

test("el histórico automático no pisa lo que la persona guardó a propósito", async () => {
  const a = almacenMemoria();
  await encolar(a, "h1", mes("2026-05", 256, "manual"), false);
  await encolar(a, "h1", mes("2026-05", 216, "historico"), true);
  assert.equal((await listarPendientes(a, "h1"))[0].consumo_kwh, 256);
});

test("la lista muestra lo del servidor más lo pendiente, marcado, y el histórico no pisa lo ya guardado", () => {
  const remotos = [{ id: "a", ...mes("2026-09", 313, "manual") }];
  const pend = [
    { clave: "h|2026-09", hogarId: "h", ...mes("2026-09", 1, "historico"), soloSiNoExiste: true, estado: "pending_sync" as const, intentos: 0, creado: 0 },
    { clave: "h|2026-10", hogarId: "h", ...mes("2026-10", 385), soloSiNoExiste: false, estado: "pending_sync" as const, intentos: 0, creado: 0 },
  ];
  const f = fusionar(remotos, pend);
  assert.deepEqual(f.map((r) => `${r.periodo}:${r.consumo_kwh}:${r.estado}`), ["2026-09:313:synced", "2026-10:385:pending_sync"]);
});

test("los pendientes de un hogar no se mezclan con los de otro", async () => {
  const a = almacenMemoria();
  await encolar(a, "h1", mes("2026-10", 385), false);
  await encolar(a, "h2", mes("2026-10", 100), false);
  assert.equal((await listarPendientes(a, "h1")).length, 1);
});
