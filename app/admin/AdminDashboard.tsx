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
  provenance_status?: "approved" | "uncertain" | "blocked";
  provenance_class?: string | null;
  provenance_reason?: string | null;
  methodology_url?: string | null;
  independent_validation?: boolean;
  government_assertion_risk?: string;
  concept_group?: string | null;
  semantic_family?: string | null;
  semantic_topic?: string | null;
  duplicate_status?: "pending" | "preferred" | "superseded" | "not_eligible";
  superseded_by?: string | null;
  auto_decision_reason?: string | null;
  curation_status?: "pending" | "approved" | "excluded";
  curation_reason?: string | null;
  curation_version?: string | null;
  credibility_score?: number | null;
  credibility_status?: "approved" | "caution" | "quarantined" | null;
  credibility_reason?: string | null;
  evidence_label?: string | null;
  comparability_risk?: "low" | "medium" | "high" | null;
  corroboration_status?: string | null;
  plain_language_description?: string | null;
  technical_definition?: string | null;
  unit_explanation?: string | null;
  source_page_url?: string | null;
  exact_query_url?: string | null;
  download_url?: string | null;
  api_url?: string | null;
  dataset_release?: string | null;
  retrieved_at?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  derivation_method?: string | null;
  derivation_version?: string | null;
  verifiability_score?: number | null;
  verifiability_status?: string | null;
  understandability_score?: number | null;
  fun_score?: number | null;
  objective_status?: string | null;
  player_quality_status?: string | null;
  player_quality_reason?: string | null;
  validation_status?: "pending" | "verified" | "failed" | "unable_to_verify";
  validation_version?: string | null;
  validated_at?: string | null;
  validation_reason?: string | null;
  validation_expected_count?: number | null;
  validated_observation_count?: number | null;
  validation_mismatch_count?: number | null;
  validation_ranking_mismatch_count?: number | null;
  player_source_url?: string | null;
  player_source_status?: "pending" | "exact" | "general" | "needs_exact_url" | "invalid" | "unavailable" | null;
  player_source_reason?: string | null;
  player_source_checked_at?: string | null;
  content_review_status?: "pending" | "approved" | "excluded" | null;
  content_review_reason?: string | null;
  content_review_version?: string | null;
  immediate_comprehension_score?: number | null;
  gameplay_interest_score?: number | null;
  uniqueness_score?: number | null;
  link_quality_score?: number | null;
  computed_playable?: boolean;
  playability_blockers?: string[];
  playability_warnings?: string[];
  effective_player_source_url?: string | null;
  effective_player_source_status?: "exact" | "general" | null;
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

type AnalyticsOverview = {
  visitors: number;
  page_views: number;
  games_started: number;
  games_completed: number;
  shares: number;
  average_score: number | null;
  signed_in_users_seen: number;
};
type SourceHealthRow = { source: string; categories: number; playable: number; pending: number; latestRetrieved: string | null };
type GenerationRun = { id: number; created_at: string; challenge_date: string; status: string; source: string; error_message: string | null };
type IntegritySourceRow = { source: string; categories: number; playable: number; verified: number; failed: number; unable_to_verify: number; pending: number; last_validated_at: string | null };
type IntegrityIssue = { id: string; title: string; source_organization: string; validation_status: string; validation_reason: string | null; validated_at: string | null; validation_mismatch_count: number; validation_ranking_mismatch_count: number };
type IntegrityRun = { id: number; source_organization: string | null; status: string; started_at: string; completed_at: string | null; categories_selected: number; categories_verified: number; categories_failed: number; categories_unable: number; error_message: string | null };
type IntegrityOverview = { enforcement_enabled: boolean; categories: number; playable: number; verified: number; failed: number; unable_to_verify: number; pending: number; unverified_playable: number };
type SemanticConflict = { first_category_id: string; first_title: string; second_category_id: string; second_title: string; semantic_family: string; first_domain: string; second_domain: string };
type SimilarityConflict = { first_category_id: string; first_title: string; second_category_id: string; second_title: string; score: number };
type ContentLinkOverview = { categories: number; content_approved: number; content_excluded: number; content_pending: number; exact_player_links: number; general_player_links: number; links_pending: number; links_blocked: number; playable: number };
type ContentLinkIssue = { id: string; title: string; source_organization: string; source_indicator_code: string; content_review_status: string; content_review_reason: string | null; immediate_comprehension_score: number | null; gameplay_interest_score: number | null; player_source_status: string; player_source_url: string | null; player_source_reason: string | null; link_quality_score: number | null; computed_playable?: boolean; playability_blockers?: string[]; playability_warnings?: string[]; enabled: boolean; eligible_daily: boolean };

type Dashboard = {
  stats: { categories: number; observations: number; countries: number; usernames: number };
  reviewCounts: Record<ReviewStatus, number> & { pending_editorial: number };
  sources: SourceRow[];
  imports: ImportRow[];
  categories: CategoryRow[];
  boards: Record<string, boolean>;
  todayScoreCount: number;
  analytics: AnalyticsOverview;
  sourceHealth: SourceHealthRow[];
  generationRuns: GenerationRun[];
  integrity: { overview: IntegrityOverview; bySource: IntegritySourceRow[]; issues: IntegrityIssue[]; runs: IntegrityRun[]; migrationApplied: boolean };
  contentLinks: { overview: ContentLinkOverview; issues: ContentLinkIssue[]; migrationApplied: boolean };
  boardQuality: { migrationApplied: boolean; semanticConflicts: SemanticConflict[]; similarityConflicts: SimilarityConflict[]; semanticSimilarityThreshold: number; winnerGlobalRankLimit: number };
};

type DailyMode = "easy" | "normal" | "expert";
type GeneratedBoard = { countries: string[]; categories: string[] };
type ScoreBreakdown = { overall: number; quality: number; variety: number; geography: number; difficultyFit: number; competitiveness: number; familiarity: number };
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
  worldbank: `${REPO_ACTIONS}/import-world-bank-catalog.yml`,
  faostat: `${REPO_ACTIONS}/import-faostat.yml`,
  who: `${REPO_ACTIONS}/import-who.yml`,
  unesco: `${REPO_ACTIONS}/import-unesco.yml`,
  ilostat: `${REPO_ACTIONS}/import-ilostat.yml`,
  climate: `${REPO_ACTIONS}/import-natural-earth.yml`,
  comtrade: `${REPO_ACTIONS}/import-comtrade.yml`,
  eia: `${REPO_ACTIONS}/import-eia.yml`,
  unhcr: `${REPO_ACTIONS}/import-unhcr.yml`,
  all: `${REPO_ACTIONS}/repair-v14-expansion.yml`,
  integrity: `${REPO_ACTIONS}/audit-source-integrity.yml`,
  links: `${REPO_ACTIONS}/audit-player-source-links.yml`,
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
  const approveableSelected = selectedRows.filter((category) => category.auto_qualified
    && category.provenance_status === "approved"
    && category.independent_validation
    && category.curation_status !== "excluded"
    && category.credibility_status !== "quarantined"
    && (category.credibility_score ?? 0) >= 75
    && category.objective_status === "objective"
    && category.player_quality_status !== "blocked"
    && (category.verifiability_score ?? 100) >= 80
    && (category.understandability_score ?? 100) >= 70
    && (category.fun_score ?? 100) >= 55
    && category.content_review_status === "approved"
    && (category.immediate_comprehension_score ?? 0) >= 80
    && (category.gameplay_interest_score ?? 0) >= 65
    && ["exact", "general"].includes(category.player_source_status ?? "")
    && Boolean(category.player_source_url)
    
    && category.validation_status === "verified"
    && category.review_status !== "approved");
  const resettableSelected = selectedRows.filter((category) => category.review_status === "rejected" || category.review_status === "approved");
  const dailyModeLabels: Record<DailyMode, string> = { easy: "Scout", normal: "Adventurer", expert: "Expert" };

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

      <section style={{ ...card, marginBottom: 16, borderColor: "rgba(185,244,90,.45)", background: "linear-gradient(135deg,rgba(38,78,50,.72),rgba(8,30,24,.8))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div><span className="kicker">v15 catalog workflow</span><h2 style={{ margin: "5px 0" }}>Review categories in the new Workbench</h2><p style={{ margin: 0, opacity: .72 }}>One authoritative decision, permanent political/self-report and clarity flags, source values, overlaps, and keyboard review.</p></div>
          <a href="/admin/review" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Open Category Review</a>
        </div>
      </section>

      <section className="adminStatGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        {[
          ["Categories", data.stats.categories],
          ["Observations", data.stats.observations],
          ["Countries", data.stats.countries],
          ["Usernames", data.stats.usernames],
          ["Approved", data.reviewCounts.approved],
          ["Pending editorial", data.reviewCounts.pending_editorial],
          ["Needs review", data.reviewCounts.needs_review],
          ["Candidates", data.reviewCounts.candidate],
        ].map(([label, value]) => (
          <article key={String(label)} style={card}>
            <div style={{ opacity: .7, fontSize: 13 }}>{label}</div>
            <strong style={{ display: "block", fontSize: 27, marginTop: 5 }}>{formatNumber(Number(value))}</strong>
          </article>
        ))}
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Last 30 days</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {[
            ["Visitors", data.analytics.visitors],
            ["Page views", data.analytics.page_views],
            ["Games started", data.analytics.games_started],
            ["Games completed", data.analytics.games_completed],
            ["Completion rate", data.analytics.games_started ? `${Math.round((data.analytics.games_completed / data.analytics.games_started) * 100)}%` : "—"],
            ["Shares", data.analytics.shares],
            ["Average score", data.analytics.average_score ?? "—"],
          ].map(([label, value]) => <div key={String(label)} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,.04)" }}>
            <div style={{ opacity: .7, fontSize: 12 }}>{label}</div><strong style={{ fontSize: 22 }}>{typeof value === "number" ? formatNumber(value) : value}</strong>
          </div>)}
        </div>
        <p style={{ opacity: .64, marginBottom: 0, fontSize: 12 }}>First-party, privacy-conscious analytics begin after the combined v14.4 Supabase installer is applied.</p>
      </section>

      <section style={{ ...card, marginTop: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 5 }}>Content and player-source links</h2>
            <p style={{ opacity: .72, margin: 0 }}>Immediately understandable, verified categories may use either an exact official data view or a safe general official data portal. Link precision is shown separately from data trust.</p>
          </div>
          <a href={WORKFLOWS.links} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none" }}>Audit player links ↗</a>
        </div>
        {!data.contentLinks?.migrationApplied ? <p style={{ marginBottom: 0 }}>Apply the v14.4 Supabase installer to enable computed playability and player-link reporting.</p> : <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9, margin: "14px 0" }}>
            {[
              ["Content approved", data.contentLinks.overview.content_approved],
              ["Content excluded", data.contentLinks.overview.content_excluded],
              ["Content pending", data.contentLinks.overview.content_pending],
              ["Exact player links", data.contentLinks.overview.exact_player_links],
              ["General official links", data.contentLinks.overview.general_player_links],
              ["Links pending", data.contentLinks.overview.links_pending],
              ["Links blocked", data.contentLinks.overview.links_blocked],
            ].map(([label, value]) => <div key={String(label)} style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,.04)" }}><div style={{ opacity: .68, fontSize: 12 }}>{label}</div><strong style={{ fontSize: 21 }}>{formatNumber(Number(value))}</strong></div>)}
          </div>
          {data.contentLinks.issues.length > 0 && <div>
            <strong>Categories requiring attention or using warnings</strong>
            {data.contentLinks.issues.slice(0, 16).map((issue) => <div key={issue.id} style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <strong>{issue.title}</strong> · {issue.source_organization} · content {issue.content_review_status} · link {issue.player_source_status}
              <div style={{ opacity: .7, fontSize: 12 }}>{issue.playability_blockers?.[0] ?? issue.playability_warnings?.[0] ?? issue.content_review_reason ?? issue.player_source_reason ?? "No reason recorded"}</div>
            </div>)}
          </div>}
        </>}
      </section>

      <section style={{ ...card, marginTop: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 5 }}>Data integrity</h2>
            <p style={{ opacity: .72, margin: 0 }}>Official-source values, units, years, coverage, and recalculated global rankings.</p>
          </div>
          <a href={WORKFLOWS.integrity} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none" }}>Run full source audit ↗</a>
        </div>
        {!data.integrity.migrationApplied ? <p style={{ marginBottom: 0 }}>Apply the v14.4 Supabase installer to enable integrity and board-quality reporting.</p> : <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9, margin: "14px 0" }}>
            {[
              ["Enforcement", data.integrity.overview.enforcement_enabled ? "ON" : "OFF"],
              ["Verified", data.integrity.overview.verified],
              ["Pending", data.integrity.overview.pending],
              ["Failed", data.integrity.overview.failed],
              ["Unable", data.integrity.overview.unable_to_verify],
              ["Unverified playable", data.integrity.overview.unverified_playable],
            ].map(([label, value]) => <div key={String(label)} style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,.04)" }}><div style={{ opacity: .68, fontSize: 12 }}>{label}</div><strong style={{ fontSize: 21 }}>{typeof value === "number" ? formatNumber(value) : value}</strong></div>)}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead><tr>{["Source", "Categories", "Playable", "Verified", "Pending", "Failed", "Unable", "Last audit"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(255,255,255,.12)" }}>{heading}</th>)}</tr></thead>
            <tbody>{data.integrity.bySource.map((row) => <tr key={row.source}>
              <td style={{ padding: 8 }}><strong>{row.source}</strong></td><td style={{ padding: 8 }}>{row.categories}</td><td style={{ padding: 8 }}>{row.playable}</td><td style={{ padding: 8 }}>{row.verified}</td><td style={{ padding: 8 }}>{row.pending}</td><td style={{ padding: 8 }}>{row.failed}</td><td style={{ padding: 8 }}>{row.unable_to_verify}</td><td style={{ padding: 8 }}>{row.last_validated_at ? new Date(row.last_validated_at).toLocaleString() : "—"}</td>
            </tr>)}</tbody>
          </table>
          {data.integrity.issues.length > 0 && <div style={{ marginTop: 14 }}>
            <strong>Quarantined categories</strong>
            {data.integrity.issues.slice(0, 12).map((issue) => <div key={issue.id} style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.08)" }}><strong>{issue.title}</strong> · {issue.source_organization} · {issue.validation_status}<div style={{ opacity: .7, fontSize: 12 }}>{issue.validation_reason ?? "No reason recorded"}</div></div>)}
          </div>}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.12)" }}>
            <strong>Board-quality gates</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 9, marginTop: 10 }}>
              <div style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,.04)" }}><div style={{ opacity: .68, fontSize: 12 }}>Winner requirement</div><strong style={{ fontSize: 20 }}>Global top {data.boardQuality.winnerGlobalRankLimit}</strong></div>
              <div style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,.04)" }}><div style={{ opacity: .68, fontSize: 12 }}>Playable same-family pairs</div><strong style={{ fontSize: 20 }}>{data.boardQuality.migrationApplied ? data.boardQuality.semanticConflicts.length : "—"}</strong></div>
              <div style={{ padding: 11, borderRadius: 10, background: "rgba(255,255,255,.04)" }}><div style={{ opacity: .68, fontSize: 12 }}>Cross-family similarity warnings</div><strong style={{ fontSize: 20 }}>{data.boardQuality.similarityConflicts.length}</strong></div>
            </div>
            {data.boardQuality.semanticConflicts.length > 0 && <div style={{ marginTop: 10 }}>
              <div style={{ opacity: .72, fontSize: 12, marginBottom: 5 }}>These categories may remain playable individually, but the generator will never place a pair from the same board family together.</div>
              {data.boardQuality.semanticConflicts.slice(0, 12).map((conflict) => <div key={`${conflict.first_category_id}:${conflict.second_category_id}`} style={{ padding: "7px 0", borderTop: "1px solid rgba(255,255,255,.07)" }}><strong>{conflict.first_title}</strong> ↔ <strong>{conflict.second_title}</strong><div style={{ opacity: .68, fontSize: 12 }}>{conflict.semantic_family}</div></div>)}
            </div>}
            {data.boardQuality.similarityConflicts.length > 0 && <div style={{ marginTop: 12 }}>
              <div style={{ opacity: .72, fontSize: 12, marginBottom: 5 }}>Different families whose player-facing wording is at or above the {Math.round(data.boardQuality.semanticSimilarityThreshold * 100)}% similarity warning threshold. The generator also blocks these pairs.</div>
              {data.boardQuality.similarityConflicts.slice(0, 12).map((conflict) => <div key={`similar:${conflict.first_category_id}:${conflict.second_category_id}`} style={{ padding: "7px 0", borderTop: "1px solid rgba(255,255,255,.07)" }}><strong>{conflict.first_title}</strong> ↔ <strong>{conflict.second_title}</strong><div style={{ opacity: .68, fontSize: 12 }}>{Math.round(conflict.score * 100)}% text similarity</div></div>)}
            </div>}
          </div>
        </>}
      </section>

      <section style={{ ...card, marginTop: 16, overflowX: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Warehouse health by source</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
          <thead><tr>{["Source", "Categories", "Playable", "Awaiting review", "Latest retrieval"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(255,255,255,.12)" }}>{heading}</th>)}</tr></thead>
          <tbody>{data.sourceHealth.map((row) => <tr key={row.source}>
            <td style={{ padding: 8 }}><strong>{row.source}</strong></td><td style={{ padding: 8 }}>{formatNumber(row.categories)}</td><td style={{ padding: 8 }}>{formatNumber(row.playable)}</td><td style={{ padding: 8 }}>{formatNumber(row.pending)}</td><td style={{ padding: 8 }}>{row.latestRetrieved ? new Date(row.latestRetrieved).toLocaleDateString() : "—"}</td>
          </tr>)}</tbody>
        </table>
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Daily boards</h2>
            <p style={{ opacity: .72, marginBottom: 0 }}>
              Scout {data.boards.easy ? "ready" : "missing"} · Adventurer {data.boards.normal ? "ready" : "missing"} · Expert {data.boards.expert ? "ready" : "missing"}
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
                <strong>{dailyModeLabels[mode]}</strong>
                <div>Score {generation.scores[mode]?.overall ?? "—"}</div>
                <div style={{ opacity: .7, fontSize: 13 }}>{generation.boards[mode]?.countries.length ?? 0} countries · {generation.boards[mode]?.categories.length ?? 0} categories</div>
              </div>
            ))}
          </div>
        )}
        {data.generationRuns.length > 0 && <div style={{ marginTop: 14 }}>
          <strong>Recent generator runs</strong>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>{data.generationRuns.slice(0, 5).map((run) => <div key={run.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 9, borderRadius: 9, background: "rgba(255,255,255,.035)" }}>
            <span>{run.challenge_date} · {run.source}</span><span>{run.status}{run.error_message ? ` · ${run.error_message}` : ""}</span>
          </div>)}</div>
        </div>}
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Data sources</h2>
            <div style={{ opacity: .72 }}>Heavy imports run in GitHub Actions and enter the editorial review queue.</div>
          </div>
          <a href={WORKFLOWS.all} target="_blank" rel="noreferrer" style={{ ...button, textDecoration: "none" }}>Repair + expand v14 imports ↗</a>
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
                ) : key === "comtrade" ? (
                  <a href={WORKFLOWS.comtrade} target="_blank" rel="noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Run UN Comtrade in GitHub ↗</a>
                ) : key === "eia" ? (
                  <a href={WORKFLOWS.eia} target="_blank" rel="noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Run EIA in GitHub ↗</a>
                ) : key === "unhcr" ? (
                  <a href={WORKFLOWS.unhcr} target="_blank" rel="noreferrer" style={{ ...button, display: "inline-block", textDecoration: "none" }}>Run UNHCR in GitHub ↗</a>
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
                  "Review", "Category", "Source", "Quality", "Trust", "Player quality", "Content", "Player link", "Integrity", "Verify", "Clear", "Fun", "Curation", "Provenance", "Duplicate", "Evidence", "Common year", "Official", "Modeled", "Cluster", "Stability", "Recognizable", "Specific", "Actions",
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
                  <td style={{ padding: 8 }}><strong>{category.quality_score}</strong>{category.auto_qualified && <div style={{ fontSize: 11, opacity: .72 }}>quality + provenance pass</div>}</td>
                  <td style={{ padding: 8, maxWidth: 250 }}><strong>{category.credibility_score ?? "—"} · {category.credibility_status ?? "unscored"}</strong>{category.credibility_reason && <div style={{ fontSize: 11, opacity: .72 }}>{category.credibility_reason}</div>}</td>
                  <td style={{ padding: 8, maxWidth: 250 }}><strong>{category.player_quality_status ?? "unscored"}</strong><div style={{ fontSize: 11, opacity: .72 }}>{category.objective_status ?? "objective"}</div>{category.player_quality_reason && <div style={{ fontSize: 11, opacity: .72 }}>{category.player_quality_reason}</div>}</td>
                  <td style={{ padding: 8, maxWidth: 250 }}><strong>{category.content_review_status ?? "pending"}</strong><div style={{ fontSize: 11, opacity: .72 }}>understand {category.immediate_comprehension_score ?? "—"} · interest {category.gameplay_interest_score ?? "—"} · unique {category.uniqueness_score ?? "—"}</div>{category.content_review_reason && <div style={{ fontSize: 11, opacity: .72 }}>{category.content_review_reason}</div>}</td>
                  <td style={{ padding: 8, maxWidth: 260 }}><strong>{category.player_source_status ?? "pending"}</strong><div style={{ fontSize: 11, opacity: .72 }}>link quality {category.link_quality_score ?? "—"}</div>{category.player_source_url && <div style={{ fontSize: 11 }}><a href={category.player_source_url} target="_blank" rel="noreferrer">Open source page ↗</a></div>}{category.player_source_reason && <div style={{ fontSize: 11, opacity: .72 }}>{category.player_source_reason}</div>}</td>
                  <td style={{ padding: 8, maxWidth: 220 }}><strong>{category.validation_status ?? "pending"}</strong>{category.validation_reason && <div style={{ fontSize: 11, opacity: .72 }}>{category.validation_reason}</div>}</td>
                  <td style={{ padding: 8 }}><strong>{category.verifiability_score ?? "—"}</strong><div style={{ fontSize: 11, opacity: .72 }}>{category.verifiability_status ?? ""}</div></td>
                  <td style={{ padding: 8 }}>{category.understandability_score ?? "—"}</td>
                  <td style={{ padding: 8 }}>{category.fun_score ?? "—"}</td>
                  <td style={{ padding: 8, maxWidth: 240 }}><strong>{category.curation_status ?? "pending"}</strong>{category.curation_reason && <div style={{ fontSize: 11, opacity: .72 }}>{category.curation_reason}</div>}</td>
                  <td style={{ padding: 8 }}><strong>{category.provenance_status ?? "—"}</strong><div style={{ fontSize: 11, opacity: .72 }}>{category.government_assertion_risk ? `${category.government_assertion_risk} assertion risk` : ""}</div></td>
                  <td style={{ padding: 8 }}><strong>{category.duplicate_status ?? "—"}</strong>{category.superseded_by && <div style={{ fontSize: 11, opacity: .72 }}>by {category.superseded_by}</div>}</td>
                  <td style={{ padding: 8 }}>{category.evidence_label ?? category.evidence_tier ?? "—"}<div style={{ fontSize: 11, opacity: .72 }}>{category.comparability_risk ? `${category.comparability_risk} comparability risk` : ""}</div></td>
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
                      {category.auto_qualified && category.validation_status === "verified" && category.curation_status !== "excluded" && category.player_quality_status !== "blocked" && category.objective_status === "objective" && (category.verifiability_score ?? 100) >= 80 && (category.understandability_score ?? 100) >= 70 && (category.fun_score ?? 100) >= 55 && category.content_review_status === "approved" && (category.immediate_comprehension_score ?? 0) >= 80 && (category.gameplay_interest_score ?? 0) >= 65 && ["exact", "general"].includes(category.player_source_status ?? "") && Boolean(category.player_source_url)  && category.review_status !== "approved" && <button style={button} disabled={reviewing} onClick={() => decide([category.id], "approved")}>Approve</button>}
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
              <div style={card}>Source integrity <strong>{detail.category.validation_status ?? "pending"}</strong><div style={{ opacity: .72, marginTop: 6 }}>{detail.category.validated_at ? new Date(detail.category.validated_at).toLocaleString() : "Not audited"}</div></div>
              <div style={card}>Credibility <strong>{detail.category.credibility_score ?? "—"}</strong><div style={{ opacity: .72, marginTop: 6 }}>{detail.category.credibility_status ?? "unscored"} · {detail.category.evidence_label ?? ""}</div></div>
              <div style={card}>Verifiability <strong>{detail.category.verifiability_score ?? "—"}</strong><div style={{ opacity: .72, marginTop: 6 }}>{detail.category.verifiability_status ?? "unscored"}</div></div>
              <div style={card}>Clarity <strong>{detail.category.understandability_score ?? "—"}</strong><div style={{ opacity: .72, marginTop: 6 }}>{detail.category.plain_language_description ?? ""}</div></div>
              <div style={card}>Fun <strong>{detail.category.fun_score ?? "—"}</strong><div style={{ opacity: .72, marginTop: 6 }}>{detail.category.player_quality_status ?? "unscored"} · {detail.category.objective_status ?? "objective"}</div></div>
              <div style={card}>Content review <strong>{detail.category.content_review_status ?? "pending"}</strong><div style={{ opacity: .72, marginTop: 6 }}>Understand {detail.category.immediate_comprehension_score ?? "—"} · Interest {detail.category.gameplay_interest_score ?? "—"} · Unique {detail.category.uniqueness_score ?? "—"}</div></div>
              <div style={card}>Player source <strong>{detail.category.player_source_status ?? "pending"}</strong><div style={{ opacity: .72, marginTop: 6 }}>Link quality {detail.category.link_quality_score ?? "—"}</div>{detail.category.player_source_url && <div style={{ marginTop: 6 }}><a href={detail.category.player_source_url} target="_blank" rel="noreferrer">Open official source ↗</a></div>}</div>
              <div style={card}>Coverage <strong>{detail.category.common_year_coverage || detail.category.country_coverage}</strong></div>
              <div style={card}>Year <strong>{detail.year ?? detail.category.common_year ?? "—"}</strong></div>
              <div style={card}>Modeled <strong>{percentage(detail.category.modeled_observation_share)}</strong></div>
              <div style={card}>Curation <strong>{detail.category.curation_status ?? "pending"}</strong><div style={{ opacity: .72, marginTop: 6 }}>{detail.category.curation_version ?? ""}</div></div>
              <div style={card}>Provenance <strong>{detail.category.provenance_status ?? "—"}</strong><div style={{ opacity: .72, marginTop: 6 }}>{detail.category.provenance_class ?? ""}</div></div>
              <div style={card}>Duplicate status <strong>{detail.category.duplicate_status ?? "—"}</strong><div style={{ opacity: .72, marginTop: 6 }}>{detail.category.concept_group ?? ""}</div><div style={{ opacity: .72, marginTop: 6 }}>Board family: {detail.category.semantic_family ?? "—"}</div><div style={{ opacity: .72, marginTop: 6 }}>Topic: {detail.category.semantic_topic ?? "—"}</div></div>
            </div>
            {(detail.category.content_review_reason || detail.category.player_source_reason || detail.category.curation_reason || detail.category.provenance_reason || detail.category.credibility_reason || detail.category.auto_decision_reason) && (
              <div style={{ ...card, marginBottom: 16 }}>
                {detail.category.content_review_reason && <div><strong>Content:</strong> {detail.category.content_review_reason}</div>}
                {detail.category.player_source_reason && <div><strong>Player source:</strong> {detail.category.player_source_reason}</div>}
                {detail.category.curation_reason && <div><strong>Curation:</strong> {detail.category.curation_reason}</div>}
                {detail.category.provenance_reason && <div><strong>Provenance:</strong> {detail.category.provenance_reason}</div>}
                {detail.category.credibility_reason && <div><strong>Credibility:</strong> {detail.category.credibility_reason}</div>}
                {detail.category.auto_decision_reason && <div style={{ marginTop: 8 }}><strong>Decision:</strong> {detail.category.auto_decision_reason}</div>}
                {detail.category.methodology_url && <div style={{ marginTop: 8 }}><a href={detail.category.methodology_url} target="_blank" rel="noreferrer">Methodology source</a></div>}
              </div>
            )}
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
