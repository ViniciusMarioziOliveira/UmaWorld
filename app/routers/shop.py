from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game import shop
from ..schemas import BuyIn
from ..security import current_user, locked_user
from .common import done

router = APIRouter(prefix="/api/shop", tags=["shop"])


@router.get("")
def offers(user: m.User = Depends(current_user), db: Session = Depends(get_db)):
    return shop.list_view(db, user)


@router.post("/{offer_id}/buy")
def buy(offer_id: str, body: BuyIn, user: m.User = Depends(locked_user), db: Session = Depends(get_db)):
    result = shop.buy(db, user, offer_id, body.quantity)
    result["shop"] = shop.list_view(db, user)
    return done(db, user, result)
