// ========== SISTEMA DE AUTENTICAÇÃO ROMPEX ==========

// Definição de permissões por perfil
const PERMISSOES = {
  admin: ['compras', 'financeiro', 'estoque', 'rh', 'documentos', 'usuarios', 'config', 'avisos'],
  compras: ['compras', 'documentos'],
  financeiro: ['financeiro', 'compras', 'documentos'],
  estoque: ['estoque', 'compras', 'documentos'],
  rh: ['rh', 'documentos']
};

// Usuários do sistema (sincronizado com localStorage)
function obterUsuarios() {
  try {
    return JSON.parse(localStorage.getItem('rompex_usuarios') || '[]');
  } catch(e) {
    return [];
  }
}

// Inicializar usuários padrão se não existirem
function inicializarUsuarios() {
  const usuarios = obterUsuarios();
  if (usuarios.length === 0) {
    const usuariosPadrao = [
      {id:1, username:'admin', nome:'Administrador', senha:'admin123', perfil:'admin', modulos:['compras','financeiro','estoque','rh','documentos','usuarios'], ativo:true},
      {id:2, username:'compras', nome:'Usuário Compras', senha:'compras123', perfil:'compras', modulos:['compras'], ativo:true},
      {id:3, username:'financeiro', nome:'Usuário Financeiro', senha:'fin123', perfil:'financeiro', modulos:['financeiro','compras'], ativo:true}
    ];
    localStorage.setItem('rompex_usuarios', JSON.stringify(usuariosPadrao));
  }
}

// Função de login
function fazerLogin(username, senha) {
  inicializarUsuarios();
  const usuarios = obterUsuarios();
  const usuario = usuarios.find(u => u.username === username && u.senha === senha && u.ativo);
  
  if (usuario) {
    const sessao = {
      usuario: usuario.username,
      nome: usuario.nome,
      perfil: usuario.perfil,
      modulos: usuario.modulos,
      timestamp: new Date().getTime()
    };
    
    localStorage.setItem('sessao_rompex', JSON.stringify(sessao));
    return { sucesso: true };
  } else {
    return { sucesso: false, erro: 'Usuário ou senha incorretos' };
  }
}

// Função de logout
function fazerLogout() {
  localStorage.removeItem('sessao_rompex');
  window.location.href = window.location.href.includes('/modulos/') ? '../index.html' : 'index.html';
}

// Obter sessão atual
function obterSessao() {
  try {
    const sessao = localStorage.getItem('sessao_rompex');
    if (!sessao) return null;
    
    const dados = JSON.parse(sessao);
    const agora = new Date().getTime();
    const tempoDecorrido = agora - dados.timestamp;
    const TEMPO_SESSAO = 30 * 60 * 1000; // 30 minutos
    
    if (tempoDecorrido > TEMPO_SESSAO) {
      localStorage.removeItem('sessao_rompex');
      return null;
    }
    
    return dados;
  } catch(e) {
    return null;
  }
}

// Verificar autenticação
function verificarAutenticacao() {
  const sessao = obterSessao();
  if (!sessao) {
    const isInModulos = window.location.pathname.includes('/modulos/');
    window.location.href = isInModulos ? '../index.html' : 'index.html';
    return null;
  }
  return sessao;
}

// Verificar permissão para módulo específico
function temPermissao(modulo) {
  const sessao = obterSessao();
  if (!sessao) return false;
  
  // Admin tem acesso total
  if (sessao.perfil === 'admin') return true;
  
  // Verifica se o módulo está na lista de permissões do usuário
  return sessao.modulos && sessao.modulos.includes(modulo);
}

// Esconder itens do menu sem permissão
function aplicarPermissoesMenu() {
  const sessao = obterSessao();
  if (!sessao) return;
  
  // Se for admin, não precisa esconder nada
  if (sessao.perfil === 'admin') return;
  
  // Esconder módulos sem permissão
  document.querySelectorAll('.nav-item, .nav-submenu .nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (!href) return;
    
    // Mapear href para nome do módulo
    if (href.includes('compras.html') && !temPermissao('compras')) {
      item.style.display = 'none';
    }
    if (href.includes('financeiro.html') && !temPermissao('financeiro')) {
      item.style.display = 'none';
    }
    if (href.includes('documentos.html') && !temPermissao('documentos')) {
      item.style.display = 'none';
    }
    if (href.includes('usuarios.html') && !temPermissao('usuarios')) {
      item.style.display = 'none';
    }
    // O link de Avisos no menu Principal é público (qualquer usuário visualiza);
    // a versão de criação ("Lançar Avisos") fica em Configurações e é controlada
    // pelo texto abaixo, não pelo href.
  });

  // "Lançar Avisos" (criação) — esconder se não tem permissão.
  document.querySelectorAll('.nav-submenu .nav-item').forEach(item => {
    const text = item.textContent.trim();
    if (text === 'Lançar Avisos' && !temPermissao('avisos')) {
      item.style.display = 'none';
    }
  });
  
  // Esconder itens sem href mas com texto específico.
  // Mantemos as chaves internas antigas ('estoque'/'rh') para compatibilidade
  // com sessões/usuários já salvos no localStorage — só os rótulos mudaram.
  document.querySelectorAll('.nav-item').forEach(item => {
    const text = item.textContent.trim();
    if (text === 'Fiscal' && !temPermissao('estoque')) {
      item.style.display = 'none';
    }
    if (text === 'Técnicos' && !temPermissao('rh')) {
      item.style.display = 'none';
    }
    if (text === 'Configurações' && !temPermissao('config')) {
      item.style.display = 'none';
    }
  });
}

// Iniciar monitoramento de sessão
function iniciarMonitoramentoSessao() {
  setInterval(() => {
    const sessao = obterSessao();
    if (!sessao) {
      alert('⚠️ Sua sessão expirou. Faça login novamente.');
      fazerLogout();
    }
  }, 60000); // Verifica a cada 1 minuto
}

// Aplicar permissões quando a página carregar
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(aplicarPermissoesMenu, 100);
  });
}
