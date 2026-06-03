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

# Dados Mockados para fallback (usados apenas se não houver credenciais configuradas)
MOCK_JIRA_DEMANDS = [
    {"origin": "Jira", "externalId": "JIRA-101", "title": "Migração da infraestrutura local para GCP", "externalStatus": "Em Progresso"},
    {"origin": "Jira", "externalId": "JIRA-102", "title": "Fluxo de Checkout Simplificado (One-Click Buy)", "externalStatus": "A Fazer"},
    {"origin": "Jira", "externalId": "JIRA-103", "title": "Integração de pagamento instantâneo via Pix", "externalStatus": "Concluído"},
    {"origin": "Jira", "externalId": "JIRA-104", "title": "Painel Analytics corporativo pós-venda", "externalStatus": "Backlog"}
]

MOCK_AZURE_DEMANDS = [
    {"origin": "Azure", "externalId": "AZURE-501", "title": "Bug: Vazamento de memória ao alternar abas de produtos", "externalStatus": "Desenvolvimento"},
    {"origin": "Azure", "externalId": "AZURE-502", "title": "US: Componente reutilizável de Upload Drag-and-Drop", "externalStatus": "Aprovado"},
    {"origin": "Azure", "externalId": "AZURE-503", "title": "US: Refatoração do fluxo de autenticação JWT e Refresh Token", "externalStatus": "Novo"},
    {"origin": "Azure", "externalId": "AZURE-504", "title": "Bug: Erro 500 intermitente ao salvar preferências de notificação", "externalStatus": "Impedido"},
    {"origin": "Azure", "externalId": "AZURE-505", "title": "US: Implementação de WebSockets para notificações push na tela", "externalStatus": "Em Teste"}
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

# API Endpoints

@app.post("/api/sync")
def sync_demands():
    print("Iniciando sincronização...")
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
            
            # Limpa o sufixo /jira para domínios Atlassian Cloud
            if ".atlassian.net/jira" in jira_url_base.lower():
                jira_url_base = jira_url_base.lower().replace("/jira", "")
                print(f"Jira URL limpa para: {jira_url_base}")
                
            # Novo endpoint JQL da API v3 do Jira
            jira_url = f"{jira_url_base}/rest/api/3/search/jql"
            user_email = os.getenv("JIRA_USER_EMAIL")
            pat = os.getenv("JIRA_PAT")
            auth_str = f"{user_email}:{pat}"
            auth_b64 = base64.b64encode(auth_str.encode('utf-8')).decode('utf-8')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Accept": "application/json"
            }
            # É necessário passar o parâmetro fields para obter key, summary e status no endpoint /search/jql
            # Filtra apenas as demandas relatadas pelo usuário (relator)
            params = {
                "jql": 'issuetype in (Epic, Opportunity, "Epic") AND (reporter = currentUser() OR reporter = "arlindo.junior@sicoob.com.br")',
                "maxResults": 50,
                "fields": "key,summary,status"
            }
            
            response = requests.get(jira_url, headers=headers, params=params, verify=VERIFY_SSL, timeout=12)
            if response.status_code == 200:
                issues = response.json().get("issues", [])
                for issue in issues:
                    fields = issue.get("fields", {})
                    jira_fetched.append({
                        "origin": "Jira",
                        "externalId": issue.get("key") or f"JIRA-{issue.get('id')}",
                        "title": fields.get("summary", "Sem título"),
                        "externalStatus": fields.get("status", {}).get("name", "Sem Status")
                    })
                sync_source["jira"] = "real"
                print(f"Jira sincronizado com sucesso: {len(jira_fetched)} itens.")
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
            
            # WIQL para obter work items criados por ou atribuídos ao usuário (sem limite de data pois o escopo por usuário é pequeno e seguro)
            wiql_url = f"{azure_url}/_apis/wit/wiql?api-version=6.0"
            wiql_query = {
                "query": (
                    "Select [System.Id] From WorkItems Where [System.State] <> 'Removed' "
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
                    # Buscamos os detalhes em blocos de até 200 IDs (limite da API do Azure)
                    chunk_size = 200
                    azure_fetched = []
                    for i in range(0, len(work_items_refs), chunk_size):
                        chunk = work_items_refs[i:i + chunk_size]
                        ids = ",".join([str(item["id"]) for item in chunk])
                        detail_url = f"{azure_url}/_apis/wit/workitems?ids={ids}&api-version=6.0"
                        
                        detail_response = requests.get(detail_url, headers=headers, verify=VERIFY_SSL, timeout=12)
                        if detail_response.status_code == 200:
                            value = detail_response.json().get("value", [])
                            for item in value:
                                fields = item.get("fields", {})
                                item_type = fields.get("System.WorkItemType", "")
                                if item_type == "User Story":
                                    prefix = "US: "
                                elif item_type == "Bug":
                                    prefix = "Bug: "
                                else:
                                    prefix = f"{item_type}: " if item_type else ""
                                azure_fetched.append({
                                    "origin": "Azure",
                                    "externalId": f"AZ-{item.get('id')}",
                                    "title": f"{prefix}{fields.get('System.Title', 'Sem título')}",
                                    "externalStatus": fields.get("System.State", "Sem Status")
                                })
                        else:
                            err_msg = f"Azure DevOps Details HTTP {detail_response.status_code}"
                            errors.append(err_msg)
                            break
                    
                    if azure_fetched:
                        sync_source["azure"] = "real"
                        print(f"Azure DevOps sincronizado com sucesso: {len(azure_fetched)} itens.")
                    else:
                        azure_fetched = MOCK_AZURE_DEMANDS
                else:
                    print("Nenhum item recente encontrado no Azure DevOps.")
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

    # Combina tudo
    all_demands = jira_fetched + azure_fetched

    # Insere/Atualiza no SQLite
    try:
        for demand in all_demands:
            execute_query("""
                INSERT INTO demands (externalId, origin, title, externalStatus, updatedAt)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(externalId) DO UPDATE SET
                    title = excluded.title,
                    externalStatus = excluded.externalStatus,
                    updatedAt = CURRENT_TIMESTAMP
            """, (demand["externalId"], demand["origin"], demand["title"], demand["externalStatus"]))
        
        return {
            "success": len(errors) < 2, # Sucesso se pelo menos uma conexão ou fallback funcionou
            "message": "Sincronização processada.",
            "sources": sync_source,
            "count": len(all_demands),
            "errors": errors if errors else None
        }
    except Exception as db_err:
        print(f"Erro ao persistir sincronização no banco: {db_err}")
        raise HTTPException(status_code=500, detail="Erro interno ao gravar demandas sincronizadas.")

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

@app.get("/api/demands")
def list_demands():
    try:
        deps = fetch_all("SELECT blocked_id, blocker_id FROM dependencies")
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

        query = """
            SELECT d.*, group_concat(t.tag) as tags_str
            FROM demands d
            LEFT JOIN tags t ON d.externalId = t.externalId
            GROUP BY d.externalId
            ORDER BY d.updatedAt DESC
        """
        rows = fetch_all(query)
        demands = []
        now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
        
        for row in rows:
            is_stale = False
            if is_status_active(row["externalStatus"]):
                updated_dt = parse_date(row["updatedAt"])
                if updated_dt and (now_utc - updated_dt > timedelta(days=5)):
                    is_stale = True
                    
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
                "blockers": blockers_map.get(row["externalId"], []),
                "blocked_by": blocked_by_map.get(row["externalId"], []),
                "isStale": is_stale
            })
        return demands
    except Exception as e:
        print(f"Erro ao listar demandas: {e}")
        raise HTTPException(status_code=500, detail="Erro ao buscar demandas locais.")

@app.get("/api/demands/{external_id}")
def get_demand(external_id: str):
    try:
        demand = fetch_one("SELECT * FROM demands WHERE externalId = ?", (external_id,))
        if not demand:
            raise HTTPException(status_code=404, detail="Demanda não encontrada no cache local.")
        
        annotations_rows = fetch_all(
            "SELECT id, content, createdAt FROM annotations WHERE externalId = ? ORDER BY createdAt DESC",
            (external_id,)
        )
        
        tags_rows = fetch_all("SELECT tag FROM tags WHERE externalId = ?", (external_id,))
        tags = [row["tag"] for row in tags_rows]
        
        blockers_rows = fetch_all("SELECT blocker_id FROM dependencies WHERE blocked_id = ?", (external_id,))
        blocked_by_rows = fetch_all("SELECT blocked_id FROM dependencies WHERE blocker_id = ?", (external_id,))
        
        blockers = [row["blocker_id"] for row in blockers_rows]
        blocked_by = [row["blocked_id"] for row in blocked_by_rows]
        
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
            "blockers": blockers,
            "blocked_by": blocked_by,
            "isStale": is_stale
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
        demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,))
        if not demand:
            raise HTTPException(status_code=404, detail="Demanda não encontrada.")
            
        cursor = execute_query(
            "INSERT INTO annotations (externalId, content) VALUES (?, ?)",
            (external_id, content)
        )
        
        # Busca a anotação recém-inserida
        last_id = cursor.lastrowid
        new_ann = fetch_one("SELECT * FROM annotations WHERE id = ?", (last_id,))
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
        demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,))
        if not demand:
            raise HTTPException(status_code=404, detail="Demanda não encontrada.")
            
        execute_query("INSERT OR IGNORE INTO tags (externalId, tag) VALUES (?, ?)", (external_id, tag))
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
        execute_query("DELETE FROM tags WHERE externalId = ? AND tag = ?", (external_id, tag_clean))
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
        blocked_exist = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,))
        blocker_exist = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (blocker_id,))
        if not blocked_exist or not blocker_exist:
            raise HTTPException(status_code=404, detail="Uma ou ambas as demandas não foram encontradas no banco local.")
            
        execute_query("INSERT OR IGNORE INTO dependencies (blocked_id, blocker_id) VALUES (?, ?)", (external_id, blocker_id))
        return {"success": True, "blocked_id": external_id, "blocker_id": blocker_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro ao criar dependência: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao criar dependência.")

@app.delete("/api/demands/{external_id}/dependencies/{blocker_id}")
def delete_dependency(external_id: str, blocker_id: str):
    try:
        execute_query("DELETE FROM dependencies WHERE blocked_id = ? AND blocker_id = ?", (external_id, blocker_id))
        return {"success": True}
    except Exception as e:
        print(f"Erro ao deletar dependência: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao deletar dependência.")

@app.patch("/api/demands/{external_id}")
def update_demand(external_id: str, payload: DemandUpdate):
    try:
        demand = fetch_one("SELECT 1 FROM demands WHERE externalId = ?", (external_id,))
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
            tuple(params)
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
