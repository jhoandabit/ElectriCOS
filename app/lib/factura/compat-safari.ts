/**
 * Funciones que los Safari/iOS más viejos no traen y que pdfjs usa por dentro.
 * El síntoma en el iPhone es "undefined is not a function (near '...of e...')":
 * `for await (const x of flujo)` sobre un ReadableStream, que Safari no sabe recorrer.
 * Se instalan solo si faltan, así que en navegadores nuevos no cambian nada.
 */
export function instalarCompatibilidad(): void {
  const g = globalThis as any;

  // for await (const x of ReadableStream)
  const RS = g.ReadableStream;
  if (RS && typeof Symbol.asyncIterator === "symbol" && !RS.prototype[Symbol.asyncIterator]) {
    const recorrer = function (this: ReadableStream) {
      const lector = this.getReader();
      return {
        next: () => lector.read() as Promise<IteratorResult<unknown>>,
        return: async () => {
          lector.releaseLock();
          return { done: true, value: undefined };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    };
    RS.prototype[Symbol.asyncIterator] = recorrer;
    if (!RS.prototype.values) RS.prototype.values = recorrer;
  }

  if (typeof (Promise as any).withResolvers !== "function") {
    (Promise as any).withResolvers = function () {
      let resolve!: (v: unknown) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise((ok, mal) => {
        resolve = ok;
        reject = mal;
      });
      return { promise, resolve, reject };
    };
  }

  if (!Array.prototype.at) {
    Object.defineProperty(Array.prototype, "at", {
      value(this: unknown[], i: number) {
        const n = Math.trunc(i) || 0;
        return this[n < 0 ? this.length + n : n];
      },
      configurable: true,
      writable: true,
    });
  }
  if (!(Array.prototype as any).findLast) {
    Object.defineProperty(Array.prototype, "findLast", {
      value(this: unknown[], f: (v: unknown, i: number, a: unknown[]) => boolean) {
        for (let i = this.length - 1; i >= 0; i--) if (f(this[i], i, this)) return this[i];
        return undefined;
      },
      configurable: true,
      writable: true,
    });
  }
  if (typeof (Object as any).groupBy !== "function") {
    (Object as any).groupBy = (items: Iterable<unknown>, f: (v: unknown, i: number) => string) => {
      const r: Record<string, unknown[]> = Object.create(null);
      let i = 0;
      for (const v of items) (r[f(v, i++)] ||= []).push(v);
      return r;
    };
  }
  if (typeof (Map as any).groupBy !== "function") {
    (Map as any).groupBy = (items: Iterable<unknown>, f: (v: unknown, i: number) => unknown) => {
      const r = new Map<unknown, unknown[]>();
      let i = 0;
      for (const v of items) {
        const k = f(v, i++);
        const l = r.get(k);
        if (l) l.push(v);
        else r.set(k, [v]);
      }
      return r;
    };
  }
}
