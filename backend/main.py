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
    
    # Tabela de contas Git
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS git_accounts (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            provider TEXT NOT NULL,
            username TEXT NOT NULL,
            email TEXT,
            token TEXT NOT NULL,
            gitea_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Tabela de repositórios Git
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS git_repositories (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            repository_id TEXT NOT NULL,
            name TEXT NOT NULL,
            full_name TEXT NOT NULL,
            description TEXT,
            url TEXT NOT NULL,
            default_branch TEXT NOT NULL,
            language TEXT,
            private BOOLEAN,
            provider TEXT NOT NULL,
            last_sync_at TIMESTAMP,
            sync_status TEXT DEFAULT 'pending',
            sync_error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_id) REFERENCES git_accounts(id)
        )
    """)
    
    # Tabela de jobs de sync
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS git_sync_jobs (
            id TEXT PRIMARY KEY,
            repository_id TEXT NOT NULL,
            branch TEXT NOT NULL,
            commit_hash TEXT,
            status TEXT DEFAULT 'pending',
            progress INTEGER DEFAULT 0,
            error TEXT,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            analysis_count INTEGER DEFAULT 0,
            FOREIGN KEY (repository_id) REFERENCES git_repositories(id)
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

class GitAccountCreate(BaseModel):
    provider: str
    username: str
    email: Optional[str]
    token: str
    gitea_url: Optional[str]

class GitAccountResponse(BaseModel):
    id: str
    provider: str
    username: str
    email: Optional[str]
    created_at: datetime

class GitRepositoryResponse(BaseModel):
    id: str
    account_id: str
    repository_id: str
    name: str
    full_name: str
    description: Optional[str]
    url: str
    default_branch: str
    language: Optional[str]
    private: bool
    provider: str
    last_sync_at: Optional[datetime]
    sync_status: str
    sync_error: Optional[str]
    created_at: datetime

class GitSyncRequest(BaseModel):
    repository_id: str
    branch: str = "main"
    commit_hash: Optional[str] = None

class GitSyncJobResponse(BaseModel):
    id: str
    repository_id: str
    branch: str
    commit_hash: Optional[str]
    status: str
    progress: Optional[int]
    error: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    analysis_count: Optional[int]

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

# Git Integration Routes
@app.post("/git/accounts", response_model=GitAccountResponse)
async def create_git_account(account: GitAccountCreate, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    account_id = f"git-account-{int(datetime.now().timestamp() * 1000)}"
    now = datetime.now()
    
    cursor.execute(
        """INSERT INTO git_accounts 
           (id, user_id, provider, username, email, token, gitea_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (account_id, current_user["id"], account.provider, account.username, 
         account.email, account.token, account.gitea_url, now, now)
    )
    conn.commit()
    conn.close()
    
    return {
        "id": account_id,
        "provider": account.provider,
        "username": account.username,
        "email": account.email,
        "created_at": now
    }

@app.get("/git/accounts", response_model=List[GitAccountResponse])
async def list_git_accounts(current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, provider, username, email, created_at FROM git_accounts WHERE user_id = ?", 
                   (current_user["id"],))
    accounts = cursor.fetchall()
    conn.close()
    
    return [dict(a) for a in accounts]

@app.post("/git/repositories/sync")
async def sync_repositories(account_id: str, current_user: dict = Depends(get_current_user)):
    """Sincroniza repositórios de uma conta Git"""
    # Esta função seria implementada para buscar repositórios do provider
    # Por enquanto, retorna uma resposta mockada
    return {
        "message": "Sync iniciado",
        "account_id": account_id,
        "repositories_synced": 0
    }

@app.get("/git/repositories", response_model=List[GitRepositoryResponse])
async def list_git_repositories(
    account_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if account_id:
        cursor.execute(
            """SELECT gr.* FROM git_repositories gr
               JOIN git_accounts ga ON gr.account_id = ga.id
               WHERE ga.user_id = ? AND gr.account_id = ?""",
            (current_user["id"], account_id)
        )
    else:
        cursor.execute(
            """SELECT gr.* FROM git_repositories gr
               JOIN git_accounts ga ON gr.account_id = ga.id
               WHERE ga.user_id = ?""",
            (current_user["id"],)
        )
    
    repos = cursor.fetchall()
    conn.close()
    
    import json
    result = []
    for r in repos:
        result.append({
            "id": r["id"],
            "account_id": r["account_id"],
            "repository_id": r["repository_id"],
            "name": r["name"],
            "full_name": r["full_name"],
            "description": r["description"],
            "url": r["url"],
            "default_branch": r["default_branch"],
            "language": r["language"],
            "private": bool(r["private"]),
            "provider": r["provider"],
            "last_sync_at": datetime.fromisoformat(r["last_sync_at"]) if r["last_sync_at"] else None,
            "sync_status": r["sync_status"],
            "sync_error": r["sync_error"],
            "created_at": datetime.fromisoformat(r["created_at"])
        })
    
    return result

@app.post("/git/sync", response_model=GitSyncJobResponse)
async def start_sync_job(sync_request: GitSyncRequest, current_user: dict = Depends(get_current_user)):
    """Inicia um job de sincronização e análise de repositório"""
    import json
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Verifica se o repositório pertence ao usuário
    cursor.execute(
        """SELECT gr.id FROM git_repositories gr
           JOIN git_accounts ga ON gr.account_id = ga.id
           WHERE gr.id = ? AND ga.user_id = ?""",
        (sync_request.repository_id, current_user["id"])
    )
    repo = cursor.fetchone()
    
    if not repo:
        conn.close()
        raise HTTPException(status_code=404, detail="Repositório não encontrado")
    
    job_id = f"sync-job-{int(datetime.now().timestamp() * 1000)}"
    now = datetime.now()
    
    cursor.execute(
        """INSERT INTO git_sync_jobs 
           (id, repository_id, branch, commit_hash, status, started_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (job_id, sync_request.repository_id, sync_request.branch, 
         sync_request.commit_hash, "pending", now)
    )
    conn.commit()
    conn.close()
    
    return {
        "id": job_id,
        "repository_id": sync_request.repository_id,
        "branch": sync_request.branch,
        "commit_hash": sync_request.commit_hash,
        "status": "pending",
        "progress": 0,
        "error": None,
        "started_at": now,
        "completed_at": None,
        "analysis_count": 0
    }

@app.get("/git/sync/jobs", response_model=List[GitSyncJobResponse])
async def list_sync_jobs(
    repository_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = """SELECT gj.* FROM git_sync_jobs gj
               JOIN git_repositories gr ON gj.repository_id = gr.id
               JOIN git_accounts ga ON gr.account_id = ga.id
               WHERE ga.user_id = ?"""
    params = [current_user["id"]]
    
    if repository_id:
        query += " AND gj.repository_id = ?"
        params.append(repository_id)
    
    if status:
        query += " AND gj.status = ?"
        params.append(status)
    
    query += " ORDER BY gj.started_at DESC LIMIT 50"
    
    cursor.execute(query, params)
    jobs = cursor.fetchall()
    conn.close()
    
    result = []
    for j in jobs:
        result.append({
            "id": j["id"],
            "repository_id": j["repository_id"],
            "branch": j["branch"],
            "commit_hash": j["commit_hash"],
            "status": j["status"],
            "progress": j["progress"],
            "error": j["error"],
            "started_at": datetime.fromisoformat(j["started_at"]) if j["started_at"] else None,
            "completed_at": datetime.fromisoformat(j["completed_at"]) if j["completed_at"] else None,
            "analysis_count": j["analysis_count"]
        })
    
    return result

@app.get("/git/sync/jobs/{job_id}", response_model=GitSyncJobResponse)
async def get_sync_job(job_id: str, current_user: dict = Depends(get_current_user)):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute(
        """SELECT gj.* FROM git_sync_jobs gj
           JOIN git_repositories gr ON gj.repository_id = gr.id
           JOIN git_accounts ga ON gr.account_id = ga.id
           WHERE gj.id = ? AND ga.user_id = ?""",
        (job_id, current_user["id"])
    )
    job = cursor.fetchone()
    conn.close()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job não encontrado")
    
    return {
        "id": job["id"],
        "repository_id": job["repository_id"],
        "branch": job["branch"],
        "commit_hash": job["commit_hash"],
        "status": job["status"],
        "progress": job["progress"],
        "error": job["error"],
        "started_at": datetime.fromisoformat(job["started_at"]) if job["started_at"] else None,
        "completed_at": datetime.fromisoformat(job["completed_at"]) if job["completed_at"] else None,
        "analysis_count": job["analysis_count"]
    }

# Quality Gate & Badge Routes
@app.get("/quality-gate/{repository_id}/{branch}")
async def get_quality_gate(
    repository_id: str,
    branch: str,
    current_user: dict = Depends(get_current_user)
):
    """Retorna o resultado do quality gate para um repositório e branch"""
    import json
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Busca análises do repositório e branch
    cursor.execute(
        """SELECT * FROM analyses 
           WHERE metadata LIKE ? AND branch = ?
           ORDER BY timestamp DESC LIMIT 100""",
        (f'%"repositoryId":"{repository_id}"%', branch)
    )
    analyses = cursor.fetchall()
    conn.close()
    
    if not analyses:
        return {
            "passed": False,
            "reason": "Nenhuma análise encontrada",
            "scores": {"risk": 0, "security": 0, "quality": 0},
            "findings": {"critical": 0, "high": 0, "medium": 0, "low": 0}
        }
    
    # Agrega resultados
    total_risk = 0
    total_security = 0
    total_quality = 0
    total_critical = 0
    total_high = 0
    total_medium = 0
    total_low = 0
    
    for a in analyses:
        scores = json.loads(a["scores"])
        findings = json.loads(a["findings"])
        
        total_risk += scores.get("risk", 0)
        total_security += scores.get("security", 0)
        total_quality += scores.get("quality", 0)
        
        for finding in findings:
            severity = finding.get("severity", "low")
            if severity == "critical":
                total_critical += 1
            elif severity == "high":
                total_high += 1
            elif severity == "medium":
                total_medium += 1
            else:
                total_low += 1
    
    count = len(analyses)
    avg_risk = total_risk / count if count > 0 else 0
    avg_security = total_security / count if count > 0 else 0
    avg_quality = total_quality / count if count > 0 else 0
    
    # Avalia gate
    MIN_RISK = 70
    MIN_SECURITY = 70
    MAX_CRITICAL = 0
    MAX_HIGH = 5
    
    passed = True
    reason = None
    
    if avg_risk < MIN_RISK:
        passed = False
        reason = f"Risk score too low: {avg_risk:.1f}% (minimum: {MIN_RISK}%)"
    elif avg_security < MIN_SECURITY:
        passed = False
        reason = f"Security score too low: {avg_security:.1f}% (minimum: {MIN_SECURITY}%)"
    elif total_critical > MAX_CRITICAL:
        passed = False
        reason = f"Critical findings found: {total_critical} (maximum: {MAX_CRITICAL})"
    elif total_high > MAX_HIGH:
        passed = False
        reason = f"Too many high findings: {total_high} (maximum: {MAX_HIGH})"
    
    return {
        "passed": passed,
        "reason": reason,
        "scores": {
            "risk": round(avg_risk, 1),
            "security": round(avg_security, 1),
            "quality": round(avg_quality, 1)
        },
        "findings": {
            "critical": total_critical,
            "high": total_high,
            "medium": total_medium,
            "low": total_low
        },
        "file_count": count
    }

@app.get("/badge/{repository_id}/{branch}")
async def get_quality_badge(
    repository_id: str,
    branch: str
):
    """Retorna um badge SVG para o quality gate (público)"""
    from fastapi.responses import Response
    
    # Busca análises sem autenticação para badge público
    import json
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute(
        """SELECT * FROM analyses 
           WHERE metadata LIKE ? AND branch = ?
           ORDER BY timestamp DESC LIMIT 100""",
        (f'%"repositoryId":"{repository_id}"%', branch)
    )
    analyses = cursor.fetchall()
    conn.close()
    
    if not analyses:
        status = "unknown"
        color = "gray"
        text = "N/A"
    else:
        # Agrega resultados
        total_risk = 0
        total_security = 0
        total_critical = 0
        total_high = 0
        
        for a in analyses:
            scores = json.loads(a["scores"])
            findings = json.loads(a["findings"])
            
            total_risk += scores.get("risk", 0)
            total_security += scores.get("security", 0)
            
            for finding in findings:
                severity = finding.get("severity", "low")
                if severity == "critical":
                    total_critical += 1
                elif severity == "high":
                    total_high += 1
        
        count = len(analyses)
        avg_risk = total_risk / count if count > 0 else 0
        avg_security = total_security / count if count > 0 else 0
        
        MIN_RISK = 70
        MIN_SECURITY = 70
        MAX_CRITICAL = 0
        MAX_HIGH = 5
        
        passed = (avg_risk >= MIN_RISK and avg_security >= MIN_SECURITY and 
                 total_critical <= MAX_CRITICAL and total_high <= MAX_HIGH)
        
        status = "passed" if passed else "failed"
        color = "green" if passed else "red"
        text = "PASS" if passed else "FAIL"
    
    # Gera SVG do badge
    status = "passed" if gate_result["passed"] else "failed"
    color = "green" if gate_result["passed"] else "red"
    text = "PASS" if gate_result["passed"] else "FAIL"
    
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20">
      <linearGradient id="b" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
      </linearGradient>
      <mask id="a">
        <rect width="100" height="20" rx="3" fill="#fff"/>
      </mask>
      <g mask="url(#a)">
        <path fill="#555" d="M0 0h63v20H0z"/>
        <path fill="#{color}" d="M63 0h37v20H63z"/>
        <path fill="url(#b)" d="M0 0h100v20H0z"/>
      </g>
      <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
        <text x="31.5" y="15" fill="#010101" fill-opacity=".3">QA FLOW!</text>
        <text x="31.5" y="14">QA FLOW!</text>
        <text x="81.5" y="15" fill="#010101" fill-opacity=".3">{text}</text>
        <text x="81.5" y="14">{text}</text>
      </g>
    </svg>'''
    
    return Response(content=svg, media_type="image/svg+xml")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
