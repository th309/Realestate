import { Test } from '@nestjs/testing';
import { ListingPresentationNarrativeService } from '../listing-presentation-narrative.service';
import { AiProviderService } from '../../ai-provider/ai-provider.service';

/**
 * The narrative routes through AiProviderService (configured default provider,
 * e.g. DeepSeek), NOT a hardcoded Anthropic client. Providers commonly wrap
 * their JSON in a ```json fence despite "STRICT JSON only", so the service must
 * unwrap before parsing — a naive JSON.parse silently fell back on every report.
 */
const COMPLETION = (content: string) => ({
  content,
  model: 'deepseek-v4-pro',
  provider: 'deepseek' as const,
  durationMs: 1,
});

const VALID_JSON =
  '{"thesis":"Cary is strong.","actions":[{"title":"List now","desc":"Spring window."},{"title":"Price at comps","desc":""},{"title":"Lead with migration","desc":""}],"strategy":"List in next 60 days..."}';

describe('ListingPresentationNarrativeService', () => {
  let service: ListingPresentationNarrativeService;
  let aiProvider: jest.Mocked<AiProviderService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListingPresentationNarrativeService,
        {
          provide: AiProviderService,
          useValue: {
            complete: jest.fn().mockResolvedValue(COMPLETION(VALID_JSON)),
          },
        },
      ],
    }).compile();
    service = module.get(ListingPresentationNarrativeService);
    aiProvider = module.get(AiProviderService);
  });

  const input = {
    market: { geoLevel: 'city', geoId: 'cary-nc', name: 'Cary, NC' },
    persona: 'agent' as const,
    structuredFacts: { score: 87, dom: 11 },
  };

  it('routes through AiProviderService with the listing-presentation purpose', async () => {
    await service.generate(input);
    expect(aiProvider.complete).toHaveBeenCalledWith(
      'listing_presentation_narrative',
      // maxTokens 3000: deepseek-v4-pro truncated mid-JSON at 1500 → fallback.
      expect.objectContaining({ responseFormat: 'json', maxTokens: 3000 }),
    );
  });

  it('returns parsed narrative including thesis, strategy, and 3 actions', async () => {
    const result = await service.generate(input);
    expect(result.thesis).toContain('Cary');
    expect(result.actions).toHaveLength(3);
    expect(result.strategy).toBeTruthy();
    expect(result.fallbackUsed).toBe(false);
  });

  it('parses a markdown-fenced JSON response (the real model output shape)', async () => {
    aiProvider.complete.mockResolvedValueOnce(
      COMPLETION('```json\n' + VALID_JSON + '\n```'),
    );
    const result = await service.generate(input);
    expect(result.fallbackUsed).toBe(false);
    expect(result.thesis).toContain('Cary');
    expect(result.actions).toHaveLength(3);
  });

  it('returns deterministic fallback if the model returns malformed JSON', async () => {
    aiProvider.complete.mockResolvedValueOnce(COMPLETION('not json'));
    const result = await service.generate(input);
    expect(result.fallbackUsed).toBe(true);
  });

  it('falls back deterministically when the provider rejects', async () => {
    aiProvider.complete.mockRejectedValueOnce(
      new Error('connect ETIMEDOUT api.deepseek.com:443'),
    );
    const result = await service.generate(input);
    expect(result.fallbackUsed).toBe(true);
    expect(result.thesis).toContain('Cary');
    expect(result.actions).toHaveLength(3);
  });
});
