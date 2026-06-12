/* =============================================================================
   ROMPEX • SPA Router (Etapa 2 — Opcao C)
   -----------------------------------------------------------------------------
   Hash-based router que troca apenas o conteudo central do dashboard.html
   (o "shell"). A sidebar e o usuario-card ficam fixos.

   Arquitetura:
     - O shell tem #view-home (conteudo padrao da dashboard) e #module-host
       (alvo desta JS), ambos com classe .view e CSS:
         .view{display:none} / .view.active{display:block}
     - Quando location.hash === '#<nome>' e <nome> esta no registro MODULES,
       carregamos o fragment correspondente em #module-host.
     - Hash vazio (#) ou hash desconhecido => mostra #view-home.

   Estrategia de execucao de script (ver tambem comentario no unmountCurrent):
     innerHTML='<script>...</script>' NAO executa nada. Por isso fazemos
     fetch + DOMParser, extraimos os <script>, e recriamos cada um via
     document.createElement('script') + .textContent + appendChild.
     Script appendado dessa forma executa no escopo GLOBAL.

     Para a 2a visita ao mesmo modulo funcionar sem "Identifier already
     declared", o JS de cada modulo PRECISA estar envolvido em IIFE — assim
     const/let/class ficam dentro do closure, e a IIFE simplesmente roda
     dentro de uma nova funcao a cada visita.

     O que o modulo expor via "window.X = X" pra handlers inline (onclick=)
     a gente limpa via window.__moduleCleanup que o proprio modulo registra.
     Listeners em document/window e setIntervals tambem entram nessa lista.
   ============================================================================= */

(function(){
  'use strict';

  /* ===== Registro de modulos convertidos a fragmento =====
     Adicione novos modulos a medida que forem convertidos. Modulos nao
     listados aqui continuam funcionando como paginas standalone. */
  var MODULES = {
    'stakeholders': 'modulos/stakeholders.html',
    /* 'compras': 'modulos/compras.html',  // commit futuro */
  };

  function moduleFromHash() {
    var h = location.hash || '';
    if (h.charAt(0) === '#') h = h.slice(1);
    return h || null;
  }

  function refs() {
    return {
      host: document.getElementById('module-host'),
      home: document.getElementById('view-home'),
    };
  }

  function updateSidebarActive(name) {
    document.querySelectorAll('.sidebar [data-module-link]').forEach(function(el){
      el.classList.toggle('active', el.getAttribute('data-module-link') === name);
    });
  }

  /* =============================================================================
     unmountCurrent — desmonta o modulo atual antes de carregar o proximo.

     IMPORTANTE: remover <script> do DOM NAO desfaz as declaracoes globais que
     ele criou. Por isso TODO JS de modulo DEVE estar envelopado em IIFE — assim
     const/let/class ficam dentro do closure (somem com o GC quando ninguem
     referencia mais).

     O que ainda escapa via "window.X = X" (publics expostos pros onclick=) a
     gente limpa via __moduleCleanup que cada modulo registra. Listeners
     attachados em document/window e setIntervals tambem entram nessa lista.
     ============================================================================= */
  function unmountCurrent() {
    if (window.__moduleCleanup && window.__moduleCleanup.length) {
      window.__moduleCleanup.forEach(function(fn){
        try { fn(); } catch (e) { console.warn('[router] cleanup error:', e); }
      });
    }
    window.__moduleCleanup = [];

    /* remove TODOS os <style>/<script>/etc marcados com data-module do document */
    document.querySelectorAll('[data-module]').forEach(function(el){
      el.remove();
    });

    var r = refs();
    if (r.host) {
      r.host.innerHTML = '';
      r.host.removeAttribute('data-module');
    }
  }

  function showHome() {
    unmountCurrent();
    var r = refs();
    if (!r.host || !r.home) return;
    r.host.classList.remove('active');
    r.home.classList.add('active');
    updateSidebarActive(null);
    document.title = 'ROMPEX Intranet • Dashboard';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function loadModule(name) {
    var path = MODULES[name];
    if (!path) {
      console.warn('[router] modulo nao registrado:', name);
      showHome();
      return;
    }

    var r = refs();
    if (!r.host || !r.home) {
      console.warn('[router] esta pagina nao eh um shell SPA (sem #module-host / #view-home).');
      return;
    }

    /* desmonta anterior antes de pedir o proximo */
    unmountCurrent();

    var html;
    try {
      var resp = await fetch(path, { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      html = await resp.text();
    } catch (err) {
      console.error('[router] falha ao buscar fragmento:', path, err);
      r.host.innerHTML = errorBoxHTML(name, path, err.message || String(err));
      r.home.classList.remove('active');
      r.host.classList.add('active');
      r.host.dataset.module = '__error__';
      return;
    }

    var doc = new DOMParser().parseFromString(html, 'text/html');

    /* extracao: estilos do head + body, topbar, main, scripts inline */
    var styles  = doc.querySelectorAll('head style, body style');
    var topbar  = doc.querySelector('header.topbar');
    var mainEl  = doc.querySelector('main');
    var scripts = Array.from(doc.querySelectorAll('script')).filter(function(s){
      return !s.src;  /* externos (auth.js, theme.js, compras-config.js) ja estao no shell */
    });
    var titleEl = doc.querySelector('title');

    /* marca host como detendo este modulo */
    r.host.dataset.module = name;

    /* 1) styles — clone marcado com data-module pro unmount achar */
    styles.forEach(function(s){
      var c = s.cloneNode(true);
      c.setAttribute('data-module', name);
      r.host.appendChild(c);
    });

    /* 2) topbar */
    if (topbar) {
      var tb = topbar.cloneNode(true);
      tb.setAttribute('data-module', name);
      r.host.appendChild(tb);
    }

    /* 3) main */
    if (mainEl) {
      var mn = mainEl.cloneNode(true);
      mn.setAttribute('data-module', name);
      r.host.appendChild(mn);
    }

    /* 4) scripts — recriar via createElement pra executar.
       Script clonado por cloneNode NAO executa (mesma "raiz" do innerHTML).
       Por isso instanciamos novo Element manualmente. */
    scripts.forEach(function(s){
      var sc = document.createElement('script');
      sc.setAttribute('data-module', name);
      sc.textContent = s.textContent;
      r.host.appendChild(sc);
    });

    /* alterna views, sidebar e title */
    r.home.classList.remove('active');
    r.host.classList.add('active');
    updateSidebarActive(name);
    if (titleEl && titleEl.textContent) document.title = titleEl.textContent;

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function errorBoxHTML(name, path, msg) {
    return '<div style="padding:48px 28px;text-align:center;color:var(--ink-3, #6B7A93)">' +
      '<h3 style="margin:0 0 8px;color:var(--ink, #0B1426);font-family:Inter,sans-serif">' +
        'Falha ao carregar o módulo "' + escHtml(name) + '"' +
      '</h3>' +
      '<p style="margin:0 0 4px;font-family:Inter,sans-serif">' +
        'Caminho: <code>' + escHtml(path) + '</code>' +
      '</p>' +
      '<p style="margin:0 0 18px;font-size:12.5px;font-family:Inter,sans-serif;color:#EF4444">' +
        escHtml(msg) +
      '</p>' +
      '<button onclick="location.hash=&quot;&quot;" style="padding:9px 16px;border-radius:10px;border:1px solid var(--border, #E2E8F0);background:var(--surface, #fff);color:var(--ink-2, #3B4A63);cursor:pointer;font-family:Inter,sans-serif">' +
        'Voltar ao painel' +
      '</button>' +
    '</div>';
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function handleRoute() {
    var name = moduleFromHash();
    if (name && MODULES[name]) loadModule(name);
    else showHome();
  }

  /* ===== init ===== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleRoute);
  } else {
    handleRoute();
  }
  window.addEventListener('hashchange', handleRoute);

  /* ===== api pequena pra debug e composicao ===== */
  window.RompexRouter = {
    navigate: function(name){ location.hash = name ? '#' + name : ''; },
    refresh: handleRoute,
    register: function(name, path){ MODULES[name] = path; },
    listRegistered: function(){ return Object.assign({}, MODULES); },
  };
})();
