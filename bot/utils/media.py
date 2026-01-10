from __future__ import annotations

from pathlib import Path

from aiogram.types import FSInputFile, InputMediaPhoto

from bot.storage.repos import Product

PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def collect_photos(directory: Path) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(
        [
            path
            for path in directory.iterdir()
            if path.is_file() and path.suffix.lower() in PHOTO_EXTENSIONS
        ]
    )


def get_product_photos(product: Product) -> list[Path]:
    if not product.photo_dir:
        return []
    return collect_photos(repo_root() / product.photo_dir)


def get_placeholder_photo() -> Path:
    fallback = repo_root() / "margarita" / "margarita_01.jpg"
    if fallback.exists():
        return fallback
    files = sorted(repo_root().rglob("*.jpg"))
    if files:
        return files[0]
    raise FileNotFoundError("No placeholder images found")


def build_media(photo_path: Path, caption: str) -> InputMediaPhoto:
    return InputMediaPhoto(media=FSInputFile(photo_path), caption=caption, parse_mode="HTML")
