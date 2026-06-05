import os
import base64
import urllib3
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests
from dotenv import load_dotenv

from database import init_db, execute_query, fetch_all, fetch_one

# Desabilita avisos de certificados corporativos autoassinados
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Carrega variáveis de ambiente do .env
load_dotenv()

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

class DemandUpdate(BaseModel):
    promisedDate: str = None
    followUpDate: str = None
    managerNotes: str = None

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
    {"origin": "Jira", "externalId": "JIRA-101", "title": "Migração da infraestrutura local para GCP", "externalStatus": "Em Progresso", "comments_history": "[01/06/2026 10:00 - Sistema]\nImportado via carga inicial.\n\n[02/06/2026 15:30 - Product Owner]\nPrioridade alta para o próximo sprint."},
    {"origin": "Jira", "externalId": "JIRA-102", "title": "Fluxo de Checkout Simplificado (One-Click Buy)", "externalStatus": "A Fazer", "comments_history": None},
    {"origin": "Jira", "externalId": "JIRA-103", "title": "Integração de pagamento instantâneo via Pix", "externalStatus": "Concluído", "comments_history": "[30/05/2026 09:15 - Analista de QA]\nTestado em ambiente de homologação. Fluxo aprovado."},
    {"origin": "Jira", "externalId": "JIRA-104", "title": "Painel Analytics corporativo pós-venda", "externalStatus": "Backlog", "comments_history": None}
]

MOCK_AZURE_DEMANDS = [
    {"origin": "Azure", "externalId": "AZURE-501", "title": "Bug: Vazamento de memória ao alternar abas de produtos", "externalStatus": "Desenvolvimento", "comments_history": "[02/06/2026 11:22 - Desenvolvedor]\nCorrigindo vazamento no event listener do hook useEffect."},
    {"origin": "Azure", "externalId": "AZURE-502", "title": "US: Componente reutilizável de Upload Drag-and-Drop", "externalStatus": "Aprovado", "comments_history": None},
    {"origin": "Azure", "externalId": "AZURE-503", "title": "US: Refatoração do fluxo de autenticação JWT e Refresh Token", "externalStatus": "Novo", "comments_history": None},
    {"origin": "Azure", "externalId": "AZURE-504", "title": "Bug: Erro 500 intermitente ao salvar preferências de notificação", "externalStatus": "Impedido", "comments_history": "[03/06/2026 16:45 - Gestor de Projetos]\nItem bloqueado aguardando liberação da API de envio de emails corporativos."},
    {"origin": "Azure", "externalId": "AZURE-505", "title": "US: Implementação de WebSockets para notificações push na tela", "externalStatus": "Em Teste", "comments_history": None}
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

FINAL_STATUSES = {"Concluído", "Done", "Resolved", "Closed", "Improcedente", "Cancelado"}
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
    execute_query("""
        INSERT INTO demands (externalId, origin, title, externalStatus, comments_history, parentId, blockers, blocked_by, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(externalId) DO UPDATE SET
            title = excluded.title,
            externalStatus = excluded.externalStatus,
            comments_history = excluded.comments_history,
            parentId = excluded.parentId,
            blockers = excluded.blockers,
            blocked_by = excluded.blocked_by,
            updatedAt = CURRENT_TIMESTAMP
    """, (
        demand["externalId"],
        demand["origin"],
        demand["title"],
        demand["externalStatus"],
        demand.get("comments_history"),
        demand.get("parentId"),
        demand.get("blockers"),
        demand.get("blocked_by")
    ), db_name)

def fetch_jira_issue_details(key):
    try:
        jira_url_raw = os.getenv("JIRA_API_URL")
        if not jira_url_raw:
            return None
        jira_url_base = jira_url_raw.rstrip('/')
        if ".atlassian.net/jira" in jira_url_base.lower():
            jira_url_base = jira_url_base.lower().replace("/jira", "")
        
        detail_url = f"{jira_url_base}/rest/api/3/issue/{key}"
        user_email = os.getenv("JIRA_USER_EMAIL")
        pat = os.getenv("JIRA_PAT")
        auth_str = f"{user_email}:{pat}"
        auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
        
        headers = {
            "Authorization": f"Basic {auth_b64}",
            "Accept": "application/json"
        }
        params = {
            "fields": "key,summary,status,comment,parent,issuelinks,issuetype"
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
    return {
        "origin": "Jira",
        "externalId": issue.get("key") or f"JIRA-{issue.get('id')}",
        "title": fields.get("summary", "Sem título"),
        "externalStatus": fields.get("status", {}).get("name", "Sem Status") if isinstance(fields.get("status"), dict) else "Sem Status",
        "comments_history": comments_history,
        "parentId": parent_id,
        "blockers": json.dumps(blockers),
        "blocked_by": json.dumps(blocked_by)
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
                    
    import json
    return {
        "origin": "Azure",
        "externalId": f"AZ-{item.get('id')}",
        "title": f"{prefix}{fields.get('System.Title', 'Sem título')}",
        "externalStatus": fields.get("System.State", "Sem Status"),
        "comments_history": comments_history,
        "parentId": azure_parent_id,
        "blockers": json.dumps(azure_blockers),
        "blocked_by": json.dumps(azure_blocked_by)
    }

def process_sync_for_demands(fetched_demands, origin):
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
            if origin == "Jira" and has_jira_credentials():
                issue_data = fetch_jira_issue_details(key)
                if issue_data:
                    demand = parse_jira_issue(issue_data)
            elif origin == "Azure" and has_azure_credentials():
                if key.startswith("AZ-"):
                    try:
                        num_id = int(key.replace("AZ-", ""))
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
    inactive = {"concluído", "concluido", "done", "resolved", "closed", "fechado", "backlog", "a fazer", "to do", "removed", "removido", "cancelado", "canceled"}
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
            "createdAt": row["createdAt"],
            "updatedAt": row["updatedAt"],
            "promisedDate": row["promisedDate"],
            "followUpDate": row["followUpDate"],
            "managerNotes": row["managerNotes"],
            "tags": row["tags_str"].split(",") if row["tags_str"] else [],
            "externalUrl": get_external_url(row["origin"], row["externalId"]),
            "blockers": all_blockers,
            "blocked_by": all_blocked_by,
            "parentId": row.get("parentId"),
            "isStale": is_stale
        })
    return demands

# FastAPI API Endpoints

@app.post("/api/sync")
def sync_demands():
    print("Iniciando sincronização com Dois Bancos...")
    jira_fetched = []
    azure_fetched = []
    sync_source = {"jira": "mock", "azure": "mock"}
    errors = []

    # 1. Jira Sync
    if has_jira_credentials():
        try:
            print("Buscando dados reais do Jira...")
            jira_url_raw = os.getenv("JIRA_API_URL")
            jira_url_base = jira_url_raw.rstrip('/')
            if ".atlassian.net/jira" in jira_url_base.lower():
                jira_url_base = jira_url_base.lower().replace("/jira", "")
                
            jira_url = f"{jira_url_base}/rest/api/3/search/jql"
            user_email = os.getenv("JIRA_USER_EMAIL")
            pat = os.getenv("JIRA_PAT")
            auth_str = f"{user_email}:{pat}"
            auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Accept": "application/json"
            }
            params = {
                "jql": 'issuetype in (Epic, Opportunity, "Epic", "Oportunidade") AND status not in ("Concluído", "Done", "Resolved", "Closed", "Improcedente", "Cancelado") AND (reporter = currentUser() OR reporter = "arlindo.junior@sicoob.com.br")',
                "maxResults": 50,
                "fields": "key,summary,status,comment,parent,issuelinks,issuetype"
            }
            
            response = requests.get(jira_url, headers=headers, params=params, verify=VERIFY_SSL, timeout=12)
            if response.status_code == 200:
                issues = response.json().get("issues", [])
                for issue in issues:
                    parsed = parse_jira_issue(issue)
                    jira_fetched.append(parsed)
                sync_source["jira"] = "real"
            else:
                err_msg = f"Jira HTTP {response.status_code}: {response.text[:150]}"
                print(f"Erro na sincronização do Jira: {err_msg}")
                errors.append(err_msg)
                jira_fetched = MOCK_JIRA_DEMANDS
        except Exception as e:
            err_msg = f"Falha na conexão com Jira: {str(e)}"
            print(err_msg)
            errors.append(err_msg)
            jira_fetched = MOCK_JIRA_DEMANDS
    else:
        print("Credenciais do Jira ausentes. Usando dados fictícios.")
        jira_fetched = MOCK_JIRA_DEMANDS

    # 2. Azure DevOps Sync
    if has_azure_credentials():
        try:
            print("Buscando dados reais do Azure DevOps...")
            azure_url = os.getenv("AZURE_API_URL").rstrip('/')
            pat = os.getenv("AZURE_PAT")
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
                    "AND [System.State] NOT IN ('Concluído', 'Done', 'Resolved', 'Closed', 'Improcedente', 'Cancelado') "
                    "AND ("
                    "[System.CreatedBy] = @me "
                    "OR [System.CreatedBy] = 'arlindo.junior@sicoob.com.br' "
                    "OR [System.CreatedBy] = 'Arlindo Honorato Pereira Junior' "
                    "OR [System.CreatedBy] = 'Arlindo Honorato Pereira Júnior' "
                    "OR [System.AssignedTo] = @me "
                    "OR [System.AssignedTo] = 'arlindo.junior@sicoob.com.br' "
                    "OR [System.AssignedTo] = 'Arlindo Honorato Pereira Junior' "
                    "OR [System.AssignedTo] = 'Arlindo Honorato Pereira Júnior'"
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
                azure_fetched = MOCK_AZURE_DEMANDS
        except Exception as e:
            err_msg = f"Falha na conexão com Azure DevOps: {str(e)}"
            print(err_msg)
            errors.append(err_msg)
            azure_fetched = MOCK_AZURE_DEMANDS
    else:
        print("Credenciais do Azure DevOps ausentes. Usando dados fictícios.")
        azure_fetched = MOCK_AZURE_DEMANDS

    # Process sync using our unified selective sync function
    try:
        jira_count = process_sync_for_demands(jira_fetched, "Jira")
        azure_count = process_sync_for_demands(azure_fetched, "Azure")
        
        return {
            "success": len(errors) < 2,
            "message": "Sincronização processada com arquitetura de Dois Bancos.",
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
            "parentId": demand.get("parentId"),
            "isStale": is_stale,
            "comments_history": demand["comments_history"]
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao obter demanda {external_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao carregar detalhes da demanda.")

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

# Monta o diretório static na raiz `/` (DEVE vir após as rotas da API)
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
else:
    print(f"Aviso: Diretório estático {static_dir} não encontrado. Certifique-se de criá-lo.")
