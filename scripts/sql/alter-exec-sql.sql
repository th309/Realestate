CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  result json;
BEGIN
  IF sql IS NULL OR btrim(sql) = '' THEN
    RETURN json_build_object('ok', true, 'message', 'empty sql');
  END IF;

  IF lower(ltrim(sql)) LIKE 'select%' OR lower(ltrim(sql)) LIKE 'with%' THEN
    EXECUTE sql INTO result;
    RETURN result;
  END IF;

  EXECUTE sql;
  RETURN json_build_object('ok', true);
END;
$func$;
