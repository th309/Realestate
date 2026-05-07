CREATE TABLE IF NOT EXISTS format_style_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  style_reference_id UUID NOT NULL REFERENCES style_references(id) ON DELETE CASCADE,
  weight REAL NOT NULL DEFAULT 1.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (format, style_reference_id)
);

ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS selected_style_binding_id UUID REFERENCES format_style_bindings(id);

ALTER TABLE format_style_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all ON format_style_bindings FOR ALL USING (true);
GRANT ALL ON format_style_bindings TO service_role;
GRANT ALL ON format_style_bindings TO authenticated;

