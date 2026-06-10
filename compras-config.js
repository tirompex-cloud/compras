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

  /* URL do Apps Script publicado p/ sincronizar com a planilha Google Sheets.
     Ex: 'https://script.google.com/macros/s/AKfycb.../exec' */
  SHEETS_APPS_SCRIPT_URL: '',

  /* URL pra abrir a planilha no navegador (botao "Abrir planilha ↗").
     Ex: 'https://docs.google.com/spreadsheets/d/1abc.../edit' */
  SHEETS_VIEW_URL: '',

  /* Chave da API da Anthropic (Claude) para leitura de comprovantes via OCR.
     Comeca com "sk-ant-api03-..." — pegue em https://console.anthropic.com */
  ANTHROPIC_API_KEY: '',
};
