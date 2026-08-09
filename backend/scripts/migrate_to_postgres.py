import os
import sys
import sqlite3
import psycopg2
from psycopg2.extras import execute_batch, RealDictCursor
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
from database import get_db_paths

env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path)

db_url = os.getenv("DATABASE_URL")
if not db_url or not db_url.startswith("postgres"):
    print("[!] DATABASE_URL inválido ou não configurado no .env")
    sys.exit(1)

print("[*] Conectando ao Supabase PostgreSQL...")
pg_conn = psycopg2.connect(db_url)
pg_cursor = pg_conn.cursor()

# 1. Garantir que tabelas existem no PostgreSQL
tables_schema = [
    """
    CREATE TABLE IF NOT EXISTS demands (
        externalId VARCHAR(100) PRIMARY KEY,
        origin VARCHAR(50),
        title TEXT NOT NULL,
        externalStatus VARCHAR(100) NOT NULL,
        itemType VARCHAR(50) DEFAULT 'Outro',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        promisedDate VARCHAR(100),
        followUpDate VARCHAR(100),
        managerNotes TEXT,
        comments_history TEXT,
        parentId VARCHAR(100),
        localParentId VARCHAR(100),
        blockers TEXT,
        blocked_by TEXT,
        ai_summary TEXT,
        summary_updated_at VARCHAR(100),
        project VARCHAR(100),
        current_status_notes TEXT,
        blocker_notes TEXT,
        priority_rank INTEGER,
        in_tactical_planning INTEGER DEFAULT 0,
        planned_start_date VARCHAR(100),
        planned_end_date VARCHAR(100)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        health_status VARCHAR(20) NOT NULL,
        progress INTEGER NOT NULL,
        sponsor VARCHAR(100),
        target_go_live VARCHAR(100),
        executive_summary TEXT,
        strategic_notes TEXT,
        has_gantt_chart INTEGER DEFAULT 0
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS annotations (
        id SERIAL PRIMARY KEY,
        externalId VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS tags (
        externalId VARCHAR(100) NOT NULL,
        tag VARCHAR(50) NOT NULL,
        PRIMARY KEY (externalId, tag)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS dependencies (
        blocked_id VARCHAR(100) NOT NULL,
        blocker_id VARCHAR(100) NOT NULL,
        PRIMARY KEY (blocked_id, blocker_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS status_mappings (
        id SERIAL PRIMARY KEY,
        origin VARCHAR(50),
        external_status VARCHAR(100) NOT NULL,
        mapped_status VARCHAR(50) NOT NULL,
        UNIQUE(origin, external_status)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS project_reports (
        project_name VARCHAR(100) PRIMARY KEY,
        report_text TEXT,
        generated_at VARCHAR(100)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sync_metadata (
        key VARCHAR(100) PRIMARY KEY,
        val TEXT
    );
    """
]

for ddl in tables_schema:
    pg_cursor.execute(ddl)
pg_conn.commit()

path_ativo, path_historico = get_db_paths()
print(f"[*] Caminhos de origem identificados:")
print(f"    - Ativo: {path_ativo}")
print(f"    - Histórico: {path_historico}")

db_paths = [path_ativo, path_historico]

total_demands = 0
total_projects = 0
total_tags = 0
total_annotations = 0
total_deps = 0
total_status_mappings = 0

for sqlite_path in db_paths:
    if not os.path.exists(sqlite_path):
        print(f"[!] Arquivo {sqlite_path} não encontrado. Pulando...")
        continue

    print(f"[*] Processando arquivo SQLite: {sqlite_path}...")
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    # Projects
    try:
        sqlite_cursor.execute("SELECT * FROM projects")
        projects = [dict(r) for r in sqlite_cursor.fetchall()]
        if projects:
            sql_proj = """
                INSERT INTO projects (id, name, health_status, progress, sponsor, target_go_live, executive_summary, strategic_notes, has_gantt_chart)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    health_status = EXCLUDED.health_status,
                    progress = EXCLUDED.progress,
                    sponsor = EXCLUDED.sponsor,
                    target_go_live = EXCLUDED.target_go_live,
                    executive_summary = EXCLUDED.executive_summary,
                    strategic_notes = EXCLUDED.strategic_notes,
                    has_gantt_chart = EXCLUDED.has_gantt_chart
            """
            proj_data = [(p["id"], p["name"], p["health_status"], p["progress"], p.get("sponsor"), p.get("target_go_live"), p.get("executive_summary"), p.get("strategic_notes"), p.get("has_gantt_chart", 0)) for p in projects]
            execute_batch(pg_cursor, sql_proj, proj_data)
            total_projects += len(projects)
    except Exception as e:
        print(f"[!] Aviso em projetos ({sqlite_path}): {e}")

    # Demands
    try:
        sqlite_cursor.execute("SELECT * FROM demands")
        demands = [dict(r) for r in sqlite_cursor.fetchall()]
        if demands:
            sql_dem = """
                INSERT INTO demands (
                    externalId, origin, title, externalStatus, itemType, promisedDate, followUpDate,
                    managerNotes, comments_history, parentId, localParentId, blockers, blocked_by,
                    ai_summary, summary_updated_at, project, current_status_notes, blocker_notes,
                    priority_rank, in_tactical_planning, planned_start_date, planned_end_date
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) ON CONFLICT (externalId) DO UPDATE SET
                    title = EXCLUDED.title,
                    externalStatus = EXCLUDED.externalStatus,
                    itemType = EXCLUDED.itemType,
                    managerNotes = EXCLUDED.managerNotes,
                    comments_history = EXCLUDED.comments_history,
                    project = EXCLUDED.project,
                    current_status_notes = EXCLUDED.current_status_notes,
                    blocker_notes = EXCLUDED.blocker_notes,
                    priority_rank = EXCLUDED.priority_rank,
                    in_tactical_planning = EXCLUDED.in_tactical_planning
            """
            dem_data = [
                (
                    d["externalId"], d["origin"], d["title"], d["externalStatus"], d.get("itemType", "Outro"),
                    d.get("promisedDate"), d.get("followUpDate"), d.get("managerNotes"), d.get("comments_history"),
                    d.get("parentId"), d.get("localParentId"), d.get("blockers"), d.get("blocked_by"),
                    d.get("ai_summary"), d.get("summary_updated_at"), d.get("project"), d.get("current_status_notes"),
                    d.get("blocker_notes"), d.get("priority_rank"), d.get("in_tactical_planning", 0),
                    d.get("planned_start_date"), d.get("planned_end_date")
                )
                for d in demands
            ]
            execute_batch(pg_cursor, sql_dem, dem_data, page_size=100)
            total_demands += len(demands)
    except Exception as e:
        print(f"[!] Erro em demandas ({sqlite_path}): {e}")

    # Tags
    try:
        sqlite_cursor.execute("SELECT * FROM tags")
        tags = [dict(r) for r in sqlite_cursor.fetchall()]
        if tags:
            sql_tag = "INSERT INTO tags (externalId, tag) VALUES (%s, %s) ON CONFLICT (externalId, tag) DO NOTHING"
            execute_batch(pg_cursor, sql_tag, [(t["externalId"], t["tag"]) for t in tags])
            total_tags += len(tags)
    except Exception:
        pass

    # Annotations
    try:
        sqlite_cursor.execute("SELECT * FROM annotations")
        anns = [dict(r) for r in sqlite_cursor.fetchall()]
        if anns:
            sql_ann = "INSERT INTO annotations (externalId, content, createdAt) VALUES (%s, %s, %s)"
            execute_batch(pg_cursor, sql_ann, [(a["externalId"], a["content"], a.get("createdAt")) for a in anns])
            total_annotations += len(anns)
    except Exception:
        pass

    # Dependencies
    try:
        sqlite_cursor.execute("SELECT * FROM dependencies")
        deps = [dict(r) for r in sqlite_cursor.fetchall()]
        if deps:
            sql_dep = "INSERT INTO dependencies (blocked_id, blocker_id) VALUES (%s, %s) ON CONFLICT (blocked_id, blocker_id) DO NOTHING"
            execute_batch(pg_cursor, sql_dep, [(dp["blocked_id"], dp["blocker_id"]) for dp in deps])
            total_deps += len(deps)
    except Exception:
        pass

    # Status Mappings
    try:
        sqlite_cursor.execute("SELECT * FROM status_mappings")
        mappings = [dict(r) for r in sqlite_cursor.fetchall()]
        if mappings:
            sql_map = """
                INSERT INTO status_mappings (origin, external_status, mapped_status)
                VALUES (%s, %s, %s)
                ON CONFLICT (origin, external_status) DO UPDATE SET
                    mapped_status = EXCLUDED.mapped_status
            """
            map_data = [(m["origin"], m["external_status"], m["mapped_status"]) for m in mappings]
            execute_batch(pg_cursor, sql_map, map_data)
            total_status_mappings += len(mappings)
    except Exception as e:
        print(f"[!] Erro em status_mappings ({sqlite_path}): {e}")

    sqlite_conn.close()

pg_conn.commit()
pg_cursor.close()
pg_conn.close()

print(f"[*] RESUMO DA MIGRAÇÃO PARA SUPABASE POSTGRESQL:")
print(f"    - Projetos Migrados: {total_projects}")
print(f"    - Demandas Migradas (Ativas + Histórico): {total_demands}")
print(f"    - Tags Migradas: {total_tags}")
print(f"    - Anotações Migradas: {total_annotations}")
print(f"    - Dependências Migradas: {total_deps}")
print(f"    - Mapeamentos de Status Migrados: {total_status_mappings}")
print("[SUCCESS] Migração finalizada com sucesso a partir de Documents/Banco de dados!")

