-- =====================================================================
-- Migration: set_budget_alert PostgreSQL function
-- PayWiz (PS8) — Smart Banking Assistant
-- Run this in Supabase -> SQL Editor.
-- =====================================================================

create or replace function set_budget_alert(
  p_customer_id text,
  p_category text,
  p_monthly_limit numeric,
  p_alert_at_pct int default 80
) returns json language plpgsql as $$
declare
  c customers%rowtype;
  b budgets%rowtype;
begin
  select * into c from customers where id = p_customer_id;
  if not found then
    raise exception 'Customer % not found', p_customer_id;
  end if;

  if p_monthly_limit is null or p_monthly_limit <= 0 then
    raise exception 'Monthly budget limit must be greater than Rs 0';
  end if;

  if p_alert_at_pct is null or p_alert_at_pct < 10 or p_alert_at_pct > 100 then
    raise exception 'Alert percentage must be between 10%% and 100%%';
  end if;

  insert into budgets (customer_id, category, monthly_limit, alert_at_pct)
  values (p_customer_id, p_category, p_monthly_limit, coalesce(p_alert_at_pct, 80))
  on conflict (customer_id, category)
  do update set
    monthly_limit = excluded.monthly_limit,
    alert_at_pct = excluded.alert_at_pct
  returning * into b;

  return json_build_object(
    'category', b.category,
    'monthly_limit', b.monthly_limit,
    'alert_at_pct', b.alert_at_pct
  );
end $$;

grant execute on function set_budget_alert(text, text, numeric, int) to service_role;
notify pgrst, 'reload schema';
