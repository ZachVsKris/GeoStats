// Prepare bounded, source- and score-guarded repair SQL. Does not connect to production.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {loadAuditExport}=require('./load-audit-export.cjs');
const root=process.argv[2],{mapping}=loadAuditExport(root);
const read=p=>JSON.parse(fs.readFileSync(`${root}/${p}`));
const sources=read('history-source-fingerprints.json');
const hashes=Object.fromEntries(sources.map(r=>[r.id,r.fingerprint]));
const evidence=read('history-evidence-rows.json');
const proofAudit=JSON.parse(fs.readFileSync('audits/history-414-reachability-2026-09-07.json'));
assert.equal(proofAudit.unresolved.length,0);assert.equal(proofAudit.proofs.length,1240);
const proposals=evidence.map(e=>{
 assert.equal(e.snapshot_fingerprint,hashes[e.category_id]);
 const proofs=proofAudit.proofs.filter(p=>p.category_id===e.category_id).map(p=>({...p,category_id:e.category_id,witness:{...p.witness,categories:p.witness.categories.map(id=>mapping[id])}}));
 assert.ok(proofs.length>=1&&proofs.length<=3);assert.ok(proofs.every(p=>p.reachable&&p.witness.categories.every(id=>hashes[id])));
 return {id:e.category_id,hash:e.snapshot_fingerprint,proofs,dependencies:Object.fromEntries([...new Set(proofs.flatMap(p=>p.witness.categories))].map(id=>[id,hashes[id]]))};
});
assert.equal(proposals.length,96);
const proofSql=`begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.3.4-runtime-catalog'));
do $repair$ declare r record; d record; begin
 if (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2)<>414 then raise exception 'Catalog changed'; end if;
 for r in select * from jsonb_to_recordset($proofs$${JSON.stringify(proposals)}$proofs$::jsonb) x(id text,hash text,proofs jsonb,dependencies jsonb) loop
  if public.category_recovery_fingerprint_v16_3_4(r.id) is distinct from r.hash then raise exception 'Source changed: %',r.id; end if;
  for d in select * from jsonb_each_text(r.dependencies) loop
   if public.category_recovery_fingerprint_v16_3_4(d.key) is distinct from d.value then raise exception 'Witness source changed: %',d.key; end if;
  end loop;
  update public.category_recovery_evidence_v16_3_4 set proofs=r.proofs,dependency_fingerprints=r.dependencies,assessed_at=now() where category_id=r.id and approved and snapshot_fingerprint=r.hash;
  if not found then raise exception 'Recovery evidence changed: %',r.id; end if;
 end loop;
 if (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2)<>414 then raise exception 'Catalog regressed'; end if;
 perform public.assert_v16_3_4_runtime_catalog();
end $repair$;
commit;
`;
fs.writeFileSync('audits/history-recovery-proof-refresh-2026-09-07.sql',proofSql);
const before=read('history-repair-before.json'),proposal=read('history-daily-proposal.json');
assert.equal(proposal.date,'2026-09-07');assert.equal(proposal.publication.difficulty,'normal');
const old=before.map(r=>({difficulty:r.difficulty,hash:r.board_hash}));
const guards=proposal.sourceIds.map(id=>({id,hash:hashes[id]}));assert.ok(guards.every(r=>r.hash));
const dailySql=`begin;
set local lock_timeout='5s';
lock table public.daily_scores in share mode;
lock table public.daily_challenges in share row exclusive mode;
do $repair$ declare r record; begin
 if current_date<>date '2026-09-07' then raise exception 'Date changed'; end if;
 if exists(select 1 from public.daily_scores where challenge_date='2026-09-07' and difficulty='normal') then raise exception 'Adventurer now scored: repair aborted'; end if;
 if exists(select 1 from public.daily_generation_locks_v15_7 where challenge_date='2026-09-07' and expires_at>now()) then raise exception 'Generation in progress'; end if;
 for r in select * from jsonb_to_recordset($old$${JSON.stringify(old)}$old$::jsonb) x(difficulty text,hash text) loop
  if not exists(select 1 from public.daily_challenges where challenge_date='2026-09-07' and difficulty=r.difficulty and board_hash=r.hash) then raise exception 'Daily changed'; end if;
 end loop;
 for r in select * from jsonb_to_recordset($guards$${JSON.stringify(guards)}$guards$::jsonb) x(id text,hash text) loop
  if public.category_recovery_fingerprint_v16_3_4(r.id) is distinct from r.hash then raise exception 'Source changed: %',r.id; end if;
  if not exists(select 1 from public.category_runtime_review_v16_2 where id=r.id and computed_playable_v16_2 and enabled and eligible_daily) then raise exception 'Category no longer playable: %',r.id; end if;
 end loop;
 perform public.publish_daily_trio_v16('2026-09-07',$board$${JSON.stringify([proposal.publication])}$board$::jsonb);
 for r in select * from jsonb_to_recordset($old$${JSON.stringify(old.filter(r=>r.difficulty!=='normal'))}$old$::jsonb) x(difficulty text,hash text) loop
  if not exists(select 1 from public.daily_challenges where challenge_date='2026-09-07' and difficulty=r.difficulty and board_hash=r.hash) then raise exception 'Preserved mode changed'; end if;
 end loop;
end $repair$;
commit;
`;
fs.writeFileSync('audits/history-daily-repair-publication-2026-09-07.sql',dailySql);
fs.writeFileSync('audits/history-daily-repair-before-2026-09-07.json',JSON.stringify(before,null,2)+'\n');
console.log(JSON.stringify({recoveryRecords:proposals.length,dailyMode:'normal',preserved:['easy','expert'],replacementCategories:proposal.publication.board_payload.categories.map(d=>d.category.name)}));
