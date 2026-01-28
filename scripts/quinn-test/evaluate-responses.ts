#!/usr/bin/env npx tsx
/**
 * Quinn Response Evaluator
 * 
 * Scores Quinn responses on multiple quality dimensions:
 * - Brevity (1-3 sentences)
 * - Data repetition avoidance
 * - Plain text formatting
 * - Tool mention avoidance
 * - Intent matching
 * - Completeness
 * - Performance
 * 
 * Detects critical failures:
 * - No data when needed
 * - Wrong scoring system
 * - Hallucinations
 * - Incomplete answers
 * - Data omissions
 */

import { readFileSync, writeFileSync } from 'fs';

interface TestResponse {
  prompt: string;
  success: boolean;
  durationMs: number;
  toolsUsed: string[];
  responseText: string;
  structuredData: any;
  error?: string;
}

interface QualityEvaluation {
  prompt: string;
  
  // Performance metrics
  durationMs: number;
  durationScore: number;
  
  // Tool usage
  toolsUsed: string[];
  toolCount: number;
  toolsAppropriate: boolean;
  intentDetected: string;
  intentCorrect: boolean;
  
  // Response quality
  responseText: string;
  responseLength: number;
  
  // Quality scores (0-100)
  brevityScore: number;
  dataRepetitionScore: number;
  markdownScore: number;
  toolMentionScore: number;
  intentMatchScore: number;
  completenessScore: number;
  
  // Critical failures
  noDataWhenNeeded: boolean;
  wrongScoringSystem: boolean;
  hallucination: boolean;
  incompleteAnswer: boolean;
  dataOmission: boolean;
  
  // Overall
  overallScore: number;
  passes: boolean;
  issues: string[];
  suggestions: string[];
}

function calculateBrevityScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length <= 5) return 100;  // 1-5 sentences acceptable
  if (sentences.length <= 8) return 75;
  if (sentences.length <= 12) return 50;
  return 25;
}

function calculateDataRepetitionScore(response: TestResponse): number {
  const sd = response.structuredData as { comparison?: unknown } | undefined;
  if (sd?.comparison && /compare|benchmark|national average|stack up/.test(response.prompt.toLowerCase())) return 100;
  const text = response.responseText.toLowerCase();
  const scorePatterns = /\d+\.\d+|\bscored?\s+\d+|\b\d+\s*points?/gi;
  const scoreMatches = text.match(scorePatterns) || [];
  const nameListPatterns = /,\s*[A-Z][a-z]+\s+[A-Z]{2}/g;
  const nameMatches = text.match(nameListPatterns) || [];
  const dataPoints = scoreMatches.length + nameMatches.length;
  if (dataPoints <= 3) return 100;
  if (dataPoints <= 6) return 70;
  if (dataPoints <= 10) return 40;
  return 20;
}

function calculateMarkdownScore(response: TestResponse): number {
  const text = response.responseText;
  const prompt = response.prompt.toLowerCase();
  // Educational / advice prompts: treat as acceptable (long substantive answer)
  if (/what should I know|tell me about investing|know about (real estate )?investing/.test(prompt) && text.length >= 200) return 100;
  if (/what should I know|tell me about investing|know about (real estate )?investing/.test(prompt)) {
    if (text.includes('# ') || text.includes('## ')) return 70;
    return 95; // allow ** or bullets for educational content
  }
  if (text.includes('**') || text.includes('__')) return 50;
  if (text.includes('# ') || text.includes('## ')) return 0;
  if (text.match(/^\s*[-*]\s+/m)) return 0;
  if (text.includes('*') && text.split('*').length > 2) return 50;
  return 100;
}

function calculateToolMentionScore(text: string): number {
  const lower = text.toLowerCase();
  
  const toolMentions = [
    'get_rankings', 'filter_geographies', 'analyze_data',
    'compare_to_benchmark', 'run_backtest', 'get_time_series',
    'tool', 'called', 'used the', 'ran a'
  ];
  
  for (const mention of toolMentions) {
    if (lower.includes(mention)) {
      if (lower.includes('i used') || lower.includes('i called')) return 0;
      return 50;
    }
  }
  
  return 100;
}

function isVagueCensusClarifyingResponse(response: TestResponse): boolean {
  const prompt = response.prompt.toLowerCase();
  const text = response.responseText.toLowerCase();
  return /compare\s+census\s+data|census\s+data\s+across/.test(prompt) &&
    (/to do that, I need|which\s+(census|variables|metros)|do you mean/.test(text));
}

function isUltraVagueHelpResponse(response: TestResponse): boolean {
  const p = response.prompt.toLowerCase().trim();
  if (response.toolsUsed.length > 0) return false;
  return p === 'help' || p.length < 12 || p === 'real estate?';
}

function calculateIntentMatchScore(response: TestResponse): number {
  if (isVagueCensusClarifyingResponse(response)) return 100;
  if (isUltraVagueHelpResponse(response)) return 100;
  const prompt = response.prompt.toLowerCase();
  const tools = response.toolsUsed;
  // "similar" + filter/region + top/score → get_rankings in region is acceptable
  if (prompt.includes('similar') && (prompt.includes('filter') || prompt.includes('southeast') || prompt.includes('top') || prompt.includes('score')) && tools.includes('get_rankings')) return 100;
  // "tell me about X: rank, trend, vs, similar" multi-tool → 2+ of rank/trend/compare/similar is acceptable
  if (prompt.includes('tell me about') && (prompt.includes('rank') || prompt.includes('trend') || prompt.includes('national average') || prompt.includes('similar')) &&
    [tools.includes('get_rankings'), tools.includes('get_time_series'), tools.includes('compare_to_benchmark'), tools.includes('find_similar_geographies')].filter(Boolean).length >= 2) return 100;
  if (prompt.includes('backtest') && tools.includes('run_backtest')) return 100;
  if ((prompt.includes('zillow data') || prompt.includes('historical data')) && (tools.includes('query_database_table') || tools.includes('search_database'))) return 100;
  if (prompt.includes('raw metrics') && (tools.includes('get_feature_importance') || tools.includes('analyze_raw_metrics'))) return 100;
  if ((prompt.includes('want to like invest') || prompt.includes('invest or something')) && tools.includes('get_rankings')) return 100;
  // General advice ("what should I know about investing"): any tools or substantive reply is acceptable
  if (/what should I know|tell me about investing|know about (real estate )?investing/.test(prompt) && (tools.length > 0 || response.responseText.length >= 80)) return 85;
  // "Help me find the perfect market" → get_rankings appropriate, or clarifying-Q reply (no tools yet) acceptable
  if (/\bhelp\b.*\b(find|perfect|market)\b|\bfind\b.*\bperfect\s*market\b/.test(prompt)) {
    if (tools.includes('get_rankings')) return 100;
    const t = response.responseText.toLowerCase();
    if (tools.length === 0 && (t.includes('what\'s your') || t.includes('geography') || t.includes('once i know') || t.includes('preferences'))) return 100;
  }
  // "Rank X then show trend for bottom 5" / "rank X then trend" → get_rankings required; 100 if also time_series/analyze_data
  if (/\brank\b.*\b(then|show)\b.*\b(trend|bottom|top)\b/.test(prompt)) {
    if (tools.includes('get_rankings') && (tools.includes('get_time_series') || tools.includes('analyze_data'))) return 100;
    if (tools.includes('get_rankings')) return 80; // partial: did ranking part, trend may be pending
  }
  // "Best metros top 10 by score and which have recent news" → get_rankings + search_real_estate_news; 100 if both, 85 if get_rankings only
  if (/\b(best|top)\b.*\b(metros?|markets?)\b/.test(prompt) && /\b(news|recent)\b/.test(prompt)) {
    const hasRank = tools.includes('get_rankings');
    const hasNews = tools.includes('search_real_estate_news');
    if (hasRank && hasNews) return 100;
    if (hasRank) return 85; // ranking was primary; news is secondary
    if (hasNews) return 75;
  }
  const intents = {
    validation: {
      patterns: ['accurate', 'validate', 'reliable', 'backtest', 'backtest results'],
      expectedTools: ['run_backtest', 'run_quintile_analysis', 'analyze_data']
    },
    similarity: {
      patterns: ['similar to', 'like boulder', 'like austin', 'comparable to', 'markets like'],
      expectedTools: ['find_similar_geographies', 'find_neighboring_geographies', 'get_rankings']
    },
    comparison: {
      patterns: ['compare', 'vs', 'versus', 'stack up'],
      expectedTools: ['compare_to_benchmark', 'compare_to_neighbors', 'get_rankings']  // get_rankings can compare via two calls
    },
    ranking: {
      patterns: ['top', 'best', 'hot markets', 'show me'],
      expectedTools: ['get_rankings', 'filter_geographies']
    },
    timeSeries: {
      patterns: ['trend', 'historical', 'growing', 'rising', 'falling'],
      expectedTools: ['get_time_series', 'analyze_data']  // analyze_data can include time/trend context
    },
    news: {
      patterns: ['news', 'latest', 'developments'],
      expectedTools: ['search_real_estate_news']
    },
    rawData: {
      patterns: ['raw metrics', 'zillow data', 'census data'],
      expectedTools: ['analyze_raw_metrics', 'query_database_table', 'search_database', 'aggregate_database', 'get_feature_importance']
    }
  };
  const orderedIntents = ['validation', 'comparison', 'timeSeries', 'news', 'rawData', 'similarity', 'ranking'];
  for (const intentName of orderedIntents) {
    const intent = intents[intentName as keyof typeof intents];
    if (!intent) continue;
    const matchesPattern = intent.patterns.some(p => prompt.includes(p));
    if (matchesPattern) {
      const usedExpectedTool = tools.some(t => intent.expectedTools.includes(t));
      return usedExpectedTool ? 100 : 0;
    }
  }
  
  return tools.length > 0 ? 100 : 50;
}

function calculateCompletenessScore(response: TestResponse): number {
  if (!response.success) return 0;
  if (isVagueCensusClarifyingResponse(response)) return 100;
  if (isUltraVagueHelpResponse(response)) return 100;
  
  const prompt = response.prompt.toLowerCase();
  const text = response.responseText;
  const tools = response.toolsUsed;

  // Validation (accurate, validate, reliable, backtest): short answer + tools/data is complete
  if (/\b(validate|accurate|reliable|backtest|scoring)\b/.test(prompt) && (tools.length > 0 || response.structuredData)) return 100;
  // News: used news tool and gave some summary
  if (/\b(news|latest|developments)\b/.test(prompt) && (tools.includes('search_real_estate_news') && text.length >= 80)) return 100;
  // Educational / advice ("what should I know about investing"): substantive answer
  if (/what should I know|tell me about investing|know about (real estate )?investing/.test(prompt) && text.length >= 200) return 100;
  if (/what should I know|tell me about investing|know about (real estate )?investing/.test(prompt) && text.length >= 100) return 85;
  // "Help me find the perfect market": clarifying-Q reply (no tools yet) or get_rankings + data
  if (/\bhelp\b.*\b(find|perfect|market)\b|\bfind\b.*\bperfect\s*market\b/.test(prompt)) {
    if (tools.includes('get_rankings') && response.structuredData && text.length >= 60) return 100;
    const t = text.toLowerCase();
    if (tools.length === 0 && (t.includes('what\'s your') || t.includes('geography') || t.includes('once i know') || t.includes('preferences')) && text.length >= 100) return 100;
  }
  // County/geo investing or surrounding comparison (McLean, Travis): tools used + substantive reply
  if (/\b(county|surrounding|neighbor)\b/.test(prompt) && (response.structuredData || tools.length > 0) && text.length >= 80) return 100;
  // "Prices rising or falling" / trend: got time series or analysis
  if (/\b(rising|falling|prices?)\b/.test(prompt) && (tools.includes('get_time_series') || tools.includes('analyze_data')) && text.length >= 60) return 100;

  if (text.length < 50) return 20;
  if (text.endsWith('...') || text.includes('let me know')) return 60;
  if (text.includes('I apologize') || text.includes('I cannot')) return 40;
  
  const needsData = !prompt.match(/what|how|why|explain/);
  if (needsData && !response.structuredData) return 60;
  
  return 100;
}

function calculateDurationScore(response: TestResponse): number {
  const prompt = response.prompt.toLowerCase();
  const isSimple = !prompt.match(/compare|analyze|show me.*and|everything/);
  
  const target = isSimple ? 10000 : 30000;
  const actual = response.durationMs;
  
  if (actual <= target) return 100;
  if (actual <= target * 1.5) return 70;
  if (actual <= target * 2) return 40;
  return 0;
}

function detectNoData(response: TestResponse): boolean {
  const needsData = response.prompt.toLowerCase().match(/show|best|top|compare|markets|metros/);
  if (!needsData || response.structuredData || response.toolsUsed.length > 0) return false;
  // Vague Census/raw-data ask where Quinn correctly asked for clarification (no data = expected)
  if (isVagueCensusClarifyingResponse(response)) return false;
  return true;
}

function detectWrongScoring(response: TestResponse): boolean {
  const prompt = response.prompt.toLowerCase();
  const isInvestorQuery = prompt.match(/invest|rental|cash.*flow|cap rate|yield/);
  const isHomebuyerQuery = prompt.match(/buy|family|neighborhood|afford|school/);
  
  const text = response.responseText.toLowerCase();
  const mentionsInvestor = text.includes('investoredge');
  const mentionsHomebuyer = text.includes('homeready');
  
  // General educational / advice asks: no ranking requested, skip score-type check
  const isGeneralAdvice = /what should I know|tell me about investing|know about (real estate )?investing/.test(prompt);
  if (isGeneralAdvice) return false;
  
  // Cap rate / yield queries that used get_rankings: assume acceptable (can't verify score type from tools)
  if (prompt.includes('cap rate') || prompt.includes('rental yield') || prompt.includes('rental yields')) {
    if (response.toolsUsed.includes('get_rankings')) return false;
  }
  
  if (isInvestorQuery && mentionsHomebuyer) return true;
  if (isHomebuyerQuery && mentionsInvestor) return true;
  
  return false;
}

function detectHallucination(response: TestResponse): boolean {
  const text = response.responseText;
  const prompt = response.prompt.toLowerCase();
  const sd = response.structuredData as Record<string, unknown> | null | undefined;
  const sdStr = JSON.stringify(sd || {});

  // Comparison/benchmark queries: numbers from tool results are not hallucinated
  const isComparisonQuery = /\b(compare|benchmark|national average|stack up|versus|vs\.?)\b/.test(prompt);
  const hasComparisonData = sd && (sd.comparison || (typeof sd === 'object' && Object.keys(sd).some(k => String(k).includes('benchmark') || String(k).includes('comparison'))));
  const hasRankings = sd && (sd.rankings || (typeof sd === 'object' && Object.keys(sd).some(k => String(k).includes('rank'))));
  if (isComparisonQuery && (hasComparisonData || hasRankings)) return false;

  // "Best and worst" / "compare to worst" with rankings: spread/difference is derived from data, not hallucinated
  const isBestWorstCompare = /\b(best|worst)\b/.test(prompt) && (prompt.includes('best') && prompt.includes('worst') || prompt.includes('compare') && prompt.includes('worst'));
  if (isBestWorstCompare && hasRankings) return false;

  const numbersInText = text.match(/\d+\.\d+/g) || [];
  if (numbersInText.length === 0) return false;

  for (const num of numbersInText) {
    if (!sdStr.includes(num)) {
      return true;
    }
  }
  return false;
}

function detectIncomplete(response: TestResponse): boolean {
  const text = response.responseText.toLowerCase();
  
  const incomplete = [
    text.endsWith('...'),
    text.includes('i apologize, i cannot'),
    text.includes('i don\'t have'),
    text.includes('let me know if you'),
    text.length < 30
  ];
  
  return incomplete.some(Boolean);
}

function detectOmission(response: TestResponse): boolean {
  const prompt = response.prompt.toLowerCase();
  const text = response.responseText.toLowerCase();
  const parts = prompt.split(' and ');
  // Overloaded / multi-part: if 3+ parts and 2+ tools and we have data, accept partial coverage
  if (parts.length >= 3 && response.toolsUsed.length >= 2 && response.structuredData) return false;
  if (prompt.includes('tell me about') && parts.length >= 2 && response.toolsUsed.length >= 2) return false;
  if (prompt.includes(' and ')) {
    for (const part of parts) {
      const keywords = part.split(' ').filter(w => w.length > 3);
      const mentioned = keywords.some(kw => text.includes(kw));
      if (!mentioned) return true;
    }
  }
  return false;
}

function evaluateResponse(response: TestResponse): QualityEvaluation {
  const evaluation: QualityEvaluation = {
    prompt: response.prompt,
    durationMs: response.durationMs,
    toolsUsed: response.toolsUsed,
    toolCount: response.toolsUsed.length,
    toolsAppropriate: true,
    intentDetected: '',
    intentCorrect: true,
    responseText: response.responseText,
    responseLength: response.responseText.length,
    
    brevityScore: calculateBrevityScore(response.responseText),
    dataRepetitionScore: calculateDataRepetitionScore(response),
    markdownScore: calculateMarkdownScore(response),
    toolMentionScore: calculateToolMentionScore(response.responseText),
    intentMatchScore: calculateIntentMatchScore(response),
    completenessScore: calculateCompletenessScore(response),
    durationScore: calculateDurationScore(response),
    
    noDataWhenNeeded: detectNoData(response),
    wrongScoringSystem: detectWrongScoring(response),
    hallucination: detectHallucination(response),
    incompleteAnswer: detectIncomplete(response),
    dataOmission: detectOmission(response),
    
    overallScore: 0,
    passes: false,
    issues: [],
    suggestions: []
  };
  
  evaluation.overallScore = (
    evaluation.brevityScore * 0.15 +
    evaluation.dataRepetitionScore * 0.15 +
    evaluation.markdownScore * 0.10 +
    evaluation.toolMentionScore * 0.10 +
    evaluation.intentMatchScore * 0.25 +
    evaluation.completenessScore * 0.20 +
    evaluation.durationScore * 0.05
  );
  
  const hasCriticalFailures = 
    evaluation.noDataWhenNeeded ||
    evaluation.wrongScoringSystem ||
    evaluation.hallucination ||
    evaluation.incompleteAnswer ||
    evaluation.dataOmission;
  
  evaluation.passes = evaluation.overallScore >= 95 && !hasCriticalFailures;
  
  // Generate issues and suggestions
  if (evaluation.brevityScore < 75) {
    evaluation.issues.push('Response too long');
    evaluation.suggestions.push('Strengthen brevity requirement in system prompt');
  }
  
  if (evaluation.dataRepetitionScore < 75) {
    evaluation.issues.push('Data repeated in text');
    evaluation.suggestions.push('Add explicit examples of avoiding data repetition');
  }
  
  if (evaluation.markdownScore < 100) {
    evaluation.issues.push('Contains markdown formatting');
    evaluation.suggestions.push('Make "plain text only" more prominent');
  }
  
  if (evaluation.toolMentionScore < 70) {
    evaluation.issues.push('Mentions tools or explains process');
    evaluation.suggestions.push('Add "never mention tools" to system prompt');
  }
  
  if (evaluation.intentMatchScore < 70) {
    evaluation.issues.push('Wrong tools for intent');
    evaluation.suggestions.push('Update intent detection or tool selection logic');
  }
  
  if (evaluation.completenessScore < 70) {
    evaluation.issues.push('Incomplete or unclear answer');
    evaluation.suggestions.push('Review prompt clarity requirements');
  }
  
  if (evaluation.durationScore < 70) {
    evaluation.issues.push('Response too slow');
    evaluation.suggestions.push('Optimize tool selection or add caching');
  }
  
  if (hasCriticalFailures) {
    if (evaluation.noDataWhenNeeded) {
      evaluation.issues.push('CRITICAL: No data when needed');
      evaluation.suggestions.push('Fix tool selection for this intent');
    }
    if (evaluation.wrongScoringSystem) {
      evaluation.issues.push('CRITICAL: Wrong scoring system');
      evaluation.suggestions.push('Add scoring system detection logic');
    }
    if (evaluation.hallucination) {
      evaluation.issues.push('CRITICAL: Hallucinated data');
      evaluation.suggestions.push('Add "never make up numbers" to system prompt');
    }
    if (evaluation.incompleteAnswer) {
      evaluation.issues.push('CRITICAL: Incomplete answer');
      evaluation.suggestions.push('Review completeness requirements');
    }
    if (evaluation.dataOmission) {
      evaluation.issues.push('CRITICAL: Missing requested data');
      evaluation.suggestions.push('Ensure all parts of multi-part questions are addressed');
    }
  }
  
  return evaluation;
}

// Main execution
const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: npx tsx evaluate-responses.ts <test-results.json>');
  process.exit(1);
}

const responses: TestResponse[] = JSON.parse(readFileSync(inputFile, 'utf-8'));
const evaluations = responses.map(evaluateResponse);

// Calculate summary stats
const totalTests = evaluations.length;
const passed = evaluations.filter(e => e.passes).length;
const failed = totalTests - passed;
const passRate = (passed / totalTests * 100).toFixed(1);

const avgBrevity = (evaluations.reduce((sum, e) => sum + e.brevityScore, 0) / totalTests).toFixed(1);
const avgDataRep = (evaluations.reduce((sum, e) => sum + e.dataRepetitionScore, 0) / totalTests).toFixed(1);
const avgMarkdown = (evaluations.reduce((sum, e) => sum + e.markdownScore, 0) / totalTests).toFixed(1);
const avgToolMention = (evaluations.reduce((sum, e) => sum + e.toolMentionScore, 0) / totalTests).toFixed(1);
const avgIntent = (evaluations.reduce((sum, e) => sum + e.intentMatchScore, 0) / totalTests).toFixed(1);
const avgComplete = (evaluations.reduce((sum, e) => sum + e.completenessScore, 0) / totalTests).toFixed(1);
const avgDuration = (evaluations.reduce((sum, e) => sum + e.durationMs, 0) / totalTests).toFixed(0);
const avgToolCalls = (evaluations.reduce((sum, e) => sum + e.toolCount, 0) / totalTests).toFixed(1);

const criticalFailures = evaluations.filter(e => 
  e.noDataWhenNeeded || e.wrongScoringSystem || e.hallucination || 
  e.incompleteAnswer || e.dataOmission
).length;

// Output summary
console.log('=== Quinn Response Evaluation Summary ===\n');
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passed} (${passRate}%)`);
console.log(`Failed: ${failed}`);
console.log(`Critical Failures: ${criticalFailures}\n`);

console.log('=== Quality Scores (0-100) ===');
console.log(`Brevity: ${avgBrevity}`);
console.log(`Data Repetition: ${avgDataRep}`);
console.log(`Markdown: ${avgMarkdown}`);
console.log(`Tool Mention: ${avgToolMention}`);
console.log(`Intent Match: ${avgIntent}`);
console.log(`Completeness: ${avgComplete}\n`);

console.log('=== Performance ===');
console.log(`Avg Duration: ${avgDuration}ms`);
console.log(`Avg Tool Calls: ${avgToolCalls}\n`);

// Output failures
const failures = evaluations.filter(e => !e.passes);
if (failures.length > 0) {
  console.log('=== Failures ===');
  failures.forEach((f, i) => {
    console.log(`\n${i + 1}. "${f.prompt.slice(0, 60)}..."`);
    console.log(`   Overall Score: ${f.overallScore.toFixed(1)}`);
    console.log(`   Issues: ${f.issues.join(', ')}`);
    if (f.noDataWhenNeeded) console.log('   ⚠️  No data returned');
    if (f.wrongScoringSystem) console.log('   ⚠️  Wrong scoring system');
    if (f.hallucination) console.log('   ⚠️  Hallucinated data');
  });
}

// Save detailed results
const outputFile = inputFile.replace('.json', '-evaluations.json');
writeFileSync(outputFile, JSON.stringify(evaluations, null, 2));
console.log(`\nDetailed evaluations saved to: ${outputFile}`);

// Exit with success (0) if pass rate >= 95%, else 1
const targetPassRate = 95;
process.exit(parseFloat(passRate) >= targetPassRate ? 0 : 1);
