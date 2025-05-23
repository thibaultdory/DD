from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import logging # Import logging
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_parent
from app.models.privilege import Privilege
from app.models.user import User
from app.schemas import PrivilegeCreate, PrivilegeUpdate

logger = logging.getLogger(__name__) # Add logger instance
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
async def get_privileges_by_date(date_str: str, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    from datetime import date
    try:
        day = date.fromisoformat(date_str)
    except ValueError as e:
        logger.warning(f"Invalid date format received: {date_str}", exc_info=True)
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format")
    result = await db.execute(select(Privilege).where(Privilege.date == day))
    privs = result.scalars().all()
    return [serialize_priv(p) for p in privs]

@router.post("/privileges")
async def create_privilege(priv_in: PrivilegeCreate, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    try:
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
        logger.info(f"Created privilege '{priv.title}' for user {priv.assigned_to} on {priv.date}")
        return serialize_priv(priv)
    except Exception as e:
        logger.error(f"Failed to create privilege: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create privilege")

@router.put("/privileges/{privilege_id}")
async def update_privilege(privilege_id: UUID, updates: PrivilegeUpdate, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    priv = await db.get(Privilege, privilege_id)
    if not priv:
        logger.warning(f"Update attempt on non-existent privilege: {privilege_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Privilege not found")
    try:
        data = updates.dict(exclude_unset=True)
        logger.info(f"Updating privilege {privilege_id} with data: {data}")
        for field, value in data.items():
            model_field = field
            if field == 'assignedTo':
                model_field = 'assigned_to'
            
            if hasattr(priv, model_field):
                setattr(priv, model_field, value)
            else:
                 logger.warning(f"Attempted to update non-existent field '{model_field}' (from '{field}') on privilege {privilege_id}")

        await db.commit()
        await db.refresh(priv)
        logger.info(f"Successfully updated privilege {privilege_id}")
        return serialize_priv(priv)
    except Exception as e:
        logger.error(f"Failed to update privilege {privilege_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update privilege")

@router.delete("/privileges/{privilege_id}")
async def delete_privilege(privilege_id: UUID, parent: User = Depends(require_parent), db: AsyncSession = Depends(get_db)):
    priv = await db.get(Privilege, privilege_id)
    if not priv:
        logger.warning(f"Delete attempt on non-existent privilege: {privilege_id}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Privilege not found")
    try:
        await db.delete(priv)
        await db.commit()
        logger.info(f"Successfully deleted privilege {privilege_id}")
        return {"success": True}
    except Exception as e:
        logger.error(f"Failed to delete privilege {privilege_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete privilege")

@router.get("/privileges/calendar")
async def get_privileges_for_calendar(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """
    Get all privileges for calendar view.
    Parents can see and modify all privileges.
    Children can see all privileges but can only view their assigned privileges (read-only).
    """
    result = await db.execute(select(Privilege))
    privs = result.scalars().all()
    
    serialized_privs = []
    for priv in privs:
        priv_data = serialize_priv(priv)
        # Add permission flag for frontend
        if current_user.is_parent:
            priv_data["canModify"] = True
        else:
            # Children can only view their own privileges (read-only)
            is_assigned = str(current_user.id) == priv_data["assignedTo"]
            priv_data["canModify"] = False  # Always read-only for children
            priv_data["canView"] = is_assigned
        
        serialized_privs.append(priv_data)
    
    return serialized_privs

@router.get("/privileges/calendar/range")
async def get_privileges_for_calendar_range(
    start_date: str = Query(..., description="Start date for the range (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date for the range (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    """
    Get privileges for calendar view within a specific date range.
    More efficient than fetching all privileges when only viewing a specific period.
    """
    from datetime import date
    from fastapi import Query
    
    # Parse and validate dates
    try:
        start_dt = date.fromisoformat(start_date)
        end_dt = date.fromisoformat(end_date)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD format."
        )
    
    if start_dt > end_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date"
        )
    
    # Get privileges within the date range
    stmt = select(Privilege).where(
        Privilege.date >= start_dt,
        Privilege.date <= end_dt
    )
    result = await db.execute(stmt)
    privs = result.scalars().all()
    
    serialized_privs = []
    for priv in privs:
        priv_data = serialize_priv(priv)
        # Add permission flag for frontend
        if current_user.is_parent:
            priv_data["canModify"] = True
        else:
            # Children can only view their own privileges (read-only)
            is_assigned = str(current_user.id) == priv_data["assignedTo"]
            priv_data["canModify"] = False  # Always read-only for children
            priv_data["canView"] = is_assigned
        
        serialized_privs.append(priv_data)
    
    return serialized_privs
