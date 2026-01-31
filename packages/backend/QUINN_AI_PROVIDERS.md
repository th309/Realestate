# Quinn AI Provider Configuration Guide

## Overview

Quinn Chat supports a robust **multi-provider system** with automatic fallback.

- **Primary Provider**: Defaults to `anthropic` (Claude 3.5 Sonnet).
- **Fallback Provider**: Automatically switches to `openai` interface (DeepSeek) if the primary fails.
- **Easy Switching**: Control the primary provider via `AI_PROVIDER`.

## Configuration

### Recommended Setup (Claude Primary)

```env
# Primary Control
AI_PROVIDER=anthropic             # 'anthropic' or 'openai' (defaults to anthropic)
AI_MODEL=claude-sonnet-4-5-20250929 # Model ID for the primary provider

# Anthropic Configuration (Primary)
ANTHROPIC_API_KEY=sk-ant-api...

# OpenAI/DeepSeek Configuration (Fallback)
OPENAI_API_KEY=sk-...             # Or DEEPSEEK_API_KEY
AI_BASE_URL=https://api.deepseek.com/v1 # Required for DeepSeek
```

### DeepSeek Primary (Cost-Effective)

To use DeepSeek as the primary model with Claude as fallback:

```env
AI_PROVIDER=openai               
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat           # "V3.2" - Balanced inference
DEEPSEEK_API_KEY=sk-...

# Fallback
ANTHROPIC_API_KEY=sk-ant-api...
```

## DeepSeek Models

- **deepseek-chat (V3.2)**: Balanced inference vs. length. Your daily driver at GPT-5 level performance.
- **deepseek-reasoner (V3.2-Speciale)**: Maxed-out reasoning capabilities. Rivals Gemini-3.0-Pro.

You can set `AI_MODEL=deepseek-reasoner` in your `.env` to use the specialized reasoning model.

## How Fallback Works

1. **Initialization**: The service initializes both clients if keys are present.
2. **Streaming**: 
   - Attempts to stream using the configured `AI_PROVIDER` and `AI_MODEL`.
   - If that fails, switches to the other provider using a **safe default model** (`claude-3-5-sonnet-latest` or `deepseek-chat`).
3. **Logging**: Check server logs for `[Quinn Stream] Provider ... failed` messages.

## Production Deployment (Railway)

Ensure environment variables are set in the Railway dashboard:

1. **ANTHROPIC_API_KEY**: Required for Claude.
2. **DEEPSEEK_API_KEY**: Required for DeepSeek fallback.
3. **AI_PROVIDER**: `anthropic` or `deepseek`.
4. **AI_BASE_URL**: `https://api.deepseek.com/v1`.
