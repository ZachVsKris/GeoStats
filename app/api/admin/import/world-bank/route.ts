import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/adminAuth";
import { CATEGORIES, type Category } from "../../../../../lib/categories";
import { fetchCountries, fetchWorldBankCategory } from "../../../../../lib/worldBank";
import { scoreCategoryQuality } from "../../../../../lib/categoryQuality";
import {
  governWorldBankCategory,
  governanceMetadata,
  GOVERNANCE_VERSION,
} from "../../../../../lib/categoryGovernance";
import { canonicalCountryName } from "../../../../../lib/canonicalCountries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const worldBankCategories = CATEGORIES.filter((category) => category.source === "worldbank" && category.enabled !== false);

function valueType(category: Category) {
  const description = `${category.description} ${category.unit}`.toLowerCase();
  if (description.includes("per person") || description.includes("per capita")) return "per_capita";
  if (description.includes("percent") || category.unit.includes("%")) return "percentage";
  if (description.includes(" per 100") || description.includes("rate")) return "rate";
  return "total";
}

function categoryMetadata(category: Category) {
  return {
    shortName: category.shortName,
    decimals: category.decimals ?? null,
    coverageFloor: category.coverageFloor,
    certificationGrade: category.certificationGrade,
    requireCommonYear: category.requireCommonYear ?? false,
    expectedRange: category.expectedRange ?? null,
    roundType: category.roundType ?? null,
    similarityGroup: category.similarityGroup ?? null,
    governanceVersion: GOVERNANCE_VERSION,
  };
}

async function bump(admin: any, runId: number, deltaObservations: number) {
  const { data } = await admin
    .from("stat_import_runs")
    .select("categories_processed,observations_inserted")
    .eq("id", runId)
    .single();
  await admin
    .from("stat_import_runs")
    .update({
      categories_processed: (data?.categories_processed ?? 0) + 1,
      observations_inserted: (data?.observations_inserted ?? 0) + deltaObservations,
    })
    .eq("id", runId);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { admin } = auth;
  const body = await request.json().catch(() => ({}));

  if (body.action === "start") {
    const rows = worldBankCategories.map((category) => ({
      id: category.id,
      title: category.name,
      short_title: category.shortName,
      description: category.description,
      icon: category.icon,
      unit: category.unit,
      value_type: valueType(category),
      ranking_direction: category.direction,
      family: category.family,
      source_organization: "World Bank",
      source_dataset: category.dataset,
      source_indicator_code: category.indicator,
      source_url: `https://data.worldbank.org/indicator/${category.indicator}`,
      enabled: false,
      eligible_daily: false,
      minimum_year: category.minimumYear ?? 2022,
      metadata: categoryMetadata(category),
    }));
    const { error } = await admin.from("stat_categories").upsert(rows, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: run, error: runError } = await admin
      .from("stat_import_runs")
      .insert({
        source_organization: "World Bank",
        source_dataset: "World Development Indicators",
        status: "running",
        details: {
          requested_by: auth.user.id,
          total_categories: rows.length,
          automatic_governance: true,
          governance_version: GOVERNANCE_VERSION,
        },
      })
      .select("id")
      .single();
    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });
    await admin.from("data_sources").update({ status: "importing" }).eq("id", "worldbank");
    return NextResponse.json({
      runId: run.id,
      categories: worldBankCategories.map((category) => ({ id: category.id, shortName: category.shortName })),
    });
  }

  if (body.action === "category") {
    const category = worldBankCategories.find((candidate) => candidate.id === body.categoryId);
    if (!category) return NextResponse.json({ error: "Unknown World Bank category." }, { status: 400 });

    const { data: existing } = await admin
      .from("stat_categories")
      .select("review_status")
      .eq("id", category.id)
      .maybeSingle();
    const manuallyRejected = existing?.review_status === "rejected";

    try {
      const dataset = await fetchWorldBankCategory(category);
      const quality = scoreCategoryQuality(dataset);
      const governance = governWorldBankCategory(category, quality);
      const automaticPass = governance.autoApproved && !manuallyRejected;
      const requiresSourceAudit = !manuallyRejected;
      const rows = dataset.observations.map((observation) => ({
        category_id: category.id,
        country_iso3: observation.countryId,
        country_name: canonicalCountryName(observation.countryId, observation.countryName),
        data_year: Number(observation.year),
        value: observation.value,
        source_url: `https://data.worldbank.org/indicator/${category.indicator}`,
        source_record_id: `${category.indicator}:${observation.countryId}:${observation.year}`,
        metadata: {
          indicator: category.indicator,
          sourceCountryName: observation.countryName,
        },
      }));

      // Replace the snapshot so removed aggregates or stale countries cannot survive a refresh.
      const { error: deleteError } = await admin.from("stat_observations").delete().eq("category_id", category.id);
      if (deleteError) throw deleteError;
      const { error: observationError } = await admin
        .from("stat_observations")
        .upsert(rows, { onConflict: "category_id,country_iso3,data_year" });
      if (observationError) throw observationError;

      const countries = await fetchCountries();
      const { error: countryError } = await admin.from("countries").upsert(
        countries.map((country) => ({
          iso3: country.id,
          name: canonicalCountryName(country.id, country.name),
          region: country.region,
          playable: true,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "iso3" },
      );
      if (countryError) throw countryError;

      const years = rows.map((row) => row.data_year);
      const latestYear = Math.max(...years);
      const yearCoverage = new Map<number, number>();
      for (const year of years) yearCoverage.set(year, (yearCoverage.get(year) ?? 0) + 1);
      const [commonYear, commonYearCoverage] = [...yearCoverage.entries()].sort(
        (a, b) => b[1] - a[1] || b[0] - a[0],
      )[0] ?? [latestYear, 0];

      const reviewStatus = manuallyRejected
        ? "rejected"
        : quality.eligible
          ? "needs_review"
          : "candidate";
      const categoryUpdate = {
        country_coverage: rows.length,
        latest_available_year: latestYear,
        quality_score: quality.score,
        quality_details: { ...quality, governance: governanceMetadata(governance) },
        auto_qualified: automaticPass,
        eligible_daily: false,
        enabled: false,
        review_status: reviewStatus,
        evidence_tier: category.certificationGrade,
        common_year: commonYear,
        common_year_coverage: commonYearCoverage,
        provenance_status: governance.provenanceStatus,
        provenance_class: governance.provenanceClass,
        provenance_reason: governance.provenanceReason,
        methodology_url: governance.methodologyUrl,
        independent_validation: governance.independentValidation,
        government_assertion_risk: governance.governmentAssertionRisk,
        concept_group: governance.conceptGroup,
        governance_priority: governance.sourcePriority,
        governance_version: GOVERNANCE_VERSION,
        duplicate_status: manuallyRejected ? "not_eligible" : "pending",
        superseded_by: null,
        auto_decision_reason: manuallyRejected
          ? "Remains disabled because an administrator manually rejected this category."
          : `${governance.autoDecisionReason} Imported through the Admin browser and held pending the v14.2 official-source audit.`,
        validation_status: manuallyRejected ? "failed" : "pending",
        validation_version: null,
        validated_at: null,
        validation_reason: manuallyRejected
          ? "Manual rejection retained during import."
          : "Imported successfully; the independent official-source audit has not run yet.",
        source_snapshot_checksum: null,
        stored_snapshot_checksum: null,
        validated_observation_count: null,
        validation_expected_count: commonYearCoverage,
        validation_mismatch_count: 0,
        validation_ranking_mismatch_count: 0,
        metadata: { ...categoryMetadata(category), ...governanceMetadata(governance) },
      };
      const { error: categoryError } = await admin.from("stat_categories").update(categoryUpdate).eq("id", category.id);
      if (categoryError) throw categoryError;
      const { error: governanceError } = await admin.rpc("apply_category_governance", { p_category_id: category.id });
      if (governanceError) throw governanceError;

      await bump(admin, Number(body.runId), rows.length);
      return NextResponse.json({
        ok: true,
        category: category.id,
        observations: rows.length,
        year: latestYear,
        quality: quality.score,
        eligibleDaily: false,
        sourceAuditRequired: requiresSourceAudit,
        provenanceStatus: governance.provenanceStatus,
      });
    } catch (error: any) {
      await admin.from("stat_observations").delete().eq("category_id", category.id);
      await admin
        .from("stat_categories")
        .update({
          country_coverage: 0,
          latest_available_year: null,
          quality_score: 0,
          eligible_daily: false,
          quality_details: { error: error?.message || "Category import failed." },
          enabled: false,
          auto_qualified: false,
          review_status: manuallyRejected ? "rejected" : "candidate",
          duplicate_status: "not_eligible",
          superseded_by: null,
          auto_decision_reason: manuallyRejected
            ? "Remains disabled because an administrator manually rejected this category."
            : `Quarantined because the latest import failed: ${error?.message || "unknown error"}`,
          validation_status: "failed",
          validated_at: new Date().toISOString(),
          validation_reason: `Import failed before source validation: ${error?.message || "unknown error"}`,
        })
        .eq("id", category.id);
      await bump(admin, Number(body.runId), 0);
      return NextResponse.json({ error: error?.message || "Category import failed." }, { status: 500 });
    }
  }

  if (body.action === "finish") {
    const failures = Array.isArray(body.failures) ? body.failures : [];
    const status = failures.length === worldBankCategories.length ? "failed" : "completed";
    await admin
      .from("stat_import_runs")
      .update({
        status,
        completed_at: new Date().toISOString(),
        error_message: status === "failed" ? "All categories failed." : null,
        details: {
          failures,
          automatic_governance: true,
          governance_version: GOVERNANCE_VERSION,
        },
      })
      .eq("id", Number(body.runId));
    await admin
      .from("data_sources")
      .update({ status: status === "completed" ? "active" : "error", last_import_at: new Date().toISOString() })
      .eq("id", "worldbank");
    return NextResponse.json({ ok: true, status, failures: failures.length });
  }

  return NextResponse.json({ error: "Unknown import action." }, { status: 400 });
}
