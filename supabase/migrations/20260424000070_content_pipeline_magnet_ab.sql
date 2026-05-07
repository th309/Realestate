ALTER TABLE content_runs
  ADD COLUMN IF NOT EXISTS selected_magnet_binding_id UUID REFERENCES format_magnet_bindings(id);

ALTER TABLE lead_magnet_deliveries
  ADD COLUMN IF NOT EXISTS binding_id UUID REFERENCES format_magnet_bindings(id);

CREATE INDEX IF NOT EXISTS idx_deliveries_binding ON lead_magnet_deliveries (binding_id);

