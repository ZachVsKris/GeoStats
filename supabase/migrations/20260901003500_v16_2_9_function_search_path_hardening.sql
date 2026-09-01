begin;

-- Pin every remaining advisor-flagged helper to an empty search path. These
-- functions either use only pg_catalog built-ins/arguments or explicitly
-- qualify public dependencies, so this removes name-shadowing risk safely.
alter function public.set_updated_at() set search_path='';
alter function public.enforce_content_and_player_link_gate() set search_path='';
alter function public.category_v15_source_is_official(text) set search_path='';
alter function public.player_source_url_is_safe(text) set search_path='';
alter function public.category_v15_true_integrity_failure(text,text,integer,integer) set search_path='';
alter function public.category_v15_minimum_acceptable_year(text,text,integer) set search_path='';
alter function public.enforce_stat_category_content_player_link_gate() set search_path='';
alter function public.general_official_source_page(text) set search_path='';
alter function public.general_official_source_page_v15(text) set search_path='';
alter function public.category_v16_2_quality_floor(text) set search_path='';
alter function public.category_v16_2_copy_is_clear(text,text,text,text) set search_path='';
alter function public.category_board_description_v16_2_8(text,text,text,text) set search_path='';
alter function public.category_macro_domain_v16_2_7(text,text,text,jsonb) set search_path='';
alter function public.v16_2_7_durable_exclusion_reason(text,text,text,text) set search_path='';

commit;
