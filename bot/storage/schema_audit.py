from __future__ import annotations

import ast
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

SQL_KEYWORDS = re.compile(
    r"\b(SELECT|INSERT|UPDATE|DELETE)\b|\bCREATE\s+TABLE\b|\bALTER\s+TABLE\b",
    re.IGNORECASE,
)
TABLE_PATTERNS = [
    re.compile(r"\bFROM\s+([A-Za-z_][\w]*)", re.IGNORECASE),
    re.compile(r"\bJOIN\s+([A-Za-z_][\w]*)", re.IGNORECASE),
    re.compile(r"\bUPDATE\s+(?!SET\b)([A-Za-z_][\w]*)", re.IGNORECASE),
    re.compile(r"\bINSERT\s+(?:OR\s+\w+\s+)?INTO\s+([A-Za-z_][\w]*)", re.IGNORECASE),
    re.compile(r"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w]*)", re.IGNORECASE),
    re.compile(r"\bALTER\s+TABLE\s+([A-Za-z_][\w]*)", re.IGNORECASE),
]
TABLE_COLUMN_PATTERN = re.compile(r"\b([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)\b")
INSERT_COLUMNS_PATTERN = re.compile(
    r"\bINSERT\s+INTO\s+[A-Za-z_][\w]*\s*\(([^)]+)\)", re.IGNORECASE
)
UPDATE_SET_PATTERN = re.compile(r"\bSET\s+(.+?)(?:\bWHERE\b|$)", re.IGNORECASE | re.DOTALL)
SELECT_PATTERN = re.compile(r"\bSELECT\s+(.+?)\bFROM\b", re.IGNORECASE | re.DOTALL)


@dataclass
class SqlOccurrence:
    file: Path
    sql: str


def _extract_strings_from_ast(tree: ast.AST) -> Iterable[str]:
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            yield node.value
        elif isinstance(node, ast.JoinedStr):
            parts = []
            for value in node.values:
                if isinstance(value, ast.Constant) and isinstance(value.value, str):
                    parts.append(value.value)
                else:
                    parts.append("{expr}")
            yield "".join(parts)


def _collect_sql_strings(path: Path) -> list[SqlOccurrence]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except SyntaxError:
        return []

    occurrences: list[SqlOccurrence] = []
    for text in _extract_strings_from_ast(tree):
        if SQL_KEYWORDS.search(text):
            occurrences.append(SqlOccurrence(file=path, sql=text))
    return occurrences


def _parse_tables(sql: str) -> set[str]:
    tables: set[str] = set()
    for pattern in TABLE_PATTERNS:
        for match in pattern.findall(sql):
            tables.add(match.lower())
    return tables


def _parse_columns(sql: str) -> set[str]:
    columns: set[str] = set()
    for _, col in TABLE_COLUMN_PATTERN.findall(sql):
        columns.add(col.lower())

    select_match = SELECT_PATTERN.search(sql)
    if select_match:
        columns.update(_split_column_list(select_match.group(1)))

    insert_match = INSERT_COLUMNS_PATTERN.search(sql)
    if insert_match:
        columns.update(_split_column_list(insert_match.group(1)))

    update_match = UPDATE_SET_PATTERN.search(sql)
    if update_match:
        set_expr = update_match.group(1)
        columns.update(_split_assignments(set_expr))

    return {col for col in columns if col and not col.startswith("expr")}


def _split_column_list(raw: str) -> set[str]:
    columns: set[str] = set()
    stopwords = {
        "as",
        "distinct",
        "coalesce",
        "sum",
        "count",
        "min",
        "max",
        "avg",
        "case",
        "when",
        "then",
        "else",
        "end",
    }
    for item in raw.split(","):
        token = item.strip()
        if not token or token.startswith("*"):
            continue
        identifiers = re.findall(r"\b[A-Za-z_][\w]*\b", token)
        for identifier in identifiers:
            lowered = identifier.lower()
            if lowered in stopwords:
                continue
            columns.add(lowered)
    return columns


def _split_assignments(raw: str) -> set[str]:
    columns: set[str] = set()
    for part in raw.split(","):
        token = part.strip().split("=")[0].strip()
        if "." in token:
            token = token.split(".")[-1]
        if token:
            columns.add(token.lower())
    return columns


def audit_repository(root: Path) -> dict[str, object]:
    tables: dict[str, set[str]] = {}
    suspicious: list[str] = []
    sql_occurrences: list[SqlOccurrence] = []
    table_stopwords = {
        "if",
        "set",
        "values",
        "select",
        "from",
        "join",
        "where",
        "update",
        "insert",
        "into",
        "create",
        "alter",
    }

    for path in root.rglob("*.py"):
        if path.name.startswith("."):
            continue
        sql_occurrences.extend(_collect_sql_strings(path))

    for occurrence in sql_occurrences:
        sql = occurrence.sql
        parsed_tables = {table for table in _parse_tables(sql) if table not in table_stopwords}
        if not parsed_tables:
            suspicious.append(f"{occurrence.file}: {sql.strip()[:200]}")
            continue
        parsed_columns = _parse_columns(sql)
        for table in parsed_tables:
            tables.setdefault(table, set()).update(parsed_columns)

    return {
        "tables": {table: sorted(columns) for table, columns in sorted(tables.items())},
        "suspicious": sorted(suspicious),
        "total_sql_strings": len(sql_occurrences),
    }


def _write_report(report: dict[str, object], root: Path) -> tuple[Path, Path]:
    json_path = root / "audit_report.json"
    txt_path = root / "audit_report.txt"

    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = ["Schema audit report", ""]
    lines.append("Tables and columns:")
    for table, columns in report["tables"].items():
        lines.append(f"- {table}: {', '.join(columns) if columns else '(no columns found)'}")
    lines.append("")
    lines.append("Suspicious SQL snippets:")
    for item in report["suspicious"]:
        lines.append(f"- {item}")
    lines.append("")
    lines.append(f"Total SQL strings: {report['total_sql_strings']}")
    txt_path.write_text("\n".join(lines), encoding="utf-8")

    return json_path, txt_path


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    report = audit_repository(root / "bot")
    json_path, txt_path = _write_report(report, root)
    print(f"Wrote {json_path}")
    print(f"Wrote {txt_path}")


if __name__ == "__main__":
    main()
