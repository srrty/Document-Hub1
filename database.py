from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

# 1. Vercel Postgres 환경 변수 읽어오기
DATABASE_URL = os.getenv("POSTGRES_URL")

if DATABASE_URL:
    # Vercel 백엔드 연결 안정성을 위해 postgres:// 주소를 postgresql://로 표준화합니다.
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # PostgreSQL 연결 엔진 설정 (Serverless 환경에 맞게 커넥션 풀 최적화)
    engine = create_engine(
        DATABASE_URL, 
        pool_pre_ping=True,
        pool_recycle=300
    )
else:
    # 로컬 개발 환경용 SQLite (대비책)
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(BASE_DIR, "docshub.db")
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    displayname = Column(String, default="")
    tokens = Column(Integer, default=5)  # 무료 요약 토큰 5개 자동 지급
    is_operator = Column(Boolean, default=False)  # 운영자 권한 여부
    documents = relationship("Document", back_populates="owner")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True)  # 특수 가입 코드 (예: T-XYZ123)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="team", cascade="all, delete-orphan")

class TeamMember(Base):
    __tablename__ = "team_members"
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    joined_at = Column(DateTime, default=datetime.utcnow)
    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    original_content = Column(Text)
    summary_content = Column(Text)
    is_shared = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # Nullable: Null이면 내 컴퓨터(개인), 값이 있으면 팀 문서
    owner = relationship("User", back_populates="documents")
    team = relationship("Team", back_populates="documents")

class Inquiry(Base):
    __tablename__ = "inquiries"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, default="기능 문의")
    title = Column(String, index=True)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship("User")

# 2. 스키마 체크 로직 (PostgreSQL 환경에 맞게 안전장치 추가)
try:
    from sqlalchemy import inspect
    inspector = inspect(engine)
    rebuild = False
    
    # SQLite 환경이거나 개발 모드일 때만 자동 초기화 작동 (클라우드 DB 안전용)
    if not os.getenv("POSTGRES_URL"):
        if 'documents' in inspector.get_table_names():
            doc_cols = [c['name'] for c in inspector.get_columns('documents')]
            if 'team_id' not in doc_cols:
                rebuild = True
        if 'users' in inspector.get_table_names():
            user_cols = [c['name'] for c in inspector.get_columns('users')]
            if 'tokens' not in user_cols or 'is_operator' not in user_cols:
                rebuild = True
        if 'inquiries' not in inspector.get_table_names():
            rebuild = True

        if rebuild:
            print("Outdated database schema detected. Rebuilding SQLite database...")
            SessionLocal.close_all()
            engine.dispose()
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docshub.db")
            if os.path.exists(db_path):
                os.remove(db_path)
except Exception as e:
    print("Database schema check bypassed or failed:", e)

# 데이터베이스 테이블 생성 (Postgres에 테이블이 없으면 자동으로 생성해 줍니다)
Base.metadata.create_all(bind=engine)
