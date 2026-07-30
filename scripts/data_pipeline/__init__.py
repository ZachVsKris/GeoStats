"""Shared GeoStats data-ingestion framework."""

from .base import WarehouseImporter
from .models import CandidateDefinition, IndicatorRule, QualityResult, SourceObservation
from .supabase import SupabaseWarehouse

__all__ = [
    "WarehouseImporter",
    "CandidateDefinition",
    "IndicatorRule",
    "QualityResult",
    "SourceObservation",
    "SupabaseWarehouse",
]
