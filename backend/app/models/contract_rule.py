import uuid
from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base

# Association table for many-to-many relationship between contracts and rules
contract_rules = Table(
    'contract_rules',
    Base.metadata,
    Column('contract_id', UUID(as_uuid=True), ForeignKey('contracts.id'), primary_key=True),
    Column('rule_id', UUID(as_uuid=True), ForeignKey('rules.id'), primary_key=True)
)