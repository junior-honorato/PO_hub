import time
import os
import sqlite3
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

DB_PATH_HISTORICO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database_historico.db")

def seed_test_data():
    print("[E2E] Seeding test data in database_historico.db...")
    conn = sqlite3.connect(DB_PATH_HISTORICO)
    cursor = conn.cursor()
    # Delete any existing test items to avoid primary key conflicts
    cursor.execute("DELETE FROM demands WHERE externalId IN ('TEST-E2E-FINAL', 'TEST-E2E-ACTIVE')")
    
    # Insert a valid closed item
    cursor.execute("""
        INSERT INTO demands (externalId, origin, title, externalStatus, updatedAt)
        VALUES ('TEST-E2E-FINAL', 'Jira', 'Demanda E2E Concluida', 'Concluído', CURRENT_TIMESTAMP)
    """)
    # Insert an invalid active item in history db
    cursor.execute("""
        INSERT INTO demands (externalId, origin, title, externalStatus, updatedAt)
        VALUES ('TEST-E2E-ACTIVE', 'Jira', 'Demanda E2E Em Progresso', 'Em Progresso', CURRENT_TIMESTAMP)
    """)
    conn.commit()
    conn.close()

def cleanup_test_data():
    print("[E2E] Cleaning up test data...")
    conn = sqlite3.connect(DB_PATH_HISTORICO)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM demands WHERE externalId IN ('TEST-E2E-FINAL', 'TEST-E2E-ACTIVE')")
    conn.commit()
    conn.close()

def run_test():
    print("--- INICIANDO TESTE END-TO-END ---")
    seed_test_data()
    
    # Configura opções do Chrome Headless
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new") # Executa em segundo plano
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,800")
    
    # Habilita captura de logs de console
    options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    
    try:
        url = "http://127.0.0.1:8080"
        print(f"[E2E] Acessando {url}...")
        driver.get(url)
        
        # Aguarda 3 segundos para carregar o React e a tabela
        time.sleep(3)
        
        # Screenshot do Dashboard Inicial
        scr1_path = os.path.join(ARTIFACTS_DIR, "step1_dashboard.png")
        driver.save_screenshot(scr1_path)
        print(f"[E2E] Screenshot do Dashboard salvo em: {scr1_path}")
        
        # Clica no botão de sincronizar
        try:
            print("[E2E] Sincronizando APIs para carregar dados...")
            sync_btn = driver.find_element(By.XPATH, "//div[contains(@class, 'lg:flex')]//button[contains(., 'Sincronizar')]")
            sync_btn.click()
            time.sleep(2)
            try:
                alert = driver.switch_to.alert
                print(f"[E2E] Alerta detectado e aceito: {alert.text}")
                alert.accept()
            except Exception:
                pass
            time.sleep(3) # Aguarda a sincronização concluir
        except Exception as sync_err:
            print(f"[E2E] Erro ao sincronizar: {sync_err}")

        # Encontra o link / botão das Demandas no menu lateral para ir para a lista de demandas
        # No menu lateral, temos "Demandas" como botão. Vamos clicar nele para ver a tabela completa
        try:
            print("[E2E] Tentando mudar para a aba 'Demandas'...")
            demands_btn = driver.find_element(By.XPATH, "//div[contains(@class, 'lg:flex')]//button[contains(., 'Demandas')]")
            demands_btn.click()
            time.sleep(2)
            scr2_path = os.path.join(ARTIFACTS_DIR, "step2_demands_list.png")
            driver.save_screenshot(scr2_path)
            print(f"[E2E] Screenshot da Lista de Demandas salvo em: {scr2_path}")
        except Exception as btn_err:
            print(f"[E2E] Erro ao ir para aba de demandas: {btn_err}")

        # Encontra o link / botão dos Projetos no menu lateral
        try:
            print("[E2E] Tentando mudar para a aba 'Portfólio Executivo'...")
            projects_btn = driver.find_element(By.XPATH, "//div[contains(@class, 'lg:flex')]//button[contains(., 'Executivo')]")
            projects_btn.click()
            time.sleep(2)
            scr4_path = os.path.join(ARTIFACTS_DIR, "step4_projects_view.png")
            driver.save_screenshot(scr4_path)
            print(f"[E2E] Screenshot da Visão de Projetos salvo em: {scr4_path}")
        except Exception as btn_err:
            print(f"[E2E] Erro ao ir para aba de projetos: {btn_err}")

        # Encontra o link / botão do Histórico no menu lateral
        try:
            print("[E2E] Tentando mudar para a aba 'Histórico'...")
            history_btn = driver.find_element(By.XPATH, "//div[contains(@class, 'lg:flex')]//button[contains(., 'ist') and contains(., 'rico')]")
            history_btn.click()
            time.sleep(2)
            scr5_path = os.path.join(ARTIFACTS_DIR, "step5_history_view.png")
            driver.save_screenshot(scr5_path)
            print(f"[E2E] Screenshot da Visão de Histórico salvo em: {scr5_path}")

            # Verifica os itens exibidos no histórico para garantir que contêm apenas status finais
            print("[E2E] Verificando status dos itens no histórico...")
            history_rows = driver.find_elements(By.CSS_SELECTOR, "tbody tr")
            print(f"[E2E] Encontrados {len(history_rows)} itens no histórico.")
            
            found_final = False
            found_active = False
            
            final_statuses = {"Concluído", "Done", "Resolved", "Closed", "Improcedente", "Cancelado"}
            for idx, row in enumerate(history_rows):
                cols = row.find_elements(By.TAG_NAME, "td")
                if len(cols) >= 3:
                    id_text = cols[0].text.strip()
                    status_text = cols[2].text.strip()
                    print(f"[E2E] Item histórico {idx+1} ID: '{id_text}', status: '{status_text}'")
                    
                    if "TEST-E2E-FINAL" in id_text:
                        found_final = True
                    if "TEST-E2E-ACTIVE" in id_text:
                        found_active = True
                        
                    assert status_text in final_statuses, f"Erro: Item com status não-final '{status_text}' encontrado no histórico!"
            
            assert found_final, "Erro: O item concluído de teste (TEST-E2E-FINAL) não foi exibido na aba histórico!"
            assert not found_active, "Erro: O item em aberto de teste (TEST-E2E-ACTIVE) foi indevidamente exibido na aba histórico!"
            print("[E2E] Verificação de status do histórico concluída com sucesso (apenas status finais exibidos, item aberto ignorado).")
        except Exception as hist_err:
            print(f"[E2E] Erro ao ir para aba de histórico ou ao validar status: {hist_err}")
            raise hist_err

        # Volta para a aba de Demandas para o restante do teste (Drawer e Comentários)
        try:
            demands_btn = driver.find_element(By.XPATH, "//div[contains(@class, 'lg:flex')]//button[contains(., 'Demandas')]")
            demands_btn.click()
            time.sleep(1)
        except Exception as btn_err:
            print(f"[E2E] Erro ao voltar para a aba de demandas: {btn_err}")
            
        # Tenta encontrar uma linha da tabela de demandas
        # As linhas da tabela de demandas têm a classe 'cursor-pointer'
        print("[E2E] Procurando linhas na tabela para clicar...")
        rows = driver.find_elements(By.CSS_SELECTOR, "tbody tr")
        print(f"[E2E] Encontradas {len(rows)} linhas na tabela.")
        
        if rows:
            first_row = rows[0]
            print(f"[E2E] Clicando na primeira linha: '{first_row.text[:80]}...'")
            first_row.click()
            
            # Aguarda a renderização do Drawer
            time.sleep(2)
            
            # Tenta clicar no acordeão de comentários externos
            try:
                print("[E2E] Procurando o botão de comentários externos...")
                comments_btn = driver.find_element(By.XPATH, "//button[contains(., 'Coment')]")
                print("[E2E] Rolando até o botão...")
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", comments_btn)
                time.sleep(1)
                print("[E2E] Clicando no botão para abrir os comentários...")
                comments_btn.click()
                time.sleep(1.5)
            except Exception as scroll_err:
                print(f"[E2E] Erro ao tentar interagir com o acordeão de comentários: {scroll_err}")

            # Screenshot com o Drawer aberto e comentários expandidos
            scr3_path = os.path.join(ARTIFACTS_DIR, "step3_drawer_attempt.png")
            driver.save_screenshot(scr3_path)
            print(f"[E2E] Screenshot pós-clique salvo em: {scr3_path}")
        else:
            print("[E2E] Nenhuma linha encontrada para clicar.")
            
        # Captura logs do Console do Navegador
        print("\n--- LOGS DO CONSOLE DO NAVEGADOR ---")
        logs = driver.get_log('browser')
        if logs:
            for entry in logs:
                print(f"[{entry['level']}] {entry['timestamp']} - {entry['message']}")
        else:
            print("[E2E] Nenhum log no console capturado.")
            
    except Exception as e:
        print(f"[E2E] Falha crítica no teste: {e}")
        try:
            print("\n--- LOGS DO CONSOLE DO NAVEGADOR (FALHA) ---")
            logs = driver.get_log('browser')
            for entry in logs:
                print(f"[{entry['level']}] {entry['timestamp']} - {entry['message']}")
        except Exception as log_err:
            print(f"Erro ao capturar logs do console: {log_err}")
        raise e
    finally:
        driver.quit()
        cleanup_test_data()
        print("\n--- FIM DO TESTE E2E ---")

if __name__ == "__main__":
    run_test()
