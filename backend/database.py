import sqlite3
import os

DATABASE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database.db")

def get_connection():
    """Retorna uma conexão configurada com suporte a chaves estrangeiras e dicionários."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    """Cria as tabelas caso não existam."""
    conn = get_connection()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS demands (
                externalId TEXT PRIMARY KEY,
                origin TEXT CHECK(origin IN ('Jira', 'Azure')),
                title TEXT NOT NULL,
                externalStatus TEXT NOT NULL,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
                promisedDate TEXT,
                followUpDate TEXT,
                managerNotes TEXT,
                comments_history TEXT
            )
        """)

        # Garante migração para novos campos se o banco já existia
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(demands)")
        columns = [row[1] for row in cursor.fetchall()]
        if "promisedDate" not in columns:
            conn.execute("ALTER TABLE demands ADD COLUMN promisedDate TEXT")
        if "followUpDate" not in columns:
            conn.execute("ALTER TABLE demands ADD COLUMN followUpDate TEXT")
        if "managerNotes" not in columns:
            conn.execute("ALTER TABLE demands ADD COLUMN managerNotes TEXT")
        if "comments_history" not in columns:
            conn.execute("ALTER TABLE demands ADD COLUMN comments_history TEXT")

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
        conn.commit()
        print("Banco de dados SQLite inicializado com sucesso.")
    except Exception as e:
        print(f"Erro ao inicializar o banco de dados: {e}")
    finally:
        conn.close()

def execute_query(query, params=()):
    """Executa comando que modifica dados (INSERT, UPDATE, DELETE)."""
    conn = get_connection()
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

def fetch_all(query, params=()):
    """Busca múltiplos registros e os converte em lista de dicionários."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def fetch_one(query, params=()):
    """Busca um único registro e o converte em dicionário (ou None)."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()
