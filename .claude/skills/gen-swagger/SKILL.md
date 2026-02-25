---
name: gen-swagger
description: Generate Swagger/OpenAPI documentation for a NestJS controller. Use after creating or modifying backend API endpoints to keep docs in sync.
disable-model-invocation: true
---

# Generate Swagger Documentation

Add comprehensive Swagger/OpenAPI decorators to a NestJS controller.

## Input

The user provides a controller file path or module name.

## Workflow

### Step 1: Read the Controller

Analyze the controller to catalog:

- Class-level decorators (existing @ApiTags, @Controller path)
- All route handlers with their HTTP method, path, and parameters
- Return types from the service methods
- Error cases (thrown exceptions)

### Step 2: Read the Service

Read the corresponding service file to understand:

- Return shapes (what data structure each method returns)
- Error conditions (when NotFoundException, BadRequestException are thrown)
- Database queries (to understand response structure)

### Step 3: Add Controller-Level Decorators

```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';

@ApiTags('Market Data')  // Descriptive group name
@Controller('api/markets')
export class MarketsController { ... }
```

### Step 4: Add Route-Level Decorators

For each route handler:

```typescript
@Get('metros')
@ApiOperation({
  summary: 'Get metro-level market data',
  description: 'Returns market indicators for all metropolitan areas with the latest available data point per region.'
})
@ApiQuery({ name: 'date', required: false, type: String, example: '2024-01-15', description: 'Filter by specific date' })
@ApiResponse({
  status: 200,
  description: 'Metro market data retrieved successfully',
  schema: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            region_id: { type: 'string', example: '31080' },
            region_name: { type: 'string', example: 'Los Angeles-Long Beach-Anaheim, CA' },
            value: { type: 'number', example: 856000 },
            period_date: { type: 'string', example: '2024-01-31' },
          }
        }
      }
    }
  }
})
@ApiResponse({ status: 400, description: 'Invalid query parameters' })
@ApiResponse({ status: 500, description: 'Internal server error' })
async getMetros(@Query() query: GetMetrosQueryDto) { ... }
```

### Step 5: Add Response DTOs (if complex)

For reusable response shapes, create response DTOs:

```typescript
// dto/metro-response.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class MetroDataResponseDto {
  @ApiProperty({ example: "31080" })
  region_id: string;

  @ApiProperty({ example: "Los Angeles-Long Beach-Anaheim, CA" })
  region_name: string;

  @ApiProperty({ example: 856000 })
  value: number;

  @ApiProperty({ example: "2024-01-31" })
  period_date: string;
}
```

### Step 6: Verify

```bash
npm run build -w backend
npm run start:dev -w backend
# Check http://localhost:3001/api/docs
```

## Swagger Best Practices

- **Summaries** are short (under 60 chars): "Get metro market data"
- **Descriptions** explain behavior, filters, and caching
- **Examples** use realistic PropertyIQ data (real CBSA codes, realistic values)
- **Error responses** document all possible HTTP status codes
- **Group by domain** using @ApiTags (Market Data, Scoring, Reports, Admin)
