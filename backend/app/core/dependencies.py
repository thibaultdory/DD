from uuid import UUID
from fastapi import Depends, HTTPException, status, Request
import logging # Import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__) # Add logger instance
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    user_id = request.session.get("user")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        logger.error(f"Invalid UUID format for user_id in session: {user_id}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session user")
    user = await db.get(User, user_uuid)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_parent(current_user: User = Depends(get_current_user)):
    if not current_user.is_parent:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Parent role required")
    return current_user
