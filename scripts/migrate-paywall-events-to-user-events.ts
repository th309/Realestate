/**
 * One-time migration: paywall_events → user_events
 *
 * Maps each paywall_events row to the unified user_events schema,
 * inserting in batches of 500.
 *
 * Run with:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-paywall-events-to-user-events.ts
 */

import { createClient } from '@supabase/supabase-js';

// ── Supabase client ────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Type definitions ───────────────────────────────────────────────────────────

interface PaywallEvent {
  id: string;
  user_id: string | null;
  session_id: string | null;
  resource_type: string;
  resource_id: string;
  user_tier: string;
  page_path: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface UserEventInsert {
  client_event_id: string;
  visitor_id: string;
  session_id: string;
  user_id: string | null;
  user_tier: string;
  event_category: string;
  event_action: string;
  event_label: string;
  page_path: string | null;
  properties: Record<string, unknown>;
  created_at: string;
}

// ── Event type mapping ─────────────────────────────────────────────────────────

const EVENT_TYPE_MAP: Record<string, { category: string; action: string }> = {
  'view':          { category: 'conversion', action: 'paywall_view'    },
  'click_upgrade': { category: 'conversion', action: 'upgrade_click'   },
  'dismiss':       { category: 'conversion', action: 'paywall_dismiss' },
};

// ── Mapping logic ──────────────────────────────────────────────────────────────

const READ_BATCH_SIZE = 1000;
const INSERT_BATCH_SIZE = 500;

function mapPaywallEventToUserEvent(row: PaywallEvent): UserEventInsert {
  const mapped = EVENT_TYPE_MAP[row.event_type];

  if (!mapped) {
    // Unknown event types fall through as a generic conversion event so no
    // data is silently dropped — log a warning but continue.
    console.warn(
      `  [WARN] Unknown event_type "${row.event_type}" on row ${row.id} — ` +
      `using event_action "paywall_unknown"`,
    );
  }

  const eventCategory = mapped?.category ?? 'conversion';
  const eventAction   = mapped?.action   ?? 'paywall_unknown';

  // Derive a stable visitor_id from session_id so anonymous pre-auth events
  // still group correctly in the new schema.
  const visitorId = row.session_id
    ? `migrated-session-${row.session_id}`
    : `migrated-user-${row.user_id ?? row.id}`;

  // session_id is NOT NULL in user_events — fall back to the row id when the
  // source column is null so the UNIQUE (session_id, client_event_id) constraint
  // can still be satisfied.
  const sessionId = row.session_id ?? `migrated-fallback-${row.id}`;

  return {
    client_event_id: `migrated-${row.id}`,
    visitor_id:      visitorId,
    session_id:      sessionId,
    user_id:         row.user_id,
    user_tier:       row.user_tier,
    event_category:  eventCategory,
    event_action:    eventAction,
    // Combine resource_type + resource_id into a single human-readable label,
    // e.g. "metric:rental_yield" or "geography:zip".
    event_label:     `${row.resource_type}:${row.resource_id}`,
    page_path:       row.page_path,
    // Preserve the original metadata and event_type for auditability.
    properties: {
      ...row.metadata,
      migrated_from:          'paywall_events',
      original_event_type:    row.event_type,
      original_resource_type: row.resource_type,
      original_resource_id:   row.resource_id,
    },
    created_at: row.created_at,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function countPaywallEvents(): Promise<number> {
  const { count, error } = await supabase
    .from('paywall_events')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to count paywall_events: ${error.message}`);
  }
  return count ?? 0;
}

async function fetchPaywallEventBatch(offset: number): Promise<PaywallEvent[]> {
  const { data, error } = await supabase
    .from('paywall_events')
    .select('*')
    .order('created_at', { ascending: true })
    .range(offset, offset + READ_BATCH_SIZE - 1);

  if (error) {
    throw new Error(
      `Failed to fetch paywall_events at offset ${offset}: ${error.message}`,
    );
  }
  return (data ?? []) as PaywallEvent[];
}

async function insertUserEventBatch(rows: UserEventInsert[]): Promise<void> {
  const { error } = await supabase
    .from('user_events')
    .insert(rows, { defaultToNull: true });

  if (error) {
    throw new Error(`Failed to insert user_events batch: ${error.message}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function migratePaywallEventsToUserEvents(): Promise<void> {
  console.log('Starting migration: paywall_events → user_events');
  console.log('─'.repeat(56));

  const totalRows = await countPaywallEvents();
  console.log(`Total paywall_events to migrate: ${totalRows}`);

  if (totalRows === 0) {
    console.log('Nothing to migrate — paywall_events table is empty.');
    return;
  }

  let migratedCount = 0;
  let readOffset = 0;

  while (readOffset < totalRows) {
    // ── Read next read-batch from paywall_events ─────────────────────────────
    const paywallBatch = await fetchPaywallEventBatch(readOffset);

    if (paywallBatch.length === 0) {
      break; // Reached the end of the table.
    }

    // ── Map each row to the user_events schema ───────────────────────────────
    const mappedRows: UserEventInsert[] = paywallBatch.map(mapPaywallEventToUserEvent);

    // ── Insert in sub-batches of INSERT_BATCH_SIZE ───────────────────────────
    for (let i = 0; i < mappedRows.length; i += INSERT_BATCH_SIZE) {
      const insertBatch = mappedRows.slice(i, i + INSERT_BATCH_SIZE);
      await insertUserEventBatch(insertBatch);
      migratedCount += insertBatch.length;
      console.log(`Migrated ${migratedCount}/${totalRows} paywall events`);
    }

    readOffset += paywallBatch.length;
  }

  console.log('─'.repeat(56));
  console.log(`Migration complete. ${migratedCount} rows written to user_events.`);
}

migratePaywallEventsToUserEvents().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
