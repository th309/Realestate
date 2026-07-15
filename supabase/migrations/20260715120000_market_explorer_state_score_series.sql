-- State-level PropertyIQ Score = mean of the state's scored metros (no native state rows exist).
-- distinct-on collapses the crosswalk (one row per ZIP) to one state per CBSA so a metro is
-- counted once per state, matching the prototype's stateEnts aggregation.
create or replace function me_state_score_series(p_start date)
returns table(state_fips text, score_date date, avg_score numeric)
language sql
stable
as $$
  with metro_state as (
    select distinct on (cbsa_code) cbsa_code, state_fips
    from geography_crosswalk
    where cbsa_code is not null and state_fips is not null
    order by cbsa_code, state_fips
  )
  select ms.state_fips, s.score_date, avg(s.score)::numeric as avg_score
  from propertyiq_scores s
  join metro_state ms on ms.cbsa_code = s.location_id
  where s.geography = 'metro'
    and s.score_type = 'propertyiq'
    and s.score is not null
    and s.score_date >= p_start
  group by ms.state_fips, s.score_date;
$$;

grant execute on function me_state_score_series(date) to anon, authenticated, service_role;
