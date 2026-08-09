import os
import json
import requests
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import APIKeyCookie

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "po-hub-super-secret-jwt-key-2026")
ALGORITHM = "HS256"
COOKIE_NAME = "po_hub_session"

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
ALLOWED_EMAILS = [e.strip().lower() for e in os.getenv("ALLOWED_EMAILS", "").split(",") if e.strip()]

cookie_scheme = APIKeyCookie(name=COOKIE_NAME, auto_error=False)

def create_session_token(user_info: dict) -> str:
    """Gera token JWT contendo os dados do usuário com expiração de 8 horas."""
    expires = datetime.now(timezone.utc) + timedelta(hours=8)
    payload = {
        "sub": user_info.get("email"),
        "name": user_info.get("name"),
        "picture": user_info.get("picture"),
        "exp": expires
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)

def decode_session_token(token: str) -> dict:
    """Valida e decodifica o token JWT de sessão."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def get_current_user(request: Request) -> dict:
    """Dependency para proteger endpoints da API."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        # Se não houver cookie, verifica cabeçalho Authorization Bearer
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado. Efetue login via Google SSO.")
        
    payload = decode_session_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Sessão expirada ou inválida. Efetue login novamente.")
        
    user_email = payload.get("sub", "").lower()
    if ALLOWED_EMAILS and user_email not in ALLOWED_EMAILS:
        raise HTTPException(status_code=403, detail=f"Acesso negado para o e-mail '{user_email}'. Usuário não autorizado.")
        
    return payload

def get_google_auth_url(redirect_uri: str, state: str = "state") -> str:
    """Gera a URL do formulário de consentimento da Google."""
    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account",
        "state": state
    }
    req = requests.Request("GET", base_url, params=params).prepare()
    return req.url

def exchange_code_for_user_info(code: str, redirect_uri: str) -> dict:
    """Troca o código de autorização pelos tokens da Google e obtém os dados do perfil."""
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    resp = requests.post(token_url, data=data, timeout=10)
    if resp.status_code != 200:
        print(f"[!] Erro ao obter token do Google: {resp.text}")
        err_desc = resp.text
        try:
            err_json = resp.json()
            err_desc = err_json.get("error_description") or err_json.get("error") or resp.text
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Falha no Google OAuth ({resp.status_code}): {err_desc}")
        
    token_data = resp.json()
    access_token = token_data.get("access_token")
    
    # Obtém dados do usuário (email, nome, foto)
    user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    user_resp = requests.get(user_info_url, headers=headers, timeout=10)
    if user_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Não foi possível obter informações de perfil do Google.")
        
    return user_resp.json()
