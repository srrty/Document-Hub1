from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

# 1. Vercel Postgres 환경 변수 읽어오기
DATABASE_URL = os.getenv("POSTGRES_URL")

if DATABASE_URL:
    # Vercel 환경에서는 postgres:// 주소를 postgresql://로 표준화합니다.
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # PostgreSQL 연결 엔진 설정 (연결 재시도 옵션 최적화)
    engine = create_engine(
        DATABASE_URL, 
        pool_pre_ping=True,
        pool_recycle=300
    )
else:
    # 로컬 개발 환경용 SQLite
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
    tokens = Column(Integer, default=5)
    is_operator = Column(Boolean, default=False)
    documents = relationship("Document", back_populates="owner")
    team_memberships = relationship("TeamMember", back_populates="user", cascade="all, delete-orphan")

class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    code = Column(String, unique=True, index=True)
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
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
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

# Vercel 클라우드 환경에 맞게 무거운 옛날 스키마 체크/삭제 코드를 완전히 제거했습니다.
# 테이블이 없으면 Vercel Postgres에 자동으로 깨끗하게 생성해 줍니다.
Base.metadata.create_all(bind=engine)
