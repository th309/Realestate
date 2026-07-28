import { FeedTopUpService } from './feed-topup.service';
import { buildFeedDeps } from './__tests__/feed-generation-test-helpers';

function build(...args: Parameters<typeof buildFeedDeps>) {
  const deps = buildFeedDeps(...args);
  const service = new FeedTopUpService(...deps.args);
  return { service, ...deps };
}

describe('FeedTopUpService.topUp', () => {
  const OLD = process.env.CONTENT_FEED_TARGET_DRAFTS;
  beforeEach(() => {
    process.env.CONTENT_FEED_TARGET_DRAFTS = '2';
  });
  afterAll(() => {
    if (OLD === undefined) delete process.env.CONTENT_FEED_TARGET_DRAFTS;
    else process.env.CONTENT_FEED_TARGET_DRAFTS = OLD;
  });

  it('delegates one generation per needed draft and records spend once', async () => {
    const { service, generatePost, recordSpend } = build({ pendingCount: 0 });
    const outcomes = await service.topUp();
    expect(generatePost).toHaveBeenCalledTimes(2);
    expect(outcomes.filter((o) => o.status === 'inserted')).toHaveLength(2);
    expect(recordSpend).toHaveBeenCalledTimes(1);
  });

  it('no-ops when already at target', async () => {
    const { service, generatePost } = build({ pendingCount: 2 });
    const outcomes = await service.topUp();
    expect(outcomes).toHaveLength(0);
    expect(generatePost).not.toHaveBeenCalled();
  });

  it('skips when the pipeline is paused', async () => {
    const { service, generatePost } = build({ paused: true, pendingCount: 0 });
    const outcomes = await service.topUp();
    expect(outcomes).toHaveLength(0);
    expect(generatePost).not.toHaveBeenCalled();
  });

  it('skips when the daily budget is exhausted', async () => {
    const { service, generatePost } = build({
      pendingCount: 0,
      budgetAllowed: false,
    });
    const outcomes = await service.topUp();
    expect(generatePost).not.toHaveBeenCalled();
    expect(outcomes[0].status).toBe('skipped_budget');
  });

  it('rotates the post type by total posts ever created, not just the in-cycle index', async () => {
    // Regression for a live bug: the loop index used to reset to 0 on every
    // topUp() call, so a typical one-post-per-tick cron always regenerated
    // FEED_POST_TYPES[0] (linkedin_post) and never reached carousel_copy /
    // video_script. Live data confirmed the skew: 7 linkedin_post / 2
    // facebook_post / 1 carousel_copy / 0 video_script out of the first 10
    // posts ever generated. Offsetting by the brand's total-ever-created count
    // (not pending queue depth, which can return to the same value on every
    // tick under a steady review cadence) varies the starting type across
    // ticks even when each tick only needs one post.
    process.env.CONTENT_FEED_TARGET_DRAFTS = '1';
    const first = build({ pendingCount: 0, totalCount: 0 });
    await first.service.topUp(); // need = 1 - 0 = 1, offset = 0 + 0 = 0
    const firstType = first.generatePost.mock.calls[0][2];

    process.env.CONTENT_FEED_TARGET_DRAFTS = '2';
    const second = build({ pendingCount: 1, totalCount: 1 });
    await second.service.topUp(); // need = 2 - 1 = 1, offset = 1 + 0 = 1
    const secondType = second.generatePost.mock.calls[0][2];

    expect(firstType).toBe('linkedin_post');
    expect(secondType).toBe('facebook_post');
    expect(secondType).not.toBe(firstType);
  });

  it('does not get stuck on one type when the queue holds steady across ticks', async () => {
    // The failure mode a pending-length offset would have: if the reviewer
    // clears exactly one draft per tick, pending.length is IDENTICAL on every
    // cron tick, so an offset keyed on it never advances. The total-ever-created
    // count keeps climbing regardless, so the type keeps rotating.
    process.env.CONTENT_FEED_TARGET_DRAFTS = '1';
    const seenTypes = new Set<string>();
    for (let tick = 0; tick < 4; tick++) {
      // Steady state: 0 pending before each tick (mirrors "always cleared to
      // zero"), but total-ever-created keeps growing tick over tick.
      const { service, generatePost } = build({
        pendingCount: 0,
        totalCount: tick,
      });
      await service.topUp();
      seenTypes.add(generatePost.mock.calls[0][2] as string);
    }
    expect(seenTypes.size).toBe(4);
  });
});
