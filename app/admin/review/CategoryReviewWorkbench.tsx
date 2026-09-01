"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

type ReviewStatus = "pending" | "approved" | "rejected" | "duplicate" | "needs_rewrite" | "needs_data_repair" | "needs_discussion";
type Readiness = "all" | "ready" | "blocked";
type PromotionFilter = "all" | "playable" | "auto_promote" | "manual_review" | "rewrite_required" | "data_repair_required" | "duplicate" | "excluded";
type SemanticAuditFilter = "all" | "pass" | "rewrite_required" | "data_repair_required" | "review_required" | "excluded";
type SortKey = "priority" | "quality" | "coverage" | "title" | "source";

type CategoryRow = {
  id: string;
  title: string;
  effective_title: string;
  description: string | null;
  plain_language_description: string | null;
  source_organization: string;
  source_dataset: string;
  source_indicator_code: string;
  source_url: string | null;
  source_page_url: string | null;
  methodology_url: string | null;
  player_source_url: string | null;
  player_source_status: string | null;
  unit: string | null;
  value_type: string | null;
  measurement_type?: "total" | "share" | "per_capita" | "historical_date" | "rate" | "value" | null;
  ranking_direction: "high" | "low";
  family: string | null;
  semantic_family: string | null;
  semantic_topic: string | null;
  concept_group: string | null;
  effective_semantic_group: string | null;
  quality_score: number | null;
  country_coverage: number | null;
  common_year_coverage: number | null;
  latest_available_year: number | null;
  common_year: number | null;
  editorial_status: ReviewStatus;
  political_self_reported: boolean;
  confusing: boolean;
  esoteric: boolean;
  subjective_or_composite: boolean;
  stale_data: boolean;
  poor_coverage: boolean;
  duplicate_of: string | null;
  recommended_title: string | null;
  semantic_group: string | null;
  editorial_notes: string | null;
  reviewed_at: string | null;
  hard_gate_ready: boolean;
  editorial_ready: boolean;
  computed_playable_v16_2: boolean;
  promotion_decision_v16_2?: string | null;
  promotion_reason_v16_2?: string | null;
  release_disposition_v16_2_3?: string | null;
  release_disposition_reason_v16_2_3?: string | null;
  primary_blocker_v16_2?: string | null;
  blocker_class_v16_2?: string | null;
  strict_pass_v16_2?: boolean | null;
  source_quality_floor_v16_2?: number | null;
  suggested_duplicate_of_v16_2?: string | null;
  v16_2_blockers: string[];
  v16_warnings?: string[];
  semantic_audit_status?: "pass" | "rewrite_required" | "data_repair_required" | "review_required" | "excluded";
  semantic_source_identity_status?: string | null;
  semantic_title_unit_status?: string | null;
  semantic_result_logic_status?: string | null;
  semantic_audit_issues?: string[];
  semantic_audit_warnings?: string[];
  validation_status: string | null;
  validation_reason: string | null;
  credibility_status: string | null;
  credibility_score: number | null;
  objective_status: string | null;
  player_quality_status: string | null;
  content_review_status: string | null;
  curation_status: string | null;
  metadata?: Record<string, unknown> | null;
  auto_vetting_recommendation?: "approve" | "rewrite" | "duplicate" | "quarantine_data" | "retire" | null;
  auto_vetting_score?: number | null;
  auto_vetting_reason?: string | null;
  auto_possible_duplicate_of?: string | null;
  auto_title_similarity?: number | null;
  auto_rank_correlation?: number | null;
  auto_tie_share?: number | null;
};

type SourceSummary = { name: string; total: number; pending: number; approved: number; ready: number; playable: number; approvedBlocked: number; rejected: number };
type Overview = {
  categories: number;
  pending: number;
  approved: number;
  rejected: number;
  duplicates: number;
  needs_rewrite: number;
  needs_data_repair: number;
  needs_discussion: number;
  hard_gate_ready: number;
  playable: number;
  approved_but_blocked: number;
  political_self_reported: number;
  confusing_or_esoteric: number;
  subjective_or_composite: number;
  semantic_audit_passed?: number;
  semantic_rewrite_required?: number;
  semantic_data_repair_required?: number;
  semantic_review_required?: number;
};
type QueueResponse = {
  migrationApplied: boolean;
  overview: Overview;
  sources: SourceSummary[];
  categories: CategoryRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
  error?: string;
};
type Observation = { country_iso3: string; country_name: string; value: number; data_year: number };
type SimilarCategory = {
  id: string;
  effective_title: string;
  source_organization: string;
  source_indicator_code: string;
  effective_semantic_group: string | null;
  editorial_status: ReviewStatus;
  computed_playable_v16_2: boolean;
  duplicate_of: string | null;
};
type HistoryRow = { id: number; previous_state: Record<string, unknown>; next_state: Record<string, unknown>; created_at: string; reviewer_user_id: string };
type DetailResponse = {
  category: CategoryRow & Record<string, unknown>;
  year: number | null;
  top: Observation[];
  bottom: Observation[];
  similar: SimilarCategory[];
  history: HistoryRow[];
  error?: string;
};

type Draft = {
  status: ReviewStatus;
  political_self_reported: boolean;
  confusing: boolean;
  esoteric: boolean;
  subjective_or_composite: boolean;
  stale_data: boolean;
  poor_coverage: boolean;
  duplicate_of: string;
  recommended_title: string;
  board_description: string;
  semantic_group: string;
  notes: string;
};

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  duplicate: "Duplicate",
  needs_rewrite: "Needs rewrite",
  needs_data_repair: "Needs data repair",
  needs_discussion: "Needs discussion",
};

const EMPTY_OVERVIEW: Overview = {
  categories: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  duplicates: 0,
  needs_rewrite: 0,
  needs_data_repair: 0,
  needs_discussion: 0,
  hard_gate_ready: 0,
  playable: 0,
  approved_but_blocked: 0,
  political_self_reported: 0,
  confusing_or_esoteric: 0,
  subjective_or_composite: 0,
  semantic_audit_passed: 0,
  semantic_rewrite_required: 0,
  semantic_data_repair_required: 0,
  semantic_review_required: 0,
};

function draftFromCategory(category: CategoryRow): Draft {
  return {
    status: category.editorial_status,
    political_self_reported: Boolean(category.political_self_reported),
    confusing: Boolean(category.confusing),
    esoteric: Boolean(category.esoteric),
    subjective_or_composite: Boolean(category.subjective_or_composite),
    stale_data: Boolean(category.stale_data),
    poor_coverage: Boolean(category.poor_coverage),
    duplicate_of: category.duplicate_of ?? "",
    recommended_title: category.recommended_title ?? "",
    board_description: typeof category.metadata?.boardDescription === "string"
      ? category.metadata.boardDescription
      : "",
    semantic_group: category.semantic_group ?? category.effective_semantic_group ?? "",
    notes: category.editorial_notes ?? "",
  };
}

function formatReviewValue(value: number, category: CategoryRow) {
  if (!Number.isFinite(value)) return "—";
  if (category.measurement_type === "historical_date") {
    const format = String(category.metadata?.historicalValueFormat ?? category.metadata?.historical_value_format ?? "year");
    if (format === "date") {
      const whole = Math.round(value);
      const year = Math.trunc(whole / 10000);
      const month = Math.trunc((whole % 10000) / 100);
      const day = whole % 100;
      const date = new Date(Date.UTC(year, Math.max(0, month - 1), Math.max(1, day)));
      if (Number.isFinite(date.getTime()) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
      }
    }
    const year = Math.round(value);
    return year < 0 ? `${Math.abs(year)} BCE` : `${year}`;
  }
  const unit = category.unit;
  const magnitude = Math.abs(value);
  const formatted = magnitude >= 1_000_000_000
    ? `${(value / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`
    : magnitude >= 1_000_000
      ? `${(value / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
      : magnitude >= 10_000
        ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
        : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit === "%" || unit?.toLowerCase().includes("percent") ? `${formatted}%` : `${formatted}${unit ? ` ${unit}` : ""}`;
}

function blockerTone(category: CategoryRow) {
  if (category.computed_playable_v16_2) return "playable";
  if (category.hard_gate_ready) return "reviewReady";
  if (category.editorial_status === "rejected" || category.editorial_status === "duplicate") return "stopped";
  return "blocked";
}

export default function CategoryReviewWorkbench() {
  const [query, setQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState<ReviewStatus | "all">("pending");
  const [readiness, setReadiness] = useState<Readiness>("all");
  const [audit, setAudit] = useState<SemanticAuditFilter>("all");
  const [promotion, setPromotion] = useState<PromotionFilter>("all");
  const [sort, setSort] = useState<SortKey>("priority");
  const [page, setPage] = useState(1);
  const [queue, setQueue] = useState<CategoryRow[]>([]);
  const [overview, setOverview] = useState<Overview>(EMPTY_OVERVIEW);
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 60, total: 0, pages: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCommittedQuery(query.trim());
      setPage(1);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadQueue = useCallback(async (preferredId?: string | null) => {
    setLoadingQueue(true);
    setError(null);
    const params = new URLSearchParams({
      q: committedQuery,
      source,
      status,
      readiness,
      audit,
      promotion,
      sort,
      page: String(page),
      limit: "60",
    });
    const response = await fetch(`/api/admin/category-review?${params.toString()}`, { cache: "no-store" });
    const json = (await response.json().catch(() => ({}))) as QueueResponse;
    if (!response.ok) {
      setError(json.error ?? "Unable to load the review queue.");
      setLoadingQueue(false);
      return;
    }
    setQueue(json.categories ?? []);
    setOverview(json.overview ?? EMPTY_OVERVIEW);
    setSources(json.sources ?? []);
    setPagination(json.pagination ?? { page: 1, limit: 60, total: 0, pages: 1 });
    const nextSelected = preferredId && json.categories.some((row) => row.id === preferredId)
      ? preferredId
      : selectedId && json.categories.some((row) => row.id === selectedId)
        ? selectedId
        : json.categories[0]?.id ?? null;
    setSelectedId(nextSelected);
    setLoadingQueue(false);
  }, [committedQuery, source, status, readiness, audit, promotion, sort, page, selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    const response = await fetch(`/api/admin/category-review/${encodeURIComponent(id)}`, { cache: "no-store" });
    const json = (await response.json().catch(() => ({}))) as DetailResponse;
    if (!response.ok) {
      setError(json.error ?? "Unable to load this category.");
      setLoadingDetail(false);
      return;
    }
    setDetail(json);
    setDraft(draftFromCategory(json.category));
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [committedQuery, source, status, readiness, audit, promotion, sort, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else {
      setDetail(null);
      setDraft(null);
    }
  }, [selectedId, loadDetail]);

  const selectedIndex = useMemo(() => queue.findIndex((row) => row.id === selectedId), [queue, selectedId]);
  const current = detail?.category ?? queue.find((row) => row.id === selectedId) ?? null;
  const blockingFlags = draft
    ? [
        draft.political_self_reported && "Political/self-reported",
        draft.subjective_or_composite && "Subjective/composite",
        draft.confusing && "Confusing",
        draft.esoteric && "Esoteric",
        draft.stale_data && "Stale",
        draft.poor_coverage && "Poor coverage",
        Boolean(draft.duplicate_of) && "Duplicate link",
      ].filter(Boolean) as string[]
    : [];

  const move = useCallback((direction: -1 | 1) => {
    if (!queue.length) return;
    const nextIndex = Math.max(0, Math.min(queue.length - 1, selectedIndex + direction));
    setSelectedId(queue[nextIndex]?.id ?? null);
  }, [queue, selectedIndex]);

  const save = useCallback(async (patch?: Partial<Draft>, advance = autoAdvance) => {
    if (!selectedId || !draft || saving) return;
    const nextDraft = { ...draft, ...patch };
    setSaving(true);
    setError(null);
    setNotice(null);
    const response = await fetch(`/api/admin/category-review/${encodeURIComponent(selectedId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextDraft),
    });
    const json = (await response.json().catch(() => ({}))) as DetailResponse & { error?: string; blockers?: string[] };
    if (!response.ok) {
      setError(json.error ?? "The review decision could not be saved.");
      setSaving(false);
      return;
    }

    const oldIndex = selectedIndex;
    const oldTitle = current?.effective_title ?? current?.title ?? "Category";
    setNotice(`${oldTitle}: ${STATUS_LABELS[nextDraft.status]}.`);
    setDetail(json);
    setDraft(draftFromCategory(json.category));
    await loadQueue(json.category.id);
    if (advance) {
      const remaining = queue.filter((row) => row.id !== selectedId);
      const next = remaining[Math.min(Math.max(oldIndex, 0), Math.max(remaining.length - 1, 0))];
      if (next) setSelectedId(next.id);
    }
    setSaving(false);
  }, [selectedId, draft, saving, autoAdvance, selectedIndex, current, loadQueue, queue]);

  const quickDecision = useCallback((nextStatus: ReviewStatus, flags: Partial<Draft> = {}) => {
    if (!draft) return;
    const patch: Partial<Draft> = { status: nextStatus, ...flags };
    if (nextStatus === "approved") {
      patch.political_self_reported = false;
      patch.subjective_or_composite = false;
      patch.confusing = false;
      patch.esoteric = false;
      patch.stale_data = false;
      patch.poor_coverage = false;
      patch.duplicate_of = "";
    }
    void save(patch);
  }, [draft, save]);

  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey || saving) return;
      const key = event.key.toLowerCase();
      if (key === "arrowright" || key === "j") { event.preventDefault(); move(1); }
      else if (key === "arrowleft" || key === "k") { event.preventDefault(); move(-1); }
      else if (key === "a") { event.preventDefault(); quickDecision("approved"); }
      else if (key === "r") { event.preventDefault(); quickDecision("rejected"); }
      else if (key === "d") { event.preventDefault(); quickDecision("duplicate"); }
      else if (key === "w") { event.preventDefault(); quickDecision("needs_rewrite"); }
      else if (key === "b") { event.preventDefault(); quickDecision("needs_data_repair"); }
      else if (key === "n") { event.preventDefault(); quickDecision("needs_discussion"); }
      else if (key === "p") { event.preventDefault(); quickDecision("rejected", { political_self_reported: true }); }
      else if (key === "c") { event.preventDefault(); quickDecision("rejected", { confusing: true, esoteric: true }); }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [move, quickDecision, saving]);

  const statusCounts = [
    ["Pending", overview.pending],
    ["Approved", overview.approved],
    ["Playable", overview.playable],
    ["Approved but blocked", overview.approved_but_blocked],
    ["Integrity-ready", overview.hard_gate_ready],
    ["Data repair", overview.needs_data_repair],
    ["Rejected", overview.rejected],
  ] as const;
  const semanticAuditCounts = [
    ["Meaning audit passed", overview.semantic_audit_passed],
    ["Needs copy rewrite", overview.semantic_rewrite_required],
    ["Needs data repair", overview.semantic_data_repair_required],
    ["Needs manual review", overview.semantic_review_required],
  ] as const;

  return <section className="reviewWorkbench">
    <div className="reviewSummaryGrid">
      {statusCounts.map(([label, value]) => <div className="reviewSummaryCard" key={label}><span>{label}</span><strong>{Number(value ?? 0).toLocaleString()}</strong></div>)}
    </div>
    <div className="reviewSummaryGrid semanticAuditSummary" aria-label="Category meaning and result audit summary">
      {semanticAuditCounts.map(([label, value]) => <div className="reviewSummaryCard" key={label}><span>{label}</span><strong>{Number(value ?? 0).toLocaleString()}</strong></div>)}
    </div>

    <div className="reviewToolbar">
      <input ref={searchRef} value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search title, code, source, or semantic group…" aria-label="Search categories" />
      <select value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }} aria-label="Filter by source">
        <option value="all">All sources ({overview.categories.toLocaleString()})</option>
        {sources.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.total})</option>)}
      </select>
      <select value={status} onChange={(event) => { setStatus(event.target.value as ReviewStatus | "all"); setPage(1); }} aria-label="Filter by status">
        <option value="all">All decisions</option>
        {(Object.keys(STATUS_LABELS) as ReviewStatus[]).map((key) => <option value={key} key={key}>{STATUS_LABELS[key]}</option>)}
      </select>
      <select value={readiness} onChange={(event) => { setReadiness(event.target.value as Readiness); setPage(1); }} aria-label="Filter by integrity readiness">
        <option value="all">Any integrity state</option>
        <option value="ready">Integrity-ready</option>
        <option value="blocked">Has hard blockers</option>
      </select>
      <select value={audit} onChange={(event) => { setAudit(event.target.value as SemanticAuditFilter); setPage(1); }} aria-label="Filter by category meaning audit">
        <option value="all">Any meaning-audit state</option>
        <option value="pass">Meaning audit passed</option>
        <option value="rewrite_required">Needs copy rewrite</option>
        <option value="data_repair_required">Needs data repair</option>
        <option value="review_required">Needs manual review</option>
        <option value="excluded">Excluded</option>
      </select>
      <select value={promotion} onChange={(event) => { setPromotion(event.target.value as PromotionFilter); setPage(1); }} aria-label="Filter by Catalog outcome">
        <option value="all">Any Catalog outcome</option>
        <option value="playable">Playable</option>
        <option value="auto_promote">Ready to auto-promote</option>
        <option value="manual_review">Manual review</option>
        <option value="rewrite_required">Needs rewrite</option>
        <option value="data_repair_required">Data repair</option>
        <option value="duplicate">Duplicate</option>
        <option value="excluded">Excluded</option>
      </select>
      <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Sort categories">
        <option value="priority">Best review candidates</option>
        <option value="quality">Highest quality</option>
        <option value="coverage">Highest coverage</option>
        <option value="source">Source</option>
        <option value="title">Title</option>
      </select>
      <label className="autoAdvanceToggle"><input type="checkbox" checked={autoAdvance} onChange={(event) => setAutoAdvance(event.target.checked)} /> Auto-advance</label>
    </div>

    {(error || notice) && <div className={`reviewMessage ${error ? "error" : "success"}`}>{error ?? notice}</div>}

    <div className="reviewWorkspace">
      <aside className="reviewQueuePane" aria-label="Category queue">
        <div className="reviewQueueHeader">
          <div><strong>{pagination.total.toLocaleString()}</strong> matching</div>
          <div>Page {pagination.page} of {pagination.pages}</div>
        </div>
        <div className="reviewQueueList">
          {loadingQueue && !queue.length && <div className="reviewEmpty">Loading categories…</div>}
          {!loadingQueue && !queue.length && <div className="reviewEmpty">No categories match these filters.</div>}
          {queue.map((category, index) => <button
            key={category.id}
            className={`reviewQueueItem ${category.id === selectedId ? "selected" : ""}`}
            onClick={() => setSelectedId(category.id)}
            type="button"
          >
            <span className={`reviewQueueDot ${blockerTone(category)}`} />
            <span className="reviewQueueCopy">
              <strong>{category.effective_title}</strong>
              <span>{category.source_organization} · {category.common_year ?? category.latest_available_year ?? "—"} · {Math.max(category.common_year_coverage ?? 0, category.country_coverage ?? 0)} countries</span>
              <span>{category.effective_semantic_group ?? "No semantic group"} · quality {category.quality_score ?? "—"}</span>
            </span>
            <span className="reviewQueueStatus">{STATUS_LABELS[category.editorial_status]}</span>
            <span className="reviewQueueIndex">{index + 1}</span>
          </button>)}
        </div>
        <div className="reviewPagination">
          <button type="button" disabled={page <= 1 || loadingQueue} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <button type="button" disabled={page >= pagination.pages || loadingQueue} onClick={() => setPage((value) => Math.min(pagination.pages, value + 1))}>Next</button>
        </div>
      </aside>

      <article className="reviewDetailPane">
        {!current && <div className="reviewEmpty detail">Choose a category from the queue.</div>}
        {current && <>
          <div className="reviewDetailHeader">
            <div>
              <div className="reviewEyebrow">{current.source_organization} · {current.source_indicator_code}</div>
              <h2>{current.effective_title}</h2>
              <p>{current.plain_language_description || current.description || "No plain-language description has been added."}</p>
            </div>
            <div className={`reviewReadinessBadge ${current.computed_playable_v16_2 ? "playable" : current.hard_gate_ready ? "ready" : "blocked"}`}>
              {current.computed_playable_v16_2 ? "Playable" : current.hard_gate_ready ? "Integrity-ready" : "Hard blockers"}
            </div>
          </div>

          <div className="reviewMetricStrip">
            <div><span>Year</span><strong>{detail?.year ?? current.common_year ?? current.latest_available_year ?? "—"}</strong></div>
            <div><span>Coverage</span><strong>{Math.max(current.common_year_coverage ?? 0, current.country_coverage ?? 0)}</strong></div>
            <div><span>Quality</span><strong>{current.quality_score ?? "—"}</strong></div>
            <div><span>Direction</span><strong>{current.ranking_direction === "low" ? "Lowest wins" : "Highest wins"}</strong></div>
            <div><span>Unit</span><strong>{current.unit || "—"}</strong></div>
            <div><span>Validation</span><strong>{current.validation_status ?? "pending"}</strong></div>
          </div>

          <div className="reviewDecisionBar" aria-label="Quick review decisions">
            <button type="button" className="approve" disabled={saving} onClick={() => quickDecision("approved")} title="Keyboard: A">Approve <kbd>A</kbd></button>
            <button type="button" className="reject" disabled={saving} onClick={() => quickDecision("rejected")} title="Keyboard: R">Reject <kbd>R</kbd></button>
            <button type="button" className="duplicate" disabled={saving || !draft?.duplicate_of} onClick={() => quickDecision("duplicate")} title="Keyboard: D">Duplicate <kbd>D</kbd></button>
            <button type="button" disabled={saving} onClick={() => quickDecision("needs_rewrite")} title="Keyboard: W">Rewrite <kbd>W</kbd></button>
            <button type="button" disabled={saving} onClick={() => quickDecision("needs_data_repair")} title="Keyboard: B">Data repair <kbd>B</kbd></button>
            <button type="button" disabled={saving} onClick={() => quickDecision("needs_discussion")} title="Keyboard: N">Discuss <kbd>N</kbd></button>
            <button type="button" className="political" disabled={saving} onClick={() => quickDecision("rejected", { political_self_reported: true })} title="Keyboard: P">Political / self-report <kbd>P</kbd></button>
            <button type="button" className="confusing" disabled={saving} onClick={() => quickDecision("rejected", { confusing: true, esoteric: true })} title="Keyboard: C">Too confusing <kbd>C</kbd></button>
          </div>

          <div className="reviewDetailGrid">
            <section className="reviewPanel">
              <h3>Automated vetting recommendation</h3>
              {current.auto_vetting_recommendation
                ? <div className="reviewPass"><strong>{current.auto_vetting_recommendation.replace("_", " ")} · {current.auto_vetting_score ?? "—"}/100</strong><span>{current.auto_vetting_reason}</span>{current.auto_possible_duplicate_of && <button type="button" onClick={() => setSelectedId(current.auto_possible_duplicate_of!)}>Open possible duplicate</button>}</div>
                : <p className="reviewFinePrint">Run the v16 expanded-catalog vetting workflow after imports. Recommendations never activate categories automatically.</p>}
            </section>
            <section className="reviewPanel">
              <h3>Editorial decision</h3>
              {draft && <div className="reviewForm">
                <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ReviewStatus })}>{(Object.keys(STATUS_LABELS) as ReviewStatus[]).map((key) => <option key={key} value={key}>{STATUS_LABELS[key]}</option>)}</select></label>
                <label>Player-facing title<input value={draft.recommended_title} onChange={(event) => setDraft({ ...draft, recommended_title: event.target.value })} placeholder={current.title} maxLength={80} /></label>
                <label className="full">Board description<textarea value={draft.board_description} onChange={(event) => setDraft({ ...draft, board_description: event.target.value })} placeholder="One clear sentence shown on the game board; define specialist terms and thresholds" rows={3} maxLength={200} /><small>{draft.board_description.length}/200 characters</small></label>
                <label>Semantic group<input value={draft.semantic_group} onChange={(event) => setDraft({ ...draft, semantic_group: event.target.value })} placeholder="e.g. Trade, Energy, Physical geography" /></label>
                <label>Duplicate of<input value={draft.duplicate_of} onChange={(event) => setDraft({ ...draft, duplicate_of: event.target.value })} placeholder="Preferred category ID" /></label>
                <label className="full">Notes<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={4} placeholder="Why should this category be kept, rejected, rewritten, or discussed?" /></label>
                <div className="reviewFlags full">
                  {([
                    ["political_self_reported", "Political / self-reported"],
                    ["subjective_or_composite", "Subjective / composite"],
                    ["confusing", "Confusing"],
                    ["esoteric", "Too esoteric"],
                    ["stale_data", "Stale data"],
                    ["poor_coverage", "Poor coverage"],
                  ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })} /> {label}</label>)}
                </div>
                {!!blockingFlags.length && <div className="reviewBlockingNotice full"><strong>Approval blockers:</strong> {blockingFlags.join(", ")}</div>}
                <div className="reviewSaveRow full">
                  <button type="button" disabled={saving} onClick={() => void save(undefined, false)}>{saving ? "Saving…" : "Save without advancing"}</button>
                  <button type="button" className="primary" disabled={saving} onClick={() => void save(undefined, true)}>{saving ? "Saving…" : "Save and next"}</button>
                </div>
              </div>}
            </section>

            <section className="reviewPanel">
              <h3>Catalog outcome</h3>
              <div className={current.computed_playable_v16_2 ? "reviewPass" : "reviewBlockerList"}>
                <strong>{(current.promotion_decision_v16_2 ?? "unassessed").replaceAll("_", " ")}</strong>
                <span>{current.primary_blocker_v16_2 ?? current.promotion_reason_v16_2 ?? "Passes all current gameplay gates."}</span>
                {current.release_disposition_v16_2_3 ? <span><strong>v16.2.3 disposition:</strong> {current.release_disposition_v16_2_3.replaceAll("_", " ")}{current.release_disposition_reason_v16_2_3 ? ` · ${current.release_disposition_reason_v16_2_3}` : ""}</span> : null}
                {current.suggested_duplicate_of_v16_2 ? <span>Preferred exact match: <code>{current.suggested_duplicate_of_v16_2}</code></span> : null}
              </div>
            </section>

            <section className="reviewPanel">
              <h3>Category meaning and result audit</h3>
              {current.semantic_audit_status === "pass"
                ? <div className="reviewPass"><strong>Title, unit, source identity and result bounds align.</strong><span>This is a systematic screen; top and bottom results remain visible below for editorial plausibility review.</span></div>
                : <div className="reviewBlockerList">
                    <div><strong>{(current.semantic_audit_status ?? "review_required").replaceAll("_", " ")}</strong></div>
                    {(current.semantic_audit_issues ?? []).map((issue) => <div key={issue}>{issue}</div>)}
                    {(current.semantic_audit_warnings ?? []).map((warning) => <div key={warning}>Warning: {warning}</div>)}
                  </div>}
              <p className="reviewFinePrint"><strong>Source identity:</strong> {current.semantic_source_identity_status ?? "not assessed"} · <strong>Title/unit:</strong> {current.semantic_title_unit_status ?? "not assessed"} · <strong>Results:</strong> {current.semantic_result_logic_status ?? "not assessed"}</p>
            </section>

            <section className="reviewPanel">
              <h3>Current gameplay gate</h3>
              {current.hard_gate_ready
                ? <div className="reviewPass"><strong>Passes the same source, semantic, ranking, and quality gate used by the generator.</strong><span>Editorial approval can make it playable.</span></div>
                : <div className="reviewBlockerList">{(current.v16_2_blockers ?? []).filter((blocker) => !blocker.startsWith("Editorial") && !blocker.startsWith("Flagged") && !blocker.startsWith("Marked")).map((blocker) => <div key={blocker}>{blocker}</div>)}</div>}
              {current.validation_reason && <p className="reviewFinePrint"><strong>Validation:</strong> {current.validation_reason}</p>}
              <div className="reviewLinkRow">
                {current.player_source_url && <a href={current.player_source_url} target="_blank" rel="noreferrer">Player source</a>}
                {current.methodology_url && <a href={current.methodology_url} target="_blank" rel="noreferrer">Methodology</a>}
                {current.source_page_url && <a href={current.source_page_url} target="_blank" rel="noreferrer">Dataset page</a>}
                {current.source_url && <a href={current.source_url} target="_blank" rel="noreferrer">Stored source</a>}
              </div>
            </section>
          </div>

          <div className="reviewDetailGrid values">
            <section className="reviewPanel">
              <h3>{current.ranking_direction === "low" ? "Lowest values (winners)" : "Top values (winners)"}</h3>
              {loadingDetail && <div className="reviewEmpty">Loading values…</div>}
              {!loadingDetail && <ol className="reviewRankingList">{(detail?.top ?? []).map((row) => <li key={row.country_iso3}><span>{row.country_name}</span><strong>{formatReviewValue(row.value, current)}</strong></li>)}</ol>}
            </section>
            <section className="reviewPanel">
              <h3>Opposite end</h3>
              {!loadingDetail && <ol className="reviewRankingList reverse">{(detail?.bottom ?? []).map((row) => <li key={row.country_iso3}><span>{row.country_name}</span><strong>{formatReviewValue(row.value, current)}</strong></li>)}</ol>}
            </section>
          </div>

          <section className="reviewPanel similarPanel">
            <h3>Potential overlaps</h3>
            {(detail?.similar ?? []).length
              ? <div className="reviewSimilarGrid">{detail?.similar.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)}><strong>{item.effective_title}</strong><span>{item.source_organization} · {STATUS_LABELS[item.editorial_status]}</span><code>{item.id}</code></button>)}</div>
              : <p className="reviewFinePrint">No other category currently uses this semantic group.</p>}
          </section>

          <div className="reviewKeyboardHelp"><strong>Keyboard:</strong> A approve · R reject · D duplicate · W rewrite · N discuss · P political/self-report · C confusing · ←/→ move · / search</div>
        </>}
      </article>
    </div>
  </section>;
}
