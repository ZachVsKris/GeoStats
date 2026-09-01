begin;

-- The owner-retirement predicate is schema-independent. Pin an empty search
-- path so callers cannot influence name resolution.
alter function public.v16_2_7_durable_exclusion_reason(text,text,text,text)
set search_path='';

commit;
