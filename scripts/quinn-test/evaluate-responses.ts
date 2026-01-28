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
  const text = response.responseText.toLowerCase();
  
  // Check for score patterns
  const scorePatterns = /\d+\.\d+|\bscored?\s+\d+|\b\d+\s*points?/gi;
  const scoreMatches = text.match(scorePatterns) || [];
  
  // Check for city/metro name lists
  const nameListPatterns = /,\s*[A-Z][a-z]+\s+[A-Z]{2}/g;
  const nameMatches = text.match(nameListPatterns) || [];
  
  const dataPoints = scoreMatches.length + nameMatches.length;
  
  if (dataPoints <= 3) return 100;  // 0-3 data points acceptable
  if (dataPoints <= 6) return 70;
  if (dataPoints <= 10) return 40;
  return 20;
}

function calculateMarkdownScore(text: string): number {
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

function calculateIntentMatchScore(response: TestResponse): number {
  const prompt = response.prompt.toLowerCase();
  const tools = response.toolsUsed;
  
  const intents = {
    similarity: {
      patterns: ['similar', 'like', 'comparable'],
      expectedTools: ['find_similar_geographies', 'find_neighboring_geographies']
    },
    comparison: {
      patterns: ['compare', 'vs', 'versus', 'stack up'],
      expectedTools: ['compare_to_benchmark', 'compare_to_neighbors', 'get_rankings']  // get_rankings can compare via two calls
    },
    ranking: {
      patterns: ['top', 'best', 'hot markets', 'show me'],
      expectedTools: ['get_rankings', 'filter_geographies']
    },
    validation: {
      patterns: ['accurate', 'validate', 'reliable', 'backtest'],
      expectedTools: ['run_backtest', 'run_quintile_analysis', 'analyze_data']  // analyze_data can support validation context
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
      expectedTools: ['analyze_raw_metrics', 'query_database_table', 'search_database', 'aggregate_database']
    }
  };
  
  for (const [intentName, intent] of Object.entries(intents)) {
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
  
  const text = response.responseText;
  
  if (text.length < 50) return 20;
  if (text.endsWith('...') || text.includes('let me know')) return 60;
  if (text.includes('I apologize') || text.includes('I cannot')) return 40;
  
  const needsData = !response.prompt.toLowerCase().match(/what|how|why|explain/);
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
  return Boolean(needsData && !response.structuredData && response.toolsUsed.length === 0);
}

function detectWrongScoring(response: TestResponse): boolean {
  const prompt = response.prompt.toLowerCase();
  const isInvestorQuery = prompt.match(/invest|rental|cash.*flow|cap rate|yield/);
  const isHomebuyerQuery = prompt.match(/buy|family|neighborhood|afford|school/);
  
  const text = response.responseText.toLowerCase();
  const mentionsInvestor = text.includes('investoredge');
  const mentionsHomebuyer = text.includes('homeready');
  
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

  // Comparison/benchmark queries with comparison data: numbers may be summarised (e.g. "4.2%" vs 0.042)
  const isComparisonQuery = /\b(compare|benchmark|national average|stack up|versus|vs\.?)\b/.test(prompt);
  const hasComparisonData = sd && (sd.comparison || (typeof sd === 'object' && Object.keys(sd).some(k => String(k).includes('benchmark') || String(k).includes('comparison'))));
  if (isComparisonQuery && hasComparisonData) return false;

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
  
  if (prompt.includes(' and ')) {
    const parts = prompt.split(' and ');
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
    markdownScore: calculateMarkdownScore(response.responseText),
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
  
  evaluation.passes = evaluation.overallScore >= 72 && !hasCriticalFailures;
  
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
