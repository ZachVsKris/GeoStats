"use client";

import { useMemo, useState } from "react";
import type { CanonicalDataset } from "../lib/dataEngine";
import { formatValue } from "../lib/dataEngine";
import { SOURCE_REGISTRY } from "../lib/sourceRegistry";

type Props = {
  dataset: CanonicalDataset;
  onClose: () => void;
};

function displayDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function link(label: string, url?: string) {
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer">{label} ↗</a>;
}

function inputDatasetLabel(value: Record<string, unknown> | string) {
  if (typeof value === "string") return value;
  const name = String(value.name ?? value.dataset ?? value.layer ?? "Input dataset");
  const version = value.version ? ` v${String(value.version)}` : "";
  return `${name}${version}`;
}

export default function CategorySourcePanel({ dataset, onClose }: Props) {
  const [query, setQuery] = useState("");
  const category = dataset.category;
  const sourceName = category.source === "worldbank" ? "World Bank" : SOURCE_REGISTRY[category.source]?.name ?? category.source;
  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return dataset.ranked.filter((row) => !normalized || row.countryName.toLowerCase().includes(normalized) || row.countryId.toLowerCase().includes(normalized));
  }, [dataset.ranked, query]);
  const exactLink = dataset.exactQueryUrl || category.exactQueryUrl || dataset.apiUrl || category.apiUrl || dataset.sourceUrl;
  const sourcePage = dataset.sourcePageUrl || category.sourcePageUrl || dataset.sourceUrl;
  const description = category.plainLanguageDescription || category.description;

  return <div className="sourceModal" role="dialog" aria-modal="true" aria-label={`${category.name} source and data`} onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
    <div className="sourcePanel">
      <button className="sourceClose" onClick={onClose} aria-label="Close source details">×</button>
      <header>
        <span className="kicker">Source & all data</span>
        <h2>{category.icon} {category.name}</h2>
        <p>{description}</p>
      </header>

      <div className="sourceSummaryGrid">
        <div><span>Source</span><strong>{sourceName}</strong></div>
        <div><span>Dataset</span><strong>{category.dataset}</strong></div>
        <div><span>Indicator</span><strong>{category.warehouseSourceIndicatorCode ?? category.indicator}</strong></div>
        <div><span>Comparison year</span><strong>{dataset.year}</strong></div>
        <div><span>Unit</span><strong>{category.unitExplanation || category.unit}</strong></div>
        <div><span>Evidence</span><strong>{dataset.evidenceLabel || category.evidenceLabel || "Internationally harmonized"}</strong></div>
        <div><span>Verifiability</span><strong>{dataset.verifiabilityScore ?? category.verifiabilityScore ?? "Reviewed"}{typeof (dataset.verifiabilityScore ?? category.verifiabilityScore) === "number" ? "/100" : ""}</strong></div>
        <div><span>Dataset release</span><strong>{dataset.datasetRelease || category.datasetRelease || "Current imported release"}</strong></div>
      </div>

      {category.technicalDefinition && <section className="sourceDefinition"><h3>Technical definition</h3><p>{category.technicalDefinition}</p></section>}
      {(dataset.derivationMethod || category.derivationMethod) && <section className="sourceDefinition"><h3>How GeoStats calculated it</h3><p>{dataset.derivationMethod || category.derivationMethod}</p>{(dataset.derivationVersion || category.derivationVersion) && <small>Calculation version: {dataset.derivationVersion || category.derivationVersion}</small>}</section>}
      {((dataset.inputDatasets || category.inputDatasets)?.length ?? 0) > 0 && <section className="sourceDefinition"><h3>Input datasets</h3><ul>{(dataset.inputDatasets || category.inputDatasets || []).map((input, index) => <li key={`${inputDatasetLabel(input)}:${index}`}>{inputDatasetLabel(input)}</li>)}</ul></section>}
      {(dataset.sourceQuery || category.sourceQuery) && <details className="sourceQuery"><summary>Exact stored query parameters</summary><pre>{JSON.stringify(dataset.sourceQuery || category.sourceQuery, null, 2)}</pre></details>}
      {(dataset.trustReason || category.trustReason || dataset.playerQualityReason || category.playerQualityReason) && <section className="sourceDefinition"><h3>Why this category is usable</h3><p>{dataset.trustReason || category.trustReason}</p>{(dataset.playerQualityReason || category.playerQualityReason) && <p>{dataset.playerQualityReason || category.playerQualityReason}</p>}</section>}

      <div className="sourceLinks">
        {link("Open exact query", exactLink)}
        {link("Download source data", dataset.downloadUrl || category.downloadUrl)}
        {link("Original source page", sourcePage)}
        {link("Methodology", dataset.methodologyUrl || category.methodologyUrl)}
        {link("License", dataset.licenseUrl || category.licenseUrl)}
      </div>
      <p className="sourceSnapshotNote">The table below is the exact country snapshot GeoStats used for this category. It remains inspectable even when the provider does not offer a stable filtered link.{displayDate(dataset.retrievedAt || category.retrievedAt) ? ` Retrieved ${displayDate(dataset.retrievedAt || category.retrievedAt)}.` : ""}</p>

      <div className="sourceTableHeader">
        <div><h3>All available country values</h3><span>{dataset.ranked.length} countries</span></div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search country" aria-label="Search source data by country" />
      </div>
      <div className="sourceDataTable" role="table" aria-label={`${category.name} all country values`}>
        <div className="sourceDataHead" role="row"><b>Rank</b><b>Country</b><b>Value</b><b>Year</b></div>
        {rows.map((row) => <div className="sourceDataRow" role="row" key={`${row.countryId}:${row.year}`}>
          <b>#{row.globalRank}</b><span>{row.countryName}</span><span>{formatValue(row.value, category)}</span><small>{row.year}</small>
        </div>)}
        {!rows.length && <p className="sourceEmpty">No countries match that search.</p>}
      </div>
    </div>
  </div>;
}
