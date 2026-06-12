import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

interface Filters {
  categoria?: string;
  mes?: string;
  limit?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let filters: Filters = {};
  try { filters = await req.json(); } catch {}

  const limit = Math.min(filters.limit || 100, 500);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let query = supabase
    .from("compras")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.categoria) query = query.eq("categoria", filters.categoria);
  if (filters.mes)       query = query.eq("mes", filters.mes);

  const { data, error } = await query;
  if (error) return json({ error: "Falha ao listar", detail: error.message }, 500);

  return json({ ok: true, compras: data || [], count: data?.length || 0 });
});