/* =============================================================================
   ROMPEX • Integração Google Drive (via Google Apps Script Web App)
   -----------------------------------------------------------------------------
   Este arquivo expõe funções globais para upload, listagem, exclusão e teste
   de conexão com o Google Drive da empresa. A API real fica em um Apps Script
   publicado como Web App. Se ROMPEX_DRIVE_API_URL estiver vazio, o sistema
   continua funcionando: cada módulo trata o erro/falha e cai em localStorage.

   Estrutura esperada de pastas (a API cria automaticamente):
     • Documentos   • Compras   • RH   • Financeiro
   ============================================================================= */

/* URL do Web App do Google Apps Script.
   Deixe em string vazia ('') para desativar a integração e usar somente o
   localStorage. Não é necessário alterar mais nada no resto do sistema. */
const ROMPEX_DRIVE_API_URL = 'https://script.google.com/macros/s/AKfycbw4myH1zNPnOFkLxCZrmzj8V_ZQ-v-K23wKFeNVDjT3PHuuMdCjWj51-ubX1Wqx2Q5GBA/exec';

/* Limite de tamanho aceito pela API (mesmo limite informado ao usuário). */
const ROMPEX_DRIVE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/* Subpastas permitidas — devem bater com o que o Apps Script reconhece.
   'Avisos' pode ainda não existir no Apps Script publicado; se o upload falhar,
   o módulo de avisos cai automaticamente para localStorage (sem URL pública). */
const ROMPEX_DRIVE_SUBPASTAS = ['Documentos', 'Compras', 'RH', 'Financeiro', 'Avisos'];

/* =============================================================================
   Helpers internos
   ============================================================================= */

/* Indica se a integração está configurada. Os módulos usam isso para decidir
   se mostram “Drive conectado” ou “Drive offline (modo local)”. */
function _rompexDriveConfigurado() {
  return typeof ROMPEX_DRIVE_API_URL === 'string' && ROMPEX_DRIVE_API_URL.trim() !== '';
}

/* Converte um File em Base64 puro (sem o prefixo "data:..."). O Apps Script
   recebe a string e usa Utilities.base64Decode no servidor. */
function _arquivoParaBase64(arquivo) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function() {
      const resultado = reader.result || '';
      const virgula = resultado.indexOf(',');
      // FileReader retorna "data:<mime>;base64,<conteudo>" — pegamos só o conteúdo.
      resolve(virgula >= 0 ? resultado.substring(virgula + 1) : resultado);
    };
    reader.onerror = function() { reject(new Error('Falha ao ler o arquivo.')); };
    reader.readAsDataURL(arquivo);
  });
}

/* Monta URL com query string a partir de um objeto de parâmetros. */
function _montarUrl(params) {
  const base = ROMPEX_DRIVE_API_URL;
  if (!params) return base;
  const qs = Object.keys(params)
    .filter(function(k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
    .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
    .join('&');
  if (!qs) return base;
  return base + (base.indexOf('?') >= 0 ? '&' : '?') + qs;
}

/* =============================================================================
   API pública
   ============================================================================= */

/* Faz o upload de um arquivo para o Drive.
   - arquivo  : File object (vindo de <input type="file">)
   - nome     : opcional, sobrescreve arquivo.name
   - tipo     : opcional, sobrescreve arquivo.type (MIME)
   - subpasta : uma de ROMPEX_DRIVE_SUBPASTAS (default: "Documentos")
   Retorna { id, nome, url, urlDownload, tamanho, data, tipo }. */
async function uploadArquivo(arquivo, nome, tipo, subpasta) {
  if (!_rompexDriveConfigurado()) {
    throw new Error('Integração com Google Drive não configurada.');
  }
  if (!arquivo) throw new Error('Nenhum arquivo informado.');
  if (arquivo.size > ROMPEX_DRIVE_MAX_BYTES) {
    throw new Error('Arquivo excede o limite de 50 MB.');
  }

  const pastaFinal = ROMPEX_DRIVE_SUBPASTAS.indexOf(subpasta) >= 0 ? subpasta : 'Documentos';
  const nomeFinal = (nome && String(nome).trim()) || arquivo.name;
  const tipoFinal = tipo || arquivo.type || 'application/octet-stream';
  const conteudoBase64 = await _arquivoParaBase64(arquivo);

  /* IMPORTANTE: usamos application/x-www-form-urlencoded (URLSearchParams).
     - É um content-type "CORS-safelisted" — NÃO dispara preflight OPTIONS.
     - Popula automaticamente `e.parameter.X` no Apps Script (sem precisar
       parsear postData.contents). Por isso usamos nomes que batem com o
       script: `arquivo` (base64), `subpasta`, `nome`, `tipo`, `acao`. */
  const body = new URLSearchParams();
  body.append('acao', 'upload');
  body.append('arquivo', conteudoBase64);
  body.append('nome', nomeFinal);
  body.append('tipo', tipoFinal);
  body.append('subpasta', pastaFinal);

  const resposta = await fetch(ROMPEX_DRIVE_API_URL, {
    method: 'POST',
    body: body
  });

  if (!resposta.ok) {
    throw new Error('Falha no upload (HTTP ' + resposta.status + ').');
  }
  const dados = await resposta.json();
  if (dados && dados.erro) throw new Error(dados.erro);
  return dados;
}

/* Lista arquivos de uma subpasta. Retorna array (vazio se nada encontrado). */
async function listarArquivos(subpasta) {
  if (!_rompexDriveConfigurado()) {
    throw new Error('Integração com Google Drive não configurada.');
  }
  const pastaFinal = ROMPEX_DRIVE_SUBPASTAS.indexOf(subpasta) >= 0 ? subpasta : 'Documentos';
  const url = _montarUrl({ acao: 'listar', pasta: pastaFinal });

  const resposta = await fetch(url, { method: 'GET' });
  if (!resposta.ok) {
    throw new Error('Falha ao listar (HTTP ' + resposta.status + ').');
  }
  const dados = await resposta.json();
  if (dados && dados.erro) throw new Error(dados.erro);
  if (Array.isArray(dados)) return dados;
  if (dados && Array.isArray(dados.arquivos)) return dados.arquivos;
  return [];
}

/* Apaga um arquivo do Drive pelo ID que a API retornou. */
async function deletarArquivo(id) {
  if (!_rompexDriveConfigurado()) {
    throw new Error('Integração com Google Drive não configurada.');
  }
  if (!id) throw new Error('ID do arquivo não informado.');
  const url = _montarUrl({ acao: 'deletar', id: id });

  const resposta = await fetch(url, { method: 'GET' });
  if (!resposta.ok) {
    throw new Error('Falha ao deletar (HTTP ' + resposta.status + ').');
  }
  const dados = await resposta.json();
  if (dados && dados.erro) throw new Error(dados.erro);
  return dados;
}

/* Testa se o Apps Script está respondendo. Não lança erro — apenas resolve
   com um objeto sinalizando online/offline. Útil para badge de status. */
async function testarConexao() {
  if (!_rompexDriveConfigurado()) {
    return { status: 'offline', motivo: 'URL da API não configurada.' };
  }
  try {
    const resposta = await fetch(ROMPEX_DRIVE_API_URL, { method: 'GET' });
    if (!resposta.ok) return { status: 'offline', motivo: 'HTTP ' + resposta.status };
    const dados = await resposta.json().catch(function() { return null; });
    if (dados && dados.status) return dados;
    return { status: 'online' };
  } catch (err) {
    return { status: 'offline', motivo: err.message || 'Falha de rede.' };
  }
}

/* Converte bytes em string legível (B / KB / MB / GB). */
function formatarTamanho(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace('.0', '') + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1).replace('.0', '') + ' MB';
  return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/* Retorna emoji que representa o tipo MIME do arquivo. */
function getIconePorTipo(mimeType) {
  const m = String(mimeType || '').toLowerCase();
  if (m.indexOf('pdf') >= 0) return '📕';
  if (m.indexOf('image/') === 0) return '🖼️';
  if (m.indexOf('spreadsheet') >= 0 || m.indexOf('excel') >= 0 || m.indexOf('csv') >= 0) return '📊';
  if (m.indexOf('word') >= 0 || m.indexOf('document') >= 0 || m.indexOf('text/') === 0) return '📝';
  if (m.indexOf('presentation') >= 0 || m.indexOf('powerpoint') >= 0) return '📽️';
  if (m.indexOf('zip') >= 0 || m.indexOf('rar') >= 0 || m.indexOf('compressed') >= 0) return '🗜️';
  if (m.indexOf('video/') === 0) return '🎬';
  if (m.indexOf('audio/') === 0) return '🎵';
  return '📄';
}

/* Expor explicitamente no escopo global para uso pelos módulos HTML.
   Sem isso, em alguns ambientes os "function declarations" no topo do arquivo
   já estão em window, mas deixamos explícito para clareza/manutenção. */
window.ROMPEX_DRIVE_API_URL = ROMPEX_DRIVE_API_URL;
window.ROMPEX_DRIVE_SUBPASTAS = ROMPEX_DRIVE_SUBPASTAS;
window.uploadArquivo = uploadArquivo;
window.listarArquivos = listarArquivos;
window.deletarArquivo = deletarArquivo;
window.testarConexao = testarConexao;
window.formatarTamanho = formatarTamanho;
window.getIconePorTipo = getIconePorTipo;
