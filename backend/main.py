"""
Backend FastAPI para QA FLOW!
API REST para análises, projetos, autenticação e relatórios
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import sqlite3
import os

app = FastAPI(title="QA FLOW! API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especificar domínios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Banco de dados
DB_PATH = "qa_insight_forge.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabela de usuários
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            hashed_password TEXT,
            provider TEXT,
            organization_id TEXT,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Tabela de organizações
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            plan TEXT DEFAULT 'free',
            max_users INTEGER DEFAULT 5,
            max_projects INTEGER DEFAULT 3,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Tabela de projetos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            repository_url TEXT,
            organization_id TEXT,
            user_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (organization_id) REFERENCES organizations(id)
        )
    """)
    
    # Tabela de análises
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            user_id TEXT,
            filename TEXT,
            language TEXT,
            code TEXT,
            scores TEXT,  -- JSON
            findings TEXT,  -- JSON
            passed BOOLEAN,
            commit_hash TEXT,
            branch TEXT,
            metadata TEXT,  -- JSON
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        )
    """)
    
    conn.commit()
    conn.close()

init_db()

# Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    provider: Optional[str]
    organization_id: Optional[str]
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str

class AnalysisCreate(BaseModel):
    project_id: Optional[str]
    filename: Optional[str]
    language: str
    code: str

class AnalysisResponse(BaseModel):
    id: str
    project_id: Optional[str]
    filename: Optional[str]
    language: str
    scores: dict
    findings: List[dict]
    passed: bool
    timestamp: datetime

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str]
    repository_url: Optional[str]

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    repository_url: Optional[str]
    created_at: datetime

# Utilitários
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    
    if user is None:
        raise credentials_exception
    return dict(user)

# Rotas
@app.get("/")
async def root():
    return {"message": "QA FLOW! API", "version": "1.0.0"}

@app.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        user_id = f"user-{int(datetime.now().timestamp() * 1000)}"
        hashed_password = get_password_hash(user.password)
        
        cursor.execute(
            "INSERT INTO users (id, email, name, hashed_password, provider, role) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, user.email, user.name, hashed_password, "email", "user")
        )
        conn.commit()
        
        return {
            "id": user_id,
            "email": user.email,
            "name": user.name,
            "provider": "email",
            "organization_id": None,
            "role": "user"
        }
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    finally:
        conn.close()

@app.post("/auth/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (form_data.username,))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "provider": current_user["provider"],
        "organization_id": current_user["organization_id"],
        "role": current_user["role"]
    }

@app.post("/projects", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    project_id = f"project-{int(datetime.now().timestamp() * 1000)}"
    now = datetime.now()
    
    cursor.execute(
        "INSERT INTO projects (id, name, description, repository_url, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (project_id, project.name, project.description, project.repository_url, current_user["id"], now, now)
    )
    conn.commit()
    conn.close()
    
    return {
        "id": project_id,
        "name": project.name,
        "description": project.description,
        "repository_url": project.repository_url,
        "created_at": now
    }

@app.get("/projects", response_model=List[ProjectResponse])
async def list_projects(current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC", (current_user["id"],))
    projects = cursor.fetchall()
    conn.close()
    
    return [dict(p) for p in projects]

@app.post("/analyses")
async def create_analysis(analysis: AnalysisCreate, current_user: dict = Depends(get_current_user)):
    # Aqui você integraria com o analyzer
    # Por enquanto, retorna uma resposta mockada
    import json
    
    analysis_id = f"analysis-{int(datetime.now().timestamp() * 1000)}"
    now = datetime.now()
    
    # Mock de análise
    scores = {"risk": 75, "quality": 80, "security": 70, "improvements": 5}
    findings = []
    passed = scores["risk"] >= 70 and scores["security"] >= 70
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO analyses 
           (id, project_id, user_id, filename, language, code, scores, findings, passed, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (analysis_id, analysis.project_id, current_user["id"], analysis.filename, 
         analysis.language, analysis.code, json.dumps(scores), json.dumps(findings), passed, now)
    )
    conn.commit()
    conn.close()
    
    return {
        "id": analysis_id,
        "scores": scores,
        "findings": findings,
        "passed": passed,
        "timestamp": now
    }

@app.get("/analyses", response_model=List[AnalysisResponse])
async def list_analyses(
    project_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if project_id:
        cursor.execute(
            "SELECT * FROM analyses WHERE user_id = ? AND project_id = ? ORDER BY timestamp DESC LIMIT ?",
            (current_user["id"], project_id, limit)
        )
    else:
        cursor.execute(
            "SELECT * FROM analyses WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?",
            (current_user["id"], limit)
        )
    
    analyses = cursor.fetchall()
    conn.close()
    
    import json
    result = []
    for a in analyses:
        result.append({
            "id": a["id"],
            "project_id": a["project_id"],
            "filename": a["filename"],
            "language": a["language"],
            "scores": json.loads(a["scores"]),
            "findings": json.loads(a["findings"]),
            "passed": bool(a["passed"]),
            "timestamp": datetime.fromisoformat(a["timestamp"])
        })
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
