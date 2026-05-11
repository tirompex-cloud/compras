// ========================================
// SISTEMA DE AUTENTICAÇÃO - INTRANET
// ========================================

// Base de usuários (em produção, isso viria de um backend)
const USUARIOS = [
  {
    username: "admin",
    password: "admin123",
    perfil: "Admin",
    nome: "Administrador",
    avatar: "👤"
  },
  {
    username: "compras",
    password: "compras123",
    perfil: "Compras",
    nome: "Setor de Compras",
    avatar: "🛒"
  },
  {
    username: "financeiro",
    password: "fin123",
    perfil: "Financeiro",
    nome: "Setor Financeiro",
    avatar: "💰"
  }
];

// Módulos disponíveis por perfil
const PERMISSOES = {
  "Admin": ["compras", "financeiro", "suprimentos", "comercial", "rh", "logistica"],
  "Compras": ["compras"],
  "Financeiro": ["financeiro"],
  "Suprimentos": ["compras", "suprimentos"],
  "Comercial": ["comercial"],
  "RH": ["rh"],
  "Logistica": ["logistica"]
};

// ========================================
// FUNÇÕES DE AUTENTICAÇÃO
// ========================================

function fazerLogin(username, password) {
  const usuario = USUARIOS.find(u => u.username === username && u.password === password);
  
  if (usuario) {
    const sessao = {
      username: usuario.username,
      nome: usuario.nome,
      perfil: usuario.perfil,
      avatar: usuario.avatar,
      loginTime: new Date().toISOString()
    };
    
    localStorage.setItem('sessao_intranet', JSON.stringify(sessao));
    registrarLog('login', usuario.username);
    return { sucesso: true, usuario: sessao };
  }
  
  return { sucesso: false, erro: 'Usuário ou senha inválidos' };
}

function fazerLogout() {
  const sessao = obterSessao();
  if (sessao) {
    registrarLog('logout', sessao.username);
  }
  localStorage.removeItem('sessao_intranet');
  window.location.href = 'index.html';
}

function obterSessao() {
  const sessaoStr = localStorage.getItem('sessao_intranet');
  if (!sessaoStr) return null;
  
  try {
    return JSON.parse(sessaoStr);
  } catch (e) {
    return null;
  }
}

function verificarAutenticacao() {
  const sessao = obterSessao();
  if (!sessao) {
    window.location.href = 'index.html';
    return null;
  }
  return sessao;
}

function temPermissao(modulo) {
  const sessao = obterSessao();
  if (!sessao) return false;
  
  const perms = PERMISSOES[sessao.perfil] || [];
  return perms.includes(modulo);
}

function obterModulosPermitidos() {
  const sessao = obterSessao();
  if (!sessao) return [];
  
  return PERMISSOES[sessao.perfil] || [];
}

// ========================================
// LOG DE ACESSOS
// ========================================

function registrarLog(acao, username) {
  const logs = JSON.parse(localStorage.getItem('logs_intranet') || '[]');
  
  logs.push({
    acao: acao,
    usuario: username,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  });
  
  // Manter apenas últimos 100 logs
  if (logs.length > 100) {
    logs.splice(0, logs.length - 100);
  }
  
  localStorage.setItem('logs_intranet', JSON.stringify(logs));
}

function obterLogs() {
  return JSON.parse(localStorage.getItem('logs_intranet') || '[]');
}

// ========================================
// TIMEOUT DE SESSÃO (30 minutos)
// ========================================

let timeoutId = null;

function iniciarMonitoramentoSessao() {
  // Limpar timeout anterior
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  
  // 30 minutos de inatividade
  const TIMEOUT = 30 * 60 * 1000;
  
  timeoutId = setTimeout(function() {
    alert('Sessão expirada por inatividade. Faça login novamente.');
    fazerLogout();
  }, TIMEOUT);
  
  // Resetar timeout em qualquer atividade
  document.addEventListener('click', resetarTimeout);
  document.addEventListener('keypress', resetarTimeout);
  document.addEventListener('mousemove', resetarTimeout);
}

function resetarTimeout() {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  iniciarMonitoramentoSessao();
}

// ========================================
// UTILITÁRIOS
// ========================================

function formatarDataHora(isoString) {
  const data = new Date(isoString);
  return data.toLocaleString('pt-BR');
}

function obterTempoSessao() {
  const sessao = obterSessao();
  if (!sessao || !sessao.loginTime) return '';
  
  const inicio = new Date(sessao.loginTime);
  const agora = new Date();
  const diff = Math.floor((agora - inicio) / 60000); // minutos
  
  if (diff < 60) {
    return diff + ' min';
  } else {
    const horas = Math.floor(diff / 60);
    const mins = diff % 60;
    return horas + 'h ' + mins + 'min';
  }
}
