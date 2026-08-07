from __future__ import annotations

import re

_RANKING_PREFIX = re.compile(r"^(?:highest|lowest|largest|smallest|most|fewest|fastest|slowest|longest|shortest|oldest|youngest)\s+", re.I)


def _label(title: str) -> str:
    return _RANKING_PREFIX.sub("", title.strip()).strip().rstrip(".")


def _clean_unit(unit: str) -> str:
    value = re.sub(r"\s+", " ", (unit or "reported value").strip())
    return value.removeprefix("in ")


def _looks_like_source_only(title: str, description: str) -> bool:
    text = re.sub(r"\s+", " ", (description or "").strip()).lower()
    label = _label(title).lower()
    return (
        not text
        or text == title.strip().lower()
        or text.startswith("countries ranked by ")
        or (text.startswith(title.strip().lower()) and ("according to" in text or "using the latest" in text))
        or (label and text in {label, f"{label}."})
    )


def plain_language_description(title: str, unit: str, existing: str | None = None) -> str:
    """Return a board-sized explanation that tells a player what is measured.

    Source-native definitions remain in ``technical_definition``. This helper only
    replaces descriptions that amount to a title plus a source citation.
    """
    current = re.sub(r"\s+", " ", (existing or "").strip())
    if current and not _looks_like_source_only(title, current):
        return current

    label = _label(title)
    lower = label.lower().replace("‑", "-")
    unit_text = _clean_unit(unit)

    exact: tuple[tuple[str, str], ...] = (
        ("healthy life expectancy", "Average number of years a newborn is expected to live in good health."),
        ("life expectancy", "Average number of years a newborn is expected to live."),
        ("maternal mortality", "Deaths related to pregnancy or childbirth per 100,000 live births."),
        ("neonatal mortality", "Deaths during the first 28 days of life per 1,000 live births."),
        ("infant mortality", "Deaths before age one per 1,000 live births."),
        ("under-five mortality", "Deaths of children before age five per 1,000 live births."),
        ("under-5 mortality", "Deaths of children before age five per 1,000 live births."),
        ("labor-force participation", "Share of working-age people who are employed or actively looking for work."),
        ("labour-force participation", "Share of working-age people who are employed or actively looking for work."),
        ("employment-to-population ratio", "Share of working-age people who are employed."),
        ("youth neet rate", "Share of young people not in employment, education, or training."),
        ("working-poverty rate", "Share of employed people living below the international poverty line."),
        ("adult literacy rate", "Share of adults who can read and write a short, simple statement."),
        ("youth literacy rate", "Share of young people who can read and write a short, simple statement."),
        ("renewable freshwater", "Fresh water naturally replenished by rainfall, rivers, and groundwater each year."),
        ("gdp per person", "Average economic output per person."),
    )
    for token, description in exact:
        if token in lower:
            return description

    if "gross enrollment ratio" in lower or "gross enrolment ratio" in lower or " enrollment" in lower:
        level = re.sub(r"\s*(?:enrollment|enrolment).*$", "", lower).strip(" -")
        if "gross" in unit_text.lower():
            return f"Students enrolled in {level or 'this level of education'} as a share of the official school-age population; this can exceed 100%."
        return f"Share of the relevant age group enrolled in {level or 'this level of education'}."
    if "completion rate" in lower or "completion" in lower:
        return f"Share of students who complete {lower.replace('completion rate', '').strip(' -') or 'this level of education'}."
    if "out-of-school rate" in lower or "out of school" in lower:
        return f"Share of the relevant children or young people who are not enrolled in school ({unit_text})."
    if "pupil-teacher ratio" in lower or "student-teacher ratio" in lower:
        return "Average number of pupils or students per teacher."
    if "school" in lower and " access" in lower:
        subject = lower.replace("access", "").strip(" -")
        return f"Share of {subject} with the named service or facility ({unit_text})."
    if "vaccination coverage" in lower or "vaccine coverage" in lower:
        return f"Share of the target-age children who received the named vaccine ({unit_text})."
    if "incidence" in lower:
        condition = lower.replace("incidence", "").strip(" -")
        return f"New reported or estimated cases of {condition or 'the condition'}, measured as {unit_text}."
    if "mortality" in lower or "death rate" in lower:
        condition = re.sub(r"\b(?:mortality|death rate)\b", "", lower).strip(" -")
        return f"Deaths from {condition or 'the cause'}, measured as {unit_text}."
    if "prevalence" in lower:
        condition = lower.replace("prevalence", "").strip(" -")
        return f"Share of the relevant population with {condition or 'the condition'} ({unit_text})."
    if lower.endswith(" rate") and ("%" in unit_text or "percent" in unit_text.lower()):
        return f"Share of the relevant population counted in {lower[:-5]} ({unit_text})."
    if " share" in lower or lower.startswith("share of") or "%" in unit_text:
        return f"Share of the relevant population or total represented by {lower} ({unit_text})."
    if unit_text and unit_text.lower() not in {"reported value", "value", "other"}:
        return f"{label[:1].upper() + label[1:]}, measured as {unit_text}."
    return f"The reported country value for {lower}."
