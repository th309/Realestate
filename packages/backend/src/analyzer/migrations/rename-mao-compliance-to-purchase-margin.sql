-- Rename the F&F metric key `mao_compliance` → `purchase_margin` in any
-- user-saved thresholds. The metric was renamed to drop the "MAO" jargon
-- in favor of the plain-English "Purchase Margin (ARV)" surfaced in the
-- Customize drawer.
--
-- Touches FIX_AND_FLIP rows only. Idempotent — safe to run twice (the
-- second run finds no rows still containing the old key).
--
-- Two key paths to migrate inside the `thresholds` JSONB:
--   1. The top-level metric object: thresholds->'mao_compliance'
--   2. The weights map: thresholds->'weights'->'mao_compliance'

UPDATE user_thresholds
SET thresholds =
  (
    -- Strip old metric key, add new one with the same value
    (thresholds - 'mao_compliance')
    || jsonb_build_object('purchase_margin', thresholds -> 'mao_compliance')
    -- Same swap inside the weights map
    || jsonb_build_object(
      'weights',
      (thresholds -> 'weights' - 'mao_compliance')
      || jsonb_build_object(
        'purchase_margin',
        thresholds -> 'weights' -> 'mao_compliance'
      )
    )
  )
WHERE
  strategy = 'FIX_AND_FLIP'
  AND thresholds ? 'mao_compliance';
