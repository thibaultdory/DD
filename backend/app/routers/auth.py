from fastapi import APIRouter, Request, Depends, HTTPException, status
import logging  # Import logging
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import date
from urllib.parse import urlencode

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from sqlalchemy import select

router = APIRouter()
logger = logging.getLogger(__name__)  # Add logger instance

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
    # Clear any existing session data to prevent state conflicts
    request.session.clear()
    
    redirect_uri = f"{settings.base_url}/api/auth/google/callback"
    logger.info(f"Starting OAuth flow with redirect_uri: {redirect_uri}")
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/google/callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Google OAuth2 callback, create or fetch user, store session"""
    try:
        logger.info("Processing OAuth callback")
        token = await oauth.google.authorize_access_token(request)
        try:
            user_info = await oauth.google.parse_id_token(request, token)
        except Exception:
            # Fallback to userinfo endpoint if id_token parsing fails
            user_info = await oauth.google.userinfo(token=token)
    except OAuthError as e:  # Catch exception as e
        logger.error(f"OAuth authentication failed: {e}", exc_info=True)  # Log error
        # Redirect to frontend with error instead of raising HTTP exception
        error_params = urlencode({"error": "oauth_failed", "message": f"OAuth authentication failed: {str(e)}"})
        return RedirectResponse(url=f"{settings.frontend_url}?{error_params}")

    email = user_info.get("email")
    if not email:
        logger.error("No email in OAuth token from Google.") # Log error
        # Redirect to frontend with error instead of raising HTTP exception
        error_params = urlencode({"error": "no_email", "message": "No email provided by Google"})
        return RedirectResponse(url=f"{settings.frontend_url}?{error_params}")
    
    name = user_info.get("name", email)
    picture = user_info.get("picture")
    # As birth_date is required, set a default placeholder
    birth_date = date(2000, 1, 1)

    try:
        # Fetch or create user
        result = await db.execute(select(User).filter_by(email=email))
        user = result.scalars().first()
        if not user:
            logger.info(f"Creating new user with email: {email}") # Log info
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

        # Redirect to frontend
        return RedirectResponse(url=settings.frontend_url)
    
    except Exception as e:
        logger.error(f"Database error during user creation/login: {e}", exc_info=True)
        # Redirect to frontend with error instead of raising HTTP exception
        error_params = urlencode({"error": "database_error", "message": "Failed to process user login"})
        return RedirectResponse(url=f"{settings.frontend_url}?{error_params}")

@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    """Return currently authenticated user or null"""
    user_id = request.session.get("user")
    if not user_id:
        return None
    try:
        uid = UUID(user_id)
    except ValueError:
        logger.warning(f"Invalid user_id format in session: {user_id}") # Log warning
        return None
    user = await db.get(User, uid)
    if not user:
        logger.warning(f"User with id {uid} not found in database, but was in session.") # Log warning
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