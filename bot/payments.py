from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from yookassa import Configuration, Payment

from .config import Config


@dataclass(frozen=True)
class YooKassaPayment:
    payment_id: str
    confirmation_url: str
    status: str


def configure_yookassa(config: Config) -> None:
    if config.yookassa_shop_id and config.yookassa_secret_key:
        Configuration.account_id = config.yookassa_shop_id
        Configuration.secret_key = config.yookassa_secret_key


def create_payment(config: Config, order_id: int, amount: int, description: str) -> YooKassaPayment:
    if not (config.yookassa_shop_id and config.yookassa_secret_key):
        raise RuntimeError("YooKassa credentials are not configured")

    payload: dict[str, Any] = {
        "amount": {"value": str(Decimal(amount)), "currency": config.currency},
        "confirmation": {
            "type": "redirect",
            "return_url": config.yookassa_return_url or "https://t.me",
        },
        "capture": True,
        "description": description,
        "metadata": {"order_id": str(order_id)},
    }
    payment = Payment.create(payload)
    return YooKassaPayment(
        payment_id=payment.id,
        confirmation_url=payment.confirmation.confirmation_url,
        status=payment.status,
    )


def get_payment_status(payment_id: str) -> str:
    payment = Payment.find_one(payment_id)
    return payment.status
