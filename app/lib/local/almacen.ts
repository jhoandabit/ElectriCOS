// Almacén local del dispositivo (IndexedDB) para trabajar sin conexión.
// Solo guarda datos de consumo del propio hogar y una copia de lo último leído:
// nunca fotos de facturas, nombres, direcciones ni claves.
// Se define como interfaz para poder probar la lógica con un almacén en memoria.

export type Tabla = "pendientes" | "cache";

export interface Almacen {
  leer<T>(tabla: Tabla, clave: string): Promise<T | undefined>;
  escribir(tabla: Tabla, clave: string, valor: unknown): Promise<void>;
  borrar(tabla: Tabla, clave: string): Promise<void>;
  todos<T>(tabla: Tabla): Promise<T[]>;
}

export function almacenMemoria(): Almacen {
  const t: Record<Tabla, Map<string, unknown>> = { pendientes: new Map(), cache: new Map() };
  return {
    async leer<T>(tabla: Tabla, clave: string) {
      return t[tabla].get(clave) as T | undefined;
    },
    async escribir(tabla, clave, valor) {
      t[tabla].set(clave, JSON.parse(JSON.stringify(valor)));
    },
    async borrar(tabla, clave) {
      t[tabla].delete(clave);
    },
    async todos<T>(tabla: Tabla) {
      return Array.from(t[tabla].values()) as T[];
    },
  };
}

const NOMBRE_BD = "electricos-local";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOMBRE_BD, 1);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains("pendientes")) bd.createObjectStore("pendientes");
      if (!bd.objectStoreNames.contains("cache")) bd.createObjectStore("cache");
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

function pedir<T>(bd: IDBDatabase, tabla: Tabla, modo: IDBTransactionMode, accion: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const p = accion(bd.transaction(tabla, modo).objectStore(tabla));
    p.onsuccess = () => resolve(p.result);
    p.onerror = () => reject(p.error);
  });
}

/** IndexedDB; si el navegador no lo permite (modo privado, etc.) cae a memoria sin romper nada. */
export function almacenLocal(): Almacen {
  let bd: Promise<IDBDatabase> | null = null;
  const memoria = almacenMemoria();
  const disponible = () => typeof indexedDB !== "undefined";
  const base = () => (bd ??= abrir());

  return {
    async leer<T>(tabla: Tabla, clave: string) {
      if (!disponible()) return memoria.leer<T>(tabla, clave);
      try {
        return (await pedir(await base(), tabla, "readonly", (s) => s.get(clave))) as T | undefined;
      } catch {
        return memoria.leer<T>(tabla, clave);
      }
    },
    async escribir(tabla, clave, valor) {
      await memoria.escribir(tabla, clave, valor);
      if (!disponible()) return;
      try {
        await pedir(await base(), tabla, "readwrite", (s) => s.put(valor, clave));
      } catch {
        /* queda en memoria mientras la pestaña siga abierta */
      }
    },
    async borrar(tabla, clave) {
      await memoria.borrar(tabla, clave);
      if (!disponible()) return;
      try {
        await pedir(await base(), tabla, "readwrite", (s) => s.delete(clave));
      } catch {
        /* nada */
      }
    },
    async todos<T>(tabla: Tabla) {
      if (!disponible()) return memoria.todos<T>(tabla);
      try {
        return (await pedir(await base(), tabla, "readonly", (s) => s.getAll())) as T[];
      } catch {
        return memoria.todos<T>(tabla);
      }
    },
  };
}
