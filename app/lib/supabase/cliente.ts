"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente único de Supabase para el navegador.
// La URL y la clave "anon" son públicas por diseño: lo que protege los datos
// es RLS (ver supabase/migrations/..._seguridad_rls.sql), no esconder la clave.
// La clave "service_role" NUNCA debe aparecer en el frontend ni en GitHub.

let cliente: SupabaseClient | null = null;

export function supabaseConfigurado() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabase(): SupabaseClient {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    cliente = createClient(url, clave, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return cliente;
}
