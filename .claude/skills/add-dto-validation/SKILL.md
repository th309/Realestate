---
name: add-dto-validation
description: Add class-validator DTO validation to an existing NestJS controller. Use after creating or modifying backend controller endpoints, or when auditing input validation.
disable-model-invocation: true
---

# Add DTO Validation

Add proper input validation to an existing NestJS controller that's missing class-validator DTOs.

## Input

The user provides a controller file path or module name.

## Workflow

### Step 1: Analyze the Controller

Read the controller file and catalog every route handler:

| Method       | Decorator | Route   | Parameters          | Current Validation |
| ------------ | --------- | ------- | ------------------- | ------------------ |
| getMetros    | @Get()    | /metros | @Query date: string | NONE               |
| createReport | @Post()   | /       | @Body body: any     | NONE               |

### Step 2: Create DTOs

For each unvalidated parameter, create a DTO class:

**Query Parameters → Query DTO:**

```typescript
import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class GetMetrosQueryDto {
  @ApiPropertyOptional({ example: "2024-01-15" })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

**Body Parameters → Create/Update DTO:**

```typescript
import { IsString, IsNotEmpty, IsEnum, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateReportDto {
  @ApiProperty({ example: "homeready" })
  @IsString()
  @IsNotEmpty()
  template_slug: string;

  @ApiProperty({ example: "metro" })
  @IsEnum(["state", "metro", "county", "zip"])
  geography_type: string;
}
```

### Step 3: Apply Validation Pipe

Add to the controller class level:

```typescript
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
```

This strips unknown properties and auto-transforms types.

### Step 4: Update Route Handlers

Replace raw parameter types with DTOs:

```typescript
// BEFORE
@Get('metros')
async getMetros(@Query('date') date?: string) { ... }

// AFTER
@Get('metros')
async getMetros(@Query() query: GetMetrosQueryDto) { ... }
```

Update the service calls to use DTO properties.

### Step 5: Add Swagger Decorators

Add to each route handler:

```typescript
@ApiOperation({ summary: 'Get metro-level data' })
@ApiResponse({ status: 200, description: 'Metro data retrieved successfully' })
@ApiResponse({ status: 400, description: 'Invalid query parameters' })
```

### Step 6: Verify

```bash
npm run build -w backend
npm run test -w backend -- --testPathPattern={module}
```

## Common Validator Patterns

| Parameter Type   | Validators                                  |
| ---------------- | ------------------------------------------- |
| Date string      | `@IsDateString()`                           |
| Geography type   | `@IsEnum(['state','metro','county','zip'])` |
| FIPS/CBSA code   | `@IsString() @Matches(/^\d{2,5}$/)`         |
| Pagination limit | `@IsOptional() @IsInt() @Min(1) @Max(100)`  |
| UUID             | `@IsUUID()`                                 |
| Sort direction   | `@IsEnum(['asc', 'desc'])`                  |
