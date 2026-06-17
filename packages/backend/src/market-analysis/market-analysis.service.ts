import { Injectable, Logger } from '@nestjs/common';
import { ReportAiService } from '../reports/report-ai.service';
import { RedisService } from '../redis/redis.service';
import { extractJsonObject } from '../ai/extract-json';
import { generateFallback } from './market-analysis-fallback';

interface MetricValue {
  value: number | null;
  formatted: string;
  change: number | null;
}

export interface AnalysisRequest {
  geoType: string;
  geoId: string;
  geoName: string;
  metrics: Record<string, MetricValue>;
  scores: {
    propertyiq: { score: number; grade: string };
  };
  lastUpdated?: string;
}

export interface AnalysisSection {
  title: string;
  analysis: string;
}

export interface MarketAnalysisResult {
  homebuyer: AnalysisSection[];
  investor: AnalysisSection[];
  generatedAt: string;
  cached: boolean;
}

const CACHE_TTL_SECONDS = 86400; // 24h — analyses are expensive and inputs change slowly

@Injectable()
export class MarketAnalysisService {
  private readonly logger = new Logger(MarketAnalysisService.name);
  private readonly inflight = new Map<string, Promise<MarketAnalysisResult>>();

  constructor(
    private readonly reportAiService: ReportAiService,
    private readonly redisService: RedisService,
  ) {}

  async generateAnalysis(
    request: AnalysisRequest,
  ): Promise<MarketAnalysisResult> {
    // v6: bust the v5 cache that captured deterministic-template fallbacks
    // (the AI JSON was truncating at the old 3000-token cap and failing to parse).
    const cacheKey = `piq:market-analysis:v6:${request.geoType}:${request.geoId}`;

    const cached = await this.redisService.getByKey(cacheKey);
    if (cached) {
      this.logger.log(`[MarketAnalysis] Cache hit for ${request.geoName}`);
      return { ...cached, cached: true };
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) {
      this.logger.log(
        `[MarketAnalysis] Coalescing concurrent request for ${request.geoName}`,
      );
      return existing;
    }

    const promise = this.computeAndCache(request, cacheKey);
    this.inflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  private async computeAndCache(
    request: AnalysisRequest,
    cacheKey: string,
  ): Promise<MarketAnalysisResult> {
    let homebuyer: AnalysisSection[];
    let investor: AnalysisSection[];

    if (this.reportAiService.isAvailable()) {
      const result = await this.generateWithAi(request);
      homebuyer = result.homebuyer;
      investor = result.investor;
    } else {
      this.logger.warn(
        '[MarketAnalysis] AI unavailable, using template fallback',
      );
      homebuyer = generateFallback(request, 'homebuyer');
      investor = generateFallback(request, 'investor');
    }

    const result: MarketAnalysisResult = {
      homebuyer: this.sanitizeSections(homebuyer),
      investor: this.sanitizeSections(investor),
      generatedAt: new Date().toISOString(),
      cached: false,
    };

    await this.redisService.setByKey(cacheKey, result, CACHE_TTL_SECONDS);

    return result;
  }

  private async generateWithAi(
    request: AnalysisRequest,
  ): Promise<{ homebuyer: AnalysisSection[]; investor: AnalysisSection[] }> {
    const prompt = this.buildPrompt(request);

    try {
      // Match the proven reports/ai-insights pipeline: DON'T force
      // response_format:json_object (the working report narratives never do;
      // extractJsonObject parses JSON out of a plain or fenced response), and
      // give the model real headroom. The 6-section JSON was hitting the old
      // 3000-token cap (finish_reason=length) → truncated, unparseable JSON →
      // silent fallback to the deterministic template on every market. 6000
      // leaves comfortable margin for the full payload.
      const response = await this.reportAiService.complete(prompt, 6000);
      return this.parseResponse(response);
    } catch (error) {
      this.logger.error(
        `[MarketAnalysis] AI generation failed: ${error.message}`,
      );
      return {
        homebuyer: generateFallback(request, 'homebuyer'),
        investor: generateFallback(request, 'investor'),
      };
    }
  }

  private buildPrompt(request: AnalysisRequest): string {
    const { geoName, metrics, scores } = request;

    const metricsBlock = Object.entries(metrics)
      .filter(([, v]) => v.value != null)
      .map(([key, v]) => {
        const changePart =
          v.change != null
            ? ` (${v.change >= 0 ? '+' : ''}${v.change.toFixed(1)}% YoY)`
            : '';
        return `- ${key}: ${v.formatted}${changePart}`;
      })
      .join('\n');

    return `You are a sharp, experienced real estate market analyst. Analyze the data below for ${geoName} and write 6 short analytical paragraphs: 3 for a homebuyer audience and 3 for an investor audience.

Market Data for ${geoName}:
${metricsBlock}

Scores:
- PropertyIQ Score: ${scores.propertyiq.score}/100 (Grade: ${scores.propertyiq.grade})

Write exactly 6 sections, 3 for homebuyers and 3 for investors. Use natural, informative titles.

HOMEBUYER SECTIONS:
1. AFFORDABILITY: Can a typical buyer afford this market? Reference income requirements, median prices, price per sqft, and how long it takes to save.
2. MARKET PACE: Is this market moving fast or slow? Reference days on market, inventory trends, pending ratios. Should a buyer be aggressive or patient?
3. PRICE TRAJECTORY: Where are prices headed? Reference YoY/MoM changes, 5-year trends, price cuts. Is now a good or bad time to buy?

INVESTOR SECTIONS:
4. CASH FLOW POTENTIAL: Will a rental property cash flow here? Reference cap rates, gross yield, rent levels, GRM. Cash-flow market or appreciation play?
5. VALUE GROWTH: Will property values appreciate? Reference YoY and 5-year growth, population and job growth, overvalued indicators.
6. LIQUIDITY AND DEMAND: Can you rent it out easily? Can you sell when you want? Reference days on market, inventory, rental demand, absorption.

Content rules:
- Reference specific numbers from the data (say "prices are up 4.2% year-over-year to $385K", not just "prices are rising").
- Be honest and balanced. If the data is mixed, say so.
- Each paragraph should be 60-100 words, conversational but analytical.
- If a metric is missing, work with what you have. Do not mention missing data.
- Close each paragraph with a plain, practical takeaway sentence. Do NOT add a "Takeaway" label, a heading, a colon prefix, or any emphasis around it.

Style rules (strict):
- Write plain conversational prose. NO markdown formatting at all: no asterisks for bold, no underscores around words, no backticks, no headings, no bullet points inside the analysis.
- No em-dashes. Use commas, periods, or the word "and" instead.
- Do not output raw data field names. Translate code-style identifiers into plain English ("days_on_market" becomes "days on market", "price_cut_pct" becomes "the share of listings with price cuts").
- Each "analysis" value must be one single plain-text paragraph with no special formatting characters.

Respond in this exact JSON format:
{"homebuyer":[{"title":"...","analysis":"..."},{"title":"...","analysis":"..."},{"title":"...","analysis":"..."}],"investor":[{"title":"...","analysis":"..."},{"title":"...","analysis":"..."},{"title":"...","analysis":"..."}]}`;
  }

  private parseResponse(response: string): {
    homebuyer: AnalysisSection[];
    investor: AnalysisSection[];
  } {
    // Parse through the shared fence-aware extractor (same helper the reports
    // pipeline uses). It throws on empty/unparseable output, and we throw on a
    // wrong-shaped object — so the caller's catch falls back to the
    // deterministic data-driven template, never the "Analysis unavailable."
    // placeholder that used to get cached.
    const parsed = extractJsonObject<{
      homebuyer?: AnalysisSection[];
      investor?: AnalysisSection[];
      sections?: AnalysisSection[];
    }>(response);

    if (Array.isArray(parsed.homebuyer) && Array.isArray(parsed.investor)) {
      return {
        homebuyer: parsed.homebuyer.slice(0, 3),
        investor: parsed.investor.slice(0, 3),
      };
    }
    // Tolerate the older flat {sections:[...6]} shape.
    if (Array.isArray(parsed.sections) && parsed.sections.length >= 6) {
      return {
        homebuyer: parsed.sections.slice(0, 3),
        investor: parsed.sections.slice(3, 6),
      };
    }
    throw new Error(
      'MarketAnalysis: AI response missing homebuyer/investor arrays',
    );
  }

  private sanitizeSections(sections: AnalysisSection[]): AnalysisSection[] {
    return sections.map((s) => ({
      title: this.stripMarkdown(s.title ?? ''),
      analysis: this.stripMarkdown(s.analysis ?? ''),
    }));
  }

  /**
   * Defensive strip of markdown the model may emit despite the prompt's style
   * rules (e.g. "**takeaway**"). Belt-and-suspenders so raw markdown never
   * reaches the UI, which renders the analysis text verbatim.
   */
  private stripMarkdown(text: string): string {
    if (!text) return text;
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold**
      .replace(/__([^_]+)__/g, '$1') // __bold__
      .replace(/\*([^*\n]+)\*/g, '$1') // *italic*
      .replace(/`([^`]+)`/g, '$1') // `code`
      .replace(/^\s{0,3}#{1,6}\s+/gm, '') // # headings
      .replace(/\*\*/g, '') // any stray bold markers
      .replace(/[ \t]{2,}/g, ' ') // collapse doubled spaces left behind
      .trim();
  }
}
