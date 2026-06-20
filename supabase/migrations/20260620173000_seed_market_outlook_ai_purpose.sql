-- Seed the `market_outlook` AI purpose: the landing hero's predictive,
-- news-aware market narrative (<~100 words). Without a row the purpose silently
-- rides the env-var fallback config (AI_PROVIDER/AI_MODEL), which can be
-- incoherent. The narrative WRITING uses DeepSeek; the recent local-news context
-- woven into the prompt is fetched separately via the Gemini-backed `news_scout`
-- purpose (NewsScoutService).
INSERT INTO ai_model_config (purpose, label, provider, model, temperature) VALUES
  ('market_outlook', 'Landing Hero Market Outlook (predictive, news-aware)', 'deepseek', 'deepseek-v4-pro', 0.60)
ON CONFLICT (purpose) DO NOTHING;
