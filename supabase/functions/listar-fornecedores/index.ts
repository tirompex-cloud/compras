import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Filtros {
  search?: string;
  tipo_pessoa?: 'PF' | 'PJ';
  ativo?: boolean;
  limit?: number;
  offset?: number;
}

Deno.serve(async (req: Request) => {
  const pre = preflight(req);
  if (pre) return pre;

  const cors = corsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status = 200): Response => new Response(
    JSON.stringify(body),
    { status, headers: { ...cors, "content-type": "application/json" } },
  );

  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let filtros: Filtros = {};
  try { filtros = await req.json(); } catch {}

  const limit = Math.min(filtros.limit || 100, 500);
  const offset = filtros.offset || 0;
  const ativo = filtros.ativo !== false;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let query = supabase.from("fornecedores")
    .select("*", { count: "exact" })
    .eq("ativo", ativo)
    .order("nome", { ascending: true })
    .range(offset, offset + limit - 1);

  if (filtros.tipo_pessoa) query = query.eq("tipo_pessoa", filtros.tipo_pessoa);
  if (filtros.search) {
    const s = filtros.search.trim().replace(/[%_]/g, '');
    query = query.or(`nome.ilike.%${s}%,documento.ilike.%${s}%,razao_social.ilike.%${s}%,nome_fantasia.ilike.%${s}%`);
  }

  const { data, count, error } = await query;
  if (error) return json({ error: "Falha ao listar", detail: error.message }, 500);

  return json({ ok: true, fornecedores: data || [], total: count || 0 });
});
