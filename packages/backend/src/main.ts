import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Build trigger: 2026-01-28

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Manual CORS middleware — cors@2.8.5 crashes on Express 5 with Origin header
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
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

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
  console.log(`📅 Build: ${new Date().toISOString()}`);
}
bootstrap();
// rebuild
// cache-bust 1738795000
