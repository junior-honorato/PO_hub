import os
import sys
import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path)

db_url = os.getenv("DATABASE_URL")
if not db_url or not db_url.startswith("postgres"):
    print("[!] DATABASE_URL inválido ou não configurado no .env")
    sys.exit(1)

sqlite_path = os.path.join(backend_dir, "database_ativo.db")
if not os.path.exists(sqlite_path):
    print(f"[!] Banco SQLite local não encontrado em {sqlite_path}")
    sys.exit(1)

print("[*] Iniciando migração de dados do SQLite para Supabase PostgreSQL...")

pg_conn = psycopg2.connect(db_url)
pg_conn.autocommit = True
pg_cursor = pg_conn.cursor(cursor_factory=RealDictCursor)

sqlite_conn = sqlite3.connect(sqlite_path)
sqlite_conn.row_factory = sqlite3.Row
sqlite_cursor = sqlite_conn.cursor()

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
    """
]

for ddl in tables_schema:
    pg_cursor.execute(ddl)

# 2. Migrar Projetos
sqlite_cursor.execute("SELECT * FROM projects")
projects = [dict(r) for r in sqlite_cursor.fetchall()]
for p in projects:
    pg_cursor.execute("""
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
    """, (p["id"], p["name"], p["health_status"], p["progress"], p.get("sponsor"), p.get("target_go_live"), p.get("executive_summary"), p.get("strategic_notes"), p.get("has_gantt_chart", 0)))
print(f"[*] {len(projects)} projetos migrados.")

# 3. Migrar Demandas
sqlite_cursor.execute("SELECT * FROM demands")
demands = [dict(r) for r in sqlite_cursor.fetchall()]
for d in demands:
    pg_cursor.execute("""
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
    """, (
        d["externalId"], d["origin"], d["title"], d["externalStatus"], d.get("itemType", "Outro"),
        d.get("promisedDate"), d.get("followUpDate"), d.get("managerNotes"), d.get("comments_history"),
        d.get("parentId"), d.get("localParentId"), d.get("blockers"), d.get("blocked_by"),
        d.get("ai_summary"), d.get("summary_updated_at"), d.get("project"), d.get("current_status_notes"),
        d.get("blocker_notes"), d.get("priority_rank"), d.get("in_tactical_planning", 0),
        d.get("planned_start_date"), d.get("planned_end_date")
    ))
print(f"[*] {len(demands)} demandas migradas.")

pg_cursor.close()
pg_conn.close()
sqlite_conn.close()
print("[SUCCESS] Migração de dados do SQLite para Supabase concluída com sucesso!")
