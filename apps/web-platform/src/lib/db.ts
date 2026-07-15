import { supabase } from "./supabaseClient";

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/**
 * RPC functions (db/004 onward) mostly `returns vb_<schema>.<table>` —
 * PostgREST serialises that as the table's real (snake_case) column
 * names. Running results through this once means every page sees the
 * same camelCase @veribills/shared-types shapes regardless of whether a
 * view read or an RPC write produced them. Idempotent on already-camelCase
 * keys, so it's safe to apply to jsonb-returning RPCs too.
 */
export function camelizeKeys<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelizeKeys(v)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [toCamel(k), camelizeKeys(v)]),
    ) as T;
  }
  return value as T;
}

/** Unwraps a supabase-js `{ data, error }` result, throwing on error. */
export async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data as T;
}

/** Calls a veriBills RPC function and camelizes its result. */
export async function callRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return camelizeKeys<T>(data);
}

interface EdgeEnvelope<T> {
  ok: boolean;
  data: T;
  error?: { code: string; message: string };
}

/** Invokes a supabase/functions/* Edge Function (mock sibling-platform adapters, real outbound HTTP). */
export async function callEdgeFunction<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<EdgeEnvelope<T>>(fn, { body });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error?.message ?? `${fn} failed`);
  return data.data;
}
