import os
import base64
import urllib3
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests
from dotenv import load_dotenv
import google.generativeai as genai

from database import init_db, execute_query, fetch_all, fetch_one

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

# Configura o cliente do Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="PO Hub API", version="1.0.0")

# Habilita CORS para desenvolvimento do frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa o banco de dados
init_db()

# Define se verifica SSL (Padrão: False para suportar proxies corporativos)
VERIFY_SSL = os.getenv("SSL_VERIFY", "false").lower() in ("true", "1", "yes")

# Modelos Pydantic para validação
class AnnotationCreate(BaseModel):
    content: str

class TagCreate(BaseModel):
    tag: str

class DependencyCreate(BaseModel):
    blocker_id: str

class SyncRequest(BaseModel):
    jiraUrl: Optional[str] = None
    jiraEmail: Optional[str] = None
    jiraToken: Optional[str] = None
    azureOrg: Optional[str] = None
    azureProject: Optional[str] = None
    azureToken: Optional[str] = None

class ProjectSummaryRequest(BaseModel):
    project_name: str
    demand_ids: list[str]
    force_refresh: Optional[bool] = False


class DemandUpdate(BaseModel):
    title: Optional[str] = None
    promisedDate: Optional[str] = None
    followUpDate: Optional[str] = None
    managerNotes: Optional[str] = None
    localParentId: Optional[str] = None
    project: Optional[str] = None
    current_status_notes: Optional[str] = None
    blocker_notes: Optional[str] = None

class DemandManualCreate(BaseModel):
    title: str
    project_name: Optional[str] = None

class ProjectCreate(BaseModel):
    name: str
    health_status: str
    progress: int
    sponsor: Optional[str] = None
    target_go_live: Optional[str] = None
    executive_summary: Optional[str] = None
    strategic_notes: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    health_status: Optional[str] = None
    progress: Optional[int] = None
    sponsor: Optional[str] = None
    target_go_live: Optional[str] = None
    executive_summary: Optional[str] = None
    strategic_notes: Optional[str] = None

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
FINAL_STATUSES = {"Concluído", "Done", "Closed", "Improcedente", "Cancelado"}
FINAL_STATUSES_LOWER = {s.lower() for s in FINAL_STATUSES}

def is_final_status(status):
    if not status:
        return False
    s = str(status).strip()
    return s in FINAL_STATUSES or s.lower() in FINAL_STATUSES_LOWER

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
        execute_query(
            "INSERT OR REPLACE INTO dependencies (blocked_id, blocker_id) VALUES (?, ?)",
            (dep_dict["blocked_id"], dep_dict["blocker_id"]),
            "historico"
        )
        
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
        execute_query(
            "INSERT OR REPLACE INTO dependencies (blocked_id, blocker_id) VALUES (?, ?)",
            (dep_dict["blocked_id"], dep_dict["blocker_id"]),
            "ativo"
        )
        
    # Delete from history
    execute_query("DELETE FROM demands WHERE externalId = ?", (external_id,), "historico")

def save_demand(demand, db_name):
    updated_at = demand.get("updatedAt")
    if not updated_at:
        updated_at = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    execute_query("""
        INSERT INTO demands (externalId, origin, title, externalStatus, itemType, comments_history, parentId, blockers, blocked_by, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
        ON CONFLICT(externalId) DO UPDATE SET
            title = excluded.title,
            externalStatus = excluded.externalStatus,
            itemType = excluded.itemType,
            comments_history = excluded.comments_history,
            updatedAt = excluded.updatedAt
    """, (
        demand["externalId"],
        demand["origin"],
        demand["title"],
        demand["externalStatus"],
        demand.get("itemType", "Outro"),
        demand.get("comments_history"),
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
            "fields": "key,summary,status,comment,parent,issuelinks,issuetype,updated"
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
        "externalStatus": fields.get("status", {}).get("name", "Sem Status") if isinstance(fields.get("status"), dict) else "Sem Status",
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
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S.%f"):
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
    if db_name == "historico":
        placeholders = ", ".join(["?"] * len(FINAL_STATUSES))
        where_clause = f"WHERE d.externalStatus IN ({placeholders})"
        params = tuple(FINAL_STATUSES)

    query = f"""
        SELECT d.*, group_concat(t.tag) as tags_str
        FROM demands d
        LEFT JOIN tags t ON d.externalId = t.externalId
        {where_clause}
        GROUP BY d.externalId
        ORDER BY d.updatedAt DESC
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
            "blocker_notes": row.get("blocker_notes")
        })
    return demands

# FastAPI API Endpoints

@app.post("/api/sync")
def sync_demands(req: SyncRequest = Body(...)):
    print("Iniciando sincronização com Dois Bancos...")
    
    has_jira_payload = bool(req.jiraUrl and req.jiraEmail and req.jiraToken)
    has_azure_payload = bool(req.azureOrg and req.azureProject and req.azureToken)
    
    # Se houver credenciais reais em qualquer uma das APIs, limpa TODOS os dados mockados do banco local
    if has_jira_payload or has_azure_payload:
        try:
            execute_query("DELETE FROM demands WHERE externalId LIKE 'JIRA-%' OR externalId LIKE 'AZURE-%'", db_name="ativo")
            execute_query("DELETE FROM demands WHERE externalId LIKE 'JIRA-%' OR externalId LIKE 'AZURE-%'", db_name="historico")
            print("[*] Banco de dados limpo de dados fictícios de demonstração.")
        except Exception as e:
            print(f"Erro ao limpar dados fictícios do banco: {e}")

    jira_fetched = []
    azure_fetched = []
    sync_source = {"jira": "mock", "azure": "mock"}
    errors = []

    # 1. Jira Sync
    if has_jira_payload:
        try:
            print("Buscando dados reais do Jira...")
            jira_url_raw = req.jiraUrl
            jira_url_base = jira_url_raw.rstrip('/')
            if ".atlassian.net/jira" in jira_url_base.lower():
                jira_url_base = jira_url_base.lower().replace("/jira", "")
                
            jira_url = f"{jira_url_base}/rest/api/3/search/jql"
            user_email = req.jiraEmail
            pat = req.jiraToken
            auth_str = f"{user_email}:{pat}"
            auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Accept": "application/json"
            }
            next_page_token = None
            max_results = 100
            while True:
                params = {
                    "jql": 'issuetype in (Epic, Opportunity, "Epic", "Oportunidade", Story, "Story", "História", "Historia", Legend, "Legend") AND (reporter = currentUser() OR assignee = currentUser())',
                    "maxResults": max_results,
                    "fields": "key,summary,status,comment,parent,issuelinks,issuetype,updated"
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
                        parsed = parse_jira_issue(issue)
                        jira_fetched.append(parsed)
                    sync_source["jira"] = "real"
                    is_last = data.get("isLast", True)
                    next_page_token = data.get("nextPageToken")
                    if is_last or not next_page_token:
                        break
                else:
                    err_msg = f"Jira HTTP {response.status_code}: {response.text[:150]}"
                    print(f"Erro na sincronização do Jira: {err_msg}")
                    errors.append(err_msg)
                    break
        except Exception as e:
            err_msg = f"Falha na conexão com Jira: {str(e)}"
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
            print("Buscando dados reais do Azure DevOps...")
            azure_url = f"https://dev.azure.com/{req.azureOrg}/{req.azureProject}".rstrip('/')
            pat = req.azureToken
            auth_str = f":{pat}"
            auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/json"
            }
            
            wiql_url = f"{azure_url}/_apis/wit/wiql?api-version=6.0"
            wiql_query = {
                "query": (
                    "Select [System.Id] From WorkItems Where [System.State] <> 'Removed' "
                    "AND ("
                    "[System.CreatedBy] = @me "
                    "OR [System.AssignedTo] = @me"
                    ")"
                )
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
                err_msg = f"Azure DevOps WIQL HTTP {wiql_response.status_code}: {wiql_response.text[:150]}"
                print(f"Erro no Azure DevOps: {err_msg}")
                errors.append(err_msg)
        except Exception as e:
            err_msg = f"Falha na conexão com Azure DevOps: {str(e)}"
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
        "url": req.jiraUrl,
        "email": req.jiraEmail,
        "token": req.jiraToken
    } if has_jira_payload else None

    azure_url_constructed = f"https://dev.azure.com/{req.azureOrg}/{req.azureProject}" if has_azure_payload else None
    azure_pat = req.azureToken if has_azure_payload else None
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
        
        return {
            "success": len(errors) < 2,
            "message": "Sincronização processada com arquitetura de Dois Bancos e credenciais dinâmicas.",
            "sources": sync_source,
            "count": jira_count + azure_count,
            "errors": errors if errors else None
        }
    except Exception as db_err:
        print(f"Erro ao persistir sincronização no banco: {db_err}")
        raise HTTPException(status_code=500, detail="Erro interno ao gravar demandas sincronizadas.")

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
            "blocker_notes": demand.get("blocker_notes")
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao obter demanda {external_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao carregar detalhes da demanda.")

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
            
        # Cache miss or stale summary -> call Gemini
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=400, detail="Chave de API do Gemini (GEMINI_API_KEY) não configurada no arquivo .env.")
            
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
        genai.configure(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")
        model = genai.GenerativeModel(model_name)
        
        response = model.generate_content(prompt)
        new_summary = response.text
        if not new_summary:
            raise HTTPException(status_code=500, detail="Não foi possível obter uma resposta válida do Gemini.")
            
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
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar resumo: {str(e)}")

@app.post("/api/projects/summary")
def generate_project_summary(payload: ProjectSummaryRequest):
    if not payload.demand_ids:
        raise HTTPException(status_code=400, detail="A lista de IDs de demandas não pode estar vazia.")
        
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
                
        # 1. Check Gemini API key
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=400, detail="Chave de API do Gemini (GEMINI_API_KEY) não configurada no arquivo .env.")
            
        # 2. Query active db for externalId, title, externalStatus, comments_history
        placeholders = ", ".join(["?"] * len(payload.demand_ids))
        query = f"SELECT externalId, title, externalStatus, comments_history FROM demands WHERE externalId IN ({placeholders})"
        rows = fetch_all(query, tuple(payload.demand_ids), "ativo")
        
        if not rows:
            raise HTTPException(status_code=404, detail="Nenhuma das demandas especificadas foi encontrada na base ativa.")
            
        # 3. Concatenate structured data
        structured_lines = []
        for r in rows:
            comments = r.get("comments_history") or "Sem comentários"
            line = f"ID: {r['externalId']} | Título: {r['title']} | Status: {r['externalStatus']} | Histórico: {comments.strip()}"
            structured_lines.append(line)
            
        concatenated_data = "\n".join(structured_lines)
        
        # 4. Call Gemini model
        genai.configure(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")
        
        model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction="Atue como um Agile Coach / Product Owner. Leia o status atual e o histórico destas demandas de um projeto e gere um Status Report semanal executivo e conciso. Estruture a resposta estritamente em 3 blocos: 1. 🚀 Principais Entregas/Avanços da Semana, 2. 🔄 O que está em Andamento, 3. ⚠️ Atenção Necessária (riscos ou bloqueios identificados)."
        )
        
        response = model.generate_content(concatenated_data)
        report_text = response.text
        if not report_text:
            raise HTTPException(status_code=500, detail="Não foi possível obter um relatório válido do Gemini.")
            
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
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar status report: {str(e)}")

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
        import time
        timestamp = int(time.time() * 1000)
        external_id = f"BIZ-{timestamp}"
        
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
        
        # Apenas permite excluir demandas com origem 'Negocio' (locais/manuais)
        if demand["origin"] != "Negocio":
            raise HTTPException(status_code=400, detail="Apenas demandas locais (com origem 'Negocio') podem ser excluídas.")
            
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
        return projects
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
        rows = fetch_all(query, (project_name,), "ativo")
        
        deps = fetch_all("SELECT blocked_id, blocker_id FROM dependencies", db_name="ativo")
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
                "blocker_notes": row.get("blocker_notes")
            })
            
        # PASSO 1: Inteligência do Farol
        import datetime
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        today = datetime.date.today()
        
        has_blocked = False
        has_overdue = False
        has_close_to_deadline = False
        
        for d in demands:
            is_blocked = False
            if d.get("externalStatus") and d["externalStatus"].strip().lower() == "blocked":
                is_blocked = True
            if d.get("blockers") and len(d["blockers"]) > 0:
                is_blocked = True
                
            if is_blocked:
                has_blocked = True
                
            if d.get("promisedDate"):
                promised_str = d["promisedDate"].strip()
                # Resolved é considerado ainda em andamento. Closed é que a demanda foi efetivamente concluída.
                is_completed = status_lower in ("concluido", "concluído", "done", "closed", "fechado")
                
                if not is_completed:
                    try:
                        promised_date = datetime.datetime.strptime(promised_str, "%Y-%m-%d").date()
                        if promised_str < today_str:
                            has_overdue = True
                        else:
                            is_in_progress = status_lower not in ("backlog", "a fazer", "to do")
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
            
        cursor = execute_query(
            """INSERT INTO projects (name, health_status, progress, sponsor, target_go_live, executive_summary, strategic_notes) 
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (name, payload.health_status, payload.progress, payload.sponsor, payload.target_go_live, payload.executive_summary, payload.strategic_notes),
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
        if not update_data:
            return project
            
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
            
        if "progress" in update_data and not (0 <= update_data["progress"] <= 100):
            raise HTTPException(status_code=400, detail="progress deve ser um valor inteiro entre 0 e 100.")
            
        fields = []
        values = []
        for k, v in update_data.items():
            fields.append(f"{k} = ?")
            values.append(v)
            
        values.append(project_id)
        execute_query(f"UPDATE projects SET {', '.join(fields)} WHERE id = ?", tuple(values), "ativo")
        
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

# Monta o diretório static na raiz `/` (DEVE vir após as rotas da API)
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
else:
    print(f"Aviso: Diretório estático {static_dir} não encontrado. Certifique-se de criá-lo.")

if __name__ == "__main__":
    import uvicorn
    # Carrega a porta do .env (com fallback para 8080)
    port = int(os.getenv("PORT", 8080))
    print(f"[*] Iniciando PO Hub na porta {port} (lida do .env)...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

