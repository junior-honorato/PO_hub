import time
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager

def run_debug_click():
    print("[DEBUG] Configurando Chrome...")
    options = webdriver.ChromeOptions()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,800")
    options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    
    try:
        url = "http://127.0.0.1:8080"
        print(f"[DEBUG] Acessando {url}...")
        driver.get(url)
        time.sleep(3)
        
        # 1. Clicar no menu lateral "Portfólio Executivo"
        print("[DEBUG] Clicando no menu 'Portfólio Executivo'...")
        projects_btn = driver.find_element(By.XPATH, "//div[contains(@class, 'lg:flex')]//button[contains(., 'Executivo')]")
        projects_btn.click()
        time.sleep(2)
        
        # 2. Clicar na primeira linha/card de projeto para abrir o ProjectOverview
        print("[DEBUG] Abrindo detalhes do primeiro projeto...")
        project_row = driver.find_element(By.CSS_SELECTOR, "tbody tr")
        project_row.click()
        time.sleep(2)
        
        # 3. Clicar na aba "Report Executivo Tecnologia"
        print("[DEBUG] Clicando na aba 'Report Executivo Tecnologia'...")
        tech_report_tab = driver.find_element(By.XPATH, "//button[contains(., 'Report Executivo Tecnologia')]")
        tech_report_tab.click()
        time.sleep(3)
        
        # Salva o screenshot do Report Executivo Tecnologia renderizado
        screenshot_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "debug_tech_report.png")
        driver.save_screenshot(screenshot_path)
        print(f"[DEBUG] Screenshot salvo em: {screenshot_path}")
        
        # Captura logs do console
        print("\n--- LOGS DO CONSOLE DO NAVEGADOR ---")
        logs = driver.get_log('browser')
        if logs:
            for entry in logs:
                print(f"[{entry['level']}] {entry['timestamp']} - {entry['message']}")
        else:
            print("[DEBUG] Nenhum log capturado no console.")
            
    except Exception as e:
        print(f"[DEBUG] Erro: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    run_debug_click()
