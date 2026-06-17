import logging
import os
import socket
import subprocess
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

logger = logging.getLogger(__name__)


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


def _is_ipv4(host: str) -> bool:
    parts = host.split(".")
    if len(parts) != 4:
        return False
    try:
        return all(0 <= int(p) <= 255 for p in parts)
    except ValueError:
        return False


def _hostname_resolves(hostname: str) -> bool:
    try:
        socket.getaddrinfo(
            hostname, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM
        )
        return True
    except socket.gaierror:
        return False


def _first_ipv4_from_dig_output(stdout: str) -> str | None:
    for line in stdout.splitlines():
        candidate = line.strip().rstrip(".")
        if _is_ipv4(candidate):
            return candidate
    return None


def _resolve_via_public_dns(hostname: str) -> str | None:
    """Fallback when router/local DNS cannot resolve Supabase pooler hostnames."""
    for resolver in ("8.8.8.8", "1.1.1.1"):
        try:
            proc = subprocess.run(
                ["dig", "+short", hostname, "A", f"@{resolver}"],
                capture_output=True,
                text=True,
                timeout=8,
                check=False,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
            continue
        ip = _first_ipv4_from_dig_output(proc.stdout)
        if ip:
            return ip
    return None


def _replace_hostname_in_uri(uri: str, ip: str) -> str:
    parsed = urlparse(uri)
    host = parsed.hostname
    if not host:
        return uri
    port = parsed.port or 5432
    if parsed.username and parsed.password is not None:
        auth = f"{parsed.username}:{parsed.password}"
    elif parsed.username:
        auth = parsed.username
    else:
        auth = ""
    netloc = f"{auth}@{ip}:{port}" if auth else f"{ip}:{port}"
    return urlunparse(parsed._replace(netloc=netloc))


def _apply_dns_fallback_if_needed(uri: str) -> str:
    """
    Replace DB hostname with an IP when system DNS fails (common on some routers).

    Set DATABASE_DNS_FALLBACK=0 to disable. Requires ``dig`` on PATH for fallback.
    """
    flag = os.environ.get("DATABASE_DNS_FALLBACK", "1").strip().lower()
    if flag in ("0", "false", "no"):
        return uri

    parsed = urlparse(uri)
    host = parsed.hostname
    if not host or _is_ipv4(host) or _hostname_resolves(host):
        return uri

    override_ip = os.environ.get("DATABASE_HOST_IP", "").strip()
    if override_ip and _is_ipv4(override_ip):
        logger.warning(
            "Using DATABASE_HOST_IP=%s for database host %s",
            override_ip,
            host,
        )
        return _replace_hostname_in_uri(uri, override_ip)

    ip = _resolve_via_public_dns(host)
    if not ip:
        return uri

    logger.warning(
        "System DNS could not resolve database host %s; connecting via %s "
        "(public DNS fallback). Fix local DNS or set DATABASE_HOST_IP=%s in .env.",
        host,
        ip,
        ip,
    )
    return _replace_hostname_in_uri(uri, ip)


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
    uri = _apply_dns_fallback_if_needed(uri)
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

