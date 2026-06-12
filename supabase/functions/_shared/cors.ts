/* =============================================================================
   ROMPEX • CORS shared helper para Edge Functions

   Politica:
   - Reflete a Origin da requisicao quando casa com a allowlist (regex);
     senao, devolve Allow-Origin vazio (browser bloqueia).
   - Allow-Headers cobre exatamente o que o frontend manda: apikey,
     authorization, content-type, x-client-info.
   - Allow-Methods limitado a POST + OPTIONS (todas as functions sao POST).
   - Max-Age 24h reduz preflights repetidos.
   - Vary: Origin pra CDN/cache nao misturar respostas entre origens.

   Allowlist:
   - Previews da Vercel deste projeto: subdominio termina em
     -thiago-morais-projects1.vercel.app
   - Produção (subdominio padrao): project-b8m7j.vercel.app
   - Dev local: http://localhost:<porta>

   Observação de seguranca:
   - Isso NAO autentica. Continua aceitando qualquer caller (ate sem JWT).
     A barreira real virá com Supabase Auth + validacao de JWT por usuario
     (fase posterior, fora do escopo deste fix).
   ============================================================================= */

const ALLOWED: RegExp[] = [
  /^https:\/\/[a-z0-9-]+-thiago-morais-projects1\.vercel\.app$/i,
  /^https:\/\/project-b8m7j\.vercel\.app$/i,
  /^http:\/\/localhost:\d+$/,
];

export function corsHeaders(origin: string | null): Record<string, string> {
  const ok = origin !== null && ALLOWED.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

/** Se a requisicao for um preflight OPTIONS, devolve a Response 200 com headers
    CORS pra ser retornada imediatamente. Caso contrario, devolve null. */
export function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, {
    status: 200,
    headers: corsHeaders(req.headers.get("origin")),
  });
}
