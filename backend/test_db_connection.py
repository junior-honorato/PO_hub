import os
import sys
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path)

db_url = os.getenv("DATABASE_URL")
print(f"[*] Testing connection with DATABASE_URL: {db_url[:25]}..." if db_url else "[!] DATABASE_URL not found in .env")

if not db_url:
    sys.exit(1)

try:
    import psycopg2
    # Ensure SSL mode if needed
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    db_version = cursor.fetchone()
    print("[SUCCESS] Connected to Supabase PostgreSQL!")
    print(f"[*] Database Version: {db_version[0]}")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"[!] Connection failed: {e}")
    sys.exit(1)
