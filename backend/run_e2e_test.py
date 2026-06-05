import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)
def run_test():
    print("--- INICIANDO TESTE END-TO-END ---")
    
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
        url = "http://127.0.0.1:5000"
        print(f"[E2E] Acessando {url}...")
        driver.get(url)
        
        # Aguarda 3 segundos para carregar o React e a tabela
        time.sleep(3)
        
        # Screenshot do Dashboard Inicial
        scr1_path = os.path.join(ARTIFACTS_DIR, "step1_dashboard.png")
        driver.save_screenshot(scr1_path)
        print(f"[E2E] Screenshot do Dashboard salvo em: {scr1_path}")
        
        # Encontra o link / botão das Demandas no menu lateral para ir para a lista de demandas
        # No menu lateral, temos "Demandas" como botão. Vamos clicar nele para ver a tabela completa
        try:
            print("[E2E] Tentando mudar para a aba 'Demandas'...")
            demands_btn = driver.find_element(By.XPATH, "//button[contains(., 'Demandas')]")
            demands_btn.click()
            time.sleep(2)
            scr2_path = os.path.join(ARTIFACTS_DIR, "step2_demands_list.png")
            driver.save_screenshot(scr2_path)
            print(f"[E2E] Screenshot da Lista de Demandas salvo em: {scr2_path}")
        except Exception as btn_err:
            print(f"[E2E] Erro ao ir para aba de demandas: {btn_err}")

        # Encontra o link / botão dos Projetos no menu lateral
        try:
            print("[E2E] Tentando mudar para a aba 'Projetos'...")
            projects_btn = driver.find_element(By.XPATH, "//button[contains(., 'Projetos')]")
            projects_btn.click()
            time.sleep(2)
            scr4_path = os.path.join(ARTIFACTS_DIR, "step4_projects_view.png")
            driver.save_screenshot(scr4_path)
            print(f"[E2E] Screenshot da Visão de Projetos salvo em: {scr4_path}")
            
            # Volta para a aba de Demandas para o restante do teste
            demands_btn = driver.find_element(By.XPATH, "//button[contains(., 'Demandas')]")
            demands_btn.click()
            time.sleep(1)
        except Exception as btn_err:
            print(f"[E2E] Erro ao ir para aba de projetos: {btn_err}")
            
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
                comments_btn = driver.find_element(By.XPATH, "//button[contains(., 'Histórico de Comentários')]")
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
    finally:
        driver.quit()
        print("\n--- FIM DO TESTE E2E ---")

if __name__ == "__main__":
    run_test()
