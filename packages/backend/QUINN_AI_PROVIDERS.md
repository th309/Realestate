# Quinn AI Provider Configuration Guide

## Current Setup: Claude Primary

### Anthropic Models

1. **claude-3-5-sonnet-latest**
   - Best-in-class reasoning and coding
   - Primary model for all complex analysis
   - Use for reliable tool usage and broad context understanding

### Previous Setup (Deepseek) - DEPRECATED
Deepseek (V3.2) was previously used but encountered reliability issues. It remains available as a fallback option via the `openai` provider setting.

### Configuration

### Configuration

Your current `.env` is configured to use **Anthropic (Claude)** as primary:

```env
AI_PROVIDER=anthropic
AI_BASE_URL=https://api.anthropic.com
AI_MODEL=claude-3-5-sonnet-latest
ANTHROPIC_API_KEY=sk-ant-api...
```

### Switching Models

#### Use Deepseek V3.2 (Legacy/Fallback)
```env
AI_PROVIDER=deepseek
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
DEEPSEEK_API_KEY=...
```

#### Fallback to Claude (Secondary)
```env
AI_PROVIDER=anthropic
AI_MODEL=claude-3-5-sonnet-latest
# Make sure ANTHROPIC_API_KEY is set on Railway
```

### Testing the Configuration

1. **Restart the backend server** after changing `.env`:
   ```bash
   cd packages/backend
   npm run start:dev
   ```

2. **Check the logs** for confirmation:
   ```
   [Quinn Init] Provider: DEEPSEEK
   [Quinn Init] Model: deepseek-chat
   [Quinn Init] OpenAI-compatible client initialized (BaseURL: https://api.deepseek.com/v1)
   ```

3. **Test Quinn chat** via API or frontend

### Model Selection Strategy

**Recommended Usage:**
- **Default**: `deepseek-chat` for 90% of queries (fast, cost-effective)
- **Complex queries**: Switch to `deepseek-reasoner` for:
  - Multi-step analysis requiring deep reasoning
  - Complex ML optimization questions
  - Strategic investment analysis
- **Fallback**: Claude Sonnet if Deepseek has issues or for specific features

### Production Deployment (Railway)

Don't forget to update environment variables on Railway:

1. Go to Railway dashboard → Your project → Variables
2. Add/Update:
   - `DEEPSEEK_API_KEY=sk-61962ff95c1c4a8684417f907da0d573`
   - `AI_PROVIDER=deepseek`
   - `AI_BASE_URL=https://api.deepseek.com/v1`
   - `AI_MODEL=deepseek-chat`
3. Redeploy or restart the service

### Cost Comparison

**Deepseek V3.2 (deepseek-chat)**
- Input: $0.14 per million tokens
- Output: $0.28 per million tokens
- ~10-20x cheaper than Claude/GPT-4

**Deepseek V3.2-Special (deepseek-reasoner)**
- Input: $0.55 per million tokens
- Output: $2.19 per million tokens
- Similar to Claude pricing but with extended reasoning

**Claude 3.5 Sonnet**
- Input: $3 per million tokens
- Output: $15 per million tokens
- Premium option for critical queries

### Troubleshooting

**Quinn not responding:**
- Check logs for API key errors
- Verify `AI_BASE_URL` is set correctly for Deepseek
- Ensure DEEPSEEK_API_KEY is valid

**Rate limits:**
- Deepseek has generous rate limits for paid accounts
- Consider implementing request queuing if hitting limits

**Quality issues:**
- Try switching to `deepseek-reasoner` for better reasoning
- Fall back to Claude for specific use cases requiring highest quality
