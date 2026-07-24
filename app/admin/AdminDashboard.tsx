"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type MouseEvent } from "react";

type ReviewStatus = "candidate" | "needs_review" | "approved" | "rejected";
type Decision = "approved" | "rejected" | "reset";
type SortKey = "quality" | "coverage" | "year" | "title";

type CategoryRow = {
  id: string;
  title: string;
  source_organization: string;
  source_dataset: string;
  source_indicator_code: string;
  enabled: boolean;
  eligible_daily: boolean;
  quality_score: number;
  country_coverage: number;
  latest_available_year: number | null;
  family: string;
  unit?: string;
  review_status: ReviewStatus;
  evidence_tier: "A" | "B" | "C" | null;
  auto_qualified: boolean;
  common_year: number | null;
  common_year_coverage: number;
  official_observation_share: number | null;
  modeled_observation_share: number | null;
  clustering_score: number | null;
  stability_score: number | null;
  quality_standard_version: string;
  recognizability_score?: number | null;
  specificity_score?: number | null;
  canonical_match_status?: string;
};

type ImportRow = {
  id: number;
  source_organization: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  categories_processed: number;
  observations_inserted: number;
  error_message: string | null;
};

type SourceRow = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

type Dashboard = {
  stats: { categories: number; observations: number; countries: number };
  reviewCounts: Record<ReviewStatus, number>;
  sources: SourceRow[];
  imports: ImportRow[];
  categories: CategoryRow[];
  boards: Record<string, boolean>;
  todayScoreCount: number;
};

type DailyMode = "easy" | "normal" | "expert";
type GeneratedBoard = { countries: string[]; categories: string[] };
type ScoreBreakdown = { overall: number; quality: number; variety: number; geography: number; difficultyFit: number; competitiveness: number };
type GenerationDiagnostics = {
  eligibleDatasets: number;
  requiredDatasets: number;
  attempts: number;
  validCandidates: Partial<Record<DailyMode, number>>;
  failureStage?: string;
  message?: string;
};
type GenerationResult = {
  date: string;
  diagnostics: GenerationDiagnostics;
  scores: Record<DailyMode, ScoreBreakdown>;
  boards: Record<DailyMode, GeneratedBoard>;
};
type Observation = { country_iso3: string; country_name: string; value: number; data_year: number; metadata?: Record<string, unknown> };
type CategoryDetail = {
  category: CategoryRow & Record<string, unknown>;
  year: number | null;
  top: Observation[];
  bottom: Observation[];
  reviews: { decision: string; notes: string | null; created_at: string }[];
};

const REPO_ACTIONS = "https://github.com/ZachVsKris/Geohunter/actions/workflows";
const WORKFLOWS: Record<string, string> = {
  faostat: `${REPO_ACTIONS}/import-faostat.yml`,
  who: `${REPO_ACTIONS}/import-who.yml`,
  unesco: `${REPO_ACTIONS}/import-unesco.yml`,
  ilostat: `${REPO_ACTIONS}/import-ilostat.yml`,
  climate: `${REPO_ACTIONS}/import-natural-earth.yml`,
  all: `${REPO_ACTIONS}/main.yml`,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 16,
  padding: 18,
  background: "rgba(8,30,24,.72)",
};
const button: React.CSSProperties = {
  appearance: "none",
  border: "1px solid rgba(185,244,90,.55)",
  background: "#17382d",
  color: "#efffda",
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 700,
  cursor: "pointer",
};
const mutedButton: React.CSSProperties = { ...button, borderColor: "rgba(255,255,255,.18)", background: "rgba(255,255,255,.05)" };
const dangerButton: React.CSSProperties = { ...button, borderColor: "rgba(255,120,120,.45)", background: "rgba(95,28,30,.65)" };
const input: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.16)",
  background: "#081b16",
  color: "#f4f7ef",
  padding: "8px 10px",
};

function percentage(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatValue(value: number, unit?: string) {
  const magnitude = Math.abs(value);
  const formatted = magnitude >= 1_000_000_000
    ? `${(value / 1_000_000_000).toFixed(2)}B`
    : magnitude >= 1_000_000
      ? `${(value / 1_000_000).toFixed(2)}M`
      : magnitude >= 1_000
        ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
        : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return unit ? `${formatted} ${unit}` : formatted;
}

function statusLabel(status: ReviewStatus) {
  return status === "needs_review" ? "needs review" : status;
}

function sourceKey(source: SourceRow) {
  return source.id.toLowerCase();
}

export default function AdminDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [review, setReview] = useState("all");
  const [minimumCoverage, setMinimumCoverage] = useState(0);
  const [sort, setSort] = useState<SortKey>("quality");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generation, setGeneration] = useState<GenerationResult | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Dashboard could not load.");
    setData(json);
  }, []);

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Dashboard could not load."));
  }, [load]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = data?.categories.filter((category) =>
      (source === "all" || category.source_organization === source)
      && (review === "all" || category.review_status === review)
      && category.country_coverage >= minimumCoverage
      && (!normalizedQuery || `${category.title} ${category.source_indicator_code} ${category.family}`.toLowerCase().includes(normalizedQuery))) ?? [];

    return [...rows].sort((left, right) => {
      if (sort === "title") return left.title.localeCompare(right.title);
      if (sort === "coverage") return right.country_coverage - left.country_coverage || right.quality_score - left.quality_score;
      if (sort === "year") return (right.latest_available_year ?? 0) - (left.latest_available_year ?? 0) || right.country_coverage - left.country_coverage;
      return right.quality_score - left.quality_score || right.country_coverage - left.country_coverage;
    });
  }, [data, query, source, review, minimumCoverage, sort]);

  const selectedRows = useMemo(() => data?.categories.filter((category) => selected.has(category.id)) ?? [], [data, selected]);
  const allVisibleSelected = filtered.length > 0 && filtered.every((category) => selected.has(category.id));
  const boardsLocked = (data?.todayScoreCount ?? 0) > 0;

  function toggleSelected(categoryId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filtered.forEach((category) => next.delete(category.id));
      else filtered.forEach((category) => next.add(category.id));
      return next;
    });
  }

  async function postWorldBank(body: unknown) {
    const response = await fetch("/api/admin/import/world-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Import failed.");
    return json;
  }

  async function importWorldBank() {
    if (running) return;
    setRunning(true);
    setError("");
    setNotice("");
    try {
      const start = await postWorldBank({ action: "start" });
      setProgress({ done: 0, total: start.categories.length, label: "Preparing World Bank categories" });
      const failures: { id: string; error: string }[] = [];
      for (let index = 0; index < start.categories.length; index += 1) {
        const category = start.categories[index];
        setProgress({ done: index, total: start.categories.length, label: category.shortName });
        try {
          await postWorldBank({ action: "category", runId: start.runId, categoryId: category.id });
        } catch (cause) {
          failures.push({ id: category.id, error: cause instanceof Error ? cause.message : "Unknown error" });
        }
      }
      await postWorldBank({ action: "finish", runId: start.runId, failures });
      setProgress({
        done: start.categories.length,
        total: start.categories.length,
        label: failures.length ? `Completed with ${failures.length} warnings` : "Import completed",
      });
      setNotice("World Bank import finished.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "World Bank import failed.");
    } finally {
      setRunning(false);
    }
  }

  async function generateBoards() {
    if (generating) return;
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/daily/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await response.json();
      if (!response.ok) throw Object.assign(new Error(json.error || "Daily generation failed."), { diagnostics: json.diagnostics });
      setGeneration(json);
      setNotice("Daily boards generated.");
      await load();
    } catch (cause) {
      const errorWithDiagnostics = cause as Error & { diagnostics?: GenerationDiagnostics };
      const diagnostics = errorWithDiagnostics.diagnostics;
      setError(diagnostics
        ? `${errorWithDiagnostics.message} Eligible datasets: ${diagnostics.eligibleDatasets ?? "—"}; attempts: ${diagnostics.attempts ?? "—"}; stage: ${diagnostics.failureStage ?? "unknown"}.`
        : errorWithDiagnostics.message);
    } finally {
      setGenerating(false);
    }
  }

  async function inspectCategory(categoryId: string) {
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(categoryId)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Category details could not load.");
      setDetail(json);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Category details could not load.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function decide(categoryIds: string[], decision: Decision) {
    if (!categoryIds.length || reviewing) return;
    setReviewing(true);
    setError("");
    setNotice("");
    try {
      const reviewedIds: string[] = [];
      const failures: { id: string; error: string }[] = [];
      const missing: string[] = [];
      for (let offset = 0; offset < categoryIds.length; offset += 400) {
        const batch = categoryIds.slice(offset, offset + 400);
        const response = await fetch("/api/admin/categories/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryIds: batch, decision }),
        });
        const json = await response.json();
        if (!response.ok && response.status !== 207) throw new Error(json.error || "Review decision failed.");
        reviewedIds.push(...(json.reviewed ?? []));
        failures.push(...(json.failures ?? []));
        missing.push(...(json.missing ?? []));
      }
      if (failures.length || missing.length) {
        setError(`${failures.length + missing.length} review actions could not be completed. ${reviewedIds.length} were saved.`);
      } else {
        setNotice(`${reviewedIds.length} categor${reviewedIds.length === 1 ? "y" : "ies"} ${decision === "reset" ? "reset" : decision}.`);
      }
      setSelected(new Set());
      setDetail(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review decision failed.");
    } finally {
      setReviewing(false);
    }
  }

  if (!data) return <section className="adminLoading">{error || "Loading warehouse…"}</section>;

  const sources = Array.from(new Set(data.categories.map((category) => category.source_organization))).sort();
  const approveableSelected = selectedRows.filter((category) => category.auto_qualified && category.review_status !== "approved");
  const resettableSelected = selectedRows.filter((category) => category.review_status === "rejected" || category.review_status === "approved");

  return (
    <>
      <style>{`
        .adminShell {
          color: #f4f7ef !important;
        }
        .adminShell .adminHeaderActions > a,
        .adminShell .adminHeaderActions button {
          color: #17231d !important;
        }
        .adminShell input[type="checkbox"] {
          accent-color: #b9f45a;
        }
      `}</style>
      {error && <div className="adminError" style={{ ...card, borderColor: "rgba(255,100,100,.6)", marginBottom: 14 }}>{error}</div>}
      {notice && <div style={{ ...card, borderColor: "rgba(185,244,90,.55)", marginBottom: 14 }}>{notice}</div>}

      <section className="adminStatGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        {[
          ["Categories", data.stats.categories],
          ["Observations", data.stats.observations],
          ["Countries", data.stats.countries],
          ["Approved", data.reviewCounts.approved],
          ["Need review", data.reviewCounts.needs_review],
          ["Quarantined", data.reviewCounts.candidate],
        ].map(([label, value]) => (
          <article key={String(label)} style={card}>
            <div style={{ opacity: .7, fontSize: 13 }}>{label}</div>
            <strong style={{ display: "block", fontSize: 27, marginTop: 5 }}>{formatNumber(Number(value))}</strong>
          </article>
        ))}
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Daily boards</h2>
            <p style={{ opacity: .72, marginBottom: 0 }}>
              Easy {data.boards.easy ? "ready" : "missing"} · Normal {data.boards.normal ? "ready" : "missing"} · Expert {data.boards.expert ? "ready" : "missing"}
            </p>
          </div>
          <button style={button} disabled={generating || boardsLocked} onClick={generateBoards}>
            {generating ? "Generating…" : boardsLocked ? "Locked after first score" : "Generate Daily trio"}
          </button>
        </div>
        {generation && (
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
            {(["easy", "normal", "expert"] as const).map((mode) => (
              <div key={mode} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,.04)" }}>
                <strong style={{ textTransform: "capitalize" }}>{mode}</strong>
                <div>Score {generation.scores[mode]?.overall ?? "—"}</div>
                <div style={{ opacity: .7, fontSize: 13 }}>{generation.boards[mode]?.countries.length ?? 0} countries · {generation.boards[mode]?.categories.length ?? 0} categories</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Data sources</h2>
            <div style={{ opacity: .72 }}>Heavy imports run in GitHub Actions and enter quarantine.</div>
          </div>
          <a href={WORKFLOWS.all} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none" }}>Run all source imports ↗</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
          {data.sources.map((item) => {
            const key = sourceKey(item);
            return (
              <article key={item.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <strong>{item.name}</strong>
                  <span style={{ opacity: .72, textTransform: "uppercase", fontSize: 11 }}>{item.status ?? "planned"}</span>
                </div>
                <p style={{ opacity: .75, minHeight: 44 }}>{item.description}</p>
                {key === "world-bank" || key === "worldbank" ? (
                  <button style={button} disabled={running} onClick={importWorldBank}>{running ? "Importing…" : "Run World Bank import"}</button>
                ) : key === "faostat" ? (
                  <a href={WORKFLOWS.faostat} target="_blank" rel="noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Run FAOSTAT in GitHub ↗</a>
                ) : key === "who" ? (
                  <a href={WORKFLOWS.who} target="_blank" rel="noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Run WHO in GitHub ↗</a>
                ) : key === "unesco" ? (
                  <a href={WORKFLOWS.unesco} target="_blank" rel="noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Run UNESCO in GitHub ↗</a>
                ) : key === "ilostat" ? (
                  <a href={WORKFLOWS.ilostat} target="_blank" rel="noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Run ILOSTAT in GitHub ↗</a>
                ) : key === "climate" ? (
                  <a href={WORKFLOWS.climate} target="_blank" rel="noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Run Natural Earth in GitHub ↗</a>
                ) : (
                  <button style={mutedButton} disabled>Not available yet</button>
                )}
              </article>
            );
          })}
        </div>
        {progress.total > 0 && (
          <div style={{ ...card, marginTop: 12 }}>
            <div>{progress.label}</div>
            <progress value={progress.done} max={progress.total} style={{ width: "100%", marginTop: 8 }} />
          </div>
        )}
      </section>

      <section style={{ ...card, marginTop: 16, overflowX: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Import history</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead><tr>{["Source", "Status", "Started", "Categories", "Observations", "Error"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(255,255,255,.12)" }}>{heading}</th>)}</tr></thead>
          <tbody>
            {data.imports.map((run) => (
              <tr key={run.id}>
                <td style={{ padding: 8 }}>{run.source_organization}</td>
                <td style={{ padding: 8 }}>{run.status}</td>
                <td style={{ padding: 8 }}>{new Date(run.started_at).toLocaleString()}</td>
                <td style={{ padding: 8 }}>{formatNumber(run.categories_processed)}</td>
                <td style={{ padding: 8 }}>{formatNumber(run.observations_inserted)}</td>
                <td style={{ padding: 8, maxWidth: 260 }}>{run.error_message || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Category library</h2>
            <p style={{ opacity: .72, marginBottom: 0 }}>Only strict-pass categories with administrator approval can enter Daily.</p>
          </div>
          <strong>{formatNumber(filtered.length)} shown</strong>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) repeat(4,minmax(135px,1fr))", gap: 10, marginTop: 16 }}>
          <input style={input} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search categories…" />
          <select style={input} value={source} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSource(event.target.value)}>
            <option value="all">All sources</option>
            {sources.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select style={input} value={review} onChange={(event: ChangeEvent<HTMLSelectElement>) => setReview(event.target.value)}>
            <option value="all">All review states</option>
            <option value="approved">Approved</option>
            <option value="needs_review">Needs review</option>
            <option value="candidate">Quarantined</option>
            <option value="rejected">Rejected</option>
          </select>
          <select style={input} value={minimumCoverage} onChange={(event: ChangeEvent<HTMLSelectElement>) => setMinimumCoverage(Number(event.target.value))}>
            <option value={0}>Any coverage</option>
            <option value={50}>50+ countries</option>
            <option value={80}>80+ countries</option>
            <option value={100}>100+ countries</option>
            <option value={130}>130+ countries</option>
            <option value={150}>150+ countries</option>
            <option value={170}>170+ countries</option>
          </select>
          <select style={input} value={sort} onChange={(event: ChangeEvent<HTMLSelectElement>) => setSort(event.target.value as SortKey)}>
            <option value="quality">Sort: quality</option>
            <option value="coverage">Sort: coverage</option>
            <option value="year">Sort: newest year</option>
            <option value="title">Sort: title</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12, minHeight: 42 }}>
          <strong>{selected.size} selected</strong>
          <button style={mutedButton} disabled={!selected.size || reviewing} onClick={() => setSelected(new Set())}>Clear</button>
          <button style={button} disabled={!approveableSelected.length || reviewing} onClick={() => decide(approveableSelected.map((row) => row.id), "approved")}>Approve strict-pass ({approveableSelected.length})</button>
          <button style={dangerButton} disabled={!selected.size || reviewing} onClick={() => decide([...selected], "rejected")}>Reject ({selected.size})</button>
          <button style={mutedButton} disabled={!resettableSelected.length || reviewing} onClick={() => decide(resettableSelected.map((row) => row.id), "reset")}>Reset ({resettableSelected.length})</button>
          {reviewing && <span>Saving review decisions…</span>}
        </div>

        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1280 }}>
            <thead>
              <tr>
                <th style={{ padding: 8 }}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all visible categories" /></th>
                {[
                  "Review", "Category", "Source", "Quality", "Evidence", "Common year", "Official", "Modeled", "Cluster", "Stability", "Recognizable", "Specific", "Actions",
                ].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(255,255,255,.12)" }}>{heading}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((category) => (
                <tr key={category.id} style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
                  <td style={{ padding: 8 }}><input type="checkbox" checked={selected.has(category.id)} onChange={() => toggleSelected(category.id)} aria-label={`Select ${category.title}`} /></td>
                  <td style={{ padding: 8 }}><strong>{statusLabel(category.review_status)}</strong></td>
                  <td style={{ padding: 8, maxWidth: 320 }}>
                    <strong>{category.title}</strong>
                    <div style={{ opacity: .65, fontSize: 12 }}>{category.family} · {category.source_indicator_code}</div>
                  </td>
                  <td style={{ padding: 8 }}>{category.source_organization}</td>
                  <td style={{ padding: 8 }}><strong>{category.quality_score}</strong>{category.auto_qualified && <div style={{ fontSize: 11, opacity: .72 }}>strict pass</div>}</td>
                  <td style={{ padding: 8 }}>{category.evidence_tier ?? "—"}</td>
                  <td style={{ padding: 8 }}>{category.common_year ?? category.latest_available_year ?? "—"}<div style={{ fontSize: 11, opacity: .72 }}>{category.common_year_coverage || category.country_coverage} countries</div></td>
                  <td style={{ padding: 8 }}>{percentage(category.official_observation_share)}</td>
                  <td style={{ padding: 8 }}>{percentage(category.modeled_observation_share)}</td>
                  <td style={{ padding: 8 }}>{category.clustering_score ?? "—"}</td>
                  <td style={{ padding: 8 }}>{category.stability_score ?? "—"}</td>
                  <td style={{ padding: 8 }}>{category.recognizability_score ?? "—"}</td>
                  <td style={{ padding: 8 }}>{category.specificity_score ?? "—"}</td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button style={mutedButton} disabled={detailLoading} onClick={() => inspectCategory(category.id)}>Inspect</button>
                      {category.review_status !== "rejected" && <button style={dangerButton} disabled={reviewing} onClick={() => decide([category.id], "rejected")}>Reject</button>}
                      {category.auto_qualified && category.review_status !== "approved" && <button style={button} disabled={reviewing} onClick={() => decide([category.id], "approved")}>Approve</button>}
                      {(category.review_status === "approved" || category.review_status === "rejected") && <button style={mutedButton} disabled={reviewing} onClick={() => decide([category.id], "reset")}>Reset</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detail && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", display: "grid", placeItems: "center", padding: 20, zIndex: 1000 }} onMouseDown={() => setDetail(null)}>
          <section style={{ ...card, width: "min(1050px,96vw)", maxHeight: "90vh", overflow: "auto", background: "#071a15" }} onMouseDown={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
              <div>
                <h2 style={{ marginTop: 0 }}>{detail.category.title}</h2>
                <div style={{ opacity: .72 }}>{detail.category.source_organization} · {detail.category.source_indicator_code}</div>
              </div>
              <button style={mutedButton} onClick={() => setDetail(null)}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10, margin: "16px 0" }}>
              <div style={card}>Quality <strong>{detail.category.quality_score}</strong></div>
              <div style={card}>Coverage <strong>{detail.category.common_year_coverage || detail.category.country_coverage}</strong></div>
              <div style={card}>Year <strong>{detail.year ?? detail.category.common_year ?? "—"}</strong></div>
              <div style={card}>Modeled <strong>{percentage(detail.category.modeled_observation_share)}</strong></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))", gap: 16 }}>
              {[{ title: "Top ranking", rows: detail.top }, { title: "Bottom ranking", rows: detail.bottom }].map((group) => (
                <div key={group.title}>
                  <h3>{group.title}</h3>
                  <ol style={{ paddingLeft: 28 }}>
                    {group.rows.map((row) => <li key={`${group.title}-${row.country_iso3}`} style={{ padding: "5px 0" }}>{row.country_name} — {formatValue(row.value, detail.category.unit)} <span style={{ opacity: .6 }}>({row.data_year})</span></li>)}
                  </ol>
                </div>
              ))}
            </div>
            {!!detail.reviews.length && (
              <div>
                <h3>Review history</h3>
                {detail.reviews.map((item, index) => <div key={`${item.created_at}-${index}`} style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.08)" }}><strong>{item.decision}</strong> · {new Date(item.created_at).toLocaleString()}{item.notes ? ` — ${item.notes}` : ""}</div>)}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
