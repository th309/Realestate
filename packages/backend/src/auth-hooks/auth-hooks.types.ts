export interface SupabaseEmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | 'signup'
      | 'recovery'
      | 'magic_link'
      | 'email_change'
      | 'invite';
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}
