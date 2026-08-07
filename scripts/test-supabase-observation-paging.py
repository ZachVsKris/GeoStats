from __future__ import annotations

import re
from urllib.parse import unquote

from data_pipeline.supabase import SupabaseWarehouse


class FakeWarehouse(SupabaseWarehouse):
    def __init__(self) -> None:
        super().__init__("https://example.supabase.co", "test")
        self.paths: list[str] = []
        self.forced_split = False

    def _request(self, method: str, path: str, payload=None, *, prefer=None):
        assert method == "GET"
        self.paths.append(path)
        assert "data_year=eq." in path
        assert "offset=73000" not in path

        match = re.search(r"category_id=in\.\((.*?)\)", path)
        assert match
        ids = [unquote(value) for value in match.group(1).split(",")]
        assert len(ids) <= 12

        # Exercise the recursive timeout fallback once.
        if not self.forced_split and len(ids) > 1:
            self.forced_split = True
            raise RuntimeError(
                'Supabase GET failed (500): {"code":"57014","message":"canceling statement due to statement timeout"}'
            )

        year_match = re.search(r"data_year=eq\.(\d+)", path)
        assert year_match
        year = int(year_match.group(1))
        return [
            {
                "category_id": category_id,
                "country_iso3": "USA",
                "data_year": year,
                "value": float(index + 1),
            }
            for index, category_id in enumerate(ids)
        ]


warehouse = FakeWarehouse()
category_ids = [f"category-{index:02d}" for index in range(25)] + ["missing-year"]
years = {
    category_id: 2020 if index < 13 else 2021
    for index, category_id in enumerate(category_ids[:-1])
}
rows = warehouse.list_category_observations_paged(
    category_ids,
    year_by_category=years,
    category_chunk_size=12,
)

assert len(rows) == 25
assert {row["category_id"] for row in rows} == set(category_ids[:-1])
assert {row["data_year"] for row in rows} == {2020, 2021}
assert warehouse.forced_split
assert all(len(path) < 2500 for path in warehouse.paths)
print("Supabase common-year observation paging fixtures passed.")
