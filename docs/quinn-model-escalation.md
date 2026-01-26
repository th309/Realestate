# Quinn Dynamic Model Escalation

## Overview

Quinn now uses a **dynamic model escalation** strategy to optimize cost and latency while maintaining high-quality responses. The system automatically routes queries to the most appropriate Claude model based on query complexity and tool requirements.

## Model Tiers

| Model | Use Case | Cost per 1M tokens (input/output) |
|-------|----------|-----------------------------------|
| **Haiku** (`claude-haiku-4-20250514`) | Simple queries, greetings, basic lookups | $0.25 / $1.25 |
| **Sonnet** (`claude-sonnet-4-20250514`) | Moderate analysis, comparisons, standard tools | $3.00 / $15.00 |
| **Opus** (`claude-opus-4-5-20251101`) | Complex multi-tool orchestration, advanced ML | $15.00 / $75.00 |

## How It Works

### 1. Initial Model Selection

When a query arrives, Quinn analyzes the message to select an appropriate starting model:

**Start with Sonnet** if query contains:
- `optimize`, `regression`, `cluster`, `feature importance`
- `predict`, `correlation`, `statistical`
- `raw metric`, `zillow data`, `realtor data`
- `backtest`, `validation`, `test strategy`

**Start with Haiku** (default) for:
- Simple greetings: "hi", "hello", "thanks"
- Basic queries: "show me top", "list", "get"
- Most other queries

### 2. Dynamic Escalation

After the initial model makes its first tool request, Quinn checks if escalation is needed:

**Haiku → Sonnet** escalation triggers when:
- Complex tools are requested: `run_regression`, `optimize_weights`, `analyze_raw_metrics`, etc.
- Moderate tools + more than 2 tools: `analyze_data`, `compare_to_benchmark`, etc.

**Sonnet → Opus** escalation triggers when:
- More than 3 complex tools are needed simultaneously
- High complexity multi-tool orchestration

When escalation occurs:
1. Quinn logs the escalation reason
2. Restarts the conversation with the more powerful model
3. The tool execution continues with the new model

### 3. Transparent Logging

Every query logs:
- Initial model selected and reasoning
- Escalation events (if any) with justification
- Final model used
- Tools executed
- Total duration

## Tool Complexity Classification

### Basic Tools (Haiku-friendly)
- `get_available_filters` - List available filters
- `filter_geographies` - Filter by criteria
- `get_rankings` - Top/bottom performers
- `get_time_series` - Historical data

### Moderate Tools (Sonnet-capable)
- `analyze_data` - Statistical analysis
- `compare_to_benchmark` - Benchmark comparisons
- `get_geographic_comparison` - Geographic comparisons
- `compare_states` - State-level comparisons

### Complex Tools (May trigger escalation)
- `run_regression` - OLS/Ridge regression
- `get_feature_importance` - ML feature ranking
- `cluster_markets` - K-means clustering
- `optimize_weights` - Weight optimization
- `analyze_raw_metrics` - Raw database analysis
- `run_backtest` - Strategy backtesting
- `validate_strategy` - Strategy validation

## Example Scenarios

### Scenario 1: Simple Query (Haiku Only)
```
User: "Show me top 10 markets in Texas"
→ Starts with: Haiku
→ Tools used: filter_geographies, get_rankings (basic tools)
→ Final model: Haiku ✓
→ Cost: ~$0.25 per 1M tokens (90% cheaper than Sonnet)
```

### Scenario 2: Complex Query (Haiku → Sonnet)
```
User: "Which metrics best predict 3-year returns?"
→ Starts with: Haiku
→ Tools requested: run_regression (complex tool)
→ Escalates to: Sonnet
→ Final model: Sonnet ✓
→ Cost: ~$3.00 per 1M tokens (only paid for restart + execution)
```

### Scenario 3: Very Complex Query (Sonnet from Start)
```
User: "Run a regression to find optimal weights for predicting appreciation"
→ Starts with: Sonnet (detected complex patterns)
→ Tools used: run_regression, optimize_weights
→ Final model: Sonnet ✓
→ Cost: No escalation overhead
```

### Scenario 4: Multi-Tool Orchestration (Sonnet → Opus)
```
User: "Cluster markets, run regression on each cluster, optimize weights, and backtest"
→ Starts with: Sonnet
→ Tools requested: cluster_markets, run_regression (×3), optimize_weights, run_backtest
→ Escalates to: Opus (5+ complex tools)
→ Final model: Opus ✓
→ Cost: ~$15 per 1M tokens (warranted for complex orchestration)
```

## Expected Cost Savings

Based on typical query distribution:
- **60% simple queries** (Haiku): 90% cost reduction
- **35% moderate queries** (Sonnet): baseline cost
- **5% complex queries** (Opus): premium cost

**Overall estimated savings: 40-50%** compared to using Sonnet for everything.

## Configuration

No configuration needed! The system works automatically. However, you can modify the heuristics in:

`packages/backend/src/analytics-chat/analytics-chat.service.ts`:
- `selectInitialModel()` - Adjust initial selection patterns
- `shouldEscalate()` - Modify escalation thresholds

## Monitoring

Check server logs for escalation insights:

```
[Quinn Model] Starting with Haiku (default)
[Quinn Escalation] Haiku → Sonnet (complex tools: run_regression)
[Quinn Chat] Completed with claude-sonnet-4-20250514, used 2 tools (escalated)
```

Frontend API logs also include model information:
```
[Quinn POST req_xxx] Model used: claude-sonnet-4-20250514
```

## Response Schema

API responses now include `modelUsed` field:

```typescript
{
  success: true,
  response: "...",
  toolsUsed: ["run_regression", "generate_chart"],
  modelUsed: "claude-sonnet-4-20250514",  // ← NEW
  structuredData: { ... },
  conversationId: "user123__chat__1234567890"
}
```

## Testing

### Test Simple Query (Should use Haiku)
```bash
curl -X POST http://localhost:3001/analytics/chat/test_conv_1 \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me top 5 markets"}'
```

Expected log:
```
[Quinn Model] Starting with Haiku (default)
[Quinn Chat] Completed with claude-haiku-4-20250514, used 1 tools
```

### Test Complex Query (Should escalate to Sonnet)
```bash
curl -X POST http://localhost:3001/analytics/chat/test_conv_2 \
  -H "Content-Type: application/json" \
  -d '{"message": "What metrics predict appreciation?"}'
```

Expected log:
```
[Quinn Model] Starting with Haiku (default)
[Quinn Escalation] Haiku → Sonnet (complex tools: run_regression)
[Quinn Chat] Completed with claude-sonnet-4-20250514, used 2 tools (escalated)
```

### Test Very Complex Query (Should start with Sonnet)
```bash
curl -X POST http://localhost:3001/analytics/chat/test_conv_3 \
  -H "Content-Type: application/json" \
  -d '{"message": "Run regression analysis to optimize investment score weights"}'
```

Expected log:
```
[Quinn Model] Starting with Sonnet (detected complex query)
[Quinn Chat] Completed with claude-sonnet-4-20250514, used 3 tools
```

## Benefits

1. **Cost Optimization**: 40-50% reduction in API costs for typical workloads
2. **Latency Improvement**: Haiku responds 2-3x faster than Sonnet for simple queries
3. **Quality Preservation**: Complex queries still get powerful models when needed
4. **Transparent**: All escalations are logged for observability
5. **Automatic**: No user configuration or manual routing needed

## Future Enhancements

Potential improvements:
- **Conversation-aware escalation**: Track conversation complexity over time
- **User-specific routing**: Power users might prefer always using Sonnet/Opus
- **A/B testing**: Compare model outputs for validation
- **Cost tracking**: Track actual costs per conversation
- **Streaming**: Stream responses for better UX
- **Caching**: Cache common queries to avoid repeated API calls
