from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/users/family")
async def get_family(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Retrieve all family members"""
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "name": u.name,
            "birthDate": u.birth_date.isoformat(),
            "isParent": u.is_parent,
            "profilePicture": u.profile_picture,
        }
        for u in users
    ]
