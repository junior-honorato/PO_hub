import sqlite3
import os

DATABASE_PATH_ATIVO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database_ativo.db")
DATABASE_PATH_HISTORICO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database_historico.db")

def get_connection(db_name="ativo"):
    """Retorna uma conexão configurada com suporte a chaves estrangeiras e dicionários."""
    path = DATABASE_PATH_HISTORICO if db_name == "historico" else DATABASE_PATH_ATIVO
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Cria as tabelas caso não existam em ambos os bancos."""
    for db_name in ["ativo", "historico"]:
        conn = get_connection(db_name)
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS demands (
                    externalId TEXT PRIMARY KEY,
                    origin TEXT CHECK(origin IN ('Jira', 'Azure', 'Negocio')),
                    title TEXT NOT NULL,
                    externalStatus TEXT NOT NULL,
                    itemType TEXT DEFAULT 'Outro',
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    promisedDate TEXT,
                    followUpDate TEXT,
                    managerNotes TEXT,
                    comments_history TEXT,
                    parentId TEXT,
                    localParentId TEXT,
                    blockers TEXT,
                    blocked_by TEXT,
                    ai_summary TEXT,
                    summary_updated_at TEXT,
                    project TEXT,
                    current_status_notes TEXT,
                    blocker_notes TEXT
                )
            """)

            # Garante migração para novos campos se o banco já existia
            cursor = conn.cursor()
            
            # Migra a restrição CHECK se necessário (adicionando 'Negocio' à lista de origens)
            cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='demands'")
            schema_row = cursor.fetchone()
            if schema_row:
                sql = schema_row[0]
                if "'Negocio'" not in sql:
                    print(f"Migrando tabela demands em {db_name} para suportar origem 'Negocio'...")
                    conn.execute("PRAGMA foreign_keys=OFF")
                    conn.execute("BEGIN TRANSACTION")
                    conn.execute("""
                        CREATE TABLE demands_new (
                            externalId TEXT PRIMARY KEY,
                            origin TEXT CHECK(origin IN ('Jira', 'Azure', 'Negocio')),
                            title TEXT NOT NULL,
                            externalStatus TEXT NOT NULL,
                            itemType TEXT DEFAULT 'Outro',
                            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                            promisedDate TEXT,
                            followUpDate TEXT,
                            managerNotes TEXT,
                            comments_history TEXT,
                            parentId TEXT,
                            localParentId TEXT,
                            blockers TEXT,
                            blocked_by TEXT,
                            ai_summary TEXT,
                            summary_updated_at TEXT,
                            project TEXT,
                            current_status_notes TEXT,
                            blocker_notes TEXT
                        )
                    """)
                    # Repopula colunas existentes
                    cursor.execute("PRAGMA table_info(demands)")
                    curr_cols = [r[1] for r in cursor.fetchall()]
                    cols_str = ", ".join(curr_cols)
                    conn.execute(f"INSERT INTO demands_new ({cols_str}) SELECT {cols_str} FROM demands")
                    conn.execute("DROP TABLE demands")
                    conn.execute("ALTER TABLE demands_new RENAME TO demands")
                    conn.execute("COMMIT")
                    conn.execute("PRAGMA foreign_keys=ON")
                    print(f"Migração da tabela demands em {db_name} concluída.")

            cursor.execute("PRAGMA table_info(demands)")
            columns = [row[1] for row in cursor.fetchall()]
            if "itemType" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN itemType TEXT DEFAULT 'Outro'")
            if "promisedDate" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN promisedDate TEXT")
            if "followUpDate" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN followUpDate TEXT")
            if "managerNotes" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN managerNotes TEXT")
            if "comments_history" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN comments_history TEXT")
            if "parentId" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN parentId TEXT")
            if "blockers" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN blockers TEXT")
            if "blocked_by" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN blocked_by TEXT")
            if "localParentId" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN localParentId TEXT")
            if "ai_summary" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN ai_summary TEXT")
            if "summary_updated_at" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN summary_updated_at TEXT")
            if "project" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN project TEXT")
            if "current_status_notes" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN current_status_notes TEXT")
            if "blocker_notes" not in columns:
                conn.execute("ALTER TABLE demands ADD COLUMN blocker_notes TEXT")

            # Tabela Annotations (Apontamentos/Histórico local)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS annotations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    externalId TEXT NOT NULL,
                    content TEXT NOT NULL,
                    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (externalId) REFERENCES demands(externalId) ON DELETE CASCADE
                )
            """)

            # Tabela Tags
            conn.execute("""
                CREATE TABLE IF NOT EXISTS tags (
                    externalId TEXT NOT NULL,
                    tag TEXT NOT NULL,
                    PRIMARY KEY (externalId, tag),
                    FOREIGN KEY (externalId) REFERENCES demands(externalId) ON DELETE CASCADE
                )
            """)

            # Tabela Dependencies (Dependências cruzadas)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS dependencies (
                    blocked_id TEXT NOT NULL,
                    blocker_id TEXT NOT NULL,
                    PRIMARY KEY (blocked_id, blocker_id),
                    FOREIGN KEY (blocked_id) REFERENCES demands(externalId) ON DELETE CASCADE,
                    FOREIGN KEY (blocker_id) REFERENCES demands(externalId) ON DELETE CASCADE
                )
            """)

            # Tabela Project Reports (Cache de Relatórios de Status)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS project_reports (
                    project_name TEXT PRIMARY KEY,
                    report_text TEXT,
                    generated_at TEXT
                )
            """)

            # Tabela Projects (Portfólio de Projetos - PPM)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    health_status TEXT NOT NULL CHECK(health_status IN ('Verde', 'Amarelo', 'Vermelho')),
                    progress INTEGER NOT NULL CHECK(progress >= 0 AND progress <= 100),
                    sponsor TEXT,
                    target_go_live TEXT,
                    executive_summary TEXT,
                    strategic_notes TEXT
                )
            """)

            # Garante migração para novos campos da tabela projects se o banco já existia
            cursor.execute("PRAGMA table_info(projects)")
            proj_columns = [row[1] for row in cursor.fetchall()]
            if "strategic_notes" not in proj_columns:
                conn.execute("ALTER TABLE projects ADD COLUMN strategic_notes TEXT")

            conn.commit()
            print(f"Banco de dados SQLite {db_name} inicializado com sucesso.")
        except Exception as e:
            print(f"Erro ao inicializar o banco de dados {db_name}: {e}")
        finally:
            conn.close()

def execute_query(query, params=(), db_name="ativo"):
    """Executa comando que modifica dados (INSERT, UPDATE, DELETE)."""
    conn = get_connection(db_name)
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        return cursor
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def fetch_all(query, params=(), db_name="ativo"):
    """Busca múltiplos registros e os converte em lista de dicionários."""
    conn = get_connection(db_name)
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def fetch_one(query, params=(), db_name="ativo"):
    """Busca um único registro e o converte em dicionário (ou None)."""
    conn = get_connection(db_name)
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()
