import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

options = webdriver.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.set_capability('goog:loggingPrefs', {'browser': 'ALL'})

service = Service(ChromeDriverManager().install())
driver = webdriver.Chrome(service=service, options=options)

try:
    print("[Diag] Acessando http://127.0.0.1:8080...")
    driver.get("http://127.0.0.1:8080")
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
