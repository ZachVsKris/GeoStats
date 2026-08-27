"use client";

import { useEffect, useMemo, useState } from "react";
import type { CanonicalDataset } from "../lib/dataEngine";
import { canonicalizeDataset, formatValue } from "../lib/dataEngine";
import { fetchCategory } from "../lib/dataSources";
import { resolvePlayerSourceUrl } from "../lib/playerSourceLinks";
import { sourceSpecification } from "../lib/sourceSpecification";
import { formatExactCategoryValue } from "../lib/valueFormatting";
import { categoryMeasurementLabel } from "../lib/categoryMeasurement";

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
    void (async () => {
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
            sourceQuery: dataset.sourceQuery || loaded.sourceQuery,
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

  const description = category.plainLanguageDescription || category.description;
  const specification = sourceSpecification(fullDataset);
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
  const showObservationYear = category.showObservationYear !== false;
  const referenceLabel = category.referenceLabel || fullDataset.datasetRelease || "Pinned source release";
  const observationReference = (year?: string) => {
    if (showObservationYear) return year || "Reference unavailable";
    if (category.measurementType === "historical_date" && year) return `${year} snapshot`;
    return referenceLabel;
  };

  return <div className="sourceModal" role="dialog" aria-modal="true" aria-label={`${category.name} data and source`} onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div className="sourcePanel sourcePanelSimple" data-measurement={categoryMeasurementLabel(category)}>
      <button className="sourceClose" onClick={onClose} aria-label="Close data and source">×</button>

      <header className="sourceHero" title={categoryMeasurementLabel(category)}>
        <div className="sourceHeroTop">
          <span className="sourceHeroIcon" aria-hidden="true">{category.icon}</span>
          <div className="sourceHeroCopy">
            <h2>{category.name}</h2>
            <p className="sourceHeroDescription">{description}</p>
          </div>
        </div>
        <div className="sourceSpec" aria-label="Exact source specification">
          {specification.chips.map((chip, index) => <span className={index === 0 ? "sourceSpecPrimary" : ""} key={chip}>{chip}</span>)}
        </div>
      </header>

      <div className="sourceTableHeader">
        <div>
          <h3>{tableTitle}</h3>
          <span>{fullDataset.ranked.length} countries{fullRankingLoaded && boardIds.size ? " · today’s countries highlighted" : ""}</span>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Look up a country" aria-label="Look up a country" />
      </div>

      {loading && <p className="sourceLoading">Loading the complete verified ranking…</p>}
      {loadError && !loading && <p className="sourceLoadError">The complete global ranking is unavailable, so only the countries from this game are shown. {loadError}</p>}
      <div className="sourceDataTable" role="table" aria-label={`${category.name} ${fullRankingLoaded ? "global" : "game"} country rankings`}>
        <div className="sourceDataHead" role="row"><b>Rank</b><b>Country</b><b>Value</b><b>Reference</b></div>
        {rows.map((row) => <div className={`sourceDataRow ${boardIds.has(row.countryId) ? "boardCountry" : ""}`} role="row" key={`${row.countryId}:${row.year}`}>
          <b>#{row.globalRank}</b>
          <span>{row.countryName}</span>
          <span title={formatExactCategoryValue(row.value, category)}>{formatValue(row.value, category)}</span>
          <small>{observationReference(row.year)}</small>
        </div>)}
        {!rows.length && !loading && <p className="sourceEmpty">No countries match that search.</p>}
      </div>

      {sourceLink
        ? <div className="sourceLinks sourceLinksSimple">
            <a href={sourceLink} target="_blank" rel="noreferrer">{sourceLinkIsExact ? "View exact official data ↗" : "Open official data source ↗"}</a>
            {!sourceLinkIsExact && <small>{category.source === "faostat"
              ? "FAOSTAT may retain earlier selections. Confirm the exact item, Production Quantity element, unit and year shown above before comparing the ranking."
              : "General official portal. Match the exact source specification above; the portal may open with a different default measure."}</small>}
          </div>
        : <p className="sourceLoadError">No safe human-readable official source page is available for this category.</p>}
    </div>
  </div>;
}
