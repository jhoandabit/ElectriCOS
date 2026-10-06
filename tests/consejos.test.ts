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

import { proximasQuincenas } from "../app/lib/calculos/ciclo";

test("próximas fechas de consejo: días 10 y 20 a las 8:00, en orden y cruzando el año", () => {
  const f = proximasQuincenas(new Date(2026, 9, 6, 12, 0), 4);
  assert.deepEqual(f.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}h`), ["2026-10-10 8h", "2026-10-20 8h", "2026-11-10 8h", "2026-11-20 8h"]);
  const fin = proximasQuincenas(new Date(2026, 11, 21, 9, 0), 3);
  assert.deepEqual(fin.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`), ["2027-1-10", "2027-1-20", "2027-2-10"]);
  // el mismo día 10 a las 7:00 todavía cuenta; a las 9:00 ya no
  assert.equal(proximasQuincenas(new Date(2026, 9, 10, 7, 0), 1)[0].getDate(), 10);
  assert.equal(proximasQuincenas(new Date(2026, 9, 10, 9, 0), 1)[0].getDate(), 20);
});
