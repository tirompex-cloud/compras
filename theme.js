/* =============================================================================
   ROMPEX • Toggle de tema (claro/escuro) + botão flutuante
   -----------------------------------------------------------------------------
   Como funciona:
   - A preferência fica em localStorage['rompex_theme'] = 'dark' | 'light'.
   - Aplicamos `data-theme="..."` no <html>; o CSS injetado abaixo usa esse
     atributo para sobrescrever as CSS vars de cada página (que estão em :root).
   - O botão flutua no canto inferior direito de toda página que carrega este
     script. O ícone alterna entre 🌙 (vai pro escuro) e ☀️ (vai pro claro).
   - A logo branca (logo-rompex-white.png) recebe filter:brightness(0) no modo
     claro — vira preta sólida, como o usuário pediu.

   IIFE com aplicação imediata para evitar "flash" de tema errado ao carregar.
   ============================================================================= */
(function() {
  'use strict';

  // -- 1. Aplica o tema o quanto antes (antes do DOM terminar de carregar) --
  var temaSalvo = localStorage.getItem('rompex_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', temaSalvo);

  // -- 2. Injeta CSS de override e estilo do botão --
  // Idempotente: se o script for incluído duas vezes, não duplica o <style>.
  if (!document.getElementById('rompex-theme-style')) {
    var css =
      /* Overrides do MODO CLARO. Especificidade html[attr] > :root, então vence. */
      'html[data-theme="light"]{' +
        '--bg-primary:#F1F5F9;' +
        '--bg-secondary:#FFFFFF;' +
        '--bg-tertiary:#F8FAFC;' +
        '--bg-card:#FFFFFF;' +
        '--text-primary:#0F172A;' +
        '--text-secondary:#475569;' +
        '--text-muted:#64748B;' +
        '--border:#E2E8F0;' +
        '--border-light:#CBD5E1;' +
        '--shadow:0 4px 24px rgba(15,23,42,0.08);' +
      '}' +
      /* Cor do body precisa de override explícito porque algumas páginas
         setam `background:var(--bg-primary)` direto, mas outras (login)
         usam gradiente. Aplica fundo claro com leve contraste. */
      'html[data-theme="light"] body{' +
        'background:#F1F5F9;color:#0F172A;' +
      '}' +
      /* A logo é PNG branca. No modo claro vira preta sólida. */
      'html[data-theme="light"] .logo-icon img{' +
        'filter:brightness(0);' +
      '}' +
      /* Inputs, selects e textareas precisam contraste no claro. */
      'html[data-theme="light"] input,html[data-theme="light"] select,html[data-theme="light"] textarea{' +
        'background:#FFFFFF;color:#0F172A;border-color:#CBD5E1;' +
      '}' +
      /* Scrollbar mais suave no claro. */
      'html[data-theme="light"] .sidebar-nav{scrollbar-color:#CBD5E1 transparent}' +
      /* ---- Botão flutuante (sempre presente, em ambos os temas) ---- */
      '#rompex-theme-toggle{' +
        'position:fixed;bottom:24px;right:24px;width:52px;height:52px;' +
        'border-radius:50%;border:none;cursor:pointer;z-index:9999;' +
        'background:linear-gradient(135deg,#10B981,#059669);color:#fff;' +
        'box-shadow:0 4px 16px rgba(16,185,129,0.4);' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-size:24px;line-height:1;padding:0;' +
        'transition:transform .25s ease,box-shadow .25s ease;' +
      '}' +
      '#rompex-theme-toggle:hover{' +
        'transform:scale(1.1) rotate(15deg);' +
        'box-shadow:0 6px 24px rgba(16,185,129,0.6);' +
      '}' +
      '#rompex-theme-toggle:active{transform:scale(0.95)}' +
      /* Em telas pequenas, fica um pouco menor pra não atrapalhar. */
      '@media(max-width:480px){#rompex-theme-toggle{width:44px;height:44px;bottom:16px;right:16px;font-size:20px}}';

    var style = document.createElement('style');
    style.id = 'rompex-theme-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // -- 3. Cria/atualiza o botão flutuante --
  function atualizarIcone(btn) {
    var atual = document.documentElement.getAttribute('data-theme');
    // Mostra o que será trocado: no escuro mostra ☀️ (vai pro claro), e vice-versa.
    btn.textContent = atual === 'light' ? '🌙' : '☀️';
    btn.setAttribute('aria-label', atual === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro');
    btn.title = btn.getAttribute('aria-label');
  }

  function criarBotao() {
    if (document.getElementById('rompex-theme-toggle')) return;
    if (!document.body) return; // ainda não disponível
    var btn = document.createElement('button');
    btn.id = 'rompex-theme-toggle';
    btn.type = 'button';
    atualizarIcone(btn);
    btn.addEventListener('click', function() {
      var atual = document.documentElement.getAttribute('data-theme') || 'dark';
      var proximo = atual === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', proximo);
      localStorage.setItem('rompex_theme', proximo);
      atualizarIcone(btn);
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', criarBotao);
  } else {
    criarBotao();
  }
})();
