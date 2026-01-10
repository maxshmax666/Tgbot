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


def _build_amount(amount: int) -> dict[str, str]:
    return {"value": str(Decimal(amount)), "currency": "RUB"}


def create_payment_card(
    order_id: int,
    amount: int,
    description: str,
    return_url: str | None = None,
) -> YooKassaPayment:
    payload: dict[str, Any] = {
        "amount": _build_amount(amount),
        "confirmation": {
            "type": "redirect",
            "return_url": return_url or "https://t.me",
        },
        "capture": True,
        "description": description,
        "metadata": {"order_id": str(order_id)},
        "payment_method_data": {"type": "bank_card"},
    }
    payment = Payment.create(payload)
    return YooKassaPayment(
        payment_id=payment.id,
        confirmation_url=payment.confirmation.confirmation_url,
        status=payment.status,
    )


def create_payment_sbp(order_id: int, amount: int, description: str) -> YooKassaPayment:
    payload: dict[str, Any] = {
        "amount": _build_amount(amount),
        "confirmation": {"type": "qr"},
        "capture": True,
        "description": description,
        "metadata": {"order_id": str(order_id)},
        "payment_method_data": {"type": "sbp"},
    }
    payment = Payment.create(payload)
    confirmation_url = getattr(payment.confirmation, "confirmation_url", None)
    if not confirmation_url:
        confirmation_url = payment.confirmation.get("confirmation_url")
    return YooKassaPayment(
        payment_id=payment.id,
        confirmation_url=confirmation_url,
        status=payment.status,
    )


def get_payment_status(payment_id: str) -> str:
    payment = Payment.find_one(payment_id)
    return payment.status
