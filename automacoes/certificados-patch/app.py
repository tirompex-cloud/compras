"""
Sistema de Certificados ROMPEX - VERSÃO LIMPA E CORRIGIDA
Servidor Flask com sistema multi-usuário
Correções: API /api/listar_todos adicionada, código duplicado removido
"""

import os
import csv
import io
from datetime import datetime
from flask import (Flask, render_template, request, jsonify, send_file,
                   redirect, url_for, abort, session)
from functools import wraps
import secrets

# ========== INTEGRAÇÃO INTRANET ROMPEX ==========
# CORS = autorização técnica para a Intranet (outro site) poder se comunicar
# com este Sistema de Certificados. Sem isso, o navegador bloqueia.
try:
    from flask_cors import CORS
except ImportError:
    CORS = None
# ================================================

import database as db
from gerador_pdf import gerar_certificado_pdf, OUTPUT_DIR
import auth

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# ========== INTEGRAÇÃO INTRANET ROMPEX ==========
# Origens autorizadas a fazer login automático aqui.
# Configurada via variável de ambiente INTRANET_ORIGINS no Render
# (separadas por vírgula). Default cobre dev local.
_origins_env = os.environ.get('INTRANET_ORIGINS', '')
INTRANET_ORIGINS = [o.strip() for o in _origins_env.split(',') if o.strip()]
if not INTRANET_ORIGINS:
    INTRANET_ORIGINS = ['http://localhost:8000', 'http://127.0.0.1:8000']

if CORS is not None:
    CORS(app, supports_credentials=True, origins=INTRANET_ORIGINS)

# Cookie da sessão precisa ser "cross-site" para a sessão criada via
# /api/sso/login persistir quando o usuário abre a nova aba.
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

# Chave secreta para o botão "Sincronizar usuários" da Intranet.
# Defina no Render como variável SYNC_SECRET (qualquer texto longo).
SYNC_SECRET = os.environ.get('SYNC_SECRET', '')
# ================================================

# Configurações
BASE_URL = os.environ.get('BASE_URL', 'http://localhost:5000')

# Inicializa o banco
db.init_db()
db.migrar_sistema_renovacao()
auth.init_users_table()
auth.add_user_id_to_certificates()


# ========== DECORATORS DE AUTENTICAÇÃO ==========

def login_required(f):
    """Requer que usuário esteja logado"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Requer que usuário seja admin - Desabilitado para intranet"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Sem verificação de autenticação - sistema para intranet
        return f(*args, **kwargs)
    return decorated_function

def permission_required(permission):
    """Requer permissão específica - Desabilitado para intranet"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Sem verificação de autenticação - sistema para intranet
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ========== AUTENTICAÇÃO ==========

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Login no sistema"""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        user = auth.authenticate_user(username, password)
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['nome_completo'] = user['nome_completo']
            session['role'] = user['role']
            
            try:
                auth.log_action(user['id'], user['username'], 'login',
                              details='Login realizado',
                              ip_address=request.remote_addr)
            except:
                pass  # Log falhou, mas continua
            
            return redirect(url_for('index'))
        else:
            return render_template('login_multi.html', erro='Usuário ou senha incorretos')
    
    return render_template('login_multi.html')

@app.route('/logout', methods=['GET', 'POST'])
def logout():
    """Logout do sistema"""
    if 'user_id' in session:
        try:
            auth.log_action(session['user_id'], session['username'], 'logout',
                           ip_address=request.remote_addr)
        except:
            pass  # Log falhou, mas continua
    session.clear()
    return redirect(url_for('login'))


# ========== FUNÇÕES HELPER ==========

def get_user_id_or_default():
    """Retorna user_id da sessão ou um ID padrão para intranet"""
    if 'user_id' in session:
        return session['user_id']
    # Usuário padrão para intranet (sem login)
    return 1

def get_username_or_default():
    """Retorna username da sessão ou um nome padrão para intranet"""
    if 'username' in session:
        return session['username']
    return 'INTRANET'

def render_page(template_name):
    """Renderiza apenas o conteúdo da página (sem header) se for AJAX"""
    if request.args.get('ajax') == '1':
        # Renderiza o template normalmente, mas o template vai ignorar o base.html
        return render_template(template_name, ajax=True)
    return render_template(template_name)


# ========== PÁGINAS ADMINISTRATIVAS ==========

@app.route('/')
def index():
    """Página de emissão de certificados"""
    return render_page('index.html')


@app.route('/consultar')
def consultar():
    """Página de consulta"""
    return render_page('consultar.html')


@app.route('/renovacoes')
def renovacoes():
    """Página de renovações"""
    return render_page('renovacoes.html')


@app.route('/usuarios')
@login_required
@admin_required
def usuarios():
    """Gerenciamento de usuários (apenas admin)"""
    return render_template('usuarios.html')


@app.route('/historico')
@login_required
@admin_required
def historico():
    """Histórico de ações (apenas admin)"""
    return render_template('historico.html')


@app.route('/perfil')
@login_required
def perfil():
    """Perfil do usuário"""
    return render_template('perfil.html')


@app.route('/admin_verify', methods=['GET', 'POST'])
@login_required
def admin_verify():
    """Verificação de senha admin"""
    if request.method == 'POST':
        admin_password = request.form.get('admin_password', '')
        
        # Verifica senha do próprio usuário
        user = auth.authenticate_user(session['username'], admin_password)
        
        if user and user['role'] == 'admin':
            session['admin_verified'] = True
            return redirect(url_for('usuarios'))
        else:
            return render_template('admin_verify.html', erro='Senha incorreta ou sem permissão')
    
    return render_template('admin_verify.html')


# ========== API - EMISSÃO ==========

@app.route('/api/emitir', methods=['POST'])
@permission_required('emitir')
def api_emitir():
    """Emite certificados"""
    try:
        dados = request.json
        user_id = get_user_id_or_default()
        user = auth.get_user_by_id(user_id) if user_id != 1 else {'id': 1, 'username': 'INTRANET'}
        
        # Valida campos obrigatórios
        campos_obrigatorios = ['data_treinamento', 'data_emissao', 'tipo_curso', 
                               'instrutor', 'local_treinamento', 'participantes']
        for campo in campos_obrigatorios:
            if not dados.get(campo):
                return jsonify({'erro': f'Campo obrigatório: {campo}'}), 400
        
        if not dados['participantes']:
            return jsonify({'erro': 'Adicione pelo menos um participante'}), 400
        
        # Cria treinamento
        treinamento_id = db.criar_treinamento(
            data_treinamento=dados['data_treinamento'],
            data_emissao=dados['data_emissao'],
            tipo_curso=dados['tipo_curso'],
            instrutor=dados['instrutor'],
            local_treinamento=dados.get('local_treinamento', 'Local padrão'),
            local_emissao=dados.get('local_emissao'),
            carga_horaria=dados.get('carga_horaria', 8),
            conteudo_teorico=dados.get('conteudo_teorico'),
            conteudo_pratico=dados.get('conteudo_pratico'),
            empresa=dados.get('empresa')
        )
        
        # Calcula validade
        data_validade = db.calcular_validade(dados['data_treinamento'], dados['tipo_curso'])
        
        certificados_gerados = []
        
        for p in dados['participantes']:
            nome = p.get('nome', '').strip()
            cpf = p.get('cpf', '').strip()
            cargo = p.get('cargo', '').strip()
            
            if not nome or not cpf:
                continue
            
            # Cria certificado
            cert_id, numero, codigo = db.criar_certificado(
                treinamento_id, nome, cpf, cargo, data_validade,
                user_id=user['id'], username=user['username']
            )
            
            # Monta dados para PDF
            dados_pdf = {
                'numero_certificado': numero,
                'codigo_validacao': codigo,
                'nome': nome,
                'cpf': cpf,
                'cargo': cargo,
                'tipo_curso': dados['tipo_curso'],
                'instrutor': dados['instrutor'],
                'local_treinamento': dados.get('local_treinamento', 'Local padrão'),
                'data_treinamento': dados['data_treinamento'],
                'data_emissao': dados['data_emissao'],
                'local_emissao': dados.get('local_emissao', 'Faz Mumbuca, Zona Rural, Santo Antonio do Monte'),
                'carga_horaria': dados.get('carga_horaria', 8),
                'conteudo_teorico': dados.get('conteudo_teorico'),
                'conteudo_pratico': dados.get('conteudo_pratico'),
            }
            
            # Gera PDF
            cpf_limpo = cpf.replace('.', '').replace('-', '')
            pdf_filename = f"{numero}_{cpf_limpo}.pdf"
            pdf_path = os.path.join(OUTPUT_DIR, pdf_filename)
            
            url_validacao = f"{BASE_URL}/c/{codigo}"
            gerar_certificado_pdf(dados_pdf, pdf_path, url_validacao)
            
            # Atualiza path no banco
            db.atualizar_pdf_path(cert_id, pdf_path)
            
            certificados_gerados.append({
                'id': cert_id,
                'numero': numero,
                'codigo': codigo,
                'nome': nome,
                'cpf': cpf,
                'pdf_url': f"/api/baixar/{cert_id}",
                'validacao_url': url_validacao
            })
        
        # Log de ação
        if user:
            try:
                auth.log_action(user['id'], user['username'], 'certificado_emitido',
                               details=f'{len(certificados_gerados)} certificados emitidos',
                               ip_address=request.remote_addr)
            except:
                pass  # Log falhou, mas continua
        
        return jsonify({
            'sucesso': True,
            'certificados_emitidos': len(certificados_gerados),
            'certificados': certificados_gerados
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


# ========== API - CONSULTA (CORRIGIDO!) ==========

@app.route('/api/listar_todos')
def api_listar_todos():
    """Lista TODOS os certificados - API QUE ESTAVA FALTANDO!"""
    try:
        # Busca todos os certificados
        certificados = db.buscar_certificados(limit=10000)
        
        # Processa cada certificado para adicionar campos úteis
        for cert in certificados:
            # Verifica se está vencido
            if cert.get('data_validade'):
                data_validade = datetime.strptime(cert['data_validade'], '%Y-%m-%d').date()
                hoje = datetime.now().date()
                
                if data_validade < hoje and cert['status'] != 'revogado':
                    cert['status'] = 'vencido'
            
            # Mapeia campos do banco para nomes esperados pelo frontend
            cert['nome'] = cert.get('participante_nome', '')
            cert['cpf'] = cert.get('participante_cpf', '')
            cert['codigo'] = cert.get('codigo_validacao', '')
        
        return jsonify({'certificados': certificados})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


@app.route('/api/consultar')
def api_consultar():
    """Busca certificado por termo (código ou CPF)"""
    termo = request.args.get('termo', '').strip()
    
    if not termo:
        return jsonify({'erro': 'Informe um termo de busca'}), 400
    
    # Tenta buscar por código ou CPF
    results = db.buscar_certificados(codigo=termo, limit=1)
    if not results:
        results = db.buscar_certificados(cpf=termo, limit=10)
    
    if not results:
        return jsonify({'erro': 'Certificado não encontrado'}), 404
    
    return jsonify({'certificados': results})


@app.route('/api/buscar')
def api_buscar():
    """Busca geral de certificados (por número, CPF, nome ou data)"""
    termo = request.args.get('termo', '').strip()
    
    if not termo:
        return jsonify({'erro': 'Informe um termo de busca'}), 400
    
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Busca em múltiplos campos
        cursor.execute("""
            SELECT * FROM certificados 
            WHERE numero_certificado LIKE ? 
            OR codigo_validacao LIKE ?
            OR participante_cpf LIKE ?
            OR participante_nome LIKE ?
            OR data_treinamento LIKE ?
            OR data_validade LIKE ?
            ORDER BY id DESC
            LIMIT 50
        """, (f'%{termo}%', f'%{termo}%', f'%{termo}%', f'%{termo}%', f'%{termo}%', f'%{termo}%'))
        
        rows = cursor.fetchall()
        conn.close()
        
        certificados = [dict(row) for row in rows]
        
        return jsonify({'certificados': certificados})
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


@app.route('/api/estatisticas')
def api_estatisticas():
    """Retorna estatísticas do sistema - APENAS certificado mais recente por CPF"""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # TOTAL GERADOS = TODOS os certificados já emitidos (histórico completo)
        cursor.execute("SELECT COUNT(*) as total FROM certificados")
        total = cursor.fetchone()['total']
        
        # Ativos (último certificado ativo de cada CPF)
        cursor.execute("""
            SELECT COUNT(*) as ativos FROM (
                SELECT c.participante_cpf 
                FROM certificados c
                INNER JOIN (
                    SELECT participante_cpf, MAX(id) as max_id
                    FROM certificados
                    GROUP BY participante_cpf
                ) latest ON c.participante_cpf = latest.participante_cpf AND c.id = latest.max_id
                WHERE c.status = 'ativo'
                AND c.data_validade >= date('now')
                AND c.motivo_revogacao IS NULL
            )
        """)
        ativos = cursor.fetchone()['ativos']
        
        # Vencidos (último certificado vencido de cada CPF)
        cursor.execute("""
            SELECT COUNT(*) as vencidos FROM (
                SELECT c.participante_cpf 
                FROM certificados c
                INNER JOIN (
                    SELECT participante_cpf, MAX(id) as max_id
                    FROM certificados
                    GROUP BY participante_cpf
                ) latest ON c.participante_cpf = latest.participante_cpf AND c.id = latest.max_id
                WHERE c.data_validade < date('now')
                AND c.status != 'revogado'
                AND (c.motivo_revogacao IS NULL OR c.motivo_revogacao != 'INATIVADO_MANUAL')
            )
        """)
        vencidos = cursor.fetchone()['vencidos']
        
        # A renovar (próximos 30 dias)
        cursor.execute("""
            SELECT COUNT(*) as a_renovar FROM (
                SELECT c.participante_cpf 
                FROM certificados c
                INNER JOIN (
                    SELECT participante_cpf, MAX(id) as max_id
                    FROM certificados
                    WHERE status = 'ativo'
                    AND motivo_revogacao IS NULL
                    GROUP BY participante_cpf
                ) latest ON c.participante_cpf = latest.participante_cpf AND c.id = latest.max_id
                WHERE c.data_validade BETWEEN date('now') AND date('now', '+30 days')
            )
        """)
        a_renovar = cursor.fetchone()['a_renovar']
        
        conn.close()
        
        return jsonify({
            'total': total,
            'ativos': ativos,
            'vencidos': vencidos,
            'a_renovar': a_renovar
        })
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


@app.route('/api/baixar/<int:cert_id>')
def api_baixar(cert_id):
    """Download do PDF"""
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pdf_path, participante_nome, numero_certificado 
        FROM certificados 
        WHERE id = ?
    """, (cert_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row or not row['pdf_path'] or not os.path.exists(row['pdf_path']):
        abort(404)
    
    nome_arquivo = f"{row['numero_certificado']} - {row['participante_nome']}.pdf"

    return send_file(row['pdf_path'], as_attachment=True, download_name=nome_arquivo)


@app.route('/preview/<int:cert_id>')
def preview_certificado(cert_id):
    """Visualizar PDF do certificado inline (sem download)"""
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pdf_path, participante_nome, numero_certificado
        FROM certificados
        WHERE id = ?
    """, (cert_id,))
    row = cursor.fetchone()
    conn.close()

    if not row or not row['pdf_path'] or not os.path.exists(row['pdf_path']):
        abort(404)

    # Retorna o PDF para visualizar inline no navegador (sem download)
    return send_file(row['pdf_path'], mimetype='application/pdf')


# ========== API - RENOVAÇÕES ==========

@app.route('/api/renovacoes')
def api_renovacoes():
    """Retorna certificados para renovação"""
    try:
        # A vencer
        a_vencer = db.certificados_a_vencer()
        
        # Vencidos naturais (por data)
        vencidos = db.certificados_vencidos_naturais()
        
        # Inativos (manualmente)
        inativos = db.certificados_inativos()
        
        return jsonify({
            'a_vencer': a_vencer,
            'vencidos': vencidos,
            'inativos': inativos
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


# ========== ROTAS ADICIONAIS PARA O FRONTEND DE RENOVAÇÕES ==========

@app.route('/api/renovacoes/listar')
def api_renovacoes_listar():
    """Lista certificados a vencer dentro de N dias (usado por renovacoes.html)"""
    try:
        dias = request.args.get('dias', 30, type=int)
        
        # Calcula diretamente com SQL - APENAS O CERTIFICADO MAIS RECENTE POR CPF
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Busca certificados ativos que vencem nos próximos N dias
        # Subconsulta: pega apenas o ID do certificado mais recente (maior ID) para cada CPF
        cursor.execute("""
            SELECT c.* FROM certificados c
            INNER JOIN (
                SELECT participante_cpf, MAX(id) as max_id
                FROM certificados
                WHERE status = 'ativo' 
                AND motivo_revogacao IS NULL
                GROUP BY participante_cpf
            ) latest ON c.participante_cpf = latest.participante_cpf AND c.id = latest.max_id
            WHERE c.data_validade BETWEEN date('now') AND date('now', '+' || ? || ' days')
            ORDER BY c.data_validade ASC
        """, (dias,))
        
        rows = cursor.fetchall()
        conn.close()
        
        certificados = [dict(row) for row in rows]
        
        return jsonify({'certificados': certificados})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


@app.route('/api/vencidos-naturais')
def api_vencidos_naturais():
    """Lista certificados vencidos por data (usado por renovacoes.html)"""
    try:
        # Calcula diretamente com SQL - APENAS O CERTIFICADO MAIS RECENTE POR CPF
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Busca certificados que venceram por data (não inativados manualmente)
        # Subconsulta: pega apenas o ID do certificado mais recente para cada CPF
        cursor.execute("""
            SELECT c.* FROM certificados c
            INNER JOIN (
                SELECT participante_cpf, MAX(id) as max_id
                FROM certificados
                WHERE status != 'revogado'
                AND (motivo_revogacao IS NULL OR motivo_revogacao != 'INATIVADO_MANUAL')
                GROUP BY participante_cpf
            ) latest ON c.participante_cpf = latest.participante_cpf AND c.id = latest.max_id
            WHERE c.data_validade < date('now')
            ORDER BY c.data_validade DESC
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        certificados = [dict(row) for row in rows]
        
        return jsonify({'certificados': certificados})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


@app.route('/api/inativos')
def api_inativos():
    """Lista certificados inativados manualmente (usado por renovacoes.html)"""
    try:
        # Calcula diretamente com SQL
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Busca certificados inativados manualmente
        cursor.execute("""
            SELECT * FROM certificados 
            WHERE motivo_revogacao = 'INATIVADO_MANUAL'
        """)
        
        rows = cursor.fetchall()
        conn.close()
        
        certificados = [dict(row) for row in rows]
        
        print(f"DEBUG: Encontrados {len(certificados)} certificados inativos")
        
        return jsonify({'certificados': certificados})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


@app.route('/api/inativar', methods=['POST'])
@permission_required('emitir')
def api_inativar_body():
    """Inativa certificado recebendo ID no body (usado por renovacoes.html)"""
    try:
        dados = request.json or {}
        cert_id = dados.get('id')
        if not cert_id:
            return jsonify({'erro': 'ID não informado'}), 400
        
        user = auth.get_user_by_id(get_user_id_or_default())
        db.inativar_certificado(cert_id, user_id=user['id'])
        
        try:
            auth.log_action(user['id'], user['username'], 'certificado_inativado',
                           details=f'Certificado {cert_id} inativado',
                           ip_address=request.remote_addr)
        except:
            pass  # Log falhou, mas continua
        
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/api/reativar', methods=['POST'])
@permission_required('emitir')
def api_reativar_body():
    """Reativa certificado recebendo ID no body (usado por renovacoes.html)"""
    try:
        dados = request.json or {}
        cert_id = dados.get('id')
        if not cert_id:
            return jsonify({'erro': 'ID não informado'}), 400
        
        db.reativar_certificado_direto(cert_id)
        
        user = auth.get_user_by_id(get_user_id_or_default())
        try:
            auth.log_action(user['id'], user['username'], 'certificado_reativado',
                           details=f'Certificado {cert_id} reativado',
                           ip_address=request.remote_addr)
        except:
            pass  # Log falhou, mas continua
        
        return jsonify({'sucesso': True})
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/api/renovacoes/dados/<int:cert_id>')
def api_renovacoes_dados(cert_id):
    """Retorna dados completos de um certificado para pré-preencher renovação"""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Buscar certificado COM dados do treinamento (JOIN)
        cursor.execute("""
            SELECT 
                c.*,
                t.empresa,
                t.instrutor,
                t.tipo_curso,
                t.local_treinamento,
                t.carga_horaria,
                t.conteudo_teorico,
                t.conteudo_pratico
            FROM certificados c
            LEFT JOIN treinamentos t ON c.treinamento_id = t.id
            WHERE c.id = ?
        """, (cert_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'success': False, 'erro': 'Certificado não encontrado'}), 404
        
        cert = dict(row)
        
        # Debug
        print(f"DEBUG: Dados do certificado {cert_id}:")
        print(f"  - Empresa: {cert.get('empresa')}")
        print(f"  - Instrutor: {cert.get('instrutor')}")
        print(f"  - Tipo Curso: {cert.get('tipo_curso')}")
        
        return jsonify({'success': True, 'certificado': cert})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'erro': str(e)}), 500


@app.route('/api/renovar/<int:cert_id>', methods=['POST'])
@permission_required('emitir')
def api_renovar(cert_id):
    """Renova um certificado"""
    try:
        novo_cert_id = db.renovar_certificado(cert_id)
        
        if novo_cert_id:
            # Log
            user = auth.get_user_by_id(get_user_id_or_default())
            try:
                auth.log_action(user['id'], user['username'], 'certificado_renovado',
                               details=f'Certificado {cert_id} renovado',
                               ip_address=request.remote_addr)
            except:
                pass  # Log falhou, mas continua
            
            return jsonify({'sucesso': True, 'novo_id': novo_cert_id})
        else:
            return jsonify({'erro': 'Erro ao renovar'}), 500
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/api/inativar/<int:cert_id>', methods=['POST'])
@permission_required('emitir')
def api_inativar(cert_id):
    """Inativa um certificado manualmente"""
    try:
        user = auth.get_user_by_id(get_user_id_or_default())
        db.inativar_certificado(cert_id, user_id=user['id'])
        
        try:
            auth.log_action(user['id'], user['username'], 'certificado_inativado',
                           details=f'Certificado {cert_id} inativado',
                           ip_address=request.remote_addr)
        except:
            pass  # Log falhou, mas continua
        
        return jsonify({'sucesso': True})
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/api/reativar/<int:cert_id>', methods=['POST'])
@permission_required('emitir')
def api_reativar(cert_id):
    """Reativa um certificado inativo"""
    try:
        db.reativar_certificado_direto(cert_id)
        
        user = auth.get_user_by_id(get_user_id_or_default())
        try:
            auth.log_action(user['id'], user['username'], 'certificado_reativado',
                           details=f'Certificado {cert_id} reativado',
                           ip_address=request.remote_addr)
        except:
            pass  # Log falhou, mas continua
        
        return jsonify({'sucesso': True})
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


# ========== API - USUÁRIOS ==========

@app.route('/api/usuarios')
@admin_required
def api_usuarios():
    """Lista todos os usuários"""
    users = auth.list_users()
    return jsonify({'usuarios': users})


@app.route('/api/usuarios/criar', methods=['POST'])
@login_required
@admin_required
def api_criar_usuario():
    """Cria novo usuário"""
    try:
        dados = request.json
        user = auth.get_user_by_id(get_user_id_or_default())
        
        print(f"DEBUG: Criando usuário com dados: {dados}")
        
        try:
            # Tenta criar com criado_por
            sucesso = auth.create_user(
                username=dados['username'],
                password=dados['password'],
                nome_completo=dados['nome_completo'],
                role=dados['role'],
                permissoes=dados.get('permissoes', 'consultar'),
                criado_por=user['id']
            )
        except TypeError as e:
            # Se der erro de parâmetro, tenta sem criado_por
            print(f"DEBUG: Tentando sem criado_por. Erro: {e}")
            sucesso = auth.create_user(
                username=dados['username'],
                password=dados['password'],
                nome_completo=dados['nome_completo'],
                role=dados['role'],
                permissoes=dados.get('permissoes', 'consultar')
            )
        
        if sucesso:
            try:
                auth.log_action(user['id'], user['username'], 'usuario_criado',
                               details=f'Usuário {dados["username"]} criado',
                               ip_address=request.remote_addr)
            except:
                pass  # Log falhou, mas continua
            return jsonify({'sucesso': True})
        else:
            return jsonify({'erro': 'Username já existe'}), 400
    
    except Exception as e:
        import traceback
        print("DEBUG: Erro ao criar usuário:")
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


@app.route('/api/usuarios/<int:user_id>', methods=['PUT'])
@login_required
@admin_required
def api_editar_usuario(user_id):
    """Edita usuário"""
    try:
        dados = request.json
        current_user = auth.get_user_by_id(get_user_id_or_default())
        
        auth.update_user(
            user_id=user_id,
            nome_completo=dados.get('nome_completo'),
            role=dados.get('role'),
            permissoes=dados.get('permissoes'),
            ativo=dados.get('ativo')
        )
        
        try:
            auth.log_action(current_user['id'], current_user['username'], 'usuario_editado',
                           details=f'Usuário {user_id} editado',
                           ip_address=request.remote_addr)
        except:
            pass  # Log falhou, mas continua
        
        return jsonify({'sucesso': True})
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/api/usuarios/<int:user_id>', methods=['DELETE'])
@login_required
@admin_required
def api_excluir_usuario(user_id):
    """Exclui usuário"""
    try:
        current_user = auth.get_user_by_id(get_user_id_or_default())
        
        # Não permite excluir a si mesmo
        if user_id == current_user['id']:
            return jsonify({'erro': 'Você não pode excluir sua própria conta'}), 400
        
        # Buscar dados do usuário antes de excluir (para o log)
        user_to_delete = auth.get_user_by_id(user_id)
        if not user_to_delete:
            return jsonify({'erro': 'Usuário não encontrado'}), 404
        
        # Excluir usuário diretamente do banco
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        
        try:
            auth.log_action(current_user['id'], current_user['username'], 'usuario_excluido',
                           details=f'Usuário {user_to_delete["username"]} (ID {user_id}) excluído',
                           ip_address=request.remote_addr)
        except:
            pass  # Log falhou, mas continua
        
        return jsonify({'sucesso': True})
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/api/alterar-senha', methods=['POST'])
@login_required
def api_alterar_senha():
    """Altera senha do próprio usuário"""
    try:
        dados = request.json
        user = auth.get_user_by_id(get_user_id_or_default())
        
        # Verifica senha atual
        if not auth.verify_password(dados['current_password'], user['password_hash']):
            return jsonify({'erro': 'Senha atual incorreta'}), 400
        
        # Altera senha
        auth.change_password(user['id'], dados['new_password'])
        
        try:
            auth.log_action(user['id'], user['username'], 'senha_alterada',
                           ip_address=request.remote_addr)
        except:
            pass  # Log falhou, mas continua
        
        return jsonify({'sucesso': True})
    
    except Exception as e:
        return jsonify({'erro': str(e)}), 500


@app.route('/api/historico')
@login_required
@admin_required
def api_historico():
    """Retorna histórico de ações"""
    logs = auth.get_action_log(limit=500)
    return jsonify(logs)


@app.route('/api/historico/<int:user_id>')
@login_required
def api_historico_usuario(user_id):
    """Retorna histórico de um usuário específico"""
    # Usuário pode ver apenas seu próprio histórico, admin vê todos
    user = auth.get_user_by_id(session['user_id'])
    
    if user['role'] != 'admin' and user['id'] != user_id:
        return jsonify({'erro': 'Acesso negado'}), 403
    
    logs = auth.get_action_log(user_id=user_id, limit=100)
    return jsonify(logs)


# ========== API - ADMIN (AÇÕES PERIGOSAS) ==========

@app.route('/api/admin/excluir-todos', methods=['POST'])
@login_required
@admin_required
def api_excluir_todos():
    """Reseta o sistema: exclui TODOS certificados e treinamentos"""
    try:
        dados = request.json
        current_user = auth.get_user_by_id(get_user_id_or_default())
        
        # Verifica senha do admin
        senha_admin = dados.get('admin_password', '')
        if not auth.verify_password(senha_admin, current_user['password_hash']):
            return jsonify({'erro': 'Senha incorreta'}), 403
        
        # Verifica confirmação
        confirmacao = dados.get('confirmacao', '')
        if confirmacao != 'EXCLUIR TUDO':
            return jsonify({'erro': 'Confirmação inválida'}), 400
        
        # Exclui TUDO
        conn = db.get_connection()
        cursor = conn.cursor()
        
        # Conta quantos registros serão excluídos
        cursor.execute("SELECT COUNT(*) as total FROM certificados")
        total_certs = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM treinamentos")
        total_trein = cursor.fetchone()['total']
        
        # Exclui certificados
        cursor.execute("DELETE FROM certificados")
        
        # Exclui treinamentos
        cursor.execute("DELETE FROM treinamentos")
        
        conn.commit()
        conn.close()
        
        # Log da ação
        try:
            auth.log_action(current_user['id'], current_user['username'], 'sistema_resetado',
                           details=f'Sistema resetado: {total_certs} certificados e {total_trein} treinamentos excluídos',
                           ip_address=request.remote_addr)
        except:
            pass  # Log falhou, mas continua
        
        return jsonify({
            'sucesso': True,
            'certificados_excluidos': total_certs,
            'treinamentos_excluidos': total_trein
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'erro': str(e)}), 500


# ========== VALIDAÇÃO PÚBLICA (SEM LOGIN) ==========

@app.route('/c/<codigo>')
def validar(codigo):
    """Página pública de validação via QR Code"""
    codigo = codigo.upper().strip()
    
    # Registra consulta
    ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    user_agent = request.headers.get('User-Agent', '')
    
    cert = db.buscar_por_codigo(codigo)
    
    if not cert:
        db.registrar_consulta(codigo, ip, user_agent, 'nao_encontrado')
        return render_template('validar.html', encontrado=False, codigo=codigo)
    
    # Verifica status
    hoje = datetime.now().date()
    data_validade = datetime.strptime(cert['data_validade'], '%Y-%m-%d').date()
    expirado = data_validade < hoje
    
    if cert.get('motivo_revogacao') == 'INATIVADO_MANUAL':
        resultado = 'inativo'
    elif cert['status'] == 'revogado':
        resultado = 'revogado'
    elif expirado:
        resultado = 'expirado'
    else:
        resultado = 'valido'
    
    db.registrar_consulta(codigo, ip, user_agent, resultado)
    
    # Formata datas
    def formatar_data_br(data_str):
        if not data_str or len(data_str) < 10:
            return data_str
        partes = data_str[:10].split('-')
        if len(partes) == 3:
            return f"{partes[2]}/{partes[1]}/{partes[0]}"
        return data_str
    
    # Mascara dados sensíveis
    cert_publico = {
        'numero_certificado': cert['numero_certificado'],
        'codigo_validacao': cert['codigo_validacao'],
        'nome_mascarado': db.mascarar_nome(cert['participante_nome']),
        'cpf_mascarado': db.mascarar_cpf(cert['participante_cpf']),
        'cargo': cert.get('cargo', ''),
        'data_treinamento': cert['data_treinamento'],
        'data_treinamento_br': formatar_data_br(cert['data_treinamento']),
        'tipo_curso': cert['tipo_curso'],
        'instrutor': cert['instrutor'],
        'data_validade': cert['data_validade'],
        'data_validade_br': formatar_data_br(cert['data_validade']),
        'data_emissao': formatar_data_br(cert.get('emitido_em', '')),
        'carga_horaria': cert.get('carga_horaria', 8),
        'status': cert['status'],
        'resultado': resultado,
        'expirado': expirado
    }

    return render_template('validar.html', encontrado=True, cert=cert_publico, codigo=codigo)


@app.route('/validar', methods=['GET', 'POST'])
def validar_form():
    """Formulário público para validação manual"""
    if request.method == 'POST':
        codigo = request.form.get('codigo', '').upper().strip()
        if codigo:
            return redirect(url_for('validar', codigo=codigo))
    return render_template('validar_form.html')


# ========== INTEGRAÇÃO COM INTRANET ROMPEX ==========
# Esses 2 caminhos permitem que a Intranet (compras-theta-seven.vercel.app)
# faça login automático e sincronize usuários neste sistema.

@app.route('/api/sso/login', methods=['POST', 'OPTIONS'])
def api_sso_login():
    """Recebe usuário+senha da Intranet, valida no banco daqui,
    cria a sessão e devolve OK. A Intranet então abre / em nova aba
    e o usuário entra direto, sem digitar nada."""
    if request.method == 'OPTIONS':
        return ('', 204)

    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    senha = data.get('senha') or data.get('password') or ''

    if not username or not senha:
        return jsonify({'ok': False, 'erro': 'Credenciais ausentes'}), 400

    user = auth.authenticate_user(username, senha)
    if not user:
        return jsonify({'ok': False, 'erro': 'Usuário não cadastrado neste sistema'}), 401

    session.permanent = True
    session['user_id'] = user['id']
    session['username'] = user['username']
    session['nome_completo'] = user['nome_completo']
    session['role'] = user['role']

    try:
        auth.log_action(user['id'], user['username'], 'sso_login',
                        details='Login via Intranet Rompex',
                        ip_address=request.remote_addr)
    except Exception:
        pass

    return jsonify({
        'ok': True,
        'usuario': user['username'],
        'nome': user['nome_completo'],
        'redirect': '/'
    })


@app.route('/api/sso/sync', methods=['POST', 'OPTIONS'])
def api_sso_sync():
    """Recebe a lista completa de usuários da Intranet e replica aqui.
    Protegido pela chave SYNC_SECRET (envia no header X-Sync-Key).
    Usuários novos são criados; existentes têm senha/nome/role atualizados."""
    if request.method == 'OPTIONS':
        return ('', 204)

    if not SYNC_SECRET:
        return jsonify({'ok': False,
                        'erro': 'Sincronização desativada (defina SYNC_SECRET no servidor)'}), 503

    if request.headers.get('X-Sync-Key', '') != SYNC_SECRET:
        return jsonify({'ok': False, 'erro': 'Chave de sincronização inválida'}), 401

    data = request.get_json(silent=True) or {}
    usuarios = data.get('usuarios') or []

    import sqlite3
    criados = 0
    atualizados = 0
    erros = []

    for u in usuarios:
        username = (u.get('username') or '').strip()
        senha = u.get('senha') or ''
        nome = u.get('nome') or username
        perfil = (u.get('perfil') or 'operador').lower()
        # Quem é admin na Intranet vira admin aqui; o resto vira operador.
        role = 'admin' if perfil == 'admin' else 'operador'

        if not username or not senha:
            erros.append(f'{username or "?"}: dados incompletos')
            continue

        try:
            conn = sqlite3.connect(auth.DB_FILE)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute('SELECT id FROM users WHERE username = ?', (username,))
            row = c.fetchone()
            existente = row['id'] if row else None
            conn.close()
        except Exception as e:
            erros.append(f'{username}: erro de leitura ({e})')
            continue

        try:
            if existente:
                auth.change_password(existente, senha)
                auth.update_user(existente, nome_completo=nome, role=role, ativo=1)
                atualizados += 1
            else:
                ok = auth.create_user(username, senha, nome, role, 'all', 1)
                if ok:
                    criados += 1
                else:
                    erros.append(f'{username}: falha ao criar')
        except Exception as e:
            erros.append(f'{username}: {e}')

    return jsonify({
        'ok': True,
        'criados': criados,
        'atualizados': atualizados,
        'erros': erros,
        'total': len(usuarios)
    })


# ========== HEALTHCHECK ==========

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})


# ========== INICIA O SERVIDOR ==========

if __name__ == '__main__':
    print(f"\n{'='*60}")
    print(f"🚀 Sistema ROMPEX iniciado com sucesso!")
    print(f"{'='*60}")
    print(f"✓ Banco de dados OK")
    print(f"✓ Autenticação desabilitada (INTRANET)")
    print(f"✓ Acesse: http://localhost:5000")
    print(f"{'='*60}\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
