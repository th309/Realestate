# Quinn Self-Testing & Optimization Skill

## Purpose
Autonomously test, evaluate, and optimize Quinn (PropertyIQ's real estate analytics chatbot) by running comprehensive test suites, analyzing failures, proposing fixes, and iterating until quality targets are met.

## When to Use
Trigger this skill when the user says:
- "optimize Quinn"
- "test Quinn"
- "improve Quinn's responses"
- "run Quinn tests"
- "fix Quinn"

## Quinn Architecture Context

### System Components
- **Backend**: Node.js/NestJS service at `packages/backend/src/analytics-chat/`
- **Analytics Service**: Python FastAPI at `packages/propertyiq-analytics/` (pandas, scikit-learn, statsmodels)
- **System Prompt**: `packages/backend/src/analytics-chat/quinn-system-prompt.ts` (exported as `QUINN_BASE_SYSTEM_PROMPT`)
- **Tool Selection**: `packages/backend/src/analytics-chat/analytics-chat.service.ts` (`getQueryIntent()` and `getRelevantTools()`)
- **Test Runner**: `scripts/quinn-test/run-iterative.ts`
- **Deployment**: Railway (production environment)

### Quinn's 27 Tools (by category)

**Ad hoc / cached tools:**
- `get_available_filters` - Metadata for filter options
- `filter_geographies` - Filter scored data by geography/state/score range
- `analyze_data` - Summary stats, correlations, top/bottom performers
- `compare_to_benchmark` - Compare to national/regional benchmarks
- `get_rankings` - Rank geographies by score or appreciation
- `get_time_series` - Historical time series for a geography

**Advanced ML / analysis:**
- `run_regression` - Regression analysis
- `get_feature_importance` - Feature importance (RF/GBR)
- `cluster_markets` - K-means clustering
- `optimize_weights` - Optimize score-component weights
- `generate_chart` - Plotly charts

**Raw metrics:**
- `analyze_raw_metrics` - Raw Zillow/Realtor/Census/Economic data
- `get_raw_metric_summary` - List available raw metrics

**Backtest / validation:**
- `run_backtest` - Full backtest with quintile validation
- `run_quintile_analysis` - Single score/horizon quintile analysis
- `compare_formulas` - 3-formula vs 9-formula comparison

**Database query:**
- `get_database_tables` - List tables
- `describe_database_table` - Schema and sample
- `query_database_table` - Query with filters
- `search_database` - Text search across tables
- `aggregate_database` - COUNT/SUM/AVG/MIN/MAX
- `get_database_summary` - High-level DB summary

**News:**
- `search_real_estate_news` - Search news by query/geography/date
- `analyze_news_impact` - Impact of news on geography

**Geography relationships:**
- `find_neighboring_geographies` - Find neighbors
- `compare_to_neighbors` - Compare to neighbors
- `find_similar_geographies` - Find similar geographies

### Scoring Systems
- **InvestorEdge**: For investors (cash-on-cash, cap rates, rental yields)
- **HomeReady**: For homebuyers (affordability, neighborhoods, family-friendly)
- **Market Health Index**: General market health indicator

All scores: **higher is better**.

### Geographic Levels
- State
- Metro/CBSA
- County
- Zip
- City (some data available)

## Quality Standards

### Excellent Response Characteristics
1. **Brevity**: 1-3 sentences maximum (exception: market overview — see below)
2. **No data repetition**: Let UI display tables/charts
3. **No markdown**: Plain text only (no bold, bullets, headers)
4. **No tool mentions**: Don't explain which tools were used
5. **Intent-matched**: Use correct tools for user's actual question
6. **Outcome-focused**: Insights and synthesis, not methodology

### Market overview / "Tell me about [geo]"
For queries like "tell me about Tulsa, OK" or "overview of the Austin market":
- **Data**: Use the last **24 months** of **all relevant data elements** (scores, appreciation; optionally population, income, permits where available). Call get_time_series with months: 24 and metrics including investoredge_score, homeready_score, market_health_score, appreciation_12m. Optionally analyze_data (filter to that geo's state/scope, horizons [12, 36]) and/or query_database_table for richer stats.
- **Response**: Deliver an **analytical overview** — 3–5 sentences that interpret the data (where it ranks, 24-month trend, vs national, what it means for the market). Do not list raw data points; interpret them (e.g. "steady appreciation", "above national on growth"). The UI shows tables/charts; Quinn's text should synthesize, not repeat.
- **Quality check**: Pass = 24 months of data used + narrative overview; fail = only a table + one intro sentence with no analysis.

### Critical Failures (must fix immediately)
1. **No data returned when data is needed**
2. **Wrong scoring system used** (InvestorEdge vs HomeReady)
3. **Hallucinating data** (making up numbers/facts)
4. **Incomplete answers** (stopping before question is answered)
5. **Data omission** (leaving out requested information)
6. **Wrong intent detection** (ranking when user wants comparison/similarity)

### Performance Targets
- **Simple queries**: < 10 seconds
- **Complex queries**: < 30 seconds
- **Tool calls**: 2-3 maximum per query
- **Pass rate**: 95%+ on test suite

## Optimization Workflow

### Phase 1: Generate Comprehensive Test Suite

Create a test prompt file covering all user types and intents:

```typescript
// Generate: scripts/quinn-test/comprehensive-prompts.txt

// HOMEBUYER QUESTIONS (HomeReady scoring)
Where should I buy in Austin?
Are prices dropping in Phoenix?
Best family neighborhoods in Dallas?
Is it a good time to buy in Denver?
What's the most affordable metro in Texas?
Compare Houston to San Antonio for first-time buyers

// INVESTOR QUESTIONS (InvestorEdge scoring)
Which markets have the best cash-on-cash returns?
Show me high-growth + positive cash flow markets
Compare cap rates across Texas metros
Hot markets for rental properties
Best rental yields in Florida
Which metros have appreciation potential?

// GENERAL MARKET QUESTIONS
What's happening in the housing market?
Hot markets right now
Show me top metros
Tell me about Austin
How does Miami compare to the national average?

// GEOGRAPHIC LEVEL TESTS
Best states for investing
Top counties in California
Compare zip codes in Seattle metro
Show me cities similar to Boulder

// COMPARISON & ANALYSIS
Compare Austin to Nashville
How does Phoenix stack up against Las Vegas?
What markets are similar to Raleigh?
Show me neighbors of Portland OR

// VALIDATION & BACKTESTING
How accurate is InvestorEdge?
Validate HomeReady scores
Show me backtest results

// TIME SERIES & TRENDS
What's the trend in Austin prices?
Show me historical data for Miami
Has Denver been growing?

// FILTERING & RANKING
Best metros in Texas for investors
Top 20 markets by appreciation
Show me high-scoring counties in the Midwest
Filter for positive cash flow markets

// NEWS & CURRENT EVENTS
What's the latest news about Austin real estate?
Any major developments in Phoenix market?
Real estate news in Florida

// RAW DATA & METRICS
What raw metrics predict appreciation?
Show me Zillow data for Austin
Compare Census data across metros

// EDGE CASES
Tell me everything about Austin
What should I know about investing in real estate?
Help me find the perfect market
```

### Phase 2: Run Initial Baseline Tests

Execute the test runner and capture comprehensive results:

```bash
# Set backend URL from .env
export BACKEND_URL=$(grep BACKEND_URL .env | cut -d '=' -f2)

# Run comprehensive test suite
npx tsx scripts/quinn-test/run-iterative.ts scripts/quinn-test/comprehensive-prompts.txt > baseline-results.txt
```

**Capture for each response:**
1. Success/failure status
2. Duration (ms)
3. Tools used (array)
4. Response text (full)
5. Structured data returned
6. Error messages (if any)

### Phase 3: Evaluate Response Quality

For each test result, score on multiple dimensions:

```typescript
interface QualityEvaluation {
  prompt: string;
  
  // Performance metrics
  durationMs: number;
  durationScore: number; // 0-100
  
  // Tool usage
  toolsUsed: string[];
  toolCount: number;
  toolsAppropriate: boolean;
  intentDetected: string;
  intentCorrect: boolean;
  
  // Response quality
  responseText: string;
  responseLength: number;
  
  // Quality checks (each 0-100)
  brevityScore: number;        // Is it 1-3 sentences?
  dataRepetitionScore: number; // Does it avoid repeating table data?
  markdownScore: number;       // Is it plain text only?
  toolMentionScore: number;    // Does it avoid mentioning tools?
  intentMatchScore: number;    // Does it match user's actual intent?
  completenessScore: number;   // Is the answer complete?
  
  // Critical failures (boolean)
  noDataWhenNeeded: boolean;
  wrongScoringSystem: boolean;
  hallucination: boolean;
  incompleteAnswer: boolean;
  dataOmission: boolean;
  
  // Overall
  overallScore: number; // 0-100 weighted average
  passes: boolean;      // true if overallScore >= 80 and no critical failures
  issues: string[];     // List of problems found
  suggestions: string[]; // Specific fix recommendations
}
```

**Evaluation Rules:**

1. **Brevity Score (0-100)**:
   - 1-3 sentences: 100
   - 4-5 sentences: 70
   - 6-10 sentences: 40
   - 10+ sentences: 0

2. **Data Repetition Score (0-100)**:
   - No scores/names/numbers in text: 100
   - 1-2 data points mentioned: 70
   - 3-5 data points: 40
   - Lists multiple scores/rankings: 0

3. **Markdown Score (0-100)**:
   - Plain text only: 100
   - Contains bold/italics: 50
   - Contains headers/bullets: 0

4. **Tool Mention Score (0-100)**:
   - No tool names mentioned: 100
   - Mentions 1 tool: 50
   - Explains tool usage: 0

5. **Intent Match Score (0-100)**:
   - Tools match user intent: 100
   - Partially correct tools: 50
   - Wrong tools (e.g., ranking when user wants similarity): 0

6. **Completeness Score (0-100)**:
   - Fully answers question: 100
   - Partial answer: 60
   - Stops mid-response: 20
   - No answer provided: 0

7. **Duration Score (0-100)**:
   - Simple query < 10s: 100
   - Complex query < 30s: 100
   - Over target by 1-2x: 50
   - Over target by 2x+: 0

8. **Critical Failure Detection**:
   - Check if data tools were needed but not used
   - Detect mentions of wrong scoring system (InvestorEdge for homebuyer questions)
   - Check for specific numbers not in structured data (hallucination)
   - Verify answer addresses the question posed

**Overall Score Calculation:**
```
overallScore = (
  brevityScore * 0.15 +
  dataRepetitionScore * 0.15 +
  markdownScore * 0.10 +
  toolMentionScore * 0.10 +
  intentMatchScore * 0.25 +
  completenessScore * 0.20 +
  durationScore * 0.05
)

passes = (overallScore >= 80) && !hasCriticalFailures
```

### Phase 4: Analyze Failure Patterns

Group failures by root cause:

```typescript
interface FailurePattern {
  category: string;
  count: number;
  examples: string[];
  affectedPrompts: string[];
  rootCause: string;
  suggestedFix: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}
```

**Common Pattern Categories:**

1. **Intent Detection Failures**
   - Root cause: `getQueryIntent()` regex not catching keywords
   - Fix: Update intent detection in `analytics-chat.service.ts`

2. **Tool Selection Failures**
   - Root cause: `getRelevantTools()` returning wrong subset
   - Fix: Update tool filtering logic in switch statement

3. **Response Length Issues**
   - Root cause: System prompt not emphasizing brevity enough
   - Fix: Strengthen brevity instructions in `QUINN_BASE_SYSTEM_PROMPT`

4. **Data Repetition**
   - Root cause: Prompt doesn't clearly forbid listing data
   - Fix: Add explicit examples of what NOT to do

5. **Markdown Formatting**
   - Root cause: Conflicting instructions or not strong enough
   - Fix: Make "NEVER use markdown" more prominent

6. **Wrong Scoring System**
   - Root cause: Profile detection not working or ambiguous query
   - Fix: Add scoring system selection logic to system prompt

7. **Performance Issues**
   - Root cause: Too many tool calls or inefficient queries
   - Fix: Optimize tool descriptions, add caching hints

### Phase 5: Generate and Apply Fixes

For each high-priority failure pattern, generate a specific fix:

**Example Fix Types:**

1. **System Prompt Updates** (`quinn-system-prompt.ts`):
```typescript
// BEFORE
"Keep responses concise."

// AFTER
"CRITICAL: Keep responses to 1-3 sentences maximum. 
Longer responses score poorly. 
One context sentence + outcome is ideal."
```

2. **Intent Detection Updates** (`analytics-chat.service.ts`):
```typescript
// Add to getQueryIntent()
if (lower.match(/similar|like|comparable/)) {
  return 'geography'; // Use find_similar_geographies
}
```

3. **Tool Selection Updates** (`analytics-chat.service.ts`):
```typescript
// In getRelevantTools() switch
case 'geography':
  return allTools.filter(t => 
    ['find_similar_geographies', 
     'find_neighboring_geographies',
     'compare_to_neighbors'].includes(t.name)
  );
```

4. **Tool Description Updates** (`analytics-tools.service.ts`):
```typescript
// Make descriptions more directive
{
  name: 'get_rankings',
  description: 'Get ranked list of geographies. 
    RETURN ONLY structured data - do not list scores in text response.
    Let UI display the table.'
}
```

**Fix Application Process:**

1. **Create git branch**: `git checkout -b quinn-optimization-iteration-N`
2. **Apply fix**: Modify the relevant file(s) under `packages/backend/`
3. **Force backend rebuild** (if deploying to Railway): In `packages/backend/src/analytics-chat/quinn-system-prompt.ts`, update the top JSDoc `Last trigger:` line (e.g. date or `iterN`). Railway rebuilds only when `packages/backend/**` changes; this ensures the push triggers a rebuild.
4. **Commit and push** backend changes. Wait **~5 minutes** for Railway to rebuild.
5. **Run subset test**: Test 10 prompts that previously failed (or full suite)
6. **If full test passes**: Keep changes
7. **If regression detected**: Rollback and try alternative fix

Only backend file changes trigger a rebuild; changes under `scripts/quinn-test/` do not.

### Phase 6: Validate and Iterate

After each fix application:

```typescript
interface IterationResult {
  iteration: number;
  timestamp: string;
  
  // Test results
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  
  // Performance
  avgDurationMs: number;
  avgToolCalls: number;
  
  // Quality metrics
  avgBrevityScore: number;
  avgCompleteness: number;
  avgIntentMatch: number;
  
  // Changes made
  filesModified: string[];
  changeDescription: string;
  tokenUsageChange: number; // percentage
  
  // Comparison to baseline
  improvementVsBaseline: number;
  regressions: string[];
  
  // Next steps
  continueOptimizing: boolean;
  reason: string;
}
```

**Stopping Criteria:**

1. **Success**: Pass rate >= 95% with no critical failures
2. **Plateau**: No improvement for 3 consecutive iterations
3. **Regression**: Pass rate drops below baseline
4. **Token Limit**: Proposed change increases tokens > 25%
5. **Max Iterations**: 20 iterations completed

### Phase 7: Generate Report

Create comprehensive optimization report:

```markdown
# Quinn Optimization Report
Generated: [timestamp]

## Summary
- **Iterations**: 5
- **Final Pass Rate**: 96.7% (58/60 tests passed)
- **Improvement**: +23.4% from baseline (73.3% → 96.7%)
- **Avg Response Time**: 8.2s (was 12.7s, -35%)
- **Avg Tool Calls**: 2.1 (was 3.4, -38%)

## Changes Applied

### Iteration 1: Intent Detection for Similarity Queries
**Files**: `packages/backend/src/analytics-chat/analytics-chat.service.ts`
**Issue**: 8 prompts asking for "similar markets" were getting rankings
**Fix**: Added regex for `similar|like|comparable` → 'geography' intent
**Result**: +13.3% pass rate (73.3% → 86.6%)

### Iteration 2: Brevity Enforcement
**Files**: `packages/backend/src/analytics-chat/quinn-system-prompt.ts`
**Issue**: 45% of responses were 5+ sentences
**Fix**: Added "CRITICAL: 1-3 sentences maximum" with examples
**Result**: +6.7% pass rate (86.6% → 93.3%)

### Iteration 3: Data Repetition Prevention
**Files**: `packages/backend/src/analytics-chat/quinn-system-prompt.ts`
**Issue**: 30% of responses listed scores/rankings in text
**Fix**: Added explicit "DO NOT list data values" with counter-examples
**Result**: +3.4% pass rate (93.3% → 96.7%)

## Remaining Failures (2/60)

### Test 47: "What raw metrics predict appreciation?"
- **Issue**: No data returned, should use `analyze_raw_metrics`
- **Root Cause**: Intent detected as 'analysis' but tool not in subset
- **Recommendation**: Add `analyze_raw_metrics` to 'analysis' intent tools

### Test 52: "Help me find the perfect market"
- **Issue**: Too vague, Quinn asked clarifying question (correct!) but test expected data
- **Recommendation**: Update test expectation - clarifying question is appropriate

## Performance Metrics

| Metric | Baseline | Final | Change |
|--------|----------|-------|--------|
| Pass Rate | 73.3% | 96.7% | +23.4% |
| Avg Duration | 12.7s | 8.2s | -35.4% |
| Avg Tool Calls | 3.4 | 2.1 | -38.2% |
| Brevity Score | 62.1 | 89.4 | +43.9% |
| Intent Match | 78.3 | 94.1 | +20.2% |
| Completeness | 81.2 | 95.7 | +17.9% |

## Token Usage Analysis
- **Baseline System Prompt**: ~2,100 tokens
- **Final System Prompt**: ~2,350 tokens (+11.9%)
- **Status**: ✅ Under 25% threshold

## Recommendations for Next Steps

1. **Fix Test 47**: Add `analyze_raw_metrics` to analysis intent tools
2. **Update Test 52**: Change expectation to accept clarifying questions
3. **Monitor production**: Deploy and track real user responses
4. **A/B test**: Compare optimized vs baseline on real queries
5. **Expand test suite**: Add more edge cases discovered in production

## Files Modified
- `packages/backend/src/analytics-chat/quinn-system-prompt.ts`
- `packages/backend/src/analytics-chat/analytics-chat.service.ts`

## Git History
```
quinn-optimization-iteration-1: Fix intent detection for similarity queries
quinn-optimization-iteration-2: Enforce 1-3 sentence maximum responses
quinn-optimization-iteration-3: Prevent data repetition in text responses
```
```

## Step-by-Step Execution Guide

### Step 1: Initial Setup
```bash
# Ensure you're in project root
cd [project-root]

# Verify Railway backend URL is set
echo $BACKEND_URL
# If not set, load from .env
export BACKEND_URL=$(grep BACKEND_URL .env | cut -d '=' -f2)

# Create optimization working directory
mkdir -p scripts/quinn-test/optimization-runs
cd scripts/quinn-test/optimization-runs

# Create timestamp for this run
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir $TIMESTAMP
cd $TIMESTAMP
```

### Step 2: Generate Test Suite
```bash
# Create comprehensive test prompts
cat > comprehensive-prompts.txt << 'EOF'
# HOMEBUYER QUESTIONS (HomeReady scoring)
Where should I buy in Austin?
Are prices dropping in Phoenix?
Best family neighborhoods in Dallas?
Is it a good time to buy in Denver?
What's the most affordable metro in Texas?
Compare Houston to San Antonio for first-time buyers
Are Seattle suburbs good for families?
Where can I find good schools in Atlanta?

# INVESTOR QUESTIONS (InvestorEdge scoring)
Which markets have the best cash-on-cash returns?
Show me high-growth + positive cash flow markets
Compare cap rates across Texas metros
Hot markets for rental properties
Best rental yields in Florida
Which metros have appreciation potential?
Where should I invest for passive income?
Show me markets with strong rent growth

# GENERAL MARKET QUESTIONS
What's happening in the housing market?
Hot markets right now
Show me top metros
Tell me about Austin
Tell me about Tulsa, OK
How does Miami compare to the national average?
What are the best markets overall?

# GEOGRAPHIC LEVEL TESTS
Best states for investing
Top counties in California
Compare zip codes in Seattle metro
Show me cities similar to Boulder
Best metros in the Midwest
Top 10 states by home prices

# COMPARISON & ANALYSIS
Compare Austin to Nashville
How does Phoenix stack up against Las Vegas?
What markets are similar to Raleigh?
Show me neighbors of Portland OR
Is Dallas better than Houston?
Compare Florida metros to national average

# VALIDATION & BACKTESTING
How accurate is InvestorEdge?
Validate HomeReady scores
Show me backtest results
Is the scoring reliable?

# TIME SERIES & TRENDS
What's the trend in Austin prices?
Show me historical data for Miami
Has Denver been growing?
Are prices rising or falling in Phoenix?

# FILTERING & RANKING
Best metros in Texas for investors
Top 20 markets by appreciation
Show me high-scoring counties in the Midwest
Filter for positive cash flow markets
Give me top 5 metros in California

# NEWS & CURRENT EVENTS
What's the latest news about Austin real estate?
Any major developments in Phoenix market?
Real estate news in Florida

# RAW DATA & METRICS
What raw metrics predict appreciation?
Show me Zillow data for Austin
Compare Census data across metros

# EDGE CASES
Tell me everything about Austin
What should I know about investing in real estate?
Help me find the perfect market
What's the best market?
EOF
```

### Step 3: Run Baseline Tests
```bash
# Run comprehensive test suite
npx tsx ../../run-iterative.ts comprehensive-prompts.txt | tee baseline-results.txt

# Extract baseline metrics
grep "Passed:" baseline-results.txt
grep "Avg response time:" baseline-results.txt
```

### Step 4: Analyze Each Response

For each test result, create detailed evaluation:

```typescript
// Create: evaluate-responses.ts

import { readFileSync } from 'fs';

interface TestResponse {
  prompt: string;
  success: boolean;
  durationMs: number;
  toolsUsed: string[];
  responseText: string;
  structuredData: any;
  error?: string;
}

function evaluateResponse(response: TestResponse): QualityEvaluation {
  const evaluation: QualityEvaluation = {
    prompt: response.prompt,
    durationMs: response.durationMs,
    toolsUsed: response.toolsUsed,
    toolCount: response.toolsUsed.length,
    responseText: response.responseText,
    responseLength: response.responseText.length,
    
    // Calculate scores
    brevityScore: calculateBrevityScore(response.responseText),
    dataRepetitionScore: calculateDataRepetitionScore(response),
    markdownScore: calculateMarkdownScore(response.responseText),
    toolMentionScore: calculateToolMentionScore(response.responseText),
    intentMatchScore: calculateIntentMatchScore(response),
    completenessScore: calculateCompletenessScore(response),
    durationScore: calculateDurationScore(response),
    
    // Detect critical failures
    noDataWhenNeeded: detectNoData(response),
    wrongScoringSystem: detectWrongScoring(response),
    hallucination: detectHallucination(response),
    incompleteAnswer: detectIncomplete(response),
    dataOmission: detectOmission(response),
    
    // Overall
    overallScore: 0, // calculated below
    passes: false,
    issues: [],
    suggestions: []
  };
  
  // Calculate overall score
  evaluation.overallScore = (
    evaluation.brevityScore * 0.15 +
    evaluation.dataRepetitionScore * 0.15 +
    evaluation.markdownScore * 0.10 +
    evaluation.toolMentionScore * 0.10 +
    evaluation.intentMatchScore * 0.25 +
    evaluation.completenessScore * 0.20 +
    evaluation.durationScore * 0.05
  );
  
  // Check if passes
  const hasCriticalFailures = 
    evaluation.noDataWhenNeeded ||
    evaluation.wrongScoringSystem ||
    evaluation.hallucination ||
    evaluation.incompleteAnswer ||
    evaluation.dataOmission;
  
  evaluation.passes = evaluation.overallScore >= 80 && !hasCriticalFailures;
  
  // Generate issues and suggestions
  if (evaluation.brevityScore < 70) {
    evaluation.issues.push('Response too long');
    evaluation.suggestions.push('Strengthen brevity requirement in system prompt');
  }
  
  if (evaluation.dataRepetitionScore < 70) {
    evaluation.issues.push('Data repeated in text');
    evaluation.suggestions.push('Add explicit examples of avoiding data repetition');
  }
  
  if (evaluation.markdownScore < 100) {
    evaluation.issues.push('Contains markdown formatting');
    evaluation.suggestions.push('Make "plain text only" more prominent');
  }
  
  if (evaluation.intentMatchScore < 70) {
    evaluation.issues.push('Wrong tools for intent');
    evaluation.suggestions.push('Update intent detection or tool selection logic');
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
  }
  
  return evaluation;
}

function calculateBrevityScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length <= 3) return 100;
  if (sentences.length <= 5) return 70;
  if (sentences.length <= 10) return 40;
  return 0;
}

function calculateDataRepetitionScore(response: TestResponse): number {
  const text = response.responseText.toLowerCase();
  
  // Check for score patterns like "95.2", "scored 87", etc.
  const scorePatterns = /\d+\.\d+|\bscored?\s+\d+|\b\d+\s*points?/gi;
  const scoreMatches = text.match(scorePatterns) || [];
  
  // Check for city/metro name lists
  const nameListPatterns = /,\s*[A-Z][a-z]+\s+[A-Z]{2}/g;
  const nameMatches = text.match(nameListPatterns) || [];
  
  const dataPoints = scoreMatches.length + nameMatches.length;
  
  if (dataPoints === 0) return 100;
  if (dataPoints <= 2) return 70;
  if (dataPoints <= 5) return 40;
  return 0;
}

function calculateMarkdownScore(text: string): number {
  // Check for markdown formatting
  if (text.includes('**') || text.includes('__')) return 50; // Bold
  if (text.includes('# ') || text.includes('## ')) return 0; // Headers
  if (text.match(/^\s*[-*]\s+/m)) return 0; // Bullets
  if (text.includes('*') && text.split('*').length > 2) return 50; // Italics
  return 100;
}

function calculateToolMentionScore(text: string): number {
  const lower = text.toLowerCase();
  
  // Tool names
  const toolMentions = [
    'get_rankings', 'filter_geographies', 'analyze_data',
    'compare_to_benchmark', 'run_backtest', 'get_time_series',
    'tool', 'called', 'used the', 'ran a'
  ];
  
  for (const mention of toolMentions) {
    if (lower.includes(mention)) {
      // Check if it's explaining tool usage
      if (lower.includes('i used') || lower.includes('i called')) return 0;
      return 50;
    }
  }
  
  return 100;
}

function calculateIntentMatchScore(response: TestResponse): number {
  const prompt = response.prompt.toLowerCase();
  const tools = response.toolsUsed;
  
  // Intent patterns
  const intents = {
    similarity: {
      patterns: ['similar', 'like', 'comparable'],
      expectedTools: ['find_similar_geographies', 'find_neighboring_geographies']
    },
    comparison: {
      patterns: ['compare', 'vs', 'versus', 'stack up'],
      expectedTools: ['compare_to_benchmark', 'compare_to_neighbors']
    },
    ranking: {
      patterns: ['top', 'best', 'hot markets', 'show me'],
      expectedTools: ['get_rankings', 'filter_geographies']
    },
    validation: {
      patterns: ['accurate', 'validate', 'reliable', 'backtest'],
      expectedTools: ['run_backtest', 'run_quintile_analysis']
    },
    timeSeries: {
      patterns: ['trend', 'historical', 'growing', 'rising', 'falling'],
      expectedTools: ['get_time_series']
    },
    news: {
      patterns: ['news', 'latest', 'developments'],
      expectedTools: ['search_real_estate_news']
    }
  };
  
  for (const [intentName, intent] of Object.entries(intents)) {
    const matchesPattern = intent.patterns.some(p => prompt.includes(p));
    if (matchesPattern) {
      const usedExpectedTool = tools.some(t => intent.expectedTools.includes(t));
      return usedExpectedTool ? 100 : 0;
    }
  }
  
  // Default: any tool usage is okay for ambiguous prompts
  return tools.length > 0 ? 100 : 50;
}

function calculateCompletenessScore(response: TestResponse): number {
  if (!response.success) return 0;
  
  const text = response.responseText;
  
  // Check for incomplete indicators
  if (text.length < 50) return 20;
  if (text.endsWith('...') || text.includes('let me know')) return 60;
  if (text.includes('I apologize') || text.includes('I cannot')) return 40;
  
  // Check if data was returned when needed
  const needsData = !response.prompt.toLowerCase().match(/what|how|why|explain/);
  if (needsData && !response.structuredData) return 60;
  
  return 100;
}

function calculateDurationScore(response: TestResponse): number {
  const prompt = response.prompt.toLowerCase();
  const isSimple = !prompt.match(/compare|analyze|show me.*and|everything/);
  
  const target = isSimple ? 10000 : 30000; // 10s or 30s
  const actual = response.durationMs;
  
  if (actual <= target) return 100;
  if (actual <= target * 1.5) return 70;
  if (actual <= target * 2) return 40;
  return 0;
}

function detectNoData(response: TestResponse): boolean {
  const needsData = response.prompt.toLowerCase().match(/show|best|top|compare|markets|metros/);
  return needsData && !response.structuredData && response.toolsUsed.length === 0;
}

function detectWrongScoring(response: TestResponse): boolean {
  const prompt = response.prompt.toLowerCase();
  const isInvestorQuery = prompt.match(/invest|rental|cash.*flow|cap rate|yield/);
  const isHomebuyerQuery = prompt.match(/buy|family|neighborhood|afford|school/);
  
  const text = response.responseText.toLowerCase();
  const mentionsInvestor = text.includes('investoredge');
  const mentionsHomebuyer = text.includes('homeready');
  
  if (isInvestorQuery && mentionsHomebuyer) return true;
  if (isHomebuyerQuery && mentionsInvestor) return true;
  
  return false;
}

function detectHallucination(response: TestResponse): boolean {
  const text = response.responseText;
  
  // Check for specific numbers not in structured data
  const numbersInText = text.match(/\d+\.\d+/g) || [];
  if (numbersInText.length === 0) return false;
  
  const structuredDataStr = JSON.stringify(response.structuredData || {});
  
  for (const num of numbersInText) {
    if (!structuredDataStr.includes(num)) {
      return true; // Number in text but not in data = hallucination
    }
  }
  
  return false;
}

function detectIncomplete(response: TestResponse): boolean {
  const text = response.responseText.toLowerCase();
  
  // Incomplete indicators
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
  // Check if key parts of question were not addressed
  const prompt = response.prompt.toLowerCase();
  const text = response.responseText.toLowerCase();
  
  // Multi-part questions
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

// Run evaluation on all test results
const resultsFile = process.argv[2] || 'baseline-results.txt';
// ... parse results and evaluate each one ...
```

### Step 5: Identify Fix Priorities

Group failures and prioritize:

```typescript
// Create: prioritize-fixes.ts

interface FailurePattern {
  category: string;
  count: number;
  examples: string[];
  rootCause: string;
  suggestedFix: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedImpact: number; // How many tests this would fix
}

function identifyPatterns(evaluations: QualityEvaluation[]): FailurePattern[] {
  const failures = evaluations.filter(e => !e.passes);
  
  const patterns: Map<string, FailurePattern> = new Map();
  
  // Group by issue type
  for (const eval of failures) {
    for (const issue of eval.issues) {
      if (!patterns.has(issue)) {
        patterns.set(issue, {
          category: issue,
          count: 0,
          examples: [],
          rootCause: '',
          suggestedFix: '',
          priority: 'MEDIUM',
          estimatedImpact: 0
        });
      }
      
      const pattern = patterns.get(issue)!;
      pattern.count++;
      if (pattern.examples.length < 3) {
        pattern.examples.push(eval.prompt);
      }
    }
  }
  
  // Analyze each pattern for root cause
  for (const [category, pattern] of patterns) {
    if (category.includes('CRITICAL')) {
      pattern.priority = 'CRITICAL';
    } else if (pattern.count >= failures.length * 0.3) {
      pattern.priority = 'HIGH';
    } else if (pattern.count >= failures.length * 0.1) {
      pattern.priority = 'MEDIUM';
    } else {
      pattern.priority = 'LOW';
    }
    
    pattern.estimatedImpact = pattern.count;
    
    // Determine root cause and fix based on category
    if (category.includes('Wrong tools for intent')) {
      pattern.rootCause = 'Intent detection or tool selection logic';
      pattern.suggestedFix = 'Update getQueryIntent() or getRelevantTools()';
    } else if (category.includes('too long')) {
      pattern.rootCause = 'System prompt not emphasizing brevity';
      pattern.suggestedFix = 'Add CRITICAL brevity requirement to system prompt';
    } else if (category.includes('Data repeated')) {
      pattern.rootCause = 'Missing explicit prohibition on data listing';
      pattern.suggestedFix = 'Add counter-examples to system prompt';
    } else if (category.includes('markdown')) {
      pattern.rootCause = 'Formatting instruction not strong enough';
      pattern.suggestedFix = 'Make "plain text only" more prominent';
    } else if (category.includes('No data when needed')) {
      pattern.rootCause = 'Tool not in subset for detected intent';
      pattern.suggestedFix = 'Add missing tool to intent tool set';
    }
  }
  
  // Sort by priority and impact
  return Array.from(patterns.values()).sort((a, b) => {
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.estimatedImpact - a.estimatedImpact;
  });
}
```

### Step 6: Apply Fixes Iteratively

For each high-priority pattern:

```bash
# Create new branch
ITERATION=1
git checkout -b quinn-optimization-iteration-$ITERATION

# Apply fix based on pattern
# Example: Intent detection fix

# Edit analytics-chat.service.ts
# Find getQueryIntent() method
# Add new pattern detection

# Commit
git add .
git commit -m "Quinn opt iteration $ITERATION: Fix [specific issue from pattern]"

# Test subset (10 previously failing prompts)
cat > subset-prompts.txt << EOF
What markets are similar to Raleigh?
Show me neighbors of Portland OR
Is Dallas better than Houston?
[... other failing prompts ...]
EOF

npx tsx ../../run-iterative.ts subset-prompts.txt | tee subset-results.txt

# If subset passes, run full suite
if grep -q "Failed: 0" subset-results.txt; then
  npx tsx ../../run-iterative.ts comprehensive-prompts.txt | tee iteration-$ITERATION-results.txt
  
  # Compare to baseline
  BASELINE_PASSED=$(grep "Passed:" baseline-results.txt | cut -d' ' -f2)
  CURRENT_PASSED=$(grep "Passed:" iteration-$ITERATION-results.txt | cut -d' ' -f2)
  
  if [ $CURRENT_PASSED -gt $BASELINE_PASSED ]; then
    echo "✅ Improvement! Keeping changes."
    ITERATION=$((ITERATION + 1))
  else
    echo "❌ Regression detected. Rolling back."
    git reset --hard HEAD~1
    git checkout main
  fi
else
  echo "⚠️  Subset failed. Rolling back."
  git reset --hard HEAD~1
  git checkout main
fi
```

### Step 7: Generate Final Report

After optimization completes:

```bash
# Create comprehensive report
cat > OPTIMIZATION_REPORT.md << EOF
# Quinn Optimization Report
Generated: $(date)

## Execution Summary
[Copy iteration results, metrics, changes]

## Files Modified
$(git diff main --name-only)

## Git Commits
$(git log main..HEAD --oneline)

## Performance Comparison
[Baseline vs Final metrics table]

## Recommendations
[Next steps based on remaining failures]
EOF

# Create summary for user
echo "Quinn optimization complete!"
echo "Pass rate: $FINAL_PASS_RATE (was $BASELINE_PASS_RATE)"
echo "Report: optimization-runs/$TIMESTAMP/OPTIMIZATION_REPORT.md"
```

## Usage Examples

### Basic Usage
```
User: "optimize Quinn"