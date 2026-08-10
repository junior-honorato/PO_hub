FROM python:3.10-slim

WORKDIR /app

# Copia e instala as dependências Python
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código do backend (incluindo pasta static/ e código da API)
COPY backend/ ./

# Configurações de ambiente
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

# Executa o servidor FastAPI diretamente com Uvicorn sem reloader em produção
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
