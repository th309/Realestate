/**
 * Shared types for the Organization Embeds feature.
 */

export interface EmbedTokenRecord {
  id: string;
  organization_id: string;
  name: string;
  token: string;
  allowed_origins: string[];
  widget_types: string[];
  created_by: string;
  is_active: boolean;
  is_draft: boolean;
  embed_config: Record<string, unknown> | null;
  created_at: string;
}

export interface EmbedValidationResult {
  orgId: string;
  branding: {
    logo_url: string | null;
    accent_color: string | null;
    org_name: string;
    website_url: string | null;
  };
}
