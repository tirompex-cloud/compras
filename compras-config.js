/* =============================================================================
   ROMPEX • Compras — Configuracao fixa de APIs externas
   -----------------------------------------------------------------------------
   Este arquivo deixa FIXOS no codigo as URLs/keys que antes ficavam em
   localStorage. Edite UMA UNICA VEZ aqui — depois funciona em qualquer
   navegador/dispositivo sem precisar re-configurar pelo modal.

   Como funciona:
     1. compras.html le primeiro este arquivo via window.ROMPEX_COMPRAS_CONFIG
     2. Se algum valor estiver vazio aqui, cai pra localStorage (modal de config)
     3. Se ambos vazios, fica desativado e o usuario ve o banner amarelo

   ATENCAO: Como este arquivo eh estatico (Vercel), qualquer pessoa que abrir
   o /compras-config.js no navegador VE essas chaves. Se for ambiente publico,
   considere proxy/backend. Para uso interno (Vercel privado ou senha-protegido),
   esta abordagem eh aceitavel.
   ============================================================================= */

window.ROMPEX_COMPRAS_CONFIG = {

  /* ===== Google Sheets =====
     URL do Apps Script publicado p/ sincronizar com a planilha Google Sheets.
     Formato CORRETO: 'https://script.google.com/macros/s/AKfycb.../exec'
     (atualmente vazio - configure quando publicar o Apps Script no Sheets) */
  SHEETS_APPS_SCRIPT_URL: '',

  /* URL pra abrir a planilha no navegador (botao "Abrir planilha ↗"). */
  SHEETS_VIEW_URL: 'https://docs.google.com/spreadsheets/d/1hh4tUPhcDuHgC_6RUnn84ilIO3GgOCJqmayZbNA-Qtw/edit?gid=786150952#gid=786150952',

  /* ===== Supabase Edge Functions =====
     Anthropic API key + Service Role key ficam em Secrets (server-side).
     URL + anon publishable key sao publicas por design — seguras no JS. */
  SUPABASE_OCR_URL:         'https://ypbhcafpwzlyhvhfsahf.supabase.co/functions/v1/ocr-comprovante',
  SUPABASE_SAVE_URL:        'https://ypbhcafpwzlyhvhfsahf.supabase.co/functions/v1/salvar-compra',
  SUPABASE_CANCEL_URL:      'https://ypbhcafpwzlyhvhfsahf.supabase.co/functions/v1/cancelar-compra',
  SUPABASE_LIST_URL:        'https://ypbhcafpwzlyhvhfsahf.supabase.co/functions/v1/listar-compras',

  /* Stakeholders (clientes + fornecedores) */
  SUPABASE_LIST_CLI_URL:    'https://ypbhcafpwzlyhvhfsahf.supabase.co/functions/v1/listar-clientes',
  SUPABASE_SAVE_CLI_URL:    'https://ypbhcafpwzlyhvhfsahf.supabase.co/functions/v1/salvar-cliente',
  SUPABASE_LIST_FORN_URL:   'https://ypbhcafpwzlyhvhfsahf.supabase.co/functions/v1/listar-fornecedores',
  SUPABASE_SAVE_FORN_URL:   'https://ypbhcafpwzlyhvhfsahf.supabase.co/functions/v1/salvar-fornecedor',

  SUPABASE_ANON_KEY:        'sb_publishable_pxn3pLSs_T-d01xiehiwOg_FIa-URLC',
};
