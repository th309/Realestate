// Build trigger: 2026-03-28
import './instrument'; // Sentry — must run before NestJS loads any modules
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { AppModule } from './app.module';

// Build trigger: 2026-01-28

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Trust the Railway edge proxy so Express resolves `req.ip` from the
  // RIGHTMOST x-forwarded-for entry (the trusted edge) rather than letting
  // the leftmost (attacker-controlled) value through. Required for safe
  // per-IP rate limiting in AnonRateLimitGuard.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Only attach Sentry exception filter when DSN is configured (production).
  // Without a DSN, SentryGlobalFilter crashes on 'isHeadersSent' in local dev.
  if (process.env.SENTRY_DSN) {
    app.useGlobalFilters(new SentryGlobalFilter());
  }

  // Manual CORS middleware — cors@2.8.5 crashes on Express 5 with Origin header
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,PUT,PATCH,POST,DELETE',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type,Authorization,X-User-Tier,X-User-Id,X-Session-Id,X-Requested-With',
      );
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Content-Length', '0');
      res.end();
      return;
    }
    next();
  });

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('PropertyIQ API')
    .setDescription('Real Estate Investment Analysis Platform API')
    .setVersion('1.0')
    .addTag('markets', 'Market data endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Increase HTTP server timeout for long-running AI pipelines
  // (research brief: ~2-3 min for tool-use loop + narrative generation)
  const server = app.getHttpServer();
  server.setTimeout(300_000); // 5 minutes

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  console.log(`📅 Build: ${new Date().toISOString()}`);
}
bootstrap();
// redeploy 1774481543
