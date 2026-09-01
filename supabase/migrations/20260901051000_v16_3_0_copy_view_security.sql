begin;

-- Replacing a view resets reloptions in PostgreSQL. Restore caller-context
-- permissions explicitly after the v16.3.0 clarity-view update.
alter view public.category_copy_clarity_v16_2_8 set (security_invoker=true);

commit;
