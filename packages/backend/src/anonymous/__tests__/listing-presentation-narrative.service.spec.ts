import { Test } from '@nestjs/testing';
import { ListingPresentationNarrativeService } from '../listing-presentation-narrative.service';
import { AnthropicService } from '../../ai/anthropic.service';

describe('ListingPresentationNarrativeService', () => {
  let service: ListingPresentationNarrativeService;
  let anthropic: jest.Mocked<AnthropicService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListingPresentationNarrativeService,
        {
          provide: AnthropicService,
          useValue: {
            messages: jest.fn().mockResolvedValue({
              content: [
                {
                  type: 'text',
                  text: '{"thesis":"Cary is strong.","actions":[{"title":"List now","desc":"Spring window."},{"title":"Price at comps","desc":""},{"title":"Lead with migration","desc":""}],"strategy":"List in next 60 days..."}',
                },
              ],
            }),
          },
        },
      ],
    }).compile();
    service = module.get(ListingPresentationNarrativeService);
    anthropic = module.get(AnthropicService);
  });

  it('returns parsed narrative including thesis, strategy, and 3 actions', async () => {
    const result = await service.generate({
      market: { geoLevel: 'city', geoId: 'cary-nc', name: 'Cary, NC' },
      persona: 'agent',
      structuredFacts: { score: 87, dom: 11, soldAboveList: 0.62 },
    });
    expect(result.thesis).toContain('Cary');
    expect(result.actions).toHaveLength(3);
    expect(result.strategy).toBeTruthy();
  });

  it('returns deterministic fallback if Claude returns malformed JSON', async () => {
    anthropic.messages.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json' }],
    } as any);
    const result = await service.generate({
      market: { geoLevel: 'city', geoId: 'cary-nc', name: 'Cary, NC' },
      persona: 'agent',
      structuredFacts: { score: 87 },
    });
    expect(result.fallbackUsed).toBe(true);
  });
});
