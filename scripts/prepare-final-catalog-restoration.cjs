const fs = require("node:fs");
const assert = require("node:assert/strict");

const targets = [
  "who:WHS4_117",
  "who:WHS8_110",
  "unwpp:highest-natural-change-rate",
  "unwpp:highest-net-migration-rate",
  "faostat-qcl-camels-stocks-02121-01-5111-an",
  "faostat-qcl-chickens-stocks-02151-5112-1000-an",
  "faostat-qcl-ducks-stocks-02154-5112-1000-an",
  "unwpp:fastest-pop-decline",
  "history:worldbank-under-five-mortality-below-50",
  "history:worldbank-internet-half",
  "natural-earth:landlocked-fewest-neighbors",
  "unsdg:four-g-coverage",
  "comtrade:most-coal-exported",
  "comtrade:most-crude-oil-exported",
  "comtrade:most-electricity-exported",
  "natural-earth:most-land-neighbors",
  "natural-earth:landlocked-most-neighbors",
  "history:worldbank-electricity-half",
];

const unsuitable = [
  "unhcr:most-stateless-people",
  "natural-earth:largest-mapped-glaciated-area",
  "natural-earth:highest-mapped-glaciated-share",
  "natural-earth:highest-mapped-river-density",
  "natural-earth:most-mapped-river-length",
  "natural-earth:most-mapped-rivers",
  "natural-earth:most-mapped-lakes",
  "natural-earth:largest-mapped-lake-area",
  "natural-earth:highest-mapped-lake-share",
  "natural-earth:longest-coastline",
  "natural-earth:highest-coastline-density",
];

const owner = require("../audits/owner-review-verification-2026-09-08.json");
const finalSet = new Set(owner.proofs.map((proof) => proof.category_id));
for (const id of unsuitable) finalSet.delete(id);
finalSet.delete("unwpp:lowest-death-rate");
assert.equal(finalSet.size, 354, "Expected the reviewed final catalog to contain 354 categories");
assert.ok(targets.every((id) => finalSet.has(id)), "Every repair target must belong to the reviewed final catalog");

const auditFiles = [
  "country-extremes-verification-2026-09-08.json",
  "owner-review-verification-2026-09-08.json",
  "boundary-import-recovery-2026-09-08.json",
  "strict-runtime-replay-2026-09-07.json",
  "maximum-live-verification-2026-09-07.json",
  "maximum-recovery-proofs-2026-09-07.json",
  "maximum-all-witnesses-2026-09-07.json",
  "live-414-reachability-2026-09-07.json",
  "history-414-reachability-2026-09-07.json",
  "faostat-stock-proofs-2026-09-07.json",
];

const candidates = auditFiles.flatMap((name) => {
  const report = require(`../audits/${name}`);
  return (report.proofs ?? []).map((proof) => ({ ...proof, sourceAudit: name }));
});

const verifiedSubstitutions = [
  {
    category_id: "faostat-qcl-ducks-stocks-02154-5112-1000-an",
    difficulty: "expert",
    reachable: true,
    audit_version: "final-catalog-witness-substitution-2026-09-22",
    checked_at: "2026-09-22T00:00:00.000Z",
    witness: {
      categories: [
        "faostat-qcl-ducks-stocks-02154-5112-1000-an",
        "history:worldbank-infant-mortality-below-25",
        "electricityAccess",
        "faostat-fbs:sugar",
        "natural-earth:longest-land-border",
        "unsdg:pm25-exposure",
      ],
      countries: ["BOL", "ARG", "EST", "IND", "BRA", "STP", "BGD", "NPL"],
    },
  },
  {
    category_id: "history:worldbank-under-five-mortality-below-50",
    difficulty: "expert",
    reachable: true,
    audit_version: "final-catalog-witness-substitution-2026-09-22",
    checked_at: "2026-09-22T00:00:00.000Z",
    witness: {
      categories: [
        "history:worldbank-under-five-mortality-below-50",
        "agValue",
        "unsdg:urban-slum-share",
        "unwpp:highest-birth-rate",
        "unsdg:three-g-coverage",
        "pew-religion:other-religions-population",
      ],
      countries: ["TZA", "LAO", "MDV", "ESP", "DJI", "SLV", "PAN", "STP"],
    },
  },
  {
    category_id: "natural-earth:most-land-neighbors",
    difficulty: "normal",
    reachable: true,
    audit_version: "final-catalog-witness-substitution-2026-09-22",
    checked_at: "2026-09-22T00:00:00.000Z",
    witness: {
      categories: [
        "natural-earth:most-land-neighbors",
        "militaryShare",
        "pew-religion:hindu-population",
        "history:worldbank-under-five-mortality-below-50",
      ],
      countries: ["BDI", "FJI", "POL", "IND", "BGR", "CHN"],
    },
  },
];

const expectedDimensions = {
  easy: { categories: 4, countries: 4 },
  normal: { categories: 4, countries: 6 },
  expert: { categories: 6, countries: 8 },
};

const repairs = targets.map((categoryId) => {
  const proofs = ["easy", "normal", "expert"].map((difficulty) => {
    const replacement = verifiedSubstitutions.find(
      (proof) => proof.category_id === categoryId && proof.difficulty === difficulty,
    );
    const proof = replacement ?? candidates.find((item) =>
      item.category_id === categoryId
      && item.difficulty === difficulty
      && item.reachable === true
      && item.witness?.categories?.every((id) => finalSet.has(id)),
    );
    assert.ok(proof, `Missing final-catalog witness for ${categoryId}/${difficulty}`);
    assert.equal(proof.witness.categories.length, expectedDimensions[difficulty].categories);
    assert.equal(proof.witness.countries.length, expectedDimensions[difficulty].countries);
    assert.ok(proof.witness.categories.includes(categoryId));
    assert.ok(proof.witness.categories.every((id) => finalSet.has(id)));
    const { sourceAudit, ...stored } = proof;
    return {
      ...stored,
      audit_version: stored.audit_version ?? `reviewed-audit:${sourceAudit}`,
      checked_at: stored.checked_at ?? "2026-09-08T00:00:00.000Z",
    };
  });
  return { id: categoryId, proofs };
});

assert.equal(repairs.length, 18);
assert.equal(repairs.flatMap((repair) => repair.proofs).length, 54);

const sql = `begin;
set local statement_timeout='300s';
select pg_advisory_xact_lock(hashtext('geostats-v16.3.4-runtime-catalog'));

create temporary table final_catalog_repairs on commit drop as
select * from jsonb_to_recordset($repairs$${JSON.stringify(repairs)}$repairs$::jsonb)
  as x(id text, proofs jsonb);

create temporary table final_catalog_before on commit drop as
select id from public.category_runtime_review_v16_2 where computed_playable_v16_2;

do $guard$
begin
  if (select count(*) from final_catalog_before) not in (336,354) then
    raise exception 'Final catalog repair expected the 336-category baseline or the already-repaired 354-category state';
  end if;
  if (select count(*) from final_catalog_repairs) <> 18 then
    raise exception 'Final catalog repair must contain exactly 18 categories';
  end if;
  if (select count(*) from final_catalog_before) = 354 and exists (
    select 1 from final_catalog_repairs r
    left join public.category_runtime_review_v16_2 v on v.id=r.id
    where not (v.computed_playable_v16_2 and v.enabled and v.eligible_daily)
  ) then
    raise exception 'The 354-category state is not the reviewed final catalog';
  end if;
  if exists (
    select 1 from final_catalog_repairs r
    left join public.category_recovery_evidence_v16_3_4 e on e.category_id=r.id
    left join public.category_runtime_review_v16_2 v on v.id=r.id
    where e.category_id is null or v.id is null or not e.approved
      or e.snapshot_fingerprint is distinct from public.category_recovery_fingerprint_v16_3_4(r.id)
      or v.editorial_status in ('rejected','duplicate') or v.duplicate_of is not null
      or v.validation_mismatch_count<>0 or v.validation_ranking_mismatch_count<>0
      or v.stale_data or v.subjective_or_composite or v.political_self_reported
      or v.confusing or v.esoteric or v.poor_coverage or v.objective_status<>'objective'
  ) then
    raise exception 'A repair target no longer satisfies the reviewed source and quality gates';
  end if;
  if exists (
    select 1 from final_catalog_repairs r
    cross join lateral jsonb_array_elements(r.proofs) p
    where not coalesce((p->>'reachable')::boolean,false)
      or p->>'difficulty' not in ('easy','normal','expert')
      or jsonb_array_length(p->'witness'->'categories') <> case p->>'difficulty' when 'expert' then 6 else 4 end
      or jsonb_array_length(p->'witness'->'countries') <> case p->>'difficulty' when 'easy' then 4 when 'normal' then 6 else 8 end
      or not (p->'witness'->'categories' @> jsonb_build_array(r.id))
  ) then
    raise exception 'A final-catalog witness has invalid dimensions or reachability metadata';
  end if;
  if exists (
    select 1 from final_catalog_repairs r
    cross join lateral jsonb_array_elements(r.proofs) p
    cross join lateral jsonb_array_elements_text(p->'witness'->'categories') partner
    left join public.stat_categories c on c.id=partner.value
    where c.id is null
      or not coalesce(c.metadata->'playableDifficulties','["easy","normal","expert"]'::jsonb)
        @> jsonb_build_array(p->>'difficulty')
  ) then
    raise exception 'A final-catalog witness references a missing or mode-ineligible category';
  end if;
end
$guard$;

update public.category_recovery_evidence_v16_3_4 e
set proofs=r.proofs,
    snapshot_fingerprint=public.category_recovery_fingerprint_v16_3_4(e.category_id),
    dependency_fingerprints=(
      select jsonb_object_agg(d.id,public.category_recovery_fingerprint_v16_3_4(d.id))
      from (
        select distinct jsonb_array_elements_text(p->'witness'->'categories') id
        from jsonb_array_elements(r.proofs) p
      ) d
    ),
    assessed_at=now(),
    approved=true
from final_catalog_repairs r
where e.category_id=r.id;

do $ready$
begin
  if exists (
    select 1 from final_catalog_repairs r
    where not public.category_recovery_ready_v16_3_4(r.id)
  ) then
    raise exception 'A repaired category still has stale recovery evidence';
  end if;
end
$ready$;

select public.refresh_v16_2_runtime_catalog();

-- The full refresh deliberately reapplies canonical measurement metadata before
-- promotion. Rebind the reviewed evidence to that canonical post-refresh state,
-- then perform the bounded final publication pass without another metadata rewrite.
update public.category_recovery_evidence_v16_3_4 e
set snapshot_fingerprint=public.category_recovery_fingerprint_v16_3_4(e.category_id),
    dependency_fingerprints=(
      select jsonb_object_agg(d.id,public.category_recovery_fingerprint_v16_3_4(d.id))
      from (
        select distinct jsonb_array_elements_text(p->'witness'->'categories') id
        from jsonb_array_elements(e.proofs) p
      ) d
    ),
    assessed_at=now()
where e.category_id in (select id from final_catalog_repairs);

select public.apply_category_recovery_credibility_v16_3_4();
select public.refresh_category_promotion_assessment_v16_2();

update public.stat_categories c
set enabled=public.category_v16_3_4_should_publish(c.id),
    eligible_daily=public.category_v16_3_4_should_publish(c.id),
    updated_at=now()
where c.enabled is distinct from public.category_v16_3_4_should_publish(c.id)
   or c.eligible_daily is distinct from public.category_v16_3_4_should_publish(c.id);

do $release$
begin
  if (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2) <> 354
    or (select count(*) from public.stat_categories where enabled and eligible_daily) <> 354 then
    raise exception 'Final reviewed catalog did not converge to 354 playable categories';
  end if;
  if exists (
    select 1 from public.category_runtime_review_v16_2 v
    where v.computed_playable_v16_2
      and not exists (select 1 from final_catalog_before b where b.id=v.id)
      and not exists (select 1 from final_catalog_repairs r where r.id=v.id)
  ) then
    raise exception 'Unexpected category entered the final catalog';
  end if;
  if exists (
    select 1 from final_catalog_repairs r
    left join public.category_runtime_review_v16_2 v on v.id=r.id
    where not (v.computed_playable_v16_2 and v.enabled and v.eligible_daily)
  ) then
    raise exception 'A reviewed repair target is not fully playable';
  end if;
  if exists (
    select 1 from public.stat_categories
    where id=any(array[${unsuitable.map((id) => `'${id}'`).join(",")}])
      and (enabled or eligible_daily)
  ) then
    raise exception 'A source-suitability retirement was re-enabled';
  end if;
  perform public.assert_v16_3_4_runtime_catalog();
end
$release$;

commit;
`;

const output = "supabase/migrations/20260922010000_restore_final_reviewed_catalog.sql";
fs.writeFileSync(output, sql);
console.log(JSON.stringify({ output, categories: repairs.length, proofs: 54, finalCatalog: finalSet.size }));
