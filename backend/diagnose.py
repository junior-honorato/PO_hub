import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Carrega variáveis de ambiente
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path)

port = int(os.getenv("PORT", 8080))

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

service = Service(ChromeDriverManager().install())
driver = webdriver.Chrome(service=service, options=options)

try:
    url = f"http://127.0.0.1:{port}"
    print(f"[Diag] Acessando {url}...")
    driver.get(url)
    time.sleep(3)
    
    print("[Diag] Logs do Console do Navegador:")
    logs = driver.get_log('browser')
    if logs:
        for entry in logs:
            print(f"[{entry['level']}] {entry['message']}")
    else:
        print("[Diag] Nenhum log no console.")
finally:
    driver.quit()
