import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def _normalize_scheme(uri: str) -> str:
    if uri.startswith("postgres://"):
        return uri.replace("postgres://", "postgresql://", 1)
    return uri


def _ensure_sslmode(uri: str) -> str:
    """
    Supabase PostgreSQL requires SSL. Add sslmode=require when missing.
    """
    parsed = urlparse(uri)
    if not parsed.scheme.startswith("postgresql"):
        return uri

    query_pairs = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query_pairs.setdefault("sslmode", "require")
    new_query = urlencode(query_pairs)
    return urlunparse(parsed._replace(query=new_query))


def build_database_uri(raw_uri: str) -> str:
    """
    Build a SQLAlchemy-compatible Supabase/PostgreSQL URI.
    """
    uri = (raw_uri or "").strip()
    if not uri:
        raise ValueError("DATABASE_URL is required for PostgreSQL/Supabase connection.")

    uri = _normalize_scheme(uri)
    parsed = urlparse(uri)
    if not parsed.scheme.startswith("postgresql"):
        raise ValueError("Only PostgreSQL DATABASE_URL is supported.")
    uri = _ensure_sslmode(uri)
    return uri


def mask_database_uri(uri: str) -> str:
    """
    Returns a safe, masked URI for logs/debugging.
    """
    parsed = urlparse(uri)
    if not parsed.password:
        return uri

    netloc = parsed.netloc.replace(parsed.password, "***")
    return urlunparse(parsed._replace(netloc=netloc))


def get_database_uri_from_env() -> str:
    return build_database_uri(os.environ.get("DATABASE_URL", ""))

