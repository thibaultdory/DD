from datetime import date, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.core.database import AsyncSessionLocal

# Initial family data
def _get_birth_date(offset_years: int) -> date:
    today = date.today()
    try:
        return today.replace(year=today.year - offset_years)
    except ValueError:
        # Feb 29
        return today.replace(month=2, day=28, year=today.year - offset_years)

async def seed_initial_data():
    parents = [
        {
            "email": "dory.thibault@gmail.com",
            "name": "Dory Thibault",
            "birth_date": _get_birth_date(40),
            "is_parent": True
        },
        {
            "email": "laurie.delmer@gmail.com",
            "name": "Laurie Delmer",
            "birth_date": _get_birth_date(38),
            "is_parent": True
        }
    ]
    children = [
        {
            "email": "eleadorydelmer@gmail.com",
            "name": "Elea Dory Delmer",
            "birth_date": _get_birth_date(8),
            "is_parent": False
        },
        {
            "email": "joleendorydelmer@gmail.com",
            "name": "Joleen Dory Delmer",
            "birth_date": _get_birth_date(6),
            "is_parent": False
        }
    ]
    async with AsyncSessionLocal() as session:  # type: AsyncSession
        for u in parents + children:
            result = await session.execute(select(User).filter_by(email=u["email"]))
            existing = result.scalars().first()
            if not existing:
                user = User(
                    email=u["email"],
                    name=u["name"],
                    birth_date=u["birth_date"],
                    is_parent=u["is_parent"]
                )
                session.add(user)
        await session.commit()