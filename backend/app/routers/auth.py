from fastapi import APIRouter, Request, Depends
import logging  # Import logging
import secrets
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
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

def serialize_user(user: User):
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "birthDate": str(user.birth_date),
        "isParent": user.is_parent,
        "profilePicture": user.profile_picture,
    }

def get_verified_email(user_info: dict) -> str | None:
    """Return a normalized verified Google email, or reject the identity."""
    email = user_info.get("email")
    if not isinstance(email, str) or user_info.get("email_verified") is not True:
        return None
    normalized_email = email.strip().casefold()
    return normalized_email or None

async def get_preprovisioned_user(db: AsyncSession, email: str) -> User | None:
    """Look up an existing DD user without creating an account."""
    result = await db.execute(select(User).filter_by(email=email))
    return result.scalars().first()

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
    except OAuthError:
        logger.error("OAuth authentication failed", exc_info=True)
        error_params = urlencode({"error": "oauth_failed"})
        return RedirectResponse(url=f"{settings.frontend_url}?{error_params}")

    email = get_verified_email(user_info)
    if not email:
        logger.warning("Google account did not provide a verified email address")
        error_params = urlencode({"error": "unverified_email"})
        return RedirectResponse(url=f"{settings.frontend_url}?{error_params}")

    try:
        # DD is a private family application: only pre-provisioned users may sign in.
        user = await get_preprovisioned_user(db, email)
        if not user:
            logger.warning("Rejected Google login for a non-provisioned account")
            request.session.clear()
            error_params = urlencode({"error": "access_denied"})
            return RedirectResponse(url=f"{settings.frontend_url}?{error_params}")

        # Store user ID in session
        request.session.clear()
        request.session["user"] = str(user.id)
        request.session["csrf_token"] = secrets.token_urlsafe(32)

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
    return serialize_user(user)

@router.get("/session")
async def get_session(request: Request, db: AsyncSession = Depends(get_db)):
    """Return the current user and family members in one request."""
    user_id = request.session.get("user")
    if not user_id:
        return {"user": None, "family": []}
    try:
        uid = UUID(user_id)
    except ValueError:
        logger.warning(f"Invalid user_id format in session: {user_id}")
        return {"user": None, "family": []}

    user = await db.get(User, uid)
    if not user:
        logger.warning(f"User with id {uid} not found in database, but was in session.")
        return {"user": None, "family": []}

    csrf_token = request.session.get("csrf_token")
    if not csrf_token:
        csrf_token = secrets.token_urlsafe(32)
        request.session["csrf_token"] = csrf_token

    result = await db.execute(select(User))
    family = result.scalars().all()
    return {
        "user": serialize_user(user),
        "family": [serialize_user(member) for member in family],
        "csrfToken": csrf_token,
    }

@router.post("/logout")
async def logout(request: Request):
    """Log out the current user"""
    request.session.clear()
    return {"success": True}
