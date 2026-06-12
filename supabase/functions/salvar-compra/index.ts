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
    status, headers: { ...CORS, "content-type": "application/json" },
  });
}

interface Payload {
  categoria?: string;
  mes: string;
  data_compra?: string | null;
  item: string;
  solicitante?: string | null;
  descricao?: string | null;
  fornecedor?: string | null;       // texto livre (compat)
  fornecedor_id?: string | null;    // NOVO: FK opcional
  quantidade?: number;
  valor_medio?: number | null;
  valor_pago?: number | null;
  forma_pagamento?: "cartao" | "boleto" | null;
  ultimos_digitos?: string | null;
  parcelas?: string | null;
  comprovante_base64?: string | null;
  comprovante_mime?: string | null;
  comprovante_nome?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let payload: Payload;
  try { payload = await req.json(); }
  catch { return json({ error: "Body precisa ser JSON" }, 400); }

  if (!payload.mes || !payload.item) {
    return json({ error: "Campos obrigatorios: mes, item" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let comprovante_url: string | null = null;
  let comprovante_path: string | null = null;
  let comprovante_tamanho: number | null = null;

  if (payload.comprovante_base64 && payload.comprovante_mime) {
    try {
      const bytes = Uint8Array.from(atob(payload.comprovante_base64), (c) => c.charCodeAt(0));
      comprovante_tamanho = bytes.byteLength;

      const mimePart = payload.comprovante_mime.split("/")[1] || "bin";
      const ext = mimePart.split(";")[0].toLowerCase();
      const now = new Date();
      const yyyy = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const path = `${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("comprovantes")
        .upload(path, bytes, { contentType: payload.comprovante_mime, upsert: false });

      if (upErr) return json({ error: "Falha no upload do comprovante", detail: upErr.message }, 500);

      const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(path);
      comprovante_url = urlData.publicUrl;
      comprovante_path = path;
    } catch (err) {
      return json({ error: "Erro processando comprovante", detail: (err as Error).message }, 500);
    }
  }

  const { data: row, error: insErr } = await supabase
    .from("compras")
    .insert({
      categoria: payload.categoria || "online",
      mes: payload.mes,
      data_compra: payload.data_compra || null,
      item: payload.item,
      solicitante: payload.solicitante || null,
      descricao: payload.descricao || null,
      fornecedor: payload.fornecedor || null,
      fornecedor_id: payload.fornecedor_id || null,   // NOVO
      quantidade: payload.quantidade ?? 1,
      valor_medio: payload.valor_medio ?? null,
      valor_pago: payload.valor_pago ?? null,
      forma_pagamento: payload.forma_pagamento ?? null,
      ultimos_digitos: payload.ultimos_digitos ?? null,
      parcelas: payload.parcelas ?? null,
      comprovante_url,
      comprovante_path,
      comprovante_nome: payload.comprovante_nome ?? null,
      comprovante_tamanho,
    })
    .select()
    .single();

  if (insErr) {
    if (comprovante_path) {
      await supabase.storage.from("comprovantes").remove([comprovante_path]).catch(() => {});
    }
    return json({ error: "Falha ao inserir compra", detail: insErr.message }, 500);
  }

  return json({ ok: true, compra: row });
});