from fastapi import APIRouter, HTTPException
from app.core.rules import RULES

router = APIRouter()

@router.get("/rules")
async def get_rules():
    """Retrieve all defined rules"""
    return RULES

@router.get("/rules/{rule_id}")
async def get_rule(rule_id: str):
    """Retrieve a single rule by ID"""
    for rule in RULES:
        if rule["id"] == rule_id:
            return rule
    raise HTTPException(status_code=404, detail="Rule not found")
