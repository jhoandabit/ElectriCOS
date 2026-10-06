import { test } from "node:test";
import assert from "node:assert/strict";
import { cicloQuincenal } from "../app/lib/calculos/ciclo";

test("ciclo del 10 y del 20: antes del 10 no hay, del 10 al 19 es el 10, desde el 20 es el 20", () => {
  assert.equal(cicloQuincenal(new Date(2026, 9, 9)), null);
  assert.equal(cicloQuincenal(new Date(2026, 9, 10)), "2026-10-10");
  assert.equal(cicloQuincenal(new Date(2026, 9, 19)), "2026-10-10");
  assert.equal(cicloQuincenal(new Date(2026, 9, 20)), "2026-10-20");
  assert.equal(cicloQuincenal(new Date(2026, 9, 31)), "2026-10-20");
});
