/* ============================================
   ROMPEX Intranet - Responsividade JS
   Cria botao hamburguer + overlay automaticamente
   ============================================ */
(function(){
  function init(){
    const sidebar = document.querySelector('.sidebar');
    const topbar = document.querySelector('.topbar');
    if (!sidebar || !topbar) return;
    if (document.querySelector('.mobile-menu-btn')) return; // ja inicializado

    // Botao hamburguer
    const btn = document.createElement('button');
    btn.className = 'mobile-menu-btn';
    btn.setAttribute('aria-label','Abrir menu');
    btn.setAttribute('type','button');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    topbar.insertBefore(btn, topbar.firstChild);

    // Overlay
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    function open(){
      sidebar.classList.add('open');
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function close(){
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    function toggle(){
      if (sidebar.classList.contains('open')) close(); else open();
    }

    btn.addEventListener('click', function(e){
      e.stopPropagation();
      toggle();
    });
    overlay.addEventListener('click', close);

    // Fecha ao clicar em qualquer link de navegacao (so em mobile)
    sidebar.querySelectorAll('a.nav-item').forEach(function(a){
      a.addEventListener('click', function(){
        if (window.innerWidth <= 1024) close();
      });
    });

    // Fecha ao redimensionar pra desktop
    window.addEventListener('resize', function(){
      if (window.innerWidth > 1024) close();
    });

    // ESC fecha
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && sidebar.classList.contains('open')) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
