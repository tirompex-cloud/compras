# Stakeholders — Cadastro de Clientes e Fornecedores

**Data:** 2026-06-10
**Status:** Design aprovado, aguardando implementação
**Autor:** Thiago Morais + Claude Opus 4.7
**Projeto:** ROMPEX intranet (`compras/`)

---

## 1. Contexto

A ROMPEX intranet hoje não tem cadastro de clientes nem fornecedores. O campo "Fornecedor" no módulo Compras é texto livre, o que gera:

- Inconsistência (mesmo fornecedor escrito de jeitos diferentes em compras distintas)
- Sem agregação confiável por fornecedor em relatórios
- Toda compra exige redigitar o nome do fornecedor
- Sem cadastro de clientes, futuras emissões de NF/cobranças vão precisar dessa base

Este spec define um novo módulo **Stakeholders** que cadastra clientes e fornecedores (ambos PF/PJ), com integração imediata no módulo Compras (autocompletar + auto-vincular pela IA).

Foundation que destrava 3 sub-projetos seguintes do roadmap: Produtos+Estoque, Fiscal (import NF), Compras com aprovação.

## 2. Decisões de design

| Decisão | Escolha | Motivo |
|---|---|---|
| Escopo MVP | Clientes + Fornecedores ao mesmo tempo | Usuário priorizou ambos |
| Cliente também é fornecedor? | Raro, aceita duplicação | Usuário aceitou cadastrar 2x em caso raro |
| Fornecedor PF? | Sim, suporta PF e PJ | Pra prestadores autônomos / freelas |
| Modelo de dados | 2 tabelas separadas (clientes, fornecedores) | FK direta de compras.fornecedor_id; UI mais clara |
| Endereço | Estruturado completo + ViaCEP | Permite filtros geográficos e auto-fill |
| Soft delete | Sim (`ativo boolean`) | Cliente/fornecedor referenciado em FK não pode ser hard-deletado |
| Campos obrigatórios | Apenas `nome` e `documento` | Usuário simplificou — resto é opcional |
| Auth nas Edge Functions | Anon key + Service Role server-side | Consistência com padrão `compras` |

## 3. Modelo de dados (Postgres / Supabase)

### 3.1 Tabela `clientes`

```sql
create table public.clientes (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  ativo           boolean not null default true,

  tipo_pessoa     text not null check (tipo_pessoa in ('PF','PJ')),

  -- Display + identificação
  nome            text not null,
  documento       text not null,            -- só dígitos: CPF (11) ou CNPJ (14)

  -- Contato
  telefone        text,
  email           text,

  -- Endereço (auto-preenchido via ViaCEP)
  cep             text,
  logradouro      text,
  numero          text,
  complemento     text,
  bairro          text,
  cidade          text,
  uf              char(2),
  pais            text default 'BR',

  -- PJ-specific (null quando PF)
  razao_social        text,
  nome_fantasia       text,
  inscricao_estadual  text,
  inscricao_municipal text,
  regime_tributario   text check (
    regime_tributario in ('MEI','Simples Nacional','Lucro Presumido','Lucro Real','Isento')
    or regime_tributario is null
  )
);
```

### 3.2 Tabela `fornecedores`

Estrutura idêntica:

```sql
create table public.fornecedores (like public.clientes including all);
```

### 3.3 Indexes e Constraints

```sql
-- Busca rápida por nome (autocomplete do combobox em compras)
create index clientes_nome_idx     on public.clientes     (nome);
create index fornecedores_nome_idx on public.fornecedores (nome);

-- Filtro por tipo (com partial index sobre ativos)
create index clientes_tipo_idx     on public.clientes     (tipo_pessoa) where ativo;
create index fornecedores_tipo_idx on public.fornecedores (tipo_pessoa) where ativo;

-- Documento único entre ativos (permite cadastrar de novo se foi desativado)
create unique index clientes_documento_unique     on public.clientes     (documento) where ativo;
create unique index fornecedores_documento_unique on public.fornecedores (documento) where ativo;

-- RLS habilitado (acesso só via Edge Function com SERVICE_ROLE)
alter table public.clientes     enable row level security;
alter table public.fornecedores enable row level security;
```

### 3.4 Alteração em `compras`

```sql
alter table public.compras
  add column fornecedor_id uuid references public.fornecedores(id);
```

A coluna `fornecedor` (text) é mantida pra compatibilidade com lançamentos antigos e como fallback quando não há vínculo (texto livre).

## 4. Edge Functions

Convenção mantida do compras: `ACTION-RESOURCE`.

| Function | Method | Body | Retorna |
|---|---|---|---|
| `listar-clientes` | POST | `{search?, tipo_pessoa?, ativo?, limit?, offset?}` | `{ok, clientes: [], total}` |
| `salvar-cliente` | POST | `{id?, ...dados}` — id presente = update; ausente = insert | `{ok, cliente: {}}` |
| `listar-fornecedores` | POST | mesmo padrão | `{ok, fornecedores: [], total}` |
| `salvar-fornecedor` | POST | mesmo padrão | `{ok, fornecedor: {}}` |

Atualização da function existente:

- `salvar-compra` aceita `fornecedor_id` opcional adicional ao `fornecedor` (texto). Salva os dois.

### 4.1 Validações no backend

Antes de qualquer query:

- `tipo_pessoa` ∈ {'PF', 'PJ'} (já tem CHECK no Postgres, validação adicional pra mensagem de erro clara)
- `nome` obrigatório, mín 2 chars
- `documento` obrigatório, deve casar regex:
  - PF: `^\d{11}$`
  - PJ: `^\d{14}$`
- `uf` se preenchido: 2 letras maiúsculas
- `cep` se preenchido: 8 dígitos
- `email` se preenchido: regex de email
- Erro retorna `{error: '...', campo: '...', mensagem: '...'}` com status 400

Erros de constraint do Postgres (23505 unique violation, etc) traduzidos pra mensagens amigáveis com status 409.

### 4.2 Soft delete

Não há function dedicada. Frontend chama `salvar-cliente` com `{id, ativo: false}`. O update preserva a row e seta `updated_at = now()`.

## 5. Frontend (`modulos/stakeholders.html`)

### 5.1 Layout geral

Page header padrão + tab pills (Clientes | Fornecedores) + toolbar (busca + filtro PF/PJ + botão "+ Novo") + tabela responsiva.

### 5.2 Colunas da tabela

| Tipo (pill PF/PJ) | Nome (com nome_fantasia se PJ tiver) | Documento (formatado) | Cidade/UF | Telefone ou Email | Ações ⋮ |

Ações por linha:
- **Editar**: abre modal pré-preenchido
- **Desativar**: `rxConfirm` → atualiza `ativo=false` → some da view (filtro padrão é ativo)

Filtro opcional pra ver desativados também.

### 5.3 Formulário (modal centrado)

Estrutura por seções verticais (toggle PF/PJ no topo):

1. **Identificação**: nome*, documento* (máscara dinâmica)
2. **PJ-only block** (some quando PF): razão social, nome fantasia, IE, IM, regime tributário
3. **Contato**: telefone, email
4. **Endereço**: CEP (com botão buscar via ViaCEP) → logradouro, número, complemento, bairro, cidade, UF, país

Botões: Cancelar | Salvar (gradient verde, igual ao padrão compras)

### 5.4 Comportamentos JS

| Evento | Ação |
|---|---|
| Toggle PF↔PJ | Mostra/esconde block PJ; aplica máscara correta no documento; limpa fields irrelevantes |
| Digitar `nome` quando PJ | Espelha em `razao_social` automaticamente (não sobrescreve se usuário já editou manualmente) |
| Documento | Máscara `999.999.999-99` (PF) ou `99.999.999/9999-99` (PJ) |
| CEP 8 dígitos | Fetch `viacep.com.br/ws/{cep}/json/` → preenche logradouro, bairro, cidade, UF |
| Salvar | Valida client-side → POST salvar-X → toast → fecha modal → re-fetch lista |
| Editar | Abre modal com dados preencidos. `id` no body do salvar = update |
| Desativar | `rxConfirm` (dangerous) → POST salvar com `{id, ativo: false}` → re-lista |

### 5.5 Sincronização

Igual ao padrão compras: cache em `localStorage` (key `rompex_clientes` e `rompex_fornecedores`), sync ao abrir página chamando `listar-X` e mergeando.

### 5.6 Sidebar navigation

Item novo nos 12 sidebars (dashboard + 11 módulos): "👥 Stakeholders" → `modulos/stakeholders.html`. Aplicado via script Python tipo o `_aplicar_modulos.py`.

## 6. Integração com Compras

### 6.1 Combobox de fornecedor

Campo `Fornecedor` no form de compras muda de `<input type="text">` para combobox custom:

- Input com debounce 300ms chamando `listar-fornecedores?search=X&limit=10`
- Dropdown mostra resultados + separador + item "+ Cadastrar '...' como novo fornecedor"
- Click em resultado: preenche nome visível + UUID em hidden field
- Click em "Cadastrar novo": abre modal Stakeholders pré-preenchido → ao salvar, seleciona automaticamente
- Tab/Enter sem clicar: se busca casa exatamente, seleciona; senão fica como texto livre sem UUID

### 6.2 Auto-vinculação via OCR

Após Claude OCR extrair `fornecedor: "X"`:

```
1. Chama listar-fornecedores?search=X&limit=3
2. Se match exato (case-insensitive): preenche tudo + UUID → status "✨ Fornecedor 'X' vinculado"
3. Senão se 1 candidato próximo: pré-seleciona + status "✨ Achei 'Y' — confirme se é"
4. Senão: deixa texto + dropdown aberto com "+ Cadastrar 'X' como novo fornecedor"
```

### 6.3 Backend `salvar-compra` (atualização)

Payload aceita campo adicional opcional:

```ts
{
  ...campos existentes,
  fornecedor: string | null,        // texto (compat)
  fornecedor_id: string | null,     // UUID (novo)
}
```

Insert salva ambos. Mudança não quebra fluxo atual.

### 6.4 Migração opcional dos dados antigos

Depois de cadastrar fornecedores, opcionalmente roda no SQL Editor:

```sql
update public.compras c
   set fornecedor_id = f.id
  from public.fornecedores f
 where c.fornecedor_id is null
   and lower(trim(c.fornecedor)) = lower(trim(f.nome))
   and f.ativo;
```

Vincula compras antigas por casamento exato de nome. Resto fica como texto livre (vínculo manual posterior fora de escopo).

## 7. Rollout

Em ordem, com deploy gate entre cada passo:

1. **SQL Migration** (usuário roda em SQL Editor)
2. **Edge Functions** (4 novas + update da `salvar-compra`, usuário deploya)
3. **Frontend novo** (eu crio `modulos/stakeholders.html`, sidebar nav, commit + push)
4. **Frontend update Compras** (combobox + OCR auto-link, commit + push)
5. **Testes manuais** (usuário valida)
6. **Migração opcional** dos textos antigos pra FK

## 8. Error handling

| Cenário | Tratamento |
|---|---|
| CPF/CNPJ inválido | Edge Function 400 → `rxAlert('CPF/CNPJ inválido', 'error')` |
| Documento duplicado (constraint 23505) | Edge Function 409 → `rxAlert('Já existe um cadastro ativo com esse CNPJ/CPF', 'warning')` |
| Falha de rede | `rxAlert('Falha de rede, tente de novo', 'error')` + dados ficam no form |
| ViaCEP timeout / CEP inexistente | Falha silenciosa, campos endereço ficam em branco pra preenchimento manual |
| Hard delete tentativa | Não suportado. Só soft delete via `ativo=false` |
| Sync com Supabase falha ao abrir | Igual compras: cache local + log no console + retry no próximo open |

## 9. Estados visuais UX

- **Empty state**: ícone + "Nenhum cliente cadastrado ainda" + botão "+ Cadastrar primeiro cliente"
- **Loading**: skeleton rows na tabela durante fetch
- **Linha inativa**: opacity 0.5 + badge cinza "inativo" (visível só com filtro "incluir inativos")
- **Toast sucesso**: `rxAlert('Cliente salvo', 'success')` após save bem-sucedido
- **Modal scroll**: max-height 90vh com scroll interno se conteúdo passar (PJ tem muitos fields)

## 10. Fora de escopo (v2)

Pra manter MVP enxuto:

- Upload de logo / foto da entidade
- Múltiplos contatos (telefone/email) por entidade
- Histórico de alterações / audit log
- Filtros avançados (regime tributário, região, etc)
- Export CSV/Excel da lista
- Importação em massa via planilha
- Categorias de fornecedor (matéria-prima, transportadora, etc)
- Cliente PJ vincular múltiplos endereços (matriz + filiais)
- Limite de crédito / condições de pagamento

Cada item pode virar seu próprio spec quando necessário. Nenhum bloqueia o MVP.

## 11. Dependências e bloqueios

- **Foundation pra**: Produtos+Estoque (próximo sub-projeto), Fiscal (import NF), Compras com aprovação
- **Não bloqueia**: Avisos, Documentos, Financeiro, Usuários, Certificados, Meu Perfil, Atualizações (módulos independentes)
- **Stack já no ar**: Supabase (Storage, Postgres, Edge Functions) — sem nova infra
