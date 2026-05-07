-- Gate A resume logic compares script asset updated_at vs last failed data_verifier created_at.
-- content_assets had no updated_at column, so resume always fell through to verifying_data.

ALTER TABLE content_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE content_assets SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE content_assets ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE content_assets ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION update_content_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_content_assets_updated_at ON content_assets;

CREATE TRIGGER set_content_assets_updated_at
  BEFORE UPDATE ON content_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_content_assets_updated_at();
