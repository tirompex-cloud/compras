import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Payload {
  id?: string;
  tipo_pessoa: 'PF' | 'PJ';
  nome: string;
  documento: string;
  telefone?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  pais?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  regime_tributario?: string | null;
  ativo?: boolean;
}

function validar(p: Payload): string | null {
  if (!p.tipo_pessoa || !['PF','PJ'].includes(p.tipo_pessoa)) return "tipo_pessoa deve ser PF ou PJ";
  if (!p.nome || p.nome.trim().length < 2) return "nome obrigatorio (min 2 caracteres)";
  if (!p.documento) return "documento obrigatorio (CPF ou CNPJ)";

  const docDig = String(p.documento).replace(/\D/g, '');
  if (p.tipo_pessoa === 'PF' && docDig.length !== 11) return "CPF deve ter 11 digitos";
  if (p.tipo_pessoa === 'PJ' && docDig.length !== 14) return "CNPJ deve ter 14 digitos";

  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return "email invalido";
  if (p.uf && !/^[A-Za-z]{2}$/.test(p.uf)) return "UF deve ter 2 letras";
  if (p.cep && String(p.cep).replace(/\D/g,'').length !== 8) return "CEP deve ter 8 digitos";
  return null;
}

function normalizar(p: Payload) {
  return {
    ...p,
    documento: String(p.documento).replace(/\D/g, ''),
    cep: p.cep ? String(p.cep).replace(/\D/g, '') : null,
    uf: p.uf ? p.uf.toUpperCase() : null,
    nome: p.nome?.trim(),
    email: p.email ? p.email.trim().toLowerCase() : null,
  };
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

  let payload: Payload;
  try { payload = await req.json(); }
  catch { return json({ error: "Body precisa ser JSON" }, 400); }

  const err = validar(payload);
  if (err) return json({ error: err }, 400);

  const dados = normalizar(payload);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let result;
  if (dados.id) {
    const { id, ...rest } = dados;
    result = await supabase.from("fornecedores").update(rest).eq("id", id).select().single();
  } else {
    const { id: _ignored, ...rest } = dados;
    result = await supabase.from("fornecedores").insert(rest).select().single();
  }

  if (result.error) {
    if (result.error.code === '23505') {
      return json({ error: "Ja existe um cadastro ativo com esse CPF/CNPJ" }, 409);
    }
    return json({ error: "Falha ao salvar", detail: result.error.message }, 500);
  }

  return json({ ok: true, fornecedor: result.data });
});
