from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

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

# Schema-checking utility: If schema is outdated (e.g. team_id is not in documents, or tokens not in users, or is_operator not in users), we drop & recreate docshub.db
import os
try:
    from sqlalchemy import inspect
    inspector = inspect(engine)
    rebuild = False
    
    # 1. documents 테이블 스키마 검사
    if 'documents' in inspector.get_table_names():
        doc_cols = [c['name'] for c in inspector.get_columns('documents')]
        if 'team_id' not in doc_cols:
            rebuild = True
            
    # 2. users 테이블 스키마 검사
    if 'users' in inspector.get_table_names():
        user_cols = [c['name'] for c in inspector.get_columns('users')]
        if 'tokens' not in user_cols or 'is_operator' not in user_cols:
            rebuild = True

    # 3. inquiries 테이블 스키마 검사
    if 'inquiries' not in inspector.get_table_names():
        rebuild = True

    if rebuild:
        print("Outdated database schema detected. Rebuilding SQLite database for Billing/Token/Operator/Inquiry updates...")
        SessionLocal.close_all()
        engine.dispose()
        if os.path.exists(db_path):
            os.remove(db_path)
except Exception as e:
    print("Database schema check failed, rebuilding database:", e)

# Create tables
Base.metadata.create_all(bind=engine)
