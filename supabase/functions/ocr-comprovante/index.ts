import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const PROMPT = `Voce e um extrator de dados de comprovantes de compra brasileiros (notas fiscais, recibos, faturas, extratos de cartao, prints de compra online). Recebe uma imagem e extrai SOMENTE os campos abaixo. Retorna JSON puro, sem markdown, sem prefixo, sem explicacao.

Campos esperados:
- item: descricao curta do item/servico principal (string)
- fornecedor: nome da loja/estabelecimento (string)
- data: data da compra em ISO YYYY-MM-DD (string ou null)
- valor_pago: valor TOTAL pago em reais (number com ponto decimal, sem R$ nem virgula)
- valor_medio: preco medio unitario se houver (number ou null)
- quantidade: quantidade de itens (number, default 1)
- forma_pagamento: "cartao" ou "boleto" (string ou null)
- ultimos_digitos: 4 ultimos digitos do cartao se aparecer (string de 4 chars ou null)
- parcelas: ex "3x sem juros" (string ou null)

Se algum campo nao estiver claro na imagem, use null. NUNCA invente dado.

Retorne APENAS o JSON, exemplo:
{"item":"Notebook Dell Inspiron","fornecedor":"Magazine Luiza","data":"2026-06-10","valor_pago":2890.00,"valor_medio":null,"quantidade":1,"forma_pagamento":"cartao","ultimos_digitos":"6411","parcelas":"6x sem juros"}`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY ausente no secret" }, 500);

  let body: { image_base64?: string; mime_type?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body precisa ser JSON" }, 400);
  }

  const { image_base64, mime_type } = body;
  if (!image_base64 || !mime_type) {
    return json({ error: "image_base64 e mime_type sao obrigatorios" }, 400);
  }
  const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!supported.includes(mime_type)) {
    return json({ error: `MIME nao suportado: ${mime_type}` }, 400);
  }

  let claudeRes: Response;
  try {
    claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime_type, data: image_base64 } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });
  } catch (err) {
    return json({ error: "Falha ao chamar Anthropic", detail: (err as Error).message }, 502);
  }

  if (!claudeRes.ok) {
    const text = await claudeRes.text();
    return json({ error: `Anthropic HTTP ${claudeRes.status}`, detail: text }, 502);
  }

  const data = await claudeRes.json();
  const responseText: string = data?.content?.[0]?.text || "";

  let extracted: Record<string, unknown>;
  try {
    const cleaned = responseText.replace(/^```json\s*|\s*```$/g, "").trim();
    extracted = JSON.parse(cleaned);
  } catch {
    return json({ error: "Claude nao retornou JSON valido", raw: responseText }, 502);
  }

  return json({ ok: true, extracted, model: ANTHROPIC_MODEL });
});