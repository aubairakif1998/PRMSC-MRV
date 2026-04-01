"""
Fixed tehsil list — must match operational geography (see frontend TEHSIL_OPTIONS).
Water-system locations and tehsil-manager tehsil assignments are validated here.

Tubewell operators are not assigned tehsils directly: they receive water systems
(registered under a tehsil); their effective tehsils are derived from those systems.
"""

from __future__ import annotations

PREDEFINED_TAHSILS: tuple[str, ...] = (
    "AHMADPUR SIAL",
    "ALIPUR",
    "BAHAWALNAGAR",
    "BHOWANA",
    "DARYA KHAN",
    "ISA KHEL",
    "KALLAR KAHAR",
    "KAHROR PACCA",
    "KHAIRPUR TAMEWALI",
    "KOT MOMIN",
    "LIAQATPUR",
    "NOORPUR THAL",
    "PAKPATTAN",
    "ROJHAN",
    "SHUJABAD",
    "TAUNSA",
)

_PREDEFINED_UPPER = {t.upper(): t for t in PREDEFINED_TAHSILS}


def canonical_tehsil(name: str | None) -> str | None:
    if not name or not isinstance(name, str):
        return None
    return _PREDEFINED_UPPER.get(name.strip().upper())


def is_valid_tehsil(name: str | None) -> bool:
    return canonical_tehsil(name) is not None


def validate_tehsil_assignments(tehsils: list | None) -> list[str]:
    """
    Return a deduplicated list of canonical tehsil names (e.g. for tehsil managers).
    Raises ValueError if empty or any value is not predefined.

    Not used for tubewell operator onboarding — operators get water_system_ids only.
    """
    if not tehsils or not isinstance(tehsils, list):
        raise ValueError("tehsils must be a non-empty list")
    out: list[str] = []
    seen: set[str] = set()
    for raw in tehsils:
        c = canonical_tehsil(str(raw).strip() if raw is not None else "")
        if not c:
            raise ValueError(f"Unknown or invalid tehsil: {raw!r}")
        if c not in seen:
            seen.add(c)
            out.append(c)
    if not out:
        raise ValueError("At least one valid tehsil is required")
    return out
