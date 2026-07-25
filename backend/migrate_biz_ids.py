import sqlite3
import os

from database import get_db_paths

def migrate_db(db_path):
    if not os.path.exists(db_path):
        print(f"Banco de dados {db_path} não encontrado, pulando...")
        return
        
    print(f"\nIniciando migração em: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    # 1. Busca todas as demandas com origem 'Negocio' ordenadas por data de criação
    cursor = conn.cursor()
    cursor.execute("""
        SELECT externalId, createdAt 
        FROM demands 
        WHERE origin = 'Negocio' 
        ORDER BY createdAt ASC, externalId ASC
    """)
    rows = cursor.fetchall()
    
    if not rows:
        print("Nenhuma demanda com origem 'Negocio' encontrada para migrar.")
        conn.close()
        return
        
    print(f"Encontradas {len(rows)} demandas de negócio para migrar.")
    
    # 2. Gera o mapeamento de ID antigo para ID novo
    id_mapping = {}
    for idx, row in enumerate(rows, start=1):
        old_id = row["externalId"]
        # Ignora se já estiver no formato correto de 4 dígitos (ex: BIZ-0001)
        # Mas note que se quisermos reordenar ou re-sequenciar todos, poderíamos forçar.
        # De qualquer forma, como todos os atuais são BIZ-<timestamp> (13 dígitos),
        # podemos apenas mapear todos.
        new_id = f"BIZ-{idx:04d}"
        id_mapping[old_id] = new_id
        print(f"Mapeamento: {old_id} -> {new_id}")
        
    # 3. Executa as atualizações com FKs temporariamente desativadas
    try:
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute("BEGIN TRANSACTION")
        
        # Atualiza a tabela principal de demandas (externalId)
        for old_id, new_id in id_mapping.items():
            conn.execute(
                "UPDATE demands SET externalId = ? WHERE externalId = ?",
                (new_id, old_id)
            )
            
        # Atualiza auto-referências na tabela de demandas
        for old_id, new_id in id_mapping.items():
            conn.execute(
                "UPDATE demands SET parentId = ? WHERE parentId = ?",
                (new_id, old_id)
            )
            conn.execute(
                "UPDATE demands SET localParentId = ? WHERE localParentId = ?",
                (new_id, old_id)
            )
            
        # Atualiza tabelas relacionadas
        for old_id, new_id in id_mapping.items():
            conn.execute(
                "UPDATE annotations SET externalId = ? WHERE externalId = ?",
                (new_id, old_id)
            )
            conn.execute(
                "UPDATE tags SET externalId = ? WHERE externalId = ?",
                (new_id, old_id)
            )
            conn.execute(
                "UPDATE dependencies SET blocked_id = ? WHERE blocked_id = ?",
                (new_id, old_id)
            )
            conn.execute(
                "UPDATE dependencies SET blocker_id = ? WHERE blocker_id = ?",
                (new_id, old_id)
            )
            
        conn.execute("COMMIT")
        print("Transação realizada com sucesso.")
        
        # Verifica integridade das FKs
        cursor.execute("PRAGMA foreign_key_check")
        fk_errors = cursor.fetchall()
        if fk_errors:
            print("[ERRO] Inconsistências de Chave Estrangeira detectadas após a migração!")
            for err in fk_errors:
                print(f"Tabela: {err[0]}, RowId: {err[1]}, Tabela Destino: {err[2]}, ID FK: {err[3]}")
        else:
            print("Verificação de Chave Estrangeira concluída sem erros.")
            
    except Exception as e:
        conn.execute("ROLLBACK")
        print(f"Erro durante a migração do banco: {e}")
        raise e
    finally:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.close()

if __name__ == "__main__":
    path_ativo, path_historico = get_db_paths()
    migrate_db(path_ativo)
    migrate_db(path_historico)
    print("\nMigração concluída com sucesso!")
