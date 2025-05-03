from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.privilege import Privilege
from app.models.user import User
from app.schemas import PrivilegeCreate, PrivilegeUpdate

router = APIRouter()

def serialize_priv(priv: Privilege):
    return {
        "id": str(priv.id),
        "title": priv.title,
        "description": priv.description,
        "assignedTo": str(priv.assigned_to),
        "earned": priv.earned,
        "date": priv.date.isoformat(),
    }

@router.get("/privileges")
async def get_privileges(parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Privilege))
    privs = result.scalars().all()
    return [serialize_priv(p) for p in privs]

@router.get("/privileges/user/{user_id}")
async def get_user_privileges(user_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not (current_user.is_parent or current_user.id == user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    result = await db.execute(select(Privilege).where(Privilege.assigned_to == user_id))
    privs = result.scalars().all()
    return [serialize_priv(p) for p in privs]

@router.get("/privileges/date/{date_str}")
async def get_privileges_by_date(date_str: str, parent: Depends(require_parent), db: AsyncSession = Depends(get_db)):
    from datetime import date
    try:
        day = date.fromisoformat(date_str)
    except ValueError:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format")
    result = await db.execute(select(Privilege).where(Privilege.date == day))
    privs = result.scalars().all()
    return [serialize_priv(p) for p in privs]

@router.post("/privileges")
async def create_privilege(priv_in: PrivilegeCreate, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    priv = Privilege(
        title=priv_in.title,
        description=priv_in.description,
        assigned_to=priv_in.assignedTo,
        earned=False,
        date=priv_in.date,
    )
    db.add(priv)
    await db.commit()
    await db.refresh(priv)
    return serialize_priv(priv)

@router.put("/privileges/{privilege_id}")
async def update_privilege(privilege_id: UUID, updates: PrivilegeUpdate, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    priv = await db.get(Privilege, privilege_id)
    if not priv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Privilege not found")
    data = updates.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(priv, field.lower() if field != 'assignedTo' else 'assigned_to', value)
    await db.commit()
    await db.refresh(priv)
    return serialize_priv(priv)

@router.delete("/privileges/{privilege_id}")
async def delete_privilege(privilege_id: UUID, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    priv = await db.get(Privilege, privilege_id)
    if not priv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Privilege not found")
    await db.delete(priv)
    await db.commit()
    return {"success": True}
