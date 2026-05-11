# 🏢 Rompex Intranet

Sistema modular de gestão empresarial desenvolvido para a Rompex.

## 🎨 Identidade Visual

- **Verde Principal**: `#208C4F` (RGB 32, 140, 79)
- **Verde Escuro**: `#186A3B`
- **Verde Claro**: `#D4EDDA`
- **Azul Corporativo**: `#364559` (RGB 54, 69, 89)

## 📦 Estrutura de Arquivos

```
rompex-intranet/
├── index.html              # Tela de login
├── dashboard.html          # Painel principal
├── auth.js                 # Sistema de autenticação
├── logo-rompex.png         # Logo principal
├── favicon.png             # Ícone do site
└── modulos/
    ├── compras.html        # Módulo Compras/Suprimentos
    └── financeiro.html     # Módulo Financeiro
```

## 🚀 Como Publicar no GitHub Pages

### 1. Criar Repositório no GitHub

1. Acesse: https://github.com/tirompex-cloud
2. Clique em **"New repository"**
3. Nome: `intranet` (ou outro nome de sua preferência)
4. Visibilidade: **Public** (necessário para GitHub Pages gratuito)
5. Clique em **"Create repository"**

### 2. Upload dos Arquivos

**Opção A - Via Interface Web (mais fácil):**

1. No repositório criado, clique em **"Add file" → "Upload files"**
2. Arraste todos os arquivos:
   - `index.html`
   - `dashboard.html`
   - `auth.js`
   - `logo-rompex.png`
   - `favicon.png`
3. Clique em **"Create new file"** para criar a pasta `modulos/`
4. Digite `modulos/compras.html` e cole o conteúdo
5. Repita para `modulos/financeiro.html`
6. Clique em **"Commit changes"**

**Opção B - Via Git (linha de comando):**

```bash
git clone https://github.com/tirompex-cloud/intranet.git
cd intranet
# Copie todos os arquivos para esta pasta
git add .
git commit -m "Adicionar sistema de intranet"
git push origin main
```

### 3. Ativar GitHub Pages

1. No repositório, vá em **Settings**
2. Menu lateral: **Pages**
3. Em **"Source"**, selecione:
   - Branch: **main**
   - Folder: **/ (root)**
4. Clique em **"Save"**
5. Aguarde 2-3 minutos para o deploy

### 4. Acessar o Sistema

Seu site estará disponível em:
```
https://tirompex-cloud.github.io/intranet/
```

## 🔐 Usuários Padrão

| Usuário | Senha | Perfil | Acesso |
|---------|-------|--------|--------|
| `admin` | `admin123` | Admin | Todos os módulos |
| `compras` | `compras123` | Compras | Apenas Compras/Suprimentos |
| `financeiro` | `fin123` | Financeiro | Apenas Financeiro |

⚠️ **IMPORTANTE**: Altere as senhas padrão após o primeiro acesso!

## 🔧 Configuração

### Alterar Usuários e Senhas

Edite o arquivo `auth.js`, procure a variável `USUARIOS`:

```javascript
const USUARIOS = [
  {
    username: "admin",
    password: "SUA_SENHA_AQUI",
    perfil: "Admin",
    nome: "Administrador",
    avatar: "👤"
  },
  // Adicione mais usuários aqui...
];
```

### Adicionar Mais Perfis

Na mesma arquivo `auth.js`, edite `PERMISSOES`:

```javascript
const PERMISSOES = {
  "Admin": ["compras", "financeiro", "suprimentos", "comercial", "rh", "logistica"],
  "Compras": ["compras"],
  "Financeiro": ["financeiro"],
  "NovoSetor": ["modulo1", "modulo2"], // Adicione aqui
};
```

## 📱 Recursos Implementados

### ✅ Sistema de Login
- Autenticação por usuário/senha
- Sessão persistente (localStorage)
- Timeout automático (30 minutos)
- Log de acessos

### ✅ Dashboard Principal
- Menu lateral responsivo
- Informações do usuário em tempo real
- Relógio e data
- Métricas de uso

### ✅ Controle de Acesso
- Perfis hierárquicos
- Permissões por módulo
- Bloqueio visual de módulos não permitidos

### ✅ Módulos Base
- **Compras/Suprimentos**: Sistema completo de lançamentos (próxima integração)
- **Financeiro**: Estrutura pronta para desenvolvimento

## 🔒 Segurança

### GitHub Pages é Seguro?

**Sim**, para uso interno corporativo com as seguintes observações:

✅ **Adequado para:**
- Intranet de pequena/média empresa
- Dados não ultra-sensíveis
- Uso interno com link não divulgado

⚠️ **Não adequado para:**
- Dados bancários críticos
- Informações confidenciais de alto risco
- Sistemas expostos publicamente

### Melhorias de Segurança Recomendadas

1. **Link obscuro**: Use `/x7k2p9` ao invés de `/intranet`
2. **Senhas fortes**: Troque as senhas padrão imediatamente
3. **Timeout**: Já implementado (30 min de inatividade)
4. **Logs**: Sistema registra todos os acessos
5. **HTTPS**: GitHub Pages usa SSL automático

### Segurança Futura (opcional)

- Cloudflare Access (autenticação antes do site)
- Firebase Authentication
- Vercel com senha de ambiente
- Google OAuth para login corporativo

## 🌐 Usar Domínio Próprio

Para usar `intranet.rompex.com.br`:

1. No GitHub, vá em **Settings → Pages**
2. Em **"Custom domain"**, digite: `intranet.rompex.com.br`
3. No seu provedor de domínio (Registro.br, GoDaddy, etc), adicione:
   ```
   Tipo: CNAME
   Nome: intranet
   Valor: tirompex-cloud.github.io
   ```
4. Aguarde propagação DNS (até 24h)

## 📊 Próximas Implementações

### Fase 2 - Integração Sistema de Compras
- [ ] Migrar sistema atual completo para `modulos/compras.html`
- [ ] Testar leitura de IA
- [ ] Testar salvamento no Google Sheets
- [ ] Testar backup no GitHub Gist

### Fase 3 - Desenvolvimento Financeiro
- [ ] Dashboard com métricas
- [ ] Aprovação de compras
- [ ] Relatórios executivos
- [ ] Controle orçamentário

### Fase 4 - Novos Módulos
- [ ] RH - Gestão de pessoas
- [ ] Comercial - CRM e vendas
- [ ] Logística - Rastreamento
- [ ] Suprimentos - Estoque

### Fase 5 - PWA (App)
- [ ] Manifest.json
- [ ] Service Worker
- [ ] Instalar na tela inicial
- [ ] Funcionar offline

## 🆘 Suporte

### Problemas Comuns

**1. "Página não carrega"**
- Aguarde 3-5 minutos após commit
- Force refresh: `Ctrl + Shift + R`
- Verifique se GitHub Pages está ativo em Settings

**2. "Login não funciona"**
- Abra o Console (F12) e veja erros
- Verifique se `auth.js` foi carregado
- Limpe cache do navegador

**3. "Módulo não abre"**
- Verifique se o arquivo está na pasta `modulos/`
- Confira o caminho no `dashboard.html`
- Veja se o usuário tem permissão

**4. "Logo não aparece"**
- Confirme que `logo-rompex.png` está na raiz
- Verifique o nome do arquivo (case-sensitive)
- Limpe cache com `Ctrl + Shift + R`

## 📞 Contato

Desenvolvido internamente para Rompex
Versão: 1.0.0
Data: Maio 2026

---

**⭐ Lembre-se:**
- Faça backup regular do repositório
- Documente alterações importantes
- Teste em ambiente local antes de fazer commit
- Mantenha as senhas seguras e privadas
