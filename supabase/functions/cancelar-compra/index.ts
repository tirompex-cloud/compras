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

interface Payload {
  id: string;
  cancelado_por: string;
  cancelado_motivo?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body precisa ser JSON" }, 400);
  }
  if (!payload.id || !payload.cancelado_por) {
    return json({ error: "Campos obrigatorios: id, cancelado_por" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1) Pega o path do comprovante (se tiver) antes de deletar
  const { data: existing, error: fetchErr } = await supabase
    .from("compras")
    .select("id, comprovante_path")
    .eq("id", payload.id)
    .single();

  if (fetchErr || !existing) {
    return json({ error: "Compra nao encontrada" }, 404);
  }

  // 2) Apaga o comprovante do Storage (graceful: continua se falhar)
  if (existing.comprovante_path) {
    const { error: rmErr } = await supabase.storage
      .from("comprovantes")
      .remove([existing.comprovante_path]);
    if (rmErr) console.warn("[cancelar-compra] Falha removendo arquivo:", rmErr.message);
  }

  // 3) DELETE a row do compras (limpa o Table Editor)
  const { error: delErr } = await supabase
    .from("compras")
    .delete()
    .eq("id", payload.id);

  if (delErr) {
    return json({ error: "Falha ao deletar", detail: delErr.message }, 500);
  }

  // Frontend usa esses valores no audit trail local (eles foram enviados pela request)
  return json({
    ok: true,
    cancelacao: {
      id: payload.id,
      cancelado_em: new Date().toISOString(),
      cancelado_por: payload.cancelado_por,
      cancelado_motivo: payload.cancelado_motivo || null,
    },
  });
});