#!/usr/bin/env python3
"""Shared historical-successor policy for GeoStats.

Predecessor events are never attributed to current countries by default. Each
historical category must explicitly choose a reviewed inheritance mode.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Literal

InheritanceMode = Literal["none", "primary_successor", "all_successors"]

@dataclass(frozen=True)
class SuccessorGroup:
    predecessor: str
    successors: tuple[str, ...]
    primary_successor: str | None
    note: str

GROUPS: dict[str, SuccessorGroup] = {
    "USSR": SuccessorGroup("USSR", ("RUS","ARM","AZE","BLR","EST","GEO","KAZ","KGZ","LVA","LTU","MDA","TJK","TKM","UKR","UZB"), "RUS", "Soviet attribution varies by institution."),
    "YUGOSLAVIA": SuccessorGroup("YUGOSLAVIA", ("SRB","BIH","HRV","MKD","MNE","SVN"), "SRB", "Yugoslav attribution varies by institution."),
    "CZECHOSLOVAKIA": SuccessorGroup("CZECHOSLOVAKIA", ("CZE","SVK"), None, "No default single successor."),
    "EAST_GERMANY": SuccessorGroup("EAST_GERMANY", ("DEU",), "DEU", "Reunified Germany; category-specific attribution required."),
    "WEST_GERMANY": SuccessorGroup("WEST_GERMANY", ("DEU",), "DEU", "Reunified Germany; category-specific attribution required."),
    "NORTH_YEMEN": SuccessorGroup("NORTH_YEMEN", ("YEM",), "YEM", "Unified Yemen; category-specific attribution required."),
    "SOUTH_YEMEN": SuccessorGroup("SOUTH_YEMEN", ("YEM",), "YEM", "Unified Yemen; category-specific attribution required."),
    "TANGANYIKA": SuccessorGroup("TANGANYIKA", ("TZA",), "TZA", "Union formed Tanzania; category-specific attribution required."),
    "ZANZIBAR": SuccessorGroup("ZANZIBAR", ("TZA",), "TZA", "Union formed Tanzania; category-specific attribution required."),
    "SUDAN_PRE_2011": SuccessorGroup("SUDAN_PRE_2011", ("SDN","SSD"), None, "Pre-2011 Sudan is not inherited automatically."),
}

ALIASES = {
    "soviet union": "USSR", "union of soviet socialist republics": "USSR", "ussr": "USSR",
    "yugoslavia": "YUGOSLAVIA", "socialist federal republic of yugoslavia": "YUGOSLAVIA",
    "czechoslovakia": "CZECHOSLOVAKIA", "german democratic republic": "EAST_GERMANY", "east germany": "EAST_GERMANY",
    "federal republic of germany": "WEST_GERMANY", "west germany": "WEST_GERMANY",
    "north yemen": "NORTH_YEMEN", "yemen arab republic": "NORTH_YEMEN", "south yemen": "SOUTH_YEMEN", "people's democratic republic of yemen": "SOUTH_YEMEN",
    "tanganyika": "TANGANYIKA", "zanzibar": "ZANZIBAR",
}

def predecessor_key(name: str, *, event_year: int | None = None) -> str | None:
    cleaned = " ".join(str(name or "").lower().replace("’", "'").split())
    if cleaned == "sudan" and event_year is not None and event_year < 2011:
        return "SUDAN_PRE_2011"
    return ALIASES.get(cleaned)

def resolve_successors(name: str, *, mode: InheritanceMode = "none", event_year: int | None = None) -> tuple[str, ...]:
    key = predecessor_key(name, event_year=event_year)
    if key is None:
        return ()
    group = GROUPS[key]
    if mode == "none": return ()
    if mode == "primary_successor":
        if not group.primary_successor:
            raise ValueError(f"{group.predecessor} has no approved single primary successor")
        return (group.primary_successor,)
    if mode == "all_successors": return group.successors
    raise ValueError(f"Unknown historical successor mode: {mode}")
