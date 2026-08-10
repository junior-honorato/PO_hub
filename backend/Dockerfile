FROM python:3.10-slim

WORKDIR /app

# Instala dependências Python
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copia todos os arquivos do backend (incluindo pasta static/)
COPY . ./

ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["python", "main.py"]
