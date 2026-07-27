"use client";

import { useEffect, useMemo, useState } from "react";
import type { CanonicalDataset } from "../lib/dataEngine";
import { canonicalizeDataset, formatValue } from "../lib/dataEngine";
import { fetchCategory } from "../lib/dataSources";
import { SOURCE_REGISTRY } from "../lib/sourceRegistry";
import { resolvePlayerSourceUrl } from "../lib/playerSourceLinks";

type Props = {
  dataset: CanonicalDataset;
  boardCountryIds?: string[];
  onClose: () => void;
};

export default function CategorySourcePanel({ dataset, boardCountryIds = [], onClose }: Props) {
  const [query, setQuery] = useState("");
  const [fullDataset, setFullDataset] = useState<CanonicalDataset>(dataset);
  const [loading, setLoading] = useState(true);
  const [fullRankingLoaded, setFullRankingLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const category = fullDataset.category;
  const boardIds = useMemo(() => new Set(boardCountryIds), [boardCountryIds]);

  useEffect(() => {
    let cancelled = false;
    setFullDataset(dataset);
    setLoading(true);
    setFullRankingLoaded(false);
    setLoadError(null);
    (async () => {
      try {
        const loaded = canonicalizeDataset(await fetchCategory(dataset.category));
        const expectedCoverage = Number(loaded.category.globalCoverage ?? 0);
        if (!expectedCoverage || loaded.ranked.length !== expectedCoverage) {
          throw new Error(`Only ${loaded.ranked.length} of ${expectedCoverage || "the expected"} country values loaded.`);
        }
        if (!cancelled) {
          setFullDataset({
            ...loaded,
            category: { ...loaded.category, ...dataset.category, globalCoverage: expectedCoverage },
            sourceUrl: dataset.sourceUrl || loaded.sourceUrl,
            methodologyUrl: dataset.methodologyUrl || loaded.methodologyUrl,
            exactQueryUrl: dataset.exactQueryUrl || loaded.exactQueryUrl,
            sourcePageUrl: dataset.sourcePageUrl || loaded.sourcePageUrl,
            playerSourceUrl: dataset.playerSourceUrl || loaded.playerSourceUrl,
            playerSourceStatus: dataset.playerSourceStatus || loaded.playerSourceStatus,
            playerSourceReason: dataset.playerSourceReason || loaded.playerSourceReason,
            downloadUrl: dataset.downloadUrl || loaded.downloadUrl,
          });
          setFullRankingLoaded(true);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "The complete global ranking could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dataset]);

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return fullDataset.ranked.filter((row) =>
      !normalized || row.countryName.toLowerCase().includes(normalized) || row.countryId.toLowerCase().includes(normalized),
    );
  }, [fullDataset.ranked, query]);

  const sourceName = category.source === "worldbank"
    ? "World Bank"
    : SOURCE_REGISTRY[category.source]?.name ?? category.source;
  const description = category.plainLanguageDescription || category.description;
  const sourceLink = resolvePlayerSourceUrl({
    source: category.source,
    indicator: category.warehouseSourceIndicatorCode || category.indicator,
    playerSourceUrl: fullDataset.playerSourceUrl || category.playerSourceUrl,
    playerSourceStatus: (fullDataset.playerSourceStatus || category.playerSourceStatus) as any,
    sourcePageUrl: fullDataset.sourcePageUrl || category.sourcePageUrl,
    sourceUrl: fullDataset.sourceUrl || category.sourceUrl,
    methodologyUrl: fullDataset.methodologyUrl || category.methodologyUrl,
  });
  const sourceLinkIsExact = category.source === "worldbank" || (fullDataset.playerSourceStatus || category.playerSourceStatus) === "exact";
  const tableTitle = fullRankingLoaded ? "Global rankings" : "Countries in this game";

  return <div className="sourceModal" role="dialog" aria-modal="true" aria-label={`${category.name} data and source`} onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div className="sourcePanel sourcePanelSimple">
      <button className="sourceClose" onClick={onClose} aria-label="Close data and source">×</button>
      <header>
        <span className="kicker">Data & Source</span>
        <h2>{category.icon} {category.name}</h2>
        <p>{description}</p>
        <div className="sourceSimpleMeta"><strong>{sourceName}</strong><span>{fullDataset.year}</span></div>
      </header>

      <div className="sourceTableHeader">
        <div><h3>{tableTitle}</h3><span>{fullDataset.ranked.length} countries{fullRankingLoaded && boardIds.size ? " · today’s countries highlighted" : ""}</span></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Look up a country" aria-label="Look up a country" />
      </div>

      {loading && <p className="sourceLoading">Loading the complete verified ranking…</p>}
      {loadError && !loading && <p className="sourceLoadError">The complete global ranking is unavailable, so only the countries from this game are shown. {loadError}</p>}
      <div className="sourceDataTable" role="table" aria-label={`${category.name} ${fullRankingLoaded ? "global" : "game"} country rankings`}>
        <div className="sourceDataHead" role="row"><b>Rank</b><b>Country</b><b>Value</b><b>Year</b></div>
        {rows.map((row) => <div className={`sourceDataRow ${boardIds.has(row.countryId) ? "boardCountry" : ""}`} role="row" key={`${row.countryId}:${row.year}`}>
          <b>#{row.globalRank}</b><span>{row.countryName}</span><span>{formatValue(row.value, category)}</span><small>{row.year}</small>
        </div>)}
        {!rows.length && !loading && <p className="sourceEmpty">No countries match that search.</p>}
      </div>

      {sourceLink ? <div className="sourceLinks sourceLinksSimple"><a href={sourceLink} target="_blank" rel="noreferrer">{sourceLinkIsExact ? "View exact official data ↗" : "Open official data source ↗"}</a>{!sourceLinkIsExact && <small>General official portal; use the category title or indicator code to locate the data.</small>}</div> : <p className="sourceLoadError">No safe human-readable official source page is available for this category. It is excluded from future Daily boards until one is supplied.</p>}
    </div>
  </div>;
}
