from fastapi import APIRouter, Request, Depends, HTTPException, status
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import date

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from sqlalchemy import select

router = APIRouter()

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

@router.get("/google")
async def auth_google(request: Request):
    """Initiate Google OAuth2 login flow"""
    redirect_uri = f"{settings.base_url}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/google/callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Google OAuth2 callback, create or fetch user, store session"""
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = await oauth.google.parse_id_token(request, token)
    except OAuthError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth authentication failed")

    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No email in token")
    name = user_info.get("name", email)
    picture = user_info.get("picture")
    # As birth_date is required, set a default placeholder
    birth_date = date(2000, 1, 1)

    # Fetch or create user
    result = await db.execute(select(User).filter_by(email=email))
    user = result.scalars().first()
    if not user:
        user = User(
            email=email,
            name=name,
            birth_date=birth_date,
            is_parent=False,
            profile_picture=picture,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Store user ID in session
    request.session["user"] = str(user.id)

    # Redirect or return user info
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "birthDate": str(user.birth_date),
        "isParent": user.is_parent,
        "profilePicture": user.profile_picture,
    }

@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    """Return currently authenticated user or null"""
    user_id = request.session.get("user")
    if not user_id:
        return None
    try:
        uid = UUID(user_id)
    except ValueError:
        return None
    user = await db.get(User, uid)
    if not user:
        return None
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "birthDate": str(user.birth_date),
        "isParent": user.is_parent,
        "profilePicture": user.profile_picture,
    }

@router.post("/logout")
async def logout(request: Request):
    """Log out the current user"""
    request.session.clear()
    return {"success": True}