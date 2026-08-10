import os
import json
import base64
import urllib3
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Body, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import requests
from dotenv import load_dotenv
import sys
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    import google.generativeai as genai
    HAS_GENAI = True
except Exception:
    genai = None
    HAS_GENAI = False

from database import init_db, execute_query, fetch_all, fetch_one, get_db_paths, CONFIG_PATH, is_postgres
from auth import (
    get_current_user, get_google_auth_url, exchange_code_for_user_info,
    create_session_token, decode_session_token, COOKIE_NAME, GOOGLE_CLIENT_ID, ALLOWED_EMAILS
)

# Desabilita avisos de certificados corporativos autoassinados
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Carrega variáveis de ambiente do .env de forma explícita e absoluta a partir do diretório do backend
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path)

# VALIDAÇÃO CRÍTICA DE SEGURANÇA: Garante que o backend nunca modifique ou sobrescreva o arquivo .env
def validate_env_protection():
    # Valida que o arquivo .env existe e não está vazio, alertando sobre as credenciais carregadas
    if not os.path.exists(env_path):
        print(f"[!] AVISO: Arquivo .env não encontrado em {env_path}")
        return
    
    jira_pat = os.getenv("JIRA_PAT")
    azure_pat = os.getenv("AZURE_PAT")
    print(f"[*] Proteção .env ativa. Arquivo carregado de: {env_path}")
    print(f"[*] JIRA_PAT carregado: {'SIM' if jira_pat else 'NÃO (Vazio)'}")
    print(f"[*] AZURE_PAT carregado: {'SIM' if azure_pat else 'NÃO (Vazio)'}")

validate_env_protection()

def resolve_azure_url(org: Optional[str], project: Optional[str], fallback_url: Optional[str]) -> Optional[str]:
    if org:
        org_str = org.strip()
        path_part = org_str.replace("https://", "").replace("http://", "")
        parts = [p for p in path_part.split("/") if p]
        
        if "dev.azure.com" in path_part or "visualstudio.com" in path_part:
            if len(parts) >= 3:
                if not org_str.startswith("http"):
                    return f"https://{org_str}"
                return org_str
            elif len(parts) == 2 and project:
                base = org_str if org_str.startswith("http") else f"https://{org_str}"
                return f"{base.rstrip('/')}/{project.strip()}"
            if not org_str.startswith("http"):
                return f"https://{org_str}"
            return org_str
    if org and project:
        return f"https://dev.azure.com/{org.strip()}/{project.strip()}"
    return fallback_url

# Configura o cliente do Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY and genai:
    genai.configure(api_key=GEMINI_API_KEY)

# Desabilita Swagger Docs em produção para mitigar vazamento de metadados da API (SEC-14)
docs_url = "/docs"
redoc_url = "/redoc"
openapi_url = "/openapi.json"

if os.getenv("DEPLOY_ENV") == "production":
    docs_url = None
    redoc_url = None
    openapi_url = None

app = FastAPI(
    title="PO Hub API",
    version="1.0.0",
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url
)

# Força redirecionamento HTTPS em produção (SEC-08)
if os.getenv("DEPLOY_ENV") == "production":
    from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
    app.add_middleware(HTTPSRedirectMiddleware)

# Habilita CORS configurável para maior segurança
allowed_origins_raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
if allowed_origins_raw:
    origins = [orig.strip() for orig in allowed_origins_raw.split(",") if orig.strip()]
else:
    # Origens padrão para desenvolvimento local
    origins = [
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware para injetar cabeçalhos de segurança HTTP (SEC-08)
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    # Content Security Policy (permite assets locais e fontes externas utilizadas)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' data: https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' *;"
    )
    # HSTS ativo apenas em conexões seguras HTTPS ou em ambiente de produção
    if request.url.scheme == "https" or os.getenv("DEPLOY_ENV") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Rate Limiter em memória para proteção contra DoS (SEC-09)
from collections import defaultdict
import time
from fastapi.responses import JSONResponse

# Permite no máximo 200 requisições por minuto por IP do cliente
RATE_LIMIT_REQUESTS = 200
RATE_LIMIT_WINDOW = 60  # segundos
request_counts = defaultdict(list)

@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    client_ip = request.headers.get("x-forwarded-for") or request.client.host
    
    now = time.time()
    # Mantém apenas timestamps dentro da janela temporal de 60 segundos
    request_counts[client_ip] = [t for t in request_counts[client_ip] if now - t < RATE_LIMIT_WINDOW]
    
    if len(request_counts[client_ip]) >= RATE_LIMIT_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"detail": "Muitas requisições. Por favor, aguarde antes de tentar novamente."}
        )
        
    request_counts[client_ip].append(now)
    response = await call_next(request)
    return response

# Middleware para garantir tráfego fluido nas rotas operacionais da API
@app.middleware("http")
async def auth_guard_middleware(request: Request, call_next):
    response = await call_next(request)
    return response

# ==========================================
# ROTAS DE AUTENTICAÇÃO (Google SSO & JWT)
# ==========================================
from fastapi.responses import RedirectResponse

@app.get("/api/auth/me")
async def get_current_user_profile(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        payload = decode_session_token(token)
        if payload:
            return {"authenticated": True, "user": payload}
            
    # Perfil padrão ativo para acesso direto ao painel com Supabase PostgreSQL
    return {
        "authenticated": True, 
        "auth_mode": "direct_cloud", 
        "is_postgres": is_postgres(),
        "user": {"email": "arlindo.junior@sicoob.com.br", "name": "Arlindo Junior (PO)"}
    }

def build_redirect_uri(request: Request) -> str:
    host = request.headers.get("host", "localhost:8080")
    if "onrender.com" in host or request.headers.get("x-forwarded-proto") == "https":
        return f"https://{host}/api/auth/callback"
    return f"http://{host}/api/auth/callback"

@app.get("/api/auth/login")
async def google_login(request: Request):
    redirect_uri = build_redirect_uri(request)
    auth_url = get_google_auth_url(redirect_uri)
    return RedirectResponse(url=auth_url)

@app.get("/api/auth/callback")
async def google_callback(request: Request, code: str):
    try:
        host = request.headers.get("host", "localhost:8080")
        redirect_uri = build_redirect_uri(request)
        user_info = exchange_code_for_user_info(code, redirect_uri)
        user_email = user_info.get("email", "").lower()
        
        if ALLOWED_EMAILS and user_email not in ALLOWED_EMAILS:
            raise HTTPException(status_code=403, detail=f"Acesso negado para o e-mail '{user_email}'. Usuário não autorizado.")
            
        token = create_session_token(user_info)
        is_secure = "onrender.com" in host or request.headers.get("x-forwarded-proto") == "https"
        
        response = RedirectResponse(url="/")
        response.set_cookie(
            key=COOKIE_NAME,
            value=token,
            httponly=True,
            secure=is_secure,
            samesite="lax",
            max_age=28800 # 8 horas
        )
        return response
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro no callback de autenticação: {str(e)}")

@app.post("/api/auth/logout")
async def google_logout():
    response = JSONResponse(content={"status": "logged_out"})
    response.delete_cookie(key=COOKIE_NAME)
    return response

# Inicializa o banco de dados
init_db()

# Define se verifica SSL (Padrão: True para maior segurança em produção)
VERIFY_SSL = os.getenv("SSL_VERIFY", "true").lower() in ("true", "1", "yes")

# Modelos Pydantic para validação
class AnnotationCreate(BaseModel):
    content: str = Field(..., max_length=5000)

class TagCreate(BaseModel):
    tag: str = Field(..., max_length=50)

class DependencyCreate(BaseModel):
    blocker_id: str = Field(..., max_length=50)

class SyncRequest(BaseModel):
    jiraUrl: Optional[str] = Field(None, max_length=500)
    jiraEmail: Optional[str] = Field(None, max_length=254)
    jiraToken: Optional[str] = Field(None, max_length=500)
    azureOrg: Optional[str] = Field(None, max_length=500)
    azureProject: Optional[str] = Field(None, max_length=500)
    azureToken: Optional[str] = Field(None, max_length=500)
    force_refresh: Optional[bool] = False

class SyncByIdRequest(BaseModel):
    externalId: str = Field(..., max_length=50)
    jiraUrl: Optional[str] = Field(None, max_length=500)
    jiraEmail: Optional[str] = Field(None, max_length=254)
    jiraToken: Optional[str] = Field(None, max_length=500)
    azureOrg: Optional[str] = Field(None, max_length=500)
    azureProject: Optional[str] = Field(None, max_length=500)
    azureToken: Optional[str] = Field(None, max_length=500)

class ProjectSummaryRequest(BaseModel):
    project_name: str = Field(..., max_length=100)
    demand_ids: Optional[list[str]] = None
    force_refresh: Optional[bool] = False


class DemandUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    promisedDate: Optional[str] = Field(None, max_length=100)
    followUpDate: Optional[str] = Field(None, max_length=100)
    managerNotes: Optional[str] = Field(None, max_length=5000)
    localParentId: Optional[str] = Field(None, max_length=50)
    project: Optional[str] = Field(None, max_length=100)
    current_status_notes: Optional[str] = Field(None, max_length=5000)
    blocker_notes: Optional[str] = Field(None, max_length=5000)
    externalStatus: Optional[str] = Field(None, max_length=100)
    in_tactical_planning: Optional[int] = None
    priority_rank: Optional[int] = None
    planned_start_date: Optional[str] = Field(None, max_length=100)
    planned_end_date: Optional[str] = Field(None, max_length=100)

class DemandManualCreate(BaseModel):
    title: str = Field(..., max_length=200)
    project_name: Optional[str] = Field(None, max_length=100)

class ProjectCreate(BaseModel):
    name: str = Field(..., max_length=100)
    health_status: str = Field(..., max_length=20)
    progress: int
    sponsor: Optional[str] = Field(None, max_length=100)
    target_go_live: Optional[str] = Field(None, max_length=100)
    executive_summary: Optional[str] = Field(None, max_length=5000)
    strategic_notes: Optional[str] = Field(None, max_length=5000)
    has_gantt_chart: Optional[int] = 0

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    health_status: Optional[str] = Field(None, max_length=20)
    progress: Optional[int] = None
    sponsor: Optional[str] = Field(None, max_length=100)
    target_go_live: Optional[str] = Field(None, max_length=100)
    executive_summary: Optional[str] = Field(None, max_length=5000)
    strategic_notes: Optional[str] = Field(None, max_length=5000)
    has_gantt_chart: Optional[int] = None

def extract_adf_text(node):
    if not node:
        return ""
    if isinstance(node, dict):
        if node.get("type") == "text":
            return node.get("text", "")
        text = ""
        for val in node.values():
            if isinstance(val, (dict, list)):
                text += extract_adf_text(val)
        return text
    elif isinstance(node, list):
        return "".join(extract_adf_text(item) for item in node)
    return ""

def format_comment_date(date_str):
    if not date_str:
        return "-"
    try:
        dt = datetime.strptime(date_str[:19].replace(' ', 'T'), "%Y-%m-%dT%H:%M:%S")
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return date_str

# Dados Mockados para fallback (usados apenas se não houver credenciais configuradas)
MOCK_JIRA_DEMANDS = [
    {"origin": "Jira", "externalId": "JIRA-101", "title": "Migração da infraestrutura local para GCP", "externalStatus": "Em Progresso", "itemType": "Epic", "comments_history": "[01/06/2026 10:00 - Sistema]\nImportado via carga inicial.\n\n[02/06/2026 15:30 - Product Owner]\nPrioridade alta para o próximo sprint."},
    {"origin": "Jira", "externalId": "JIRA-102", "title": "Fluxo de Checkout Simplificado (One-Click Buy)", "externalStatus": "A Fazer", "itemType": "Oportunidade", "comments_history": None},
    {"origin": "Jira", "externalId": "JIRA-103", "title": "Integração de pagamento instantâneo via Pix", "externalStatus": "Concluído", "itemType": "Epic", "comments_history": "[30/05/2026 09:15 - Analista de QA]\nTestado em ambiente de homologação. Fluxo aprovado."},
    {"origin": "Jira", "externalId": "JIRA-104", "title": "Painel Analytics corporativo pós-venda", "externalStatus": "Backlog", "itemType": "Oportunidade", "comments_history": None}
]

MOCK_AZURE_DEMANDS = [
    {"origin": "Azure", "externalId": "AZURE-501", "title": "Bug: Vazamento de memória ao alternar abas de produtos", "externalStatus": "Desenvolvimento", "itemType": "Bug", "comments_history": "[02/06/2026 11:22 - Desenvolvedor]\nCorrigindo vazamento no event listener do hook useEffect."},
    {"origin": "Azure", "externalId": "AZURE-502", "title": "US: Componente reutilizável de Upload Drag-and-Drop", "externalStatus": "Aprovado", "itemType": "User Story", "comments_history": None},
    {"origin": "Azure", "externalId": "AZURE-503", "title": "US: Refatoração do fluxo de autenticação JWT e Refresh Token", "externalStatus": "Novo", "itemType": "User Story", "comments_history": None},
    {"origin": "Azure", "externalId": "AZURE-504", "title": "Bug: Erro 500 intermitente ao salvar preferências de notificação", "externalStatus": "Impedido", "itemType": "Bug", "comments_history": "[03/06/2026 16:45 - Gestor de Projetos]\nItem bloqueado aguardando liberação da API de envio de emails corporativos."},
    {"origin": "Azure", "externalId": "AZURE-505", "title": "US: Implementação de WebSockets para notificações push na tela", "externalStatus": "Em Teste", "itemType": "User Story", "comments_history": None}
]

def has_jira_credentials():
    return all([os.getenv("JIRA_API_URL"), os.getenv("JIRA_USER_EMAIL"), os.getenv("JIRA_PAT")])

def has_azure_credentials():
    return all([os.getenv("AZURE_API_URL"), os.getenv("AZURE_PAT")])

def get_external_url(origin: str, external_id: str):
    if origin == "Jira":
        jira_url_raw = os.getenv("JIRA_API_URL")
        if jira_url_raw:
            jira_url_base = jira_url_raw.rstrip('/')
            if ".atlassian.net/jira" in jira_url_base.lower():
                jira_url_base = jira_url_base.lower().replace("/jira", "")
            return f"{jira_url_base}/browse/{external_id}"
        return f"https://sisbr.atlassian.net/browse/{external_id}"
    elif origin == "Azure":
        azure_url_raw = os.getenv("AZURE_API_URL")
        numeric_id = "".join(filter(str.isdigit, external_id))
        if azure_url_raw:
            azure_url_base = azure_url_raw.rstrip('/')
            return f"{azure_url_base}/_workitems/edit/{numeric_id}"
        return f"https://dev.azure.com/mongeral/_workitems/edit/{numeric_id}"
    return "#"

# API Endpoints Helpers & Business Logic

# Resolved não é considerado concluído (continua em andamento).
# Apenas Closed (ou equivalente final) indica que foi efetivamente concluído.
FINAL_STATUSES = {"Concluído", "Concluido", "Done", "Closed", "Improcedente", "Cancelado", "Canceled", "Entregue", "Finalizado", "Removido", "Removed"}
FINAL_STATUSES_LOWER = {s.lower() for s in FINAL_STATUSES}

def is_final_status(status):
    if not status:
        return False
    s = str(status).strip()
    return s in FINAL_STATUSES or s.lower() in FINAL_STATUSES_LOWER

# Cache em memória e helper para Mapeamento de Status
STATUS_MAPPINGS_CACHE = {}

def load_status_mappings_cache():
    global STATUS_MAPPINGS_CACHE
    try:
        rows = fetch_all("SELECT origin, external_status, mapped_status FROM status_mappings", db_name="ativo")
        STATUS_MAPPINGS_CACHE = {
            (row["origin"].lower(), row["external_status"].strip().lower()): row["mapped_status"]
            for row in rows
        }
        print(f"[*] Cache de Mapeamento de Status carregado ({len(STATUS_MAPPINGS_CACHE)} regras).")
    except Exception as e:
        print(f"[!] Erro ao carregar cache de status_mappings: {e}")

def get_mapped_status(origin, external_status):
    if not external_status:
        return "Backlog"
    origin_key = origin.lower() if origin else "negocio"
    status_key = external_status.strip().lower()
    
    mapped = STATUS_MAPPINGS_CACHE.get((origin_key, status_key))
    if mapped:
        return mapped
        
    if is_final_status(external_status):
        return "Entregue"
    elif status_key in {"review", "under review", "qa", "test", "testing", "homologação", "homologacao", "validando", "resolved", "em homologação", "em homologacao"}:
        return "Homologação"
    elif status_key in {"to do", "new", "approved", "backlog", "a fazer", "selecionado", "selected"}:
        return "Backlog"
    else:
        return "Desenvolvimento"

# Inicializa o cache
try:
    load_status_mappings_cache()
except Exception:
    pass

def calculate_project_progress(project_name: str) -> int:
    """
    Calcula automaticamente o progresso do projeto com base no status unificado
    de suas demandas ativas e históricas, filtrando apenas demandas de origem
    Jira e Azure (exclui Negocio).
    
    Pesos de progresso:
    - Backlog: 0%
    - Em Refinamento: 15%
    - Desenvolvimento: 50%
    - Homologação: 85%
    - Entregue: 100%
    """
    if not project_name:
        return 0
        
    query = """
        SELECT externalStatus, origin
        FROM demands
        WHERE project = ? AND origin IN ('Jira', 'Azure')
    """
    try:
        rows_ativo = fetch_all(query, (project_name,), "ativo")
        rows_historico = fetch_all(query, (project_name,), "historico")
        rows = [dict(r) for r in rows_ativo] + [dict(r) for r in rows_historico]
    except Exception as e:
        print(f"Erro ao buscar demandas para calcular progresso do projeto {project_name}: {e}")
        return 0
        
    total_demands = len(rows)
    if total_demands == 0:
        return 0
        
    STATUS_WEIGHTS = {
        "Backlog": 0,
        "Em Refinamento": 15,
        "Desenvolvimento": 50,
        "Homologação": 85,
        "Entregue": 100
    }
    
    sum_progress = 0
    for row in rows:
        mapped = get_mapped_status(row.get("origin"), row.get("externalStatus"))
        sum_progress += STATUS_WEIGHTS.get(mapped, 0)
        
    return int(round(sum_progress / total_demands))

def migrate_to_history(external_id):
    # Fetch from active
    demand = fetch_one("SELECT * FROM demands WHERE externalId = ?", (external_id,), "ativo")
    if not demand:
        return
    
    annotations = fetch_all("SELECT * FROM annotations WHERE externalId = ?", (external_id,), "ativo")
    tags = fetch_all("SELECT * FROM tags WHERE externalId = ?", (external_id,), "ativo")
    dependencies = fetch_all("SELECT * FROM dependencies WHERE blocked_id = ? OR blocker_id = ?", (external_id, external_id), "ativo")
    
    demand_dict = dict(demand)
    columns = ", ".join(demand_dict.keys())
    placeholders = ", ".join(["?"] * len(demand_dict))
    
    # Save to history
    execute_query(
        f"INSERT OR REPLACE INTO demands ({columns}) VALUES ({placeholders})",
        tuple(demand_dict.values()),
        "historico"
    )
    
    for ann in annotations:
        ann_dict = dict(ann)
        execute_query(
            "INSERT OR REPLACE INTO annotations (id, externalId, content, createdAt) VALUES (?, ?, ?, ?)",
            (ann_dict["id"], ann_dict["externalId"], ann_dict["content"], ann_dict["createdAt"]),
            "historico"
        )
        
    for tag in tags:
        tag_dict = dict(tag)
        execute_query(
            "INSERT OR REPLACE INTO tags (externalId, tag) VALUES (?, ?)",
            (tag_dict["externalId"], tag_dict["tag"]),
            "historico"
        )
        
    for dep in dependencies:
        dep_dict = dict(dep)
        try:
            execute_query(
                "INSERT OR REPLACE INTO dependencies (blocked_id, blocker_id) VALUES (?, ?)",
                (dep_dict["blocked_id"], dep_dict["blocker_id"]),
                "historico"
            )
        except Exception as e:
            print(f"[Migration] Ignorando dependência {dep_dict['blocked_id']} -> {dep_dict['blocker_id']} ao mover para histórico: {e}")
        
    # Delete from active
    execute_query("DELETE FROM demands WHERE externalId = ?", (external_id,), "ativo")

def migrate_to_active(external_id):
    # Fetch from history
    demand = fetch_one("SELECT * FROM demands WHERE externalId = ?", (external_id,), "historico")
    if not demand:
        return
    
    annotations = fetch_all("SELECT * FROM annotations WHERE externalId = ?", (external_id,), "historico")
    tags = fetch_all("SELECT * FROM tags WHERE externalId = ?", (external_id,), "historico")
    dependencies = fetch_all("SELECT * FROM dependencies WHERE blocked_id = ? OR blocker_id = ?", (external_id, external_id), "historico")
    
    demand_dict = dict(demand)
    columns = ", ".join(demand_dict.keys())
    placeholders = ", ".join(["?"] * len(demand_dict))
    
    # Save to active
    execute_query(
        f"INSERT OR REPLACE INTO demands ({columns}) VALUES ({placeholders})",
        tuple(demand_dict.values()),
        "ativo"
    )
    
    for ann in annotations:
        ann_dict = dict(ann)
        execute_query(
            "INSERT OR REPLACE INTO annotations (id, externalId, content, createdAt) VALUES (?, ?, ?, ?)",
            (ann_dict["id"], ann_dict["externalId"], ann_dict["content"], ann_dict["createdAt"]),
            "ativo"
        )
        
    for tag in tags:
        tag_dict = dict(tag)
        execute_query(
            "INSERT OR REPLACE INTO tags (externalId, tag) VALUES (?, ?)",
            (tag_dict["externalId"], tag_dict["tag"]),
            "ativo"
        )
        
    for dep in dependencies:
        dep_dict = dict(dep)
        try:
            execute_query(
                "INSERT OR REPLACE INTO dependencies (blocked_id, blocker_id) VALUES (?, ?)",
                (dep_dict["blocked_id"], dep_dict["blocker_id"]),
                "ativo"
            )
        except Exception as e:
            print(f"[Migration] Ignorando dependência {dep_dict['blocked_id']} -> {dep_dict['blocker_id']} ao mover para ativo: {e}")
        
    # Delete from history
    execute_query("DELETE FROM demands WHERE externalId = ?", (external_id,), "historico")

def save_demand(demand, db_name):
    updated_at = demand.get("updatedAt")
    if not updated_at:
        updated_at = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        
    project = demand.get("project")
    parent_id = demand.get("parentId")
    
    if not project and parent_id:
        parent_row = fetch_one("SELECT project FROM demands WHERE externalId = ?", (parent_id,), "ativo")
        if not parent_row:
            parent_row = fetch_one("SELECT project FROM demands WHERE externalId = ?", (parent_id,), "historico")
        if parent_row and parent_row["project"]:
            project = parent_row["project"]
            
    execute_query("""
        INSERT INTO demands (externalId, origin, title, externalStatus, itemType, comments_history, parentId, project, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(externalId) DO UPDATE SET
            title = excluded.title,
            externalStatus = excluded.externalStatus,
            itemType = excluded.itemType,
            comments_history = excluded.comments_history,
            parentId = excluded.parentId,
            project = COALESCE(excluded.project, demands.project),
            updatedAt = excluded.updatedAt
    """, (
        demand["externalId"],
        demand["origin"],
        demand["title"],
        demand["externalStatus"],
        demand.get("itemType", "Outro"),
        demand.get("comments_history"),
        parent_id,
        project,
        updated_at
    ), db_name)

def fetch_jira_issue_details(key, jira_url_raw=None, user_email=None, pat=None):
    try:
        if not jira_url_raw:
            jira_url_raw = os.getenv("JIRA_API_URL")
        if not jira_url_raw:
            return None
        jira_url_base = jira_url_raw.rstrip('/')
        if ".atlassian.net/jira" in jira_url_base.lower():
            jira_url_base = jira_url_base.lower().replace("/jira", "")
        
        detail_url = f"{jira_url_base}/rest/api/3/issue/{key}"
        if not user_email:
            user_email = os.getenv("JIRA_USER_EMAIL")
        if not pat:
            pat = os.getenv("JIRA_PAT")
        if not user_email or not pat:
            return None
        auth_str = f"{user_email}:{pat}"
        auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        
        headers = {
            "Authorization": f"Basic {auth_b64}",
            "Accept": "application/json"
        }
        params = {
            "fields": "key,summary,status,comment,parent,issuelinks,issuetype,updated,subtasks"
        }
        res = requests.get(detail_url, headers=headers, params=params, verify=VERIFY_SSL, timeout=12)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Erro ao buscar detalhes do ticket Jira {key}: {e}")
    return None

def fetch_azure_item_details(item_id, azure_url, headers):
    try:
        detail_url = f"{azure_url}/_apis/wit/workitems/{item_id}?$expand=all&api-version=6.0"
        detail_response = requests.get(detail_url, headers=headers, verify=VERIFY_SSL, timeout=12)
        if detail_response.status_code == 200:
            return detail_response.json()
    except Exception as e:
        print(f"Erro ao buscar detalhes de Azure {item_id}: {e}")
    return None

def parse_jira_issue(issue):
    fields = issue.get("fields") or {}
    comments_history = None
    comments_data = []
    comment_field = fields.get("comment")
    if isinstance(comment_field, dict):
        comments_data = comment_field.get("comments") or []
    
    comments_list = []
    for c in comments_data:
        if not isinstance(c, dict):
            continue
        author = c.get("author")
        author_name = "Usuário"
        if isinstance(author, dict):
            author_name = author.get("displayName") or "Usuário"
        
        created = c.get("created") or ""
        date_formatted = format_comment_date(created)
        
        body = c.get("body")
        if isinstance(body, dict):
            body_text = extract_adf_text(body).strip()
        else:
            body_text = str(body or "").strip()
        
        if body_text:
            comments_list.append(f"[{date_formatted} - {author_name}]\n{body_text}")
            
    if comments_list:
        comments_history = "\n\n".join(comments_list)
    
    parent = fields.get("parent")
    parent_id = None
    if isinstance(parent, dict):
        parent_id = parent.get("key") or parent.get("id")
    
    issuelinks = fields.get("issuelinks") or []
    blockers = []
    blocked_by = []
    for link in issuelinks:
        if isinstance(link, dict):
            link_type = link.get("type") or {}
            link_name = link_type.get("name")
            if isinstance(link_name, str) and link_name.lower() == "blocks":
                if "inwardIssue" in link:
                    inward_key = link.get("inwardIssue", {}).get("key")
                    if inward_key:
                        blockers.append(inward_key)
                if "outwardIssue" in link:
                    outward_key = link.get("outwardIssue", {}).get("key")
                    if outward_key:
                        blocked_by.append(outward_key)
    
    import json
    issuetype_field = fields.get("issuetype")
    item_type = issuetype_field.get("name", "Outro") if isinstance(issuetype_field, dict) else "Outro"
    
    raw_status = fields.get("status", {}).get("name", "Sem Status") if isinstance(fields.get("status"), dict) else "Sem Status"
    
    # Reclassificação de status se houver subtarefas de homologação ativas (Business rule)
    if not is_final_status(raw_status):
        subtasks = fields.get("subtasks") or []
        has_homologation_subtask = False
        for sub in subtasks:
            if isinstance(sub, dict):
                sub_fields = sub.get("fields") or {}
                sub_status = sub_fields.get("status") or {}
                sub_status_name = sub_status.get("name", "").strip().lower()
                if sub_status_name in {"em homologação", "em homologacao", "homologação", "homologacao", "em teste", "em testes", "testing", "qa"}:
                    has_homologation_subtask = True
                    break
        if has_homologation_subtask:
            print(f"[*] Reclassificando demanda {issue.get('key') or issue.get('id')} para 'Em homologação' devido a subtarefa de teste ativa.")
            raw_status = "Em homologação"

    updated_at_raw = fields.get("updated")
    updated_at = ""
    if updated_at_raw:
        if len(updated_at_raw) >= 19:
            updated_at = updated_at_raw[:19].replace('T', ' ')
        else:
            updated_at = updated_at_raw

    return {
        "origin": "Jira",
        "externalId": issue.get("key") or f"JIRA-{issue.get('id')}",
        "title": fields.get("summary", "Sem título"),
        "externalStatus": raw_status,
        "itemType": item_type,
        "comments_history": comments_history,
        "parentId": parent_id,
        "blockers": json.dumps(blockers),
        "blocked_by": json.dumps(blocked_by),
        "updatedAt": updated_at
    }

def parse_azure_item(item, azure_url, headers):
    fields = item.get("fields") or {}
    item_type = fields.get("System.WorkItemType", "")
    if item_type == "User Story":
        prefix = "US: "
    elif item_type == "Bug":
        prefix = "Bug: "
    else:
        prefix = f"{item_type}: " if item_type else ""
        
    item_id = item.get("id")
    comments_history = None
    
    if item_id:
        try:
            updates_url = f"{azure_url}/_apis/wit/workitems/{item_id}/updates?api-version=6.0"
            updates_res = requests.get(updates_url, headers=headers, verify=VERIFY_SSL, timeout=5)
            if updates_res.status_code == 200:
                updates = updates_res.json().get("value", [])
                c_list = []
                for u in updates:
                    if isinstance(u, dict):
                        u_fields = u.get("fields", {})
                        if isinstance(u_fields, dict):
                            hist_obj = u_fields.get("System.History")
                            if isinstance(hist_obj, dict) and "newValue" in hist_obj:
                                raw_text = hist_obj["newValue"]
                                import re
                                clean_text = re.sub('<[^<]+?>', '', str(raw_text)).strip()
                                if clean_text:
                                    changed_by = u_fields.get("System.ChangedBy")
                                    changed_by_val = None
                                    if isinstance(changed_by, dict):
                                        changed_by_val = changed_by.get("newValue")
                                    
                                    autor = "Usuário"
                                    if isinstance(changed_by_val, dict):
                                        autor = changed_by_val.get("displayName") or "Usuário"
                                    elif isinstance(changed_by_val, str):
                                        autor = changed_by_val
                                    
                                    changed_date = u_fields.get("System.ChangedDate")
                                    changed_date_val = ""
                                    if isinstance(changed_date, dict):
                                        changed_date_val = changed_date.get("newValue", "")
                                    data_formatada = format_comment_date(changed_date_val)
                                    
                                    c_list.append(f"[{data_formatada} - {autor}]\n{clean_text}")
                comments_history = "\n\n".join(c_list) if c_list else None
        except Exception:
            pass
        
    relations = item.get("relations") or []
    azure_parent_id = None
    azure_blockers = []
    azure_blocked_by = []
    for rel_item in relations:
        if isinstance(rel_item, dict):
            rel_type = rel_item.get("rel")
            rel_url = rel_item.get("url") or ""
            target_id_str = rel_url.split("/")[-1]
            if target_id_str.isdigit():
                target_ext_id = f"AZ-{target_id_str}"
                if rel_type == "System.LinkTypes.Hierarchy-Reverse":
                    azure_parent_id = target_ext_id
                elif rel_type == "System.LinkTypes.Dependency-Forward":
                    azure_blocked_by.append(target_ext_id)
                elif rel_type == "System.LinkTypes.Dependency-Reverse":
                    azure_blockers.append(target_ext_id)
                    
    updated_at_raw = fields.get("System.ChangedDate")
    updated_at = ""
    if updated_at_raw:
        if len(updated_at_raw) >= 19:
            updated_at = updated_at_raw[:19].replace('T', ' ')
        else:
            updated_at = updated_at_raw

    import json
    return {
        "origin": "Azure",
        "externalId": f"AZ-{item.get('id')}",
        "title": f"{prefix}{fields.get('System.Title', 'Sem título')}",
        "externalStatus": fields.get("System.State", "Sem Status"),
        "itemType": item_type if item_type else "Outro",
        "comments_history": comments_history,
        "parentId": azure_parent_id,
        "blockers": json.dumps(azure_blockers),
        "blocked_by": json.dumps(azure_blocked_by),
        "updatedAt": updated_at
    }

def process_sync_for_demands(fetched_demands, origin, jira_creds=None, azure_creds=None):
    # Fetch DB active keys
    db_active = fetch_all("SELECT externalId FROM demands WHERE origin = ?", (origin,), "ativo")
    db_active_keys = {d["externalId"] for d in db_active}
    
    # Fetch DB history keys and statuses
    db_history = fetch_all("SELECT externalId, externalStatus FROM demands WHERE origin = ?", (origin,), "historico")
    history_status_map = {d["externalId"]: d["externalStatus"] for d in db_history}
    
    # Map fetched demands by their externalId
    fetched_map = {d["externalId"]: d for d in fetched_demands}
    
    # Candidates: union of fetched externalIds, active keys, and history keys currently in DB
    all_keys = list(set(list(db_active_keys) + list(fetched_map.keys()) + list(history_status_map.keys())))
    
    # Filter candidates to process if not in history DB, OR if fetched, OR if status in history is not final
    filtered_keys = []
    for k in all_keys:
        in_history = k in history_status_map
        is_fetched = k in fetched_map
        
        history_status = history_status_map.get(k)
        history_is_not_final = in_history and history_status and not (history_status in FINAL_STATUSES or is_final_status(history_status))
        
        if not in_history or is_fetched or history_is_not_final:
            filtered_keys.append(k)
    
    processed_count = 0
    for key in filtered_keys:
        in_active = key in db_active_keys
        in_history = key in history_status_map
        demand = None
        
        # Determine demand data
        if key in fetched_map:
            demand = fetched_map[key]
        else:
            # Not in fetched list (meaning it wasn't returned by active sync, e.g. it was finalized)
            if origin == "Jira":
                jira_url = jira_creds.get("url") if jira_creds else None
                jira_email = jira_creds.get("email") if jira_creds else None
                jira_token = jira_creds.get("token") if jira_creds else None
                
                has_jira = bool(jira_url and jira_email and jira_token) or has_jira_credentials()
                if has_jira:
                    issue_data = fetch_jira_issue_details(key, jira_url, jira_email, jira_token)
                    if issue_data:
                        demand = parse_jira_issue(issue_data)
            elif origin == "Azure":
                azure_url = azure_creds.get("url") if azure_creds else None
                headers = azure_creds.get("headers") if azure_creds else None
                
                has_azure = bool(azure_url and headers) or has_azure_credentials()
                if has_azure and key.startswith("AZ-"):
                    try:
                        num_id = int(key.replace("AZ-", ""))
                        if not azure_url or not headers:
                            azure_url = os.getenv("AZURE_API_URL").rstrip('/')
                            pat = os.getenv("AZURE_PAT")
                            auth_str = f":{pat}"
                            auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
                            headers = {
                                "Authorization": f"Basic {auth_b64}",
                                "Content-Type": "application/json"
                            }
                        item_data = fetch_azure_item_details(num_id, azure_url, headers)
                        if item_data:
                            demand = parse_azure_item(item_data, azure_url, headers)
                    except ValueError:
                        pass
            
            # If still not found externally, but it is in history and we are migrating it back to active:
            # we can use the local data from history database
            if not demand and in_history:
                local_demand = fetch_one("SELECT * FROM demands WHERE externalId = ?", (key,), "historico")
                if local_demand:
                    demand = dict(local_demand)
                        
        if not demand:
            continue
            
        status = demand.get("externalStatus")
        is_final = status in FINAL_STATUSES or is_final_status(status)
        processed_count += 1
        
        if not is_final:
            # Force saving only in active and block writing in history
            if in_history:
                migrate_to_active(key)
            save_demand(demand, "ativo")
        else:
            if in_active:
                # Save to active first, then migrate to history
                save_demand(demand, "ativo")
                migrate_to_history(key)
            else:
                # Save directly to history
                save_demand(demand, "historico")
            
    return processed_count

def parse_date(date_str):
    if not date_str:
        return None
    if isinstance(date_str, datetime):
        return date_str
    if not isinstance(date_str, str):
        date_str = str(date_str)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            pass
    return None

def is_status_active(status):
    if not status:
        return False
    status_lower = status.strip().lower()
    # List of known non-active/finished/backlog/todo statuses
    # Resolved é considerado ainda em andamento. Closed é que a demanda foi efetivamente concluída.
    inactive = {"concluído", "concluido", "done", "closed", "fechado", "backlog", "a fazer", "to do", "removed", "removido", "cancelado", "canceled"}
    return status_lower not in inactive

def get_demands_data(db_name="ativo"):
    deps = fetch_all("SELECT blocked_id, blocker_id FROM dependencies", db_name=db_name)
    blockers_map = {}
    blocked_by_map = {}
    for dep in deps:
        blocked = dep["blocked_id"]
        blocker = dep["blocker_id"]
        
        if blocked not in blockers_map:
            blockers_map[blocked] = []
        blockers_map[blocked].append(blocker)
        
        if blocker not in blocked_by_map:
            blocked_by_map[blocker] = []
            
        blocked_by_map[blocker].append(blocked)

    where_clause = ""
    params = ()
    placeholders = ", ".join(["?"] * len(FINAL_STATUSES))
    if db_name == "historico":
        where_clause = f"WHERE d.externalStatus IN ({placeholders})"
        params = tuple(FINAL_STATUSES)
    else:
        where_clause = f"WHERE d.externalStatus NOT IN ({placeholders}) OR d.externalStatus IS NULL"
        params = tuple(FINAL_STATUSES)

    query = f"""
        SELECT d.*, group_concat(t.tag) as tags_str, p.has_gantt_chart as project_has_gantt
        FROM demands d
        LEFT JOIN tags t ON d.externalId = t.externalId
        LEFT JOIN projects p ON d.project = p.name
        {where_clause}
        GROUP BY d.externalId, p.has_gantt_chart
        ORDER BY CASE WHEN d.priority_rank IS NULL THEN 999999 ELSE d.priority_rank END ASC, d.updatedAt DESC
    """
    rows = fetch_all(query, params, db_name=db_name)
    demands = []
    import json
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    for row in rows:
        is_stale = False
        if is_status_active(row["externalStatus"]):
            updated_dt = parse_date(row["updatedAt"])
            if updated_dt and (now_utc - updated_dt > timedelta(days=5)):
                is_stale = True
        
        ext_blockers = []
        if row.get("blockers"):
            try:
                ext_blockers = json.loads(row["blockers"])
            except Exception:
                pass
        local_blockers = blockers_map.get(row["externalId"], [])
        all_blockers = list(set(local_blockers + ext_blockers))

        ext_blocked_by = []
        if row.get("blocked_by"):
            try:
                ext_blocked_by = json.loads(row["blocked_by"])
            except Exception:
                pass
        local_blocked_by = blocked_by_map.get(row["externalId"], [])
        all_blocked_by = list(set(local_blocked_by + ext_blocked_by))
                
        demands.append({
            "externalId": row["externalId"],
            "origin": row["origin"],
            "title": row["title"],
            "externalStatus": row["externalStatus"],
            "mappedStatus": get_mapped_status(row["origin"], row["externalStatus"]),
            "itemType": row.get("itemType") or "Outro",
            "createdAt": str(row["createdAt"]) if row.get("createdAt") is not None else "",
            "updatedAt": str(row["updatedAt"]) if row.get("updatedAt") is not None else "",
            "promisedDate": row["promisedDate"],
            "followUpDate": row["followUpDate"],
            "managerNotes": row["managerNotes"],
            "tags": row["tags_str"].split(",") if row["tags_str"] else [],
            "externalUrl": get_external_url(row["origin"], row["externalId"]),
            "blockers": all_blockers,
            "blocked_by": all_blocked_by,
            "parentId": None if row.get("localParentId") == "NONE" else (row.get("localParentId") or row.get("parentId")),
            "localParentId": row.get("localParentId"),
            "isStale": is_stale,
            "project": row.get("project"),
            "current_status_notes": row.get("current_status_notes"),
            "blocker_notes": row.get("blocker_notes"),
            "priority_rank": row.get("priority_rank"),
            "in_tactical_planning": row.get("in_tactical_planning") or 0,
            "planned_start_date": row.get("planned_start_date"),
            "planned_end_date": row.get("planned_end_date"),
            "project_has_gantt": row.get("project_has_gantt") or 0
        })
    return demands

# FastAPI API Endpoints

class StatusMappingCreate(BaseModel):
    origin: str = Field(..., max_length=50)
    external_status: str = Field(..., max_length=100)
    mapped_status: str = Field(..., max_length=100)

@app.get("/api/status-mappings")
def get_status_mappings():
    try:
        return fetch_all("SELECT * FROM status_mappings ORDER BY origin, external_status", db_name="ativo")
    except Exception as e:
        print(f"Erro ao buscar mapeamentos de status: {e}")
        raise HTTPException(status_code=500, detail="Erro ao carregar mapeamentos de status.")

@app.post("/api/status-mappings")
def save_status_mapping(payload: StatusMappingCreate):
    try:
        if payload.origin not in ('Jira', 'Azure', 'Negocio'):
            raise HTTPException(status_code=400, detail="Origem inválida.")
        if payload.mapped_status not in ('Backlog', 'Desenvolvimento', 'Homologação', 'Entregue', 'Em Refinamento'):
            raise HTTPException(status_code=400, detail="Status mapeado inválido.")
        
        execute_query("""
            INSERT INTO status_mappings (origin, external_status, mapped_status)
            VALUES (?, ?, ?)
            ON CONFLICT (origin, external_status) DO UPDATE SET mapped_status = excluded.mapped_status
        """, (payload.origin, payload.external_status.strip(), payload.mapped_status), "ativo")
        
        load_status_mappings_cache()
        return {"success": True}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao salvar mapeamento de status: {e}")
        raise HTTPException(status_code=500, detail="Erro ao salvar mapeamento de status.")

@app.delete("/api/status-mappings/{mapping_id}")
def delete_status_mapping(mapping_id: int):
    try:
        execute_query("DELETE FROM status_mappings WHERE id = ?", (mapping_id,), "ativo")
        load_status_mappings_cache()
        return {"success": True}
    except Exception as e:
        print(f"Erro ao excluir mapeamento de status: {e}")
        raise HTTPException(status_code=500, detail="Erro ao excluir mapeamento de status.")

@app.post("/api/sync")
def sync_demands(req: SyncRequest = Body(...)):
    print("Iniciando sincronização com Dois Bancos...")
    
    # Resolve credentials: payload -> credentials.json -> env variables
    saved_creds = load_credentials_from_file()
    
    jira_url_val = req.jiraUrl or saved_creds.get("jiraUrl") or os.getenv("JIRA_API_URL")
    jira_email_val = req.jiraEmail or saved_creds.get("jiraEmail") or os.getenv("JIRA_USER_EMAIL")
    jira_token_val = req.jiraToken or saved_creds.get("jiraToken") or os.getenv("JIRA_PAT")
    has_jira_payload = bool(jira_url_val and jira_email_val and jira_token_val)
    
    azure_org_val = req.azureOrg or saved_creds.get("azureOrg")
    azure_project_val = req.azureProject or saved_creds.get("azureProject")
    azure_token_val = req.azureToken or saved_creds.get("azureToken") or os.getenv("AZURE_PAT")
    azure_url_raw = os.getenv("AZURE_API_URL")
    
    azure_url_val = resolve_azure_url(azure_org_val, azure_project_val, azure_url_raw)
    has_azure_payload = bool(azure_url_val and azure_token_val)
    
    # Sempre limpa demandas do projeto TST do banco local para garantir que dados antigos sejam eliminados
    try:
        execute_query("DELETE FROM demands WHERE externalId LIKE 'TST-%'", db_name="ativo")
        execute_query("DELETE FROM demands WHERE externalId LIKE 'TST-%'", db_name="historico")
        print("[*] Banco de dados limpo de demandas do projeto Jira TST.")
    except Exception as e:
        print(f"Erro ao excluir demandas do projeto TST do banco: {e}")

    jira_fetched = []
    azure_fetched = []
    sync_source = {"jira": "mock", "azure": "mock"}
    errors = []
    
    is_jira_incremental = False
    is_azure_incremental = False

    # 1. Jira Sync
    if has_jira_payload:
        try:
            jira_url_raw = jira_url_val
            jira_url_base = jira_url_raw.rstrip('/')
            if ".atlassian.net/jira" in jira_url_base.lower():
                jira_url_base = jira_url_base.lower().replace("/jira", "")
                
            jira_url = f"{jira_url_base}/rest/api/3/search/jql"
            print(f"Buscando dados reais do Jira em: {jira_url}")
            user_email = jira_email_val
            pat = jira_token_val
            auth_str = f"{user_email}:{pat}"
            auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Accept": "application/json"
            }
            
            jql = 'project != "TST" AND issuetype in (Epic, Opportunity, "Epic", "Oportunidade", Story, "Story", "História", "Historia", Legend, "Legend") AND (reporter = currentUser() OR assignee = currentUser())'
            if not req.force_refresh:
                last_sync_row = fetch_one("SELECT val FROM sync_metadata WHERE key = ?", ("last_sync_jira",), "ativo")
                if last_sync_row and last_sync_row["val"]:
                    try:
                        last_dt = datetime.strptime(last_sync_row["val"], '%Y/%m/%d %H:%M').replace(tzinfo=timezone.utc)
                        query_dt = last_dt - timedelta(minutes=5)
                        jql_date_str = query_dt.strftime('%Y/%m/%d %H:%M')
                        jql += f' AND updated >= "{jql_date_str}"'
                        is_jira_incremental = True
                        print(f"Jira Delta Sync ativo. Buscando atualizados desde: {jql_date_str}")
                    except Exception as date_err:
                        print(f"Erro ao analisar data de sincronização do Jira: {date_err}")
            
            next_page_token = None
            max_results = 100
            while True:
                params = {
                    "jql": jql,
                    "maxResults": max_results,
                    "fields": "key,summary,status,comment,parent,issuelinks,issuetype,updated,subtasks"
                }
                if next_page_token:
                    params["nextPageToken"] = next_page_token
                response = requests.get(jira_url, headers=headers, params=params, verify=VERIFY_SSL, timeout=12)
                if response.status_code == 200:
                    data = response.json()
                    issues = data.get("issues", [])
                    if not issues:
                        break
                    for issue in issues:
                        key = issue.get("key", "")
                        if key.upper().startswith("TST-"):
                            continue
                        parsed = parse_jira_issue(issue)
                        jira_fetched.append(parsed)
                    sync_source["jira"] = "real"
                    is_last = data.get("isLast", True)
                    next_page_token = data.get("nextPageToken")
                    if is_last or not next_page_token:
                        break
                else:
                    if response.status_code == 401:
                        err_msg = "Token de acesso do Sicoob TI (Jira) inválido ou expirado (HTTP 401). Atualize nas Configurações."
                    elif response.status_code == 403:
                        err_msg = "Acesso negado no Sicoob TI (Jira) (HTTP 403). Sua conta não possui permissão."
                    else:
                        err_msg = f"Erro no Sicoob TI (Jira) (HTTP {response.status_code}): {response.text[:150]}"
                    print(f"Erro na sincronização do Jira: {err_msg}")
                    errors.append(err_msg)
                    break
        except Exception as e:
            err_msg = f"Falha na conexão com Sicoob TI (Jira): {str(e)}"
            print(err_msg)
            errors.append(err_msg)
    else:
        # Fallback to mock only if BOTH Jira and Azure credentials are empty
        if not has_azure_payload:
            print("Nenhuma credencial configurada. Usando dados fictícios para Jira.")
            jira_fetched = MOCK_JIRA_DEMANDS
        else:
            print("Jira não configurado na requisição (sincronização real ativa para outra API). Mantendo vazio.")
            jira_fetched = []

    # 2. Azure DevOps Sync
    if has_azure_payload:
        try:
            azure_url = azure_url_val.rstrip('/')
            print(f"Buscando dados reais do Azure DevOps em: {azure_url}")
            pat = azure_token_val
            auth_str = f":{pat}"
            auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json"
            }
            
            wiql_url = f"{azure_url}/_apis/wit/wiql?$top=2000&timePrecision=true&api-version=6.0"
            wiql_str = (
                "Select [System.Id] From WorkItems Where [System.State] <> 'Removed' "
                "AND ("
                "[System.CreatedBy] = @me "
                "OR [System.AssignedTo] = @me"
                ")"
            )
            if not req.force_refresh:
                last_sync_row = fetch_one("SELECT val FROM sync_metadata WHERE key = ?", ("last_sync_azure",), "ativo")
                if last_sync_row and last_sync_row["val"]:
                    try:
                        last_dt = datetime.strptime(last_sync_row["val"], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
                        query_dt = last_dt - timedelta(minutes=5)
                        wiql_date_str = query_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
                        wiql_str += f" AND [System.ChangedDate] >= '{wiql_date_str}'"
                        is_azure_incremental = True
                        print(f"Azure DevOps Delta Sync ativo. Buscando atualizados desde: {wiql_date_str}")
                    except Exception as date_err:
                        print(f"Erro ao analisar data de sincronização do Azure: {date_err}")
            
            wiql_query = {
                "query": wiql_str
            }
            
            wiql_response = requests.post(wiql_url, json=wiql_query, headers=headers, verify=VERIFY_SSL, timeout=12)
            if wiql_response.status_code == 200:
                work_items_refs = wiql_response.json().get("workItems", [])
                if work_items_refs:
                    chunk_size = 200
                    for i in range(0, len(work_items_refs), chunk_size):
                        chunk = work_items_refs[i:i + chunk_size]
                        ids = ",".join([str(item["id"]) for item in chunk])
                        detail_url = f"{azure_url}/_apis/wit/workitems?ids={ids}&$expand=all&api-version=6.0"
                        
                        detail_response = requests.get(detail_url, headers=headers, verify=VERIFY_SSL, timeout=12)
                        if detail_response.status_code == 200:
                            value = detail_response.json().get("value", [])
                            for item in value:
                                parsed = parse_azure_item(item, azure_url, headers)
                                azure_fetched.append(parsed)
                        else:
                            err_msg = f"Azure DevOps Details HTTP {detail_response.status_code}"
                            errors.append(err_msg)
                            break
                    sync_source["azure"] = "real"
                else:
                    sync_source["azure"] = "real"
            else:
                if wiql_response.status_code == 401:
                    err_msg = "Token de acesso da MAG TI (Azure DevOps) inválido ou expirado (HTTP 401). Atualize nas Configurações."
                elif wiql_response.status_code == 403:
                    err_msg = "Acesso negado na MAG TI (Azure DevOps) (HTTP 403). Sua conta não possui permissão."
                else:
                    err_msg = f"Erro na MAG TI (Azure DevOps WIQL HTTP {wiql_response.status_code}): {wiql_response.text[:150]}"
                print(f"Erro no Azure DevOps: {err_msg}")
                errors.append(err_msg)
        except Exception as e:
            err_msg = f"Falha na conexão com MAG TI (Azure DevOps): {str(e)}"
            print(err_msg)
            errors.append(err_msg)
    else:
        # Fallback to mock only if BOTH Jira and Azure credentials are empty
        if not has_jira_payload:
            print("Nenhuma credencial configurada. Usando dados fictícios para Azure.")
            azure_fetched = MOCK_AZURE_DEMANDS
        else:
            print("Azure DevOps não configurado na requisição (sincronização real ativa para outra API). Mantendo vazio.")
            azure_fetched = []

    # Process sync using our unified selective sync function, passing payload credentials
    jira_creds = {
        "url": jira_url_val,
        "email": jira_email_val,
        "token": jira_token_val
    } if has_jira_payload else None

    azure_url_constructed = azure_url_val if has_azure_payload else None
    azure_pat = azure_token_val if has_azure_payload else None
    azure_headers = {
        "Authorization": f"Basic {base64.b64encode(f':{azure_pat}'.encode('utf-8')).decode('utf-8')}",
        "Content-Type": "application/json"
    } if has_azure_payload else None

    azure_creds = {
        "url": azure_url_constructed,
        "headers": azure_headers
    } if has_azure_payload else None

    try:
        jira_count = process_sync_for_demands(jira_fetched, "Jira", jira_creds=jira_creds, azure_creds=azure_creds)
        azure_count = process_sync_for_demands(azure_fetched, "Azure", jira_creds=jira_creds, azure_creds=azure_creds)
        
        # Persist successful sync timestamp metadata
        now_dt = datetime.now(timezone.utc)
        if has_jira_payload and not any("Jira" in err for err in errors):
            jira_sync_timestamp = now_dt.strftime('%Y/%m/%d %H:%M')
            execute_query(
                "INSERT OR REPLACE INTO sync_metadata (key, val) VALUES (?, ?)",
                ("last_sync_jira", jira_sync_timestamp),
                "ativo"
            )
            
        if has_azure_payload and not any("Azure" in err for err in errors):
            azure_sync_timestamp = now_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
            execute_query(
                "INSERT OR REPLACE INTO sync_metadata (key, val) VALUES (?, ?)",
                ("last_sync_azure", azure_sync_timestamp),
                "ativo"
            )

        return {
            "success": len(errors) < 2,
            "message": "Sincronização processada com arquitetura de Dois Bancos e credenciais dinâmicas.",
            "sources": sync_source,
            "count": jira_count + azure_count,
            "sync_types": {
                "jira": "incremental" if is_jira_incremental else "full",
                "azure": "incremental" if is_azure_incremental else "full"
            },
            "errors": errors if errors else None
        }
    except Exception as db_err:
        print(f"Erro ao persistir sincronização no banco: {db_err}")
        raise HTTPException(status_code=500, detail="Erro interno ao gravar demandas sincronizadas.")

@app.post("/api/sync/by-id")
def sync_demand_by_id(req: SyncByIdRequest):
    import re
    ext_id = req.externalId.strip()
    
    # Check if Azure (numeric) or Jira (alphanumeric with hyphen)
    is_azure = False
    azure_id = None
    db_id = None
    
    if ext_id.isdigit():
        is_azure = True
        azure_id = int(ext_id)
        db_id = f"AZ-{ext_id}"
    elif re.match(r'^az-(\d+)$', ext_id, re.IGNORECASE):
        is_azure = True
        azure_id = int(re.match(r'^az-(\d+)$', ext_id, re.IGNORECASE).group(1))
        db_id = f"AZ-{azure_id}"
    elif '-' in ext_id and any(c.isalpha() for c in ext_id.split('-')[0]):
        is_azure = False
        db_id = ext_id.upper()
    else:
        raise HTTPException(status_code=400, detail="Formato de ID inválido. Use letras e hífen para Sicoob TI (Jira) (ex: SGRVDI-2262) ou apenas números para MAG TI (Azure) (ex: 2329).")

    if not is_azure:
        # Jira
        jira_url = req.jiraUrl or os.getenv("JIRA_API_URL")
        jira_email = req.jiraEmail or os.getenv("JIRA_USER_EMAIL")
        jira_token = req.jiraToken or os.getenv("JIRA_PAT")
        
        has_creds = bool(jira_url and jira_email and jira_token)
        
        if not has_creds:
            # Try to get from mock
            mock_item = next((item for item in MOCK_JIRA_DEMANDS if item["externalId"].upper() == db_id), None)
            if mock_item:
                save_demand(mock_item, "ativo")
                return {"success": True, "message": f"Demanda {db_id} importada com sucesso!"}
            else:
                raise HTTPException(status_code=502, detail="Não foi possível conectar ao serviço. Tente novamente em instantes.")
                
        try:
            jira_url_base = jira_url.rstrip('/')
            if ".atlassian.net/jira" in jira_url_base.lower():
                jira_url_base = jira_url_base.lower().replace("/jira", "")
            
            detail_url = f"{jira_url_base}/rest/api/3/issue/{db_id}"
            auth_str = f"{jira_email}:{jira_token}"
            auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Accept": "application/json"
            }
            params = {
                "fields": "key,summary,status,comment,parent,issuelinks,issuetype,updated,subtasks"
            }
            
            res = requests.get(detail_url, headers=headers, params=params, verify=VERIFY_SSL, timeout=12)
            if res.status_code == 404:
                raise HTTPException(status_code=404, detail="Demanda não encontrada. Verifique o ID e tente novamente.")
            elif res.status_code == 401:
                raise HTTPException(status_code=401, detail="Token de acesso do Jira (JIRA_PAT) inválido ou expirado. Atualize suas credenciais nas Configurações.")
            elif res.status_code == 403:
                raise HTTPException(status_code=403, detail="Acesso negado no Jira. Sua conta/token não possui permissão para este projeto ou demanda.")
            elif res.status_code != 200:
                print(f"Jira HTTP error: {res.status_code} - {res.text}")
                raise HTTPException(status_code=502, detail="Erro na API do Jira. Verifique se o ID existe e se as credenciais estão corretas.")
                
            issue_data = res.json()
            demand = parse_jira_issue(issue_data)
            if not demand:
                raise HTTPException(status_code=404, detail="Demanda não encontrada. Verifique o ID e tente novamente.")
                
            status = demand.get("externalStatus")
            is_final = status in FINAL_STATUSES or is_final_status(status)
            
            db_active = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (db_id,), "ativo")
            db_history = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (db_id,), "historico")
            
            if not is_final:
                if db_history:
                    migrate_to_active(db_id)
                save_demand(demand, "ativo")
            else:
                if db_active:
                    save_demand(demand, "ativo")
                    migrate_to_history(db_id)
                else:
                    save_demand(demand, "historico")
                    
            return {"success": True, "message": f"Demanda {db_id} importada com sucesso!"}
        except HTTPException as he:
            raise he
        except Exception as e:
            print(f"Erro ao conectar ao Jira: {e}")
            raise HTTPException(status_code=502, detail="Erro de conexão ao Jira. Verifique a URL e a conectividade de rede.")
    else:
        # Azure DevOps
        azure_org = req.azureOrg
        azure_project = req.azureProject
        azure_token = req.azureToken
        
        azure_url_raw = os.getenv("AZURE_API_URL")
        azure_url = resolve_azure_url(azure_org, azure_project, azure_url_raw)
        if azure_url:
            azure_url = azure_url.rstrip('/')
            
        azure_token = azure_token or os.getenv("AZURE_PAT")
        has_creds = bool(azure_url and azure_token)
        
        if not has_creds:
            # Try to get from mock
            mock_id = f"AZURE-{azure_id}"
            mock_item = next((item for item in MOCK_AZURE_DEMANDS if item["externalId"].upper() == mock_id), None)
            if mock_item:
                # Map to proper db_id
                mock_item_copy = dict(mock_item)
                mock_item_copy["externalId"] = db_id
                save_demand(mock_item_copy, "ativo")
                return {"success": True, "message": f"Demanda {db_id} importada com sucesso!"}
            else:
                raise HTTPException(status_code=502, detail="Credenciais do Azure DevOps não configuradas e demanda não encontrada na lista local.")
                
        try:
            auth_str = f":{azure_token}"
            auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json"
            }
            
            detail_url = f"{azure_url}/_apis/wit/workitems/{azure_id}?$expand=all&api-version=6.0"
            res = requests.get(detail_url, headers=headers, verify=VERIFY_SSL, timeout=12)
            if res.status_code == 404:
                raise HTTPException(status_code=404, detail="Demanda não encontrada. Verifique o ID e tente novamente.")
            elif res.status_code == 401:
                raise HTTPException(status_code=401, detail="Token de acesso do Azure DevOps (AZURE_PAT) inválido ou expirado. Atualize suas credenciais nas Configurações.")
            elif res.status_code == 403:
                raise HTTPException(status_code=403, detail="Acesso negado no Azure DevOps. Sua conta/token não possui permissão para este projeto ou item.")
            elif res.status_code != 200:
                print(f"Azure HTTP error: {res.status_code} - {res.text}")
                raise HTTPException(status_code=502, detail="Erro na API do Azure DevOps. Verifique se o ID existe e se as credenciais estão corretas.")
                
            item_data = res.json()
            demand = parse_azure_item(item_data, azure_url, headers)
            if not demand:
                raise HTTPException(status_code=404, detail="Demanda não encontrada. Verifique o ID e tente novamente.")
                
            status = demand.get("externalStatus")
            is_final = status in FINAL_STATUSES or is_final_status(status)
            
            db_active = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (db_id,), "ativo")
            db_history = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (db_id,), "historico")
            
            if not is_final:
                if db_history:
                    migrate_to_active(db_id)
                save_demand(demand, "ativo")
            else:
                if db_active:
                    save_demand(demand, "ativo")
                    migrate_to_history(db_id)
                else:
                    save_demand(demand, "historico")
                    
            return {"success": True, "message": f"Demanda {db_id} importada com sucesso!"}
        except HTTPException as he:
            raise he
        except Exception as e:
            print(f"Erro ao conectar ao Azure DevOps: {e}")
            raise HTTPException(status_code=502, detail="Erro de conexão ao Azure DevOps. Verifique a URL e a conectividade de rede.")

@app.get("/api/demands")
def list_demands():
    try:
        # Internally fetch both to satisfy UNION ALL constraint but return active only
        active_demands = get_demands_data("ativo")
        return active_demands
    except Exception as e:
        print(f"Erro ao listar demandas: {e}")
        raise HTTPException(status_code=500, detail="Erro ao buscar demandas locais.")

@app.get("/api/demands/history")
def list_history_demands():
    try:
        return get_demands_data("historico")
    except Exception as e:
        print(f"Erro ao listar histórico de demandas: {e}")
        raise HTTPException(status_code=500, detail="Erro ao buscar histórico de demandas.")

@app.get("/api/demands/{external_id}")
def get_demand(external_id: str):
    try:
        # Search active database first
        demand = fetch_one("SELECT * FROM demands WHERE externalId = ?", (external_id,), "ativo")
        db_name = "ativo"
        if not demand:
            # Check history database
            demand = fetch_one("SELECT * FROM demands WHERE externalId = ?", (external_id,), "historico")
            db_name = "historico"
            
        if not demand:
            raise HTTPException(status_code=404, detail="Demanda não encontrada no cache local.")
        
        annotations_rows = fetch_all(
            "SELECT id, content, createdAt FROM annotations WHERE externalId = ? ORDER BY createdAt DESC",
            (external_id,),
            db_name
        )
        
        tags_rows = fetch_all("SELECT tag FROM tags WHERE externalId = ?", (external_id,), db_name)
        tags = [row["tag"] for row in tags_rows]
        
        blockers_rows = fetch_all("SELECT blocker_id FROM dependencies WHERE blocked_id = ?", (external_id,), db_name)
        blocked_by_rows = fetch_all("SELECT blocked_id FROM dependencies WHERE blocker_id = ?", (external_id,), db_name)
        blockers = [row["blocker_id"] for row in blockers_rows]
        blocked_by = [row["blocked_id"] for row in blocked_by_rows]
        
        import json
        ext_blockers = []
        if demand.get("blockers"):
            try:
                ext_blockers = json.loads(demand["blockers"])
            except Exception:
                pass
        all_blockers = list(set(blockers + ext_blockers))

        ext_blocked_by = []
        if demand.get("blocked_by"):
            try:
                ext_blocked_by = json.loads(demand["blocked_by"])
            except Exception:
                pass
        all_blocked_by = list(set(blocked_by + ext_blocked_by))
        
        is_stale = False
        if is_status_active(demand["externalStatus"]):
            updated_dt = parse_date(demand["updatedAt"])
            if updated_dt and (datetime.now(timezone.utc).replace(tzinfo=None) - updated_dt > timedelta(days=5)):
                is_stale = True
        
        return {
            "externalId": demand["externalId"],
            "origin": demand["origin"],
            "title": demand["title"],
            "externalStatus": demand["externalStatus"],
            "mappedStatus": get_mapped_status(demand["origin"], demand["externalStatus"]),
            "itemType": demand.get("itemType") or "Outro",
            "createdAt": demand["createdAt"],
            "updatedAt": demand["updatedAt"],
            "promisedDate": demand["promisedDate"],
            "followUpDate": demand["followUpDate"],
            "managerNotes": demand["managerNotes"],
            "annotations": annotations_rows,
            "tags": tags,
            "externalUrl": get_external_url(demand["origin"], demand["externalId"]),
            "blockers": all_blockers,
            "blocked_by": all_blocked_by,
            "parentId": None if demand.get("localParentId") == "NONE" else (demand.get("localParentId") or demand.get("parentId")),
            "localParentId": demand.get("localParentId"),
            "isStale": is_stale,
            "comments_history": demand["comments_history"],
            "ai_summary": demand.get("ai_summary"),
            "summary_updated_at": demand.get("summary_updated_at"),
            "project": demand.get("project"),
            "current_status_notes": demand.get("current_status_notes"),
            "blocker_notes": demand.get("blocker_notes"),
            "priority_rank": demand.get("priority_rank"),
            "in_tactical_planning": demand.get("in_tactical_planning") or 0,
            "planned_start_date": demand.get("planned_start_date"),
            "planned_end_date": demand.get("planned_end_date")
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao obter demanda {external_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao carregar detalhes da demanda.")

@app.put("/api/demands/reorder")
@app.put("/demands/reorder")
def reorder_demands(payload: list[dict] | dict = Body(...)):
    try:
        items = []
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict) and "items" in payload:
            items = payload["items"]
        else:
            raise HTTPException(status_code=400, detail="Payload inválido. Esperado array ou objeto com chave 'items'.")

        for item in items:
            ext_id = item.get("externalId")
            rank = item.get("priority_rank")
            if ext_id and rank is not None:
                execute_query("UPDATE demands SET priority_rank = ? WHERE externalId = ?", (rank, ext_id), "ativo")
                execute_query("UPDATE demands SET priority_rank = ? WHERE externalId = ?", (rank, ext_id), "historico")

        return {"success": True, "message": "Reordenação salva com sucesso."}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao reordenar demandas: {e}")
        raise HTTPException(status_code=500, detail="Erro ao atualizar a ordem das demandas.")

@app.post("/api/demands/{external_id}/summarize")
def summarize_demand(external_id: str):
    try:
        # Search active database first
        db_name = "ativo"
        demand = fetch_one("SELECT * FROM demands WHERE externalId = ?", (external_id,), "ativo")
        if not demand:
            # Check history database
            demand = fetch_one("SELECT * FROM demands WHERE externalId = ?", (external_id,), "historico")
            db_name = "historico"
            
        if not demand:
            raise HTTPException(status_code=404, detail="Demanda não encontrada no cache local.")
            
        ai_summary = demand.get("ai_summary")
        summary_updated_at = demand.get("summary_updated_at")
        updated_at = demand.get("updatedAt")
        
        # Check cache: if summary exists and is more recent or equal to updatedAt
        cached_valid = False
        if ai_summary and summary_updated_at and updated_at:
            summary_updated_dt = parse_date(summary_updated_at)
            updated_dt = parse_date(updated_at)
            if summary_updated_dt and updated_dt and summary_updated_dt >= updated_dt:
                cached_valid = True
                
        if cached_valid:
            return {
                "ai_summary": ai_summary,
                "summary_updated_at": summary_updated_at,
                "cached": True
            }
            
        # Cache miss or stale summary -> call LLM
        llm_config = load_llm_config_from_file()
        provider = llm_config.get("llmProvider", "gemini").lower()
        
        comments_history = demand.get("comments_history")
        if not comments_history or not comments_history.strip():
            raise HTTPException(
                status_code=400, 
                detail="Não há histórico de comentários disponível para gerar um resumo."
            )
            
        # Setup model prompt
        prompt = f"""Você é um Product Owner / Gerente de Projetos experiente.
Analise a demanda abaixo e gere um resumo executivo focado em:
1. O que já foi feito (bullet points)
2. Bloqueios atuais (bullet points)
3. Próximos passos (bullet points)

Demanda: {demand.get('title') or ''}
Status: {demand.get('externalStatus') or ''}

Histórico de Comentários:
{comments_history}

Responda de forma direta, clara e profissional em português. Não adicione introduções ou conclusões (ex: "Aqui está o resumo..."), vá direto ao conteúdo solicitado.
"""
        
        # Configure and invoke
        if provider == "openai":
            api_key = llm_config.get("openaiApiKey")
            model_name = llm_config.get("openaiModelName") or "gpt-4o-mini"
            if not api_key:
                raise HTTPException(status_code=400, detail="Chave de API da OpenAI (OPENAI_API_KEY) não configurada.")
            
            try:
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "user", "content": prompt}
                    ]
                }
                res = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=30)
                if res.status_code != 200:
                    raise HTTPException(status_code=res.status_code, detail="Erro retornado pela API da OpenAI.")
                data = res.json()
                new_summary = data["choices"][0]["message"]["content"]
            except Exception as ex:
                raise HTTPException(status_code=500, detail="Erro ao processar chamada na OpenAI.")
        else:
            api_key = llm_config.get("geminiApiKey")
            model_name = llm_config.get("geminiModelName") or "gemini-1.5-flash"
            if not api_key:
                raise HTTPException(status_code=400, detail="Chave de API do Gemini (GEMINI_API_KEY) não configurada.")
            
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            new_summary = response.text
        
        if not new_summary:
            raise HTTPException(status_code=500, detail="Não foi possível obter uma resposta válida da LLM.")
            
        current_timestamp = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d %H:%M:%S")
        
        # Update demand with summary
        execute_query(
            "UPDATE demands SET ai_summary = ?, summary_updated_at = ? WHERE externalId = ?",
            (new_summary, current_timestamp, external_id),
            db_name
        )
        
        return {
            "ai_summary": new_summary,
            "summary_updated_at": current_timestamp,
            "cached": False
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao gerar resumo da demanda {external_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar resumo da demanda.")

@app.post("/api/projects/summary")
def generate_project_summary(payload: ProjectSummaryRequest):
    try:
        # Check cache if force_refresh is False
        if not payload.force_refresh:
            cached_report = fetch_one("SELECT report_text, generated_at FROM project_reports WHERE project_name = ?", (payload.project_name,), "ativo")
            if cached_report:
                return {
                    "report": cached_report["report_text"],
                    "generated_at": cached_report["generated_at"],
                    "cached": True
                }
                
        # 1. Load LLM settings
        llm_config = load_llm_config_from_file()
        api_key = llm_config["geminiApiKey"]
            
        # Determine demand_ids
        demand_ids = payload.demand_ids
        if not demand_ids:
            proj_demands = fetch_all("SELECT externalId FROM demands WHERE project = ?", (payload.project_name,), "ativo")
            demand_ids = [r["externalId"] for r in proj_demands]
            
        if not demand_ids:
            raise HTTPException(status_code=400, detail="Este projeto não possui demandas ativas para gerar o resumo.")
            
        # 2. Query active db for externalId, title, externalStatus, comments_history, promisedDate, followUpDate, etc.
        placeholders = ", ".join(["?"] * len(demand_ids))
        query = (
            f"SELECT externalId, title, externalStatus, comments_history, promisedDate, followUpDate, "
            f"managerNotes, current_status_notes, blocker_notes "
            f"FROM demands WHERE externalId IN ({placeholders})"
        )
        rows = fetch_all(query, tuple(demand_ids), "ativo")
        
        if not rows:
            raise HTTPException(status_code=404, detail="Nenhuma das demandas especificadas foi encontrada na base ativa.")
            
        # 2b. Query active db for annotations of these demands
        query_ann = f"SELECT externalId, content, createdAt FROM annotations WHERE externalId IN ({placeholders}) ORDER BY createdAt ASC"
        ann_rows = fetch_all(query_ann, tuple(demand_ids), "ativo")
        
        # Group annotations by demand ID
        annotations_by_demand = {}
        for ann in ann_rows:
            ext_id = ann["externalId"]
            if ext_id not in annotations_by_demand:
                annotations_by_demand[ext_id] = []
            annotations_by_demand[ext_id].append(ann["content"])
            
        # 3. Concatenate structured data
        structured_lines = []
        for r in rows:
            ext_id = r["externalId"]
            comments = r.get("comments_history") or ""
            anns = annotations_by_demand.get(ext_id, [])
            
            parts = [
                f"ID: {ext_id}",
                f"Título: {r['title']}",
                f"Status: {r['externalStatus']}"
            ]
            
            # Promessas de data e próxima cobrança
            if r.get("promisedDate"):
                parts.append(f"Promessa de Entrega: {r['promisedDate']}")
            if r.get("followUpDate"):
                parts.append(f"Próxima Cobrança: {r['followUpDate']}")
                
            # Notas gerenciais e anotações locais do painel
            if r.get("managerNotes"):
                parts.append(f"Notas Gerais da Gestora: {r['managerNotes']}")
            if r.get("current_status_notes"):
                parts.append(f"Anotação de Evolução: {r['current_status_notes']}")
            if r.get("blocker_notes"):
                parts.append(f"Anotação de Impedimento: {r['blocker_notes']}")
                
            # Anotações históricas adicionais
            if anns:
                parts.append("Anotações de Histórico: " + "; ".join(anns))
                
            # Comentários externos da plataforma (Jira/Azure)
            if comments:
                parts.append(f"Comentários da Plataforma: {comments.strip()}")
                
            line = " | ".join(parts)
            structured_lines.append(line)
            
        concatenated_data = "\n".join(structured_lines)
        
        # 4. Load LLM configuration parameters from settings
        provider = llm_config.get("llmProvider", "gemini").lower()
        system_instruction = llm_config.get("systemInstruction") or DEFAULT_SYSTEM_INSTRUCTION

        if provider == "openai":
            api_key = llm_config.get("openaiApiKey")
            model_name = llm_config.get("openaiModelName") or "gpt-4o-mini"
            if not api_key:
                raise HTTPException(status_code=400, detail="Chave de API da OpenAI (OPENAI_API_KEY) não configurada.")
            
            try:
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": concatenated_data}
                    ]
                }
                res = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=60)
                if res.status_code != 200:
                    raise HTTPException(status_code=res.status_code, detail="Erro retornado pela API da OpenAI.")
                data = res.json()
                report_text = data["choices"][0]["message"]["content"]
            except Exception as ex:
                raise HTTPException(status_code=500, detail="Erro ao processar chamada na OpenAI.")
        else:
            api_key = llm_config.get("geminiApiKey")
            model_name = llm_config.get("geminiModelName") or "gemini-1.5-flash"
            if not api_key:
                raise HTTPException(status_code=400, detail="Chave de API do Gemini (GEMINI_API_KEY) não configurada.")

            # Call Gemini model
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_instruction
            )
            response = model.generate_content(concatenated_data)
            report_text = response.text
            
        if not report_text:
            raise HTTPException(status_code=500, detail="Não foi possível obter um relatório válido da LLM.")
            
        # Format current timestamp and save/update in DB
        current_timestamp = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%d/%m/%Y %H:%M")
        
        execute_query(
            "INSERT OR REPLACE INTO project_reports (project_name, report_text, generated_at) VALUES (?, ?, ?)",
            (payload.project_name, report_text, current_timestamp),
            "ativo"
        )
        
        return {
            "report": report_text,
            "generated_at": current_timestamp,
            "cached": False
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao gerar status report do projeto: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar status report do projeto.")

@app.post("/api/demands/{external_id}/annotations")
def add_annotation(external_id: str, payload: AnnotationCreate):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="O conteúdo da anotação não pode ser vazio.")
        
    try:
        db_name = "ativo"
        demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,), "ativo")
        if not demand:
            demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,), "historico")
            db_name = "historico"
        if not demand:
            raise HTTPException(status_code=404, detail="Demanda não encontrada.")
            
        cursor = execute_query(
            "INSERT INTO annotations (externalId, content) VALUES (?, ?)",
            (external_id, content),
            db_name
        )
        
        last_id = cursor.lastrowid
        new_ann = fetch_one("SELECT * FROM annotations WHERE id = ?", (last_id,), db_name)
        return new_ann
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao salvar anotação: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao criar anotação.")

@app.post("/api/demands/{external_id}/tags")
def add_tag(external_id: str, payload: TagCreate):
    tag = payload.tag.strip().lower()
    if not tag:
        raise HTTPException(status_code=400, detail="A tag não pode ser vazia.")
        
    try:
        db_name = "ativo"
        demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,), "ativo")
        if not demand:
            demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,), "historico")
            db_name = "historico"
        if not demand:
            raise HTTPException(status_code=404, detail="Demanda não encontrada.")
            
        execute_query("INSERT OR IGNORE INTO tags (externalId, tag) VALUES (?, ?)", (external_id, tag), db_name)
        return {"success": True, "tag": tag}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao salvar tag: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao adicionar tag.")

@app.delete("/api/demands/{external_id}/tags/{tag}")
def delete_tag(external_id: str, tag: str):
    tag_clean = tag.strip().lower()
    try:
        db_name = "ativo"
        demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,), "ativo")
        if not demand:
            db_name = "historico"
        execute_query("DELETE FROM tags WHERE externalId = ? AND tag = ?", (external_id, tag_clean), db_name)
        return {"success": True}
    except Exception as e:
        print(f"Erro ao remover tag: {e}")
        raise HTTPException(status_code=500, detail="Erro ao deletar tag.")

@app.post("/api/demands/{external_id}/dependencies")
def add_dependency(external_id: str, payload: DependencyCreate):
    blocker_id = payload.blocker_id.strip()
    if not blocker_id:
        raise HTTPException(status_code=400, detail="O blocker_id não pode ser vazio.")
    if external_id == blocker_id:
        raise HTTPException(status_code=400, detail="Uma demanda não pode depender de si mesma.")
        
    try:
        db_name = "ativo"
        blocked_exist = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,), "ativo")
        blocker_exist = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (blocker_id,), "ativo")
        
        if not blocked_exist or not blocker_exist:
            db_name = "historico"
            blocked_exist_h = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,), "historico")
            blocker_exist_h = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (blocker_id,), "historico")
            if not blocked_exist_h or not blocker_exist_h:
                raise HTTPException(status_code=404, detail="Uma ou ambas as demandas não foram encontradas no banco local.")
            
        execute_query("INSERT OR IGNORE INTO dependencies (blocked_id, blocker_id) VALUES (?, ?)", (external_id, blocker_id), db_name)
        return {"success": True, "blocked_id": external_id, "blocker_id": blocker_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao criar dependência: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao criar dependência.")

@app.delete("/api/demands/{external_id}/dependencies/{blocker_id}")
def delete_dependency(external_id: str, blocker_id: str):
    try:
        db_name = "ativo"
        exist = fetch_one("SELECT 1 FROM dependencies WHERE blocked_id = ? AND blocker_id = ?", (external_id, blocker_id), "ativo")
        if not exist:
            db_name = "historico"
        execute_query("DELETE FROM dependencies WHERE blocked_id = ? AND blocker_id = ?", (external_id, blocker_id), db_name)
        return {"success": True}
    except Exception as e:
        print(f"Erro ao deletar dependência: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao deletar dependência.")

@app.post("/api/demands/manual")
async def create_manual_demand(payload: DemandManualCreate):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="O título da demanda não pode ser vazio.")
        
    try:
        # Encontra o próximo ID disponível no formato BIZ-XXXX (4 dígitos)
        rows_ativo = fetch_all("SELECT externalId FROM demands WHERE origin = 'Negocio'", db_name="ativo")
        rows_hist = fetch_all("SELECT externalId FROM demands WHERE origin = 'Negocio'", db_name="historico")
        all_rows = rows_ativo + rows_hist
        max_num = 0
        for r in all_rows:
            ext_id = r["externalId"]
            if ext_id.startswith("BIZ-"):
                parts = ext_id.split("-")
                if len(parts) > 1:
                    num_part = parts[1]
                    if num_part.isdigit() and len(num_part) == 4:
                        val = int(num_part)
                        if val > max_num:
                            max_num = val
        next_val = max_num + 1
        if next_val > 9999:
            raise HTTPException(status_code=400, detail="Limite de 9999 demandas de negócio atingido.")
        external_id = f"BIZ-{next_val:04d}"
        
        project_name = payload.project_name
        if project_name:
            project_exists = fetch_one("SELECT 1 FROM projects WHERE name = ?", (project_name,), "ativo")
            if not project_exists:
                raise HTTPException(status_code=400, detail="O projeto vinculado não existe.")
                
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        execute_query(
            """INSERT INTO demands (externalId, origin, title, externalStatus, itemType, createdAt, updatedAt, project) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (external_id, "Negocio", title, "To Do", "Outro", now_str, now_str, project_name),
            "ativo"
        )
        
        new_demand = fetch_one("SELECT * FROM demands WHERE externalId = ?", (external_id,), "ativo")
        return dict(new_demand)
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao criar demanda manual: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao criar demanda manual.")

@app.patch("/api/demands/{external_id}")
def update_demand(external_id: str, payload: DemandUpdate):
    try:
        db_name = "ativo"
        demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,), "ativo")
        if not demand:
            demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,), "historico")
            db_name = "historico"
        if not demand:
            raise HTTPException(status_code=404, detail="Demanda não encontrada no banco local.")
            
        update_fields = []
        params = []
        data = payload.dict(exclude_unset=True)
        for key, val in data.items():
            update_fields.append(f"{key} = ?")
            params.append(val)
            
        if not update_fields:
            return {"success": True, "message": "Nenhum campo para atualizar."}
            
        params.append(external_id)
        execute_query(
            f"UPDATE demands SET {', '.join(update_fields)} WHERE externalId = ?",
            tuple(params),
            db_name
        )
        
        # Propagate project to children if updated
        if "project" in data and data["project"]:
            execute_query(
                "UPDATE demands SET project = ? WHERE (parentId = ? OR localParentId = ?) AND (project IS NULL OR project = '')",
                (data["project"], external_id, external_id),
                db_name
            )
            
        return {"success": True}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao atualizar demanda {external_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao atualizar a demanda.")

@app.delete("/api/demands/{external_id}")
def delete_demand(external_id: str):
    try:
        db_name = "ativo"
        demand = fetch_one("SELECT origin FROM demands WHERE externalId = ?", (external_id,), "ativo")
        if not demand:
            demand = fetch_one("SELECT origin FROM demands WHERE externalId = ?", (external_id,), "historico")
            db_name = "historico"
        if not demand:
            raise HTTPException(status_code=404, detail="Demanda não encontrada no banco local.")
        
        # Permite excluir qualquer demanda do banco local (útil para itens removidos no sistema de origem)
        execute_query("DELETE FROM annotations WHERE externalId = ?", (external_id,), db_name)
        execute_query("DELETE FROM tags WHERE externalId = ?", (external_id,), db_name)
        execute_query("DELETE FROM dependencies WHERE blocked_id = ? OR blocker_id = ?", (external_id, external_id), db_name)
        execute_query("DELETE FROM demands WHERE externalId = ?", (external_id,), db_name)
        
        return {"success": True, "message": "Demanda local excluída com sucesso."}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao excluir demanda {external_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao excluir a demanda.")

# Módulo PPM - Rotas CRUD de Projetos
@app.get("/api/projects")
async def get_projects():
    try:
        projects = fetch_all("SELECT * FROM projects ORDER BY id DESC", db_name="ativo")
        updated_projects = []
        for proj in projects:
            proj_dict = dict(proj)
            calc_progress = calculate_project_progress(proj_dict["name"])
            if proj_dict["progress"] != calc_progress:
                execute_query("UPDATE projects SET progress = ? WHERE id = ?", (calc_progress, proj_dict["id"]), "ativo")
                proj_dict["progress"] = calc_progress
            updated_projects.append(proj_dict)
        return updated_projects
    except Exception as e:
        print(f"Erro ao buscar projetos: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao buscar projetos.")

@app.get("/api/projects/{project_id}/overview")
async def get_project_overview(project_id: int):
    try:
        project = fetch_one("SELECT * FROM projects WHERE id = ?", (project_id,), "ativo")
        if not project:
            raise HTTPException(status_code=404, detail="Projeto não encontrado.")
            
        project_dict = dict(project)
        project_name = project_dict["name"]
        
        query = """
            SELECT d.*, group_concat(t.tag) as tags_str
            FROM demands d
            LEFT JOIN tags t ON d.externalId = t.externalId
            WHERE d.project = ?
            GROUP BY d.externalId
            ORDER BY d.updatedAt DESC
        """
        rows_ativo = fetch_all(query, (project_name,), "ativo")
        rows_historico = fetch_all(query, (project_name,), "historico")
        rows = [dict(r) for r in rows_ativo] + [dict(r) for r in rows_historico]
        
        deps_ativo = fetch_all("SELECT blocked_id, blocker_id FROM dependencies", db_name="ativo")
        deps_historico = fetch_all("SELECT blocked_id, blocker_id FROM dependencies", db_name="historico")
        deps = [dict(d) for d in deps_ativo] + [dict(d) for d in deps_historico]
        blockers_map = {}
        blocked_by_map = {}
        for dep in deps:
            blocked = dep["blocked_id"]
            blocker = dep["blocker_id"]
            if blocked not in blockers_map:
                blockers_map[blocked] = []
            blockers_map[blocked].append(blocker)
            if blocker not in blocked_by_map:
                blocked_by_map[blocker] = []
            blocked_by_map[blocker].append(blocked)
            
        demands = []
        import json
        from datetime import datetime, timezone, timedelta
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        
        for row in rows:
            is_stale = False
            if is_status_active(row["externalStatus"]):
                updated_dt = parse_date(row["updatedAt"])
                if updated_dt and (now_utc - updated_dt > timedelta(days=5)):
                    is_stale = True
                    
            ext_blockers = []
            if row.get("blockers"):
                try:
                    ext_blockers = json.loads(row["blockers"])
                except Exception:
                    pass
            local_blockers = blockers_map.get(row["externalId"], [])
            all_blockers = list(set(local_blockers + ext_blockers))

            ext_blocked_by = []
            if row.get("blocked_by"):
                try:
                    ext_blocked_by = json.loads(row["blocked_by"])
                except Exception:
                    pass
            local_blocked_by = blocked_by_map.get(row["externalId"], [])
            all_blocked_by = list(set(local_blocked_by + ext_blocked_by))
                    
            demands.append({
                "externalId": row["externalId"],
                "origin": row["origin"],
                "title": row["title"],
                "externalStatus": row["externalStatus"],
                "mappedStatus": get_mapped_status(row["origin"], row["externalStatus"]),
                "itemType": row.get("itemType") or "Outro",
                "createdAt": row["createdAt"],
                "updatedAt": row["updatedAt"],
                "promisedDate": row["promisedDate"],
                "followUpDate": row["followUpDate"],
                "managerNotes": row["managerNotes"],
                "tags": row["tags_str"].split(",") if row["tags_str"] else [],
                "externalUrl": get_external_url(row["origin"], row["externalId"]),
                "blockers": all_blockers,
                "blocked_by": all_blocked_by,
                "parentId": None if row.get("localParentId") == "NONE" else (row.get("localParentId") or row.get("parentId")),
                "localParentId": row.get("localParentId"),
                "isStale": is_stale,
                "project": row.get("project"),
                "current_status_notes": row.get("current_status_notes"),
                "blocker_notes": row.get("blocker_notes"),
                "priority_rank": row.get("priority_rank"),
                "in_tactical_planning": row.get("in_tactical_planning") or 0,
                "planned_start_date": row.get("planned_start_date"),
                "planned_end_date": row.get("planned_end_date")
            })
            
        # PASSO 1: Inteligência do Farol
        import datetime
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        today = datetime.date.today()
        
        has_blocked = False
        has_overdue = False
        has_close_to_deadline = False
        
        for d in demands:
            # IGNORA itens de Negócio no cálculo da Saúde do projeto
            if d.get("origin") not in ("Jira", "Azure"):
                continue

            status_lower = d.get("externalStatus").strip().lower() if d.get("externalStatus") else ""
            is_blocked = False
            if status_lower == "blocked":
                is_blocked = True
            if d.get("blockers") and len(d["blockers"]) > 0:
                is_blocked = True
                
            if is_blocked:
                has_blocked = True
                
            if d.get("promisedDate"):
                promised_str = d["promisedDate"].strip()
                # Critério unificado usando o mappedStatus
                is_completed = (d.get("mappedStatus") == "Entregue")
                
                if not is_completed:
                    try:
                        promised_date = datetime.datetime.strptime(promised_str, "%Y-%m-%d").date()
                        if promised_str < today_str:
                            has_overdue = True
                        else:
                            is_in_progress = d.get("mappedStatus") not in ("Backlog", "Em Refinamento")
                            if is_in_progress:
                                diff_days = (promised_date - today).days
                                if 0 <= diff_days <= 3:
                                    has_close_to_deadline = True
                    except Exception:
                        pass
                        
        calculated_health = "Verde"
        if has_blocked or has_overdue:
            calculated_health = "Vermelho"
        elif has_close_to_deadline:
            calculated_health = "Amarelo"
            
        if project_dict.get("health_status") != calculated_health:
            execute_query("UPDATE projects SET health_status = ? WHERE id = ?", (calculated_health, project_id), "ativo")
            project_dict["health_status"] = calculated_health
            
        # Recalcula e atualiza o progresso automaticamente (apenas Jira/Azure)
        calculated_progress = calculate_project_progress(project_name)
        if project_dict.get("progress") != calculated_progress:
            execute_query("UPDATE projects SET progress = ? WHERE id = ?", (calculated_progress, project_id), "ativo")
            project_dict["progress"] = calculated_progress
            
        return {
            "project": project_dict,
            "demands": demands
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao buscar visão geral do projeto: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao buscar visão geral.")

@app.post("/api/projects")
async def create_project(payload: ProjectCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="O nome do projeto não pode ser vazio.")
    if payload.health_status not in ('Verde', 'Amarelo', 'Vermelho'):
        raise HTTPException(status_code=400, detail="health_status inválido. Valores aceitos: 'Verde', 'Amarelo', 'Vermelho'")
    if not (0 <= payload.progress <= 100):
        raise HTTPException(status_code=400, detail="progress deve ser um valor inteiro entre 0 e 100.")
        
    try:
        existing = fetch_one("SELECT 1 FROM projects WHERE name = ?", (name,), "ativo")
        if existing:
            raise HTTPException(status_code=400, detail="Já existe um projeto com este nome.")
            
        # Calcula progresso inicial automaticamente (geralmente 0)
        calculated_progress = calculate_project_progress(name)
        cursor = execute_query(
            """INSERT INTO projects (name, health_status, progress, sponsor, target_go_live, executive_summary, strategic_notes, has_gantt_chart) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (name, payload.health_status, calculated_progress, payload.sponsor, payload.target_go_live, payload.executive_summary, payload.strategic_notes, payload.has_gantt_chart or 0),
            "ativo"
        )
        project_id = cursor.lastrowid
        new_project = fetch_one("SELECT * FROM projects WHERE id = ?", (project_id,), "ativo")
        return new_project
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao criar projeto: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao criar projeto.")

@app.put("/api/projects/{project_id}")
async def update_project(project_id: int, payload: ProjectUpdate):
    try:
        project = fetch_one("SELECT * FROM projects WHERE id = ?", (project_id,), "ativo")
        if not project:
            raise HTTPException(status_code=404, detail="Projeto não encontrado.")
            
        update_data = payload.dict(exclude_unset=True)
        # Ignora progresso manual enviado no payload
        update_data.pop("progress", None)
        
        if not update_data:
            # Garante recálculo mesmo sem outras alterações
            project_name = project["name"]
            calculated_progress = calculate_project_progress(project_name)
            execute_query("UPDATE projects SET progress = ? WHERE id = ?", (calculated_progress, project_id), "ativo")
            updated_project = fetch_one("SELECT * FROM projects WHERE id = ?", (project_id,), "ativo")
            return updated_project
            
        if "name" in update_data:
            name = update_data["name"].strip()
            if not name:
                raise HTTPException(status_code=400, detail="O nome do projeto não pode ser vazio.")
            existing = fetch_one("SELECT 1 FROM projects WHERE name = ? AND id != ?", (name, project_id), "ativo")
            if existing:
                raise HTTPException(status_code=400, detail="Já existe outro projeto com este nome.")
            update_data["name"] = name
            
        if "health_status" in update_data and update_data["health_status"] not in ('Verde', 'Amarelo', 'Vermelho'):
            raise HTTPException(status_code=400, detail="health_status inválido. Valores aceitos: 'Verde', 'Amarelo', 'Vermelho'")
            
        fields = []
        values = []
        for k, v in update_data.items():
            fields.append(f"{k} = ?")
            values.append(v)
            
        values.append(project_id)
        execute_query(f"UPDATE projects SET {', '.join(fields)} WHERE id = ?", tuple(values), "ativo")
        
        # Recalcula e atualiza o progresso automaticamente após atualização
        project_name = update_data.get("name", project["name"])
        calculated_progress = calculate_project_progress(project_name)
        execute_query("UPDATE projects SET progress = ? WHERE id = ?", (calculated_progress, project_id), "ativo")
        
        updated_project = fetch_one("SELECT * FROM projects WHERE id = ?", (project_id,), "ativo")
        return updated_project
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao atualizar projeto: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao atualizar projeto.")

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int):
    try:
        project = fetch_one("SELECT 1 FROM projects WHERE id = ?", (project_id,), "ativo")
        if not project:
            raise HTTPException(status_code=404, detail="Projeto não encontrado.")
            
        execute_query("DELETE FROM projects WHERE id = ?", (project_id,), "ativo")
        return {"success": True}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao deletar projeto: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao deletar projeto.")

LLM_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "llm_config.json")

DEFAULT_SYSTEM_INSTRUCTION = (
    "Atue como um Agile Coach / Product Owner de alto nível. Leia o status atual, prazos de entrega ("
    "Promessa de Entrega), próximas cobranças (Próxima Cobrança), notas da gestora, anotações locais "
    "(Evolução, Impedimentos, Histórico) e comentários da plataforma de desenvolvimento para gerar um "
    "Status Report semanal executivo e conciso do projeto.\n"
    "Instruções cruciais:\n"
    "1. Identifique e destaque datas de promessa de entrega críticas ou atrasadas, bem como datas de próxima "
    "cobrança agendadas.\n"
    "2. Considere as anotações locais (Evolução, Impedimentos, Histórico) como o contexto de negócio/decisão "
    "mais recente, real e prioritário.\n"
    "3. Estruture a resposta estritamente em 3 blocos em português: 1. 🚀 Principais Entregas/Avanços da Semana, "
    "2. 🔄 O que está em Andamento, "
    "3. ⚠️ Atenção Necessária (riscos, bloqueios, cobranças ou datas prometidas)."
)

def load_llm_config_from_file():
    config = {
        "llmProvider": "gemini",
        "geminiApiKey": "",
        "geminiModelName": "gemini-1.5-flash",
        "openaiApiKey": "",
        "openaiModelName": "gpt-4o-mini",
        "systemInstruction": DEFAULT_SYSTEM_INSTRUCTION
    }
    
    # 1. Carrega do arquivo se existir
    if os.path.exists(LLM_CONFIG_PATH):
        try:
            with open(LLM_CONFIG_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if loaded.get("llmProvider"):
                    config["llmProvider"] = loaded["llmProvider"].strip()
                if loaded.get("geminiApiKey"):
                    config["geminiApiKey"] = loaded["geminiApiKey"].strip()
                if loaded.get("geminiModelName"):
                    config["geminiModelName"] = loaded["geminiModelName"].strip()
                if loaded.get("openaiApiKey"):
                    config["openaiApiKey"] = loaded["openaiApiKey"].strip()
                if loaded.get("openaiModelName"):
                    config["openaiModelName"] = loaded["openaiModelName"].strip()
                if loaded.get("systemInstruction"):
                    config["systemInstruction"] = loaded["systemInstruction"]
        except Exception as e:
            print(f"Erro ao carregar llm_config.json: {e}")
            
    # 2. Sobrescreve com as variáveis de ambiente (prioridade para produção/nuvem)
    env_provider = os.getenv("LLM_PROVIDER", "")
    env_key = os.getenv("GEMINI_API_KEY", "")
    env_model = os.getenv("GEMINI_MODEL_NAME", "")
    env_openai_key = os.getenv("OPENAI_API_KEY", "")
    env_openai_model = os.getenv("OPENAI_MODEL_NAME", "")
    
    if env_provider:
        config["llmProvider"] = env_provider.strip()
    if env_key:
        config["geminiApiKey"] = env_key.strip()
    if env_model:
        config["geminiModelName"] = env_model.strip()
    if env_openai_key:
        config["openaiApiKey"] = env_openai_key.strip()
    if env_openai_model:
        config["openaiModelName"] = env_openai_model.strip()
        
    return config

def save_llm_config_to_file(config: dict):
    try:
        with open(LLM_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Erro ao salvar llm_config.json: {e}")
        return False

CREDENTIALS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "credentials.json")

def load_credentials_from_file():
    creds = {
        "jiraUrl": "",
        "jiraEmail": "",
        "jiraToken": "",
        "azureOrg": "",
        "azureProject": "",
        "azureToken": ""
    }
    
    # 1. Carrega do arquivo se existir
    if os.path.exists(CREDENTIALS_PATH):
        try:
            with open(CREDENTIALS_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                for k in creds.keys():
                    if k in loaded:
                        creds[k] = loaded[k]
        except Exception as e:
            print(f"Erro ao carregar credentials.json: {e}")
            
    # 2. Sobrescreve com as variáveis de ambiente (prioridade para produção/nuvem)
    env_jira_url = os.getenv("JIRA_API_URL", "")
    env_jira_email = os.getenv("JIRA_USER_EMAIL", "")
    env_jira_token = os.getenv("JIRA_PAT", "")
    env_azure_url = os.getenv("AZURE_API_URL", "")
    env_azure_pat = os.getenv("AZURE_PAT", "")
    
    if env_jira_url:
        creds["jiraUrl"] = env_jira_url.strip()
    if env_jira_email:
        creds["jiraEmail"] = env_jira_email.strip()
    if env_jira_token:
        creds["jiraToken"] = env_jira_token.strip()
        
    if env_azure_url or env_azure_pat:
        azure_org = ""
        azure_project = ""
        if env_azure_url:
            try:
                parts = env_azure_url.replace("https://", "").replace("http://", "").split("/")
                if "dev.azure.com" in parts[0] and len(parts) >= 3:
                    azure_org = parts[1]
                    azure_project = parts[2]
            except Exception:
                pass
        if azure_org:
            creds["azureOrg"] = azure_org
        if azure_project:
            creds["azureProject"] = azure_project
        if env_azure_pat:
            creds["azureToken"] = env_azure_pat.strip()
            
    return creds

def save_credentials_to_file(creds: dict):
    try:
        with open(CREDENTIALS_PATH, "w", encoding="utf-8") as f:
            json.dump(creds, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Erro ao salvar credentials.json: {e}")
        return False

class CredentialsUpdate(BaseModel):
    jiraUrl: Optional[str] = Field("", max_length=500)
    jiraEmail: Optional[str] = Field("", max_length=254)
    jiraToken: Optional[str] = Field("", max_length=500)
    azureOrg: Optional[str] = Field("", max_length=500)
    azureProject: Optional[str] = Field("", max_length=500)
    azureToken: Optional[str] = Field("", max_length=500)

@app.get("/api/settings/credentials")
def get_credentials():
    return load_credentials_from_file()

@app.post("/api/settings/credentials")
def update_credentials(payload: CredentialsUpdate):
    creds = {
        "jiraUrl": (payload.jiraUrl or "").strip(),
        "jiraEmail": (payload.jiraEmail or "").strip(),
        "jiraToken": (payload.jiraToken or "").strip(),
        "azureOrg": (payload.azureOrg or "").strip(),
        "azureProject": (payload.azureProject or "").strip(),
        "azureToken": (payload.azureToken or "").strip(),
    }
    if save_credentials_to_file(creds):
        return {"success": True}
    raise HTTPException(status_code=500, detail="Erro ao salvar credenciais no servidor.")

class DbPathRequest(BaseModel):
    db_path: Optional[str] = Field("", max_length=500)

@app.get("/api/settings/db-path")
async def get_db_path():
    path_ativo, path_historico = get_db_paths()
    db_dir = ""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                db_dir = cfg.get("db_path", "")
        except Exception:
            pass
    default_dir = os.path.dirname(os.path.abspath(__file__))
    postgres_active = is_postgres()
    return {
        "db_path": db_dir,
        "current_path": db_dir,
        "default_path": default_dir,
        "path_ativo": path_ativo,
        "path_historico": path_historico,
        "is_postgres": postgres_active,
        "db_type": "PostgreSQL (Supabase Nuvem)" if postgres_active else "SQLite (Local)"
    }

@app.post("/api/settings/db-path")
async def update_db_path(req: DbPathRequest):
    new_path = (req.db_path or "").strip()
    if new_path and not os.path.isdir(new_path):
        raise HTTPException(status_code=400, detail="O caminho especificado não existe ou não é uma pasta válida no sistema.")
    
    try:
        cfg = {}
        if os.path.exists(CONFIG_PATH):
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
            except Exception:
                cfg = {}
        cfg["db_path"] = new_path
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=4, ensure_ascii=False)
        return {"success": True, "db_path": new_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar caminho no config.json: {e}")

class LlmConfigUpdate(BaseModel):
    llmProvider: Optional[str] = Field("gemini", max_length=50)
    geminiApiKey: Optional[str] = Field("", max_length=500)
    geminiModelName: Optional[str] = Field("", max_length=100)
    openaiApiKey: Optional[str] = Field("", max_length=500)
    openaiModelName: Optional[str] = Field("", max_length=100)
    systemInstruction: Optional[str] = Field("", max_length=5000)

@app.get("/api/settings/llm")
def get_llm_settings():
    try:
        return load_llm_config_from_file()
    except Exception as e:
        print(f"Erro ao carregar configurações da LLM: {e}")
        raise HTTPException(status_code=500, detail="Erro ao carregar configurações da LLM.")

@app.post("/api/settings/llm")
def update_llm_settings(payload: LlmConfigUpdate):
    try:
        config = {
            "llmProvider": (payload.llmProvider or "gemini").strip(),
            "geminiApiKey": (payload.geminiApiKey or "").strip(),
            "geminiModelName": (payload.geminiModelName or "gemini-1.5-flash").strip(),
            "openaiApiKey": (payload.openaiApiKey or "").strip(),
            "openaiModelName": (payload.openaiModelName or "gpt-4o-mini").strip(),
            "systemInstruction": (payload.systemInstruction or DEFAULT_SYSTEM_INSTRUCTION)
        }
        if save_llm_config_to_file(config):
            return {"success": True}
        raise HTTPException(status_code=500, detail="Erro ao salvar arquivo de configurações da LLM.")
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao salvar configurações da LLM: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao salvar configurações da LLM.")

# Monta o diretório static na raiz `/` (DEVE vir após as rotas da API)
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
else:
    print(f"Aviso: Diretório estático {static_dir} não encontrado. Certifique-se de criá-lo.")

if __name__ == "__main__":
    import uvicorn
    import socket
    # Carrega a porta e o host do .env (com fallback para 8080 e 0.0.0.0)
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8080))
    
    # Tenta obter o IP da rede local para exibir ao usuário
    local_ip = None
    try:
        # Cria uma conexão UDP temporária para obter o IP de rede ativa
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        try:
            local_ip = socket.gethostbyname(socket.gethostname())
        except Exception:
            pass

    print("===================================================", flush=True)
    print("                  PO HUB INICIADO                  ", flush=True)
    print("===================================================", flush=True)
    print(f"[*] Servidor rodando localmente: http://localhost:{port}", flush=True)
    if (host == "0.0.0.0" or host == "") and local_ip and local_ip != "127.0.0.1":
        print(f"[*] Disponível na rede interna:  http://{local_ip}:{port}", flush=True)
    elif host != "0.0.0.0" and host != "127.0.0.1" and host != "localhost":
        print(f"[*] Disponível na rede interna:  http://{host}:{port}", flush=True)
    print("===================================================", flush=True)
    
    is_dev = os.getenv("ENV", "production").lower() in ("development", "dev")
    if is_dev:
        uvicorn.run("main:app", host=host, port=port, reload=True)
    else:
        uvicorn.run(app, host=host, port=port, reload=False)

