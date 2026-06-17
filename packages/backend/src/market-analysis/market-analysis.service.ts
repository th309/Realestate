import { Injectable, Logger } from '@nestjs/common';
import { ReportAiService } from '../reports/report-ai.service';
import { RedisService } from '../redis/redis.service';
import { extractJsonObject } from '../ai/extract-json';

interface MetricValue {
  value: number | null;
  formatted: string;
  change: number | null;
}

interface AnalysisRequest {
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
    // v4: bust the v3 cache that captured truncated/"Analysis unavailable." results.
    const cacheKey = `piq:market-analysis:v4:${request.geoType}:${request.geoId}`;

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
      homebuyer = this.generateFallback(request, 'homebuyer');
      investor = this.generateFallback(request, 'investor');
    }

    const result: MarketAnalysisResult = {
      homebuyer,
      investor,
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
      // Same knowhow as the reports pipeline: ask the provider for a JSON object
      // (DeepSeek/OpenAI honor response_format; Anthropic is skipped safely) and
      // give it room. 6 paragraphs of JSON truncated at 1400 tokens is exactly
      // what produced "Analysis unavailable.".
      const response = await this.reportAiService.complete(
        prompt,
        3000,
        'json',
      );
      return this.parseResponse(response);
    } catch (error) {
      this.logger.error(
        `[MarketAnalysis] AI generation failed: ${error.message}`,
      );
      return {
        homebuyer: this.generateFallback(request, 'homebuyer'),
        investor: this.generateFallback(request, 'investor'),
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

    return `You are a sharp, experienced real estate market analyst. Analyze the data below for ${geoName} and write 6 short analytical paragraphs — 3 for a homebuyer audience and 3 for an investor audience.

Market Data for ${geoName}:
${metricsBlock}

Scores:
- PropertyIQ Score: ${scores.propertyiq.score}/100 (Grade: ${scores.propertyiq.grade})

Write exactly 6 sections — 3 for homebuyers and 3 for investors. Use natural, informative titles.

HOMEBUYER SECTIONS:
1. AFFORDABILITY — Can a typical buyer afford this market? Reference income requirements, median prices, price per sqft, and how long it takes to save.
2. MARKET PACE — Is this market moving fast or slow? Reference days on market, inventory trends, pending ratios. Should a buyer be aggressive or patient?
3. PRICE TRAJECTORY — Where are prices headed? Reference YoY/MoM changes, 5-year trends, price cuts. Is now a good or bad time to buy?

INVESTOR SECTIONS:
4. CASH FLOW POTENTIAL — Will a rental property cash flow here? Reference cap rates, gross yield, rent levels, GRM. Cash-flow market or appreciation play?
5. VALUE GROWTH — Will property values appreciate? Reference YoY and 5-year growth, population/job growth, overvalued indicators.
6. LIQUIDITY & DEMAND — Can you rent it out easily? Can you sell when you want? Reference days on market, inventory, rental demand, absorption.

Rules:
- Reference specific numbers from the data (say "prices are up 4.2% year-over-year to $385K", not just "prices are rising")
- Be honest and balanced — if the data is mixed, say so
- Each paragraph should be 60-100 words, conversational but analytical
- If a metric is missing, work with what you have — don't mention missing data
- End each section with a practical takeaway

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

  private generateFallback(
    request: AnalysisRequest,
    viewType: 'homebuyer' | 'investor',
  ): AnalysisSection[] {
    const { geoName, metrics, scores } = request;

    const val = (key: string) => metrics[key]?.value ?? null;
    const fmt = (key: string) => metrics[key]?.formatted ?? null;
    const chg = (key: string) => metrics[key]?.change ?? null;

    if (viewType === 'homebuyer') {
      const hs = scores.propertyiq;
      const scoreDesc =
        hs.score >= 70
          ? 'favorable'
          : hs.score >= 50
            ? 'moderate'
            : 'challenging';

      const affordParts = [
        `${geoName} shows ${scoreDesc} conditions for homebuyers (PropertyIQ score: ${hs.score}).`,
      ];
      if (fmt('listing_price'))
        affordParts.push(
          `The median listing price is ${fmt('listing_price')}.`,
        );
      if (fmt('income_to_buy'))
        affordParts.push(
          `You'd need roughly ${fmt('income_to_buy')} in annual income to afford a home here.`,
        );
      const yts = val('years_to_save');
      if (yts != null)
        affordParts.push(
          `At current savings rates, expect about ${yts.toFixed(1)} years to save for a down payment.`,
        );

      const speedParts: string[] = [];
      const dom = val('days_on_market');
      if (dom != null)
        speedParts.push(
          `Homes in ${geoName} average ${Math.round(dom)} days on market.`,
        );
      const invChg = chg('for_sale_inventory');
      if (invChg != null)
        speedParts.push(
          `Inventory is ${invChg > 0 ? 'up' : 'down'} ${Math.abs(invChg).toFixed(1)}% year-over-year.`,
        );
      const pr = val('pending_ratio');
      if (pr != null)
        speedParts.push(
          `The pending ratio sits at ${(pr * 100).toFixed(0)}%, indicating ${pr > 0.4 ? 'strong' : 'moderate'} buyer activity.`,
        );
      if (speedParts.length === 0)
        speedParts.push(
          `Market pace data for ${geoName} is currently limited.`,
        );

      const priceParts: string[] = [];
      if (fmt('home_value'))
        priceParts.push(`Current median home value: ${fmt('home_value')}.`);
      const hvYoy = val('home_value_yoy');
      if (hvYoy != null)
        priceParts.push(
          `Values are ${hvYoy >= 0 ? 'up' : 'down'} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`,
        );
      const hv5yr = val('home_value_5yr');
      if (hv5yr != null)
        priceParts.push(
          `The 5-year annualized growth rate is ${hv5yr.toFixed(1)}%.`,
        );
      const pcPct = val('price_cut_pct');
      if (pcPct != null)
        priceParts.push(
          `${pcPct.toFixed(0)}% of listings have price reductions.`,
        );
      if (priceParts.length === 0)
        priceParts.push(
          `Price trend data for ${geoName} is currently limited.`,
        );

      return [
        { title: 'Affordability', analysis: affordParts.join(' ') },
        { title: 'Market Speed', analysis: speedParts.join(' ') },
        { title: 'Price Trajectory', analysis: priceParts.join(' ') },
      ];
    }

    // Investor fallback
    const is = scores.propertyiq;
    const scoreDesc =
      is.score >= 70 ? 'strong' : is.score >= 50 ? 'moderate' : 'limited';

    const cfParts = [
      `${geoName} shows ${scoreDesc} investment potential (PropertyIQ score: ${is.score}).`,
    ];
    const cr = val('cap_rate');
    if (cr != null)
      cfParts.push(
        `Cap rates are around ${cr.toFixed(1)}%, indicating ${cr >= 6 ? 'solid cash flow' : cr >= 4 ? 'moderate returns' : 'appreciation-focused'} potential.`,
      );
    if (fmt('rent_index'))
      cfParts.push(`Median rents at ${fmt('rent_index')}/month.`);
    const gy = val('gross_yield');
    if (gy != null) cfParts.push(`Gross yield: ${gy.toFixed(1)}%.`);

    const growParts: string[] = [];
    const hvYoy = val('home_value_yoy');
    if (hvYoy != null)
      growParts.push(
        `Property values are ${hvYoy >= 0 ? 'up' : 'down'} ${Math.abs(hvYoy).toFixed(1)}% year-over-year.`,
      );
    const hv5yr = val('home_value_5yr');
    if (hv5yr != null)
      growParts.push(`5-year annualized growth: ${hv5yr.toFixed(1)}%.`);
    const popG = val('population_growth');
    if (popG != null)
      growParts.push(
        `Population growth of ${popG.toFixed(1)}% supports demand.`,
      );
    const jobG = val('job_growth');
    if (jobG != null) growParts.push(`Job growth: ${jobG.toFixed(1)}%.`);
    if (growParts.length === 0)
      growParts.push(`Growth data for ${geoName} is currently limited.`);

    const liqParts: string[] = [];
    const dom = val('days_on_market');
    if (dom != null)
      liqParts.push(`Homes sell in an average of ${Math.round(dom)} days.`);
    const invChg = chg('for_sale_inventory');
    if (invChg != null)
      liqParts.push(
        `Inventory ${invChg > 0 ? 'rising' : 'falling'} at ${Math.abs(invChg).toFixed(1)}% YoY.`,
      );
    const pr = val('pending_ratio');
    if (pr != null)
      liqParts.push(
        `Pending ratio of ${(pr * 100).toFixed(0)}% suggests ${pr > 0.4 ? 'healthy' : 'softer'} demand.`,
      );
    liqParts.push(`PropertyIQ score: ${scores.propertyiq.score}/100.`);

    return [
      { title: 'Cash Flow Potential', analysis: cfParts.join(' ') },
      { title: 'Value Growth', analysis: growParts.join(' ') },
      { title: 'Liquidity & Demand', analysis: liqParts.join(' ') },
    ];
  }
}
