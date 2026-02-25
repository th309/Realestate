---
name: scaffold-module
description: Scaffold a complete NestJS backend module with controller, service, DTOs, and tests. Use when creating a new backend feature, API endpoint, or module from scratch.
disable-model-invocation: true
---

# Scaffold NestJS Module

Create a complete, production-ready NestJS module with all required files following PropertyIQ conventions.

## Input

The user provides:

- **Module name** (e.g., "watchlist", "alerts", "notifications")
- **Description** of what the module does
- **Endpoints** needed (optional — will be inferred from description)

## Generated Files

```
packages/backend/src/{module-name}/
  ├── {module-name}.module.ts        # NestJS module with imports
  ├── {module-name}.controller.ts    # REST endpoints with Swagger docs
  ├── {module-name}.service.ts       # Business logic with Supabase
  ├── dto/
  │   ├── create-{name}.dto.ts       # Input validation with class-validator
  │   └── update-{name}.dto.ts       # Partial input validation
  └── {module-name}.service.spec.ts  # Jest unit tests
```

## Conventions to Follow

### Module

- Import `SupabaseModule`, `RedisModule` if needed
- Export service for use by other modules
- Register in `app.module.ts`

### Controller

- Apply `@ApiTags('{Module Name}')` for Swagger grouping
- Add `@ApiOperation()` and `@ApiResponse()` to every route
- Use `@UseGuards(JwtAuthGuard)` for authenticated routes
- Use `@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))` on class level
- Extract userId from request: `@Req() req: Request` → `req['userId']`
- Add `@Header('Cache-Control', '...')` for cacheable GET endpoints

### Service

- Inject `SupabaseService` for database access
- Inject `RedisService` for caching (if applicable)
- Use `this.supabase.getClient()` to get Supabase client
- Handle errors with proper NestJS exceptions (NotFoundException, BadRequestException)
- Log operations with NestJS Logger

### DTOs

- Every field has a class-validator decorator
- Use `@IsOptional()` for optional fields
- Use `@Transform()` for type coercion where needed
- Add `@ApiProperty()` for Swagger documentation
- Example values in `@ApiProperty({ example: '...' })`

### Tests

- Mock SupabaseService and RedisService
- Test each service method
- Test error handling paths
- Use descriptive test names per CLAUDE.md Section 1.4

## Post-Scaffold Steps

1. Register module in `app.module.ts`
2. Run `npm run build -w backend` to verify compilation
3. Run `npm run test -w backend -- --testPathPattern={module-name}` to verify tests pass
4. Verify Swagger docs at `/api/docs` after starting backend
