from __future__ import annotations

import logging
from typing import Any

import aiosqlite

from .schema import SCHEMA, SCHEMA_VERSION, IndexDef, TableDef

logger = logging.getLogger(__name__)


def _create_table_sql(table: str, spec: TableDef) -> str:
    columns = ",\n    ".join(f"{name} {definition}" for name, definition in spec.columns.items())
    constraints = ""
    if spec.constraints:
        constraints = ",\n    " + ",\n    ".join(spec.constraints)
    return f"CREATE TABLE IF NOT EXISTS {table} (\n    {columns}{constraints}\n);"


def _create_index_sql(table: str, index: IndexDef) -> str:
    unique = "UNIQUE " if index.unique else ""
    columns = ", ".join(index.columns)
    return f"CREATE {unique}INDEX IF NOT EXISTS {index.name} ON {table} ({columns});"


async def _get_user_version(conn: aiosqlite.Connection) -> int:
    async with conn.execute("PRAGMA user_version") as cur:
        row = await cur.fetchone()
    return int(row[0]) if row else 0


async def _set_user_version(conn: aiosqlite.Connection, version: int) -> None:
    await conn.execute(f"PRAGMA user_version = {version}")


async def check_db_health(db_path: str) -> dict[str, Any]:
    """Inspect existing DB schema and report missing tables/columns/indexes."""
    report: dict[str, Any] = {
        "missing_tables": [],
        "missing_columns": {},
        "missing_indexes": {},
        "errors": [],
    }

    async with aiosqlite.connect(db_path) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute("SELECT name FROM sqlite_master WHERE type='table'") as cur:
            existing_tables = {row["name"] async for row in cur}

        for table, spec in SCHEMA.items():
            if table not in existing_tables:
                report["missing_tables"].append(table)
                continue

            async with conn.execute(f"PRAGMA table_info({table})") as cur:
                columns = {row["name"] async for row in cur}
            missing_cols = sorted(set(spec.columns.keys()) - columns)
            if missing_cols:
                report["missing_columns"][table] = missing_cols

            async with conn.execute(f"PRAGMA index_list({table})") as cur:
                indexes = {row["name"] async for row in cur}
            missing_indexes = [
                index.name for index in spec.indexes if index.name not in indexes
            ]
            if missing_indexes:
                report["missing_indexes"][table] = missing_indexes

    return report


async def run_migrations(db_path: str) -> dict[str, Any]:
    """Apply forward-only, idempotent migrations based on schema definition."""
    results: dict[str, Any] = {
        "created_tables": [],
        "added_columns": {},
        "created_indexes": {},
        "manual_actions": [],
        "schema_version_before": 0,
        "schema_version_after": SCHEMA_VERSION,
    }

    async with aiosqlite.connect(db_path) as conn:
        await conn.execute("PRAGMA foreign_keys = ON")
        await conn.execute("PRAGMA journal_mode = WAL")
        await conn.execute("PRAGMA synchronous = NORMAL")

        current_version = await _get_user_version(conn)
        results["schema_version_before"] = current_version
        logger.info("DB schema version: %s", current_version)

        async with conn.execute("SELECT name FROM sqlite_master WHERE type='table'") as cur:
            existing_tables = {row[0] async for row in cur}

        for table, spec in SCHEMA.items():
            if table not in existing_tables:
                await conn.execute(_create_table_sql(table, spec))
                results["created_tables"].append(table)
                continue

            async with conn.execute(f"PRAGMA table_info({table})") as cur:
                existing_columns = {row[1] async for row in cur}
            for column, definition in spec.columns.items():
                if column in existing_columns:
                    continue
                if "PRIMARY KEY" in definition.upper() or "UNIQUE" in definition.upper():
                    results["manual_actions"].append(
                        f"Manual action required: add column {table}.{column} with constraints"
                    )
                    continue
                await conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                results.setdefault("added_columns", {}).setdefault(table, []).append(column)

            async with conn.execute(f"PRAGMA index_list({table})") as cur:
                existing_indexes = {row[1] async for row in cur}
            for index in spec.indexes:
                if index.name in existing_indexes:
                    continue
                try:
                    await conn.execute(_create_index_sql(table, index))
                    results.setdefault("created_indexes", {}).setdefault(table, []).append(
                        index.name
                    )
                except aiosqlite.Error as exc:
                    results["manual_actions"].append(
                        f"Manual action required: create index {index.name} on {table} "
                        f"({', '.join(index.columns)}): {exc}"
                    )

        if current_version != SCHEMA_VERSION:
            await _set_user_version(conn, SCHEMA_VERSION)

        await conn.commit()

    return results
