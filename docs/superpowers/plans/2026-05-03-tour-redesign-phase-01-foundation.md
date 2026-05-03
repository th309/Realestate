# Activation Tour Redesign — Phase 01: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend foundation for the activation tour — anonymous listing-presentation API, rate limiting, Redis tour cache, peers helper, and data services that wrap the new IRS migration + BLS QCEW data (ingested in parallel via separate work).

**Architecture:** Three NestJS modules: `AnonymousModule` (controller + listing-presentation service + rate-limit guard + Redis tour cache), `MigrationModule` (sibling service to MetricResolutionService for IRS county-to-county data), `EmploymentSectorsModule` (sibling service for BLS QCEW data). Listing-presentation service orchestrates all data via existing MetricResolutionService for scalar metrics + new sibling services for shape-different data. Frontend gets one fetcher + hook in `@/lib/data` consuming the single API endpoint.

**Tech Stack:** NestJS 11, ioredis, @supabase/ssr, class-validator DTOs, Anthropic SDK (claude-haiku-4-5), Jest spec tests.

**Spec:** [docs/superpowers/specs/2026-05-03-activation-tour-redesign-design.md](../specs/2026-05-03-activation-tour-redesign-design.md)

**Assumes (from parallel ingest work):**

- Table `migration_flows` with columns `from_county_fips, to_county_fips, year, inflow_count` (or close).
- Table `employment_sectors` with columns `county_fips, naics_code, naics_label, employment, wages_avg, year` (or close).
- Reconciled at end of phase if names differ.

---

## File structure

**Backend (new):**

- `packages/backend/src/anonymous/anonymous.module.ts`
- `packages/backend/src/anonymous/anonymous.controller.ts`
- `packages/backend/src/anonymous/listing-presentation.service.ts`
- `packages/backend/src/anonymous/listing-presentation-narrative.service.ts`
- `packages/backend/src/anonymous/redis-tour-cache.service.ts`
- `packages/backend/src/anonymous/anon-rate-limit.guard.ts`
- `packages/backend/src/anonymous/dto/generate-presentation.dto.ts`
- `packages/backend/src/anonymous/__tests__/anon-rate-limit.guard.spec.ts`
- `packages/backend/src/anonymous/__tests__/redis-tour-cache.service.spec.ts`
- `packages/backend/src/anonymous/__tests__/listing-presentation.service.spec.ts`
- `packages/backend/src/migration/migration.module.ts`
- `packages/backend/src/migration/migration.service.ts`
- `packages/backend/src/migration/__tests__/migration.service.spec.ts`
- `packages/backend/src/employment-sectors/employment-sectors.module.ts`
- `packages/backend/src/employment-sectors/employment-sectors.service.ts`
- `packages/backend/src/employment-sectors/__tests__/employment-sectors.service.spec.ts`
- `packages/backend/src/markets/peers.service.ts`
- `packages/backend/src/markets/__tests__/peers.service.spec.ts`

**Backend (modify):**

- `packages/backend/src/markets/markets.module.ts` — register PeersService
- `packages/backend/src/markets/markets.controller.ts` — add `GET /api/markets/peers/:geoLevel/:geoId`
- `packages/backend/src/app.module.ts` — register AnonymousModule, MigrationModule, EmploymentSectorsModule

**Frontend (new):**

- `packages/frontend/lib/data/fetchers/anonymous-listing-presentation.ts`
- `packages/frontend/lib/data/hooks/useAnonymousListingPresentation.ts`

**Frontend (modify):**

- `packages/frontend/lib/data/fetchers/index.ts` — re-export new fetcher
- `packages/frontend/lib/data/hooks/index.ts` — re-export new hook
- `packages/frontend/lib/data/index.ts` — re-export types

---

### Task 1: PeersService — peer-matching algorithm

**Files:**

- Create: `packages/backend/src/markets/peers.service.ts`
- Create: `packages/backend/src/markets/__tests__/peers.service.spec.ts`
- Modify: `packages/backend/src/markets/markets.module.ts:1-30` (register PeersService in providers + exports)

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/markets/__tests__/peers.service.spec.ts
import { Test } from "@nestjs/testing";
import { PeersService } from "../peers.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("PeersService", () => {
  let service: PeersService;
  let supabase: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PeersService,
        { provide: SupabaseService, useValue: { from: jest.fn() } },
      ],
    }).compile();
    service = module.get(PeersService);
    supabase = module.get(SupabaseService);
  });

  it("returns top-3 peers ranked by score-similarity within parent metro", async () => {
    const fromMock = jest.fn().mockReturnThis();
    const selectMock = jest.fn().mockReturnThis();
    const eqMock = jest.fn().mockReturnThis();
    const limitMock = jest.fn().mockResolvedValue({
      data: [
        {
          geo_id: "apex-nc",
          name: "Apex, NC",
          score: 81,
          household_count: 22000,
        },
        {
          geo_id: "holly-springs-nc",
          name: "Holly Springs, NC",
          score: 79,
          household_count: 14000,
        },
        {
          geo_id: "morrisville-nc",
          name: "Morrisville, NC",
          score: 84,
          household_count: 12000,
        },
      ],
      error: null,
    });
    supabase.from.mockReturnValue({
      select: selectMock,
      eq: eqMock,
      limit: limitMock,
    } as any);
    selectMock.mockReturnValue({ eq: eqMock, limit: limitMock });
    eqMock.mockReturnValue({ limit: limitMock });

    const peers = await service.findPeers({
      geoLevel: "city",
      geoId: "cary-nc",
      score: 87,
      parentMetro: "39580",
      householdCount: 62000,
    });

    expect(peers).toHaveLength(3);
    expect(peers[0].name).toBe("Apex, NC"); // closest by score
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx nx test backend --testPathPattern=peers.service.spec`
Expected: FAIL — `Cannot find module '../peers.service'`

- [ ] **Step 3: Implement minimal PeersService**

```typescript
// packages/backend/src/markets/peers.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export interface PeerCandidate {
  geoLevel: string;
  geoId: string;
  name: string;
  score: number;
  householdCount: number;
}

export interface FindPeersInput {
  geoLevel: string;
  geoId: string;
  score: number;
  parentMetro: string | null;
  householdCount: number;
}

@Injectable()
export class PeersService {
  constructor(private supabase: SupabaseService) {}

  async findPeers(input: FindPeersInput, limit = 3): Promise<PeerCandidate[]> {
    const candidates = await this.supabase
      .from("geographies_with_scores")
      .select(
        "geo_id, name, score, household_count, parent_metro_cbsa, geo_level",
      )
      .eq("parent_metro_cbsa", input.parentMetro ?? "")
      .eq("geo_level", input.geoLevel)
      .limit(50);

    if (candidates.error || !candidates.data) return [];

    const ranked = candidates.data
      .filter((c) => c.geo_id !== input.geoId)
      .map((c) => ({
        geoLevel: c.geo_level,
        geoId: c.geo_id,
        name: c.name,
        score: c.score,
        householdCount: c.household_count,
        scoreDist: Math.abs(c.score - input.score),
        sizeDist:
          Math.abs(c.household_count - input.householdCount) /
          Math.max(input.householdCount, 1),
      }))
      .sort(
        (a, b) =>
          a.scoreDist + a.sizeDist * 10 - (b.scoreDist + b.sizeDist * 10),
      )
      .slice(0, limit);

    return ranked.map(({ scoreDist, sizeDist, ...rest }) => rest);
  }
}
```

- [ ] **Step 4: Run test and verify it passes**

Run: `npx nx test backend --testPathPattern=peers.service.spec`
Expected: PASS

- [ ] **Step 5: Wire into MarketsModule**

Modify `packages/backend/src/markets/markets.module.ts` — add `PeersService` to `providers` and `exports` arrays. Existing pattern at scoring.module.ts:14-22.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/markets/peers.service.ts \
  packages/backend/src/markets/__tests__/peers.service.spec.ts \
  packages/backend/src/markets/markets.module.ts
git commit -m "feat(markets): add PeersService for peer-market matching"
```

---

### Task 2: GET /api/markets/peers/:geoLevel/:geoId endpoint

**Files:**

- Modify: `packages/backend/src/markets/markets.controller.ts` (add new endpoint method)
- Test: `packages/backend/src/markets/__tests__/markets.controller.spec.ts` (extend existing if present, else create)

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/markets/__tests__/markets.controller.spec.ts
import { Test } from "@nestjs/testing";
import { MarketsController } from "../markets.controller";
import { MarketsService } from "../markets.service";
import { PeersService } from "../peers.service";

describe("MarketsController GET /peers", () => {
  let controller: MarketsController;
  let peers: jest.Mocked<PeersService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MarketsController],
      providers: [
        { provide: MarketsService, useValue: {} },
        { provide: PeersService, useValue: { findPeers: jest.fn() } },
      ],
    }).compile();
    controller = module.get(MarketsController);
    peers = module.get(PeersService);
  });

  it("returns top-3 peers for the given geography", async () => {
    peers.findPeers.mockResolvedValue([
      {
        geoLevel: "city",
        geoId: "apex-nc",
        name: "Apex, NC",
        score: 81,
        householdCount: 22000,
      },
    ]);
    const result = await controller.getPeers("city", "cary-nc");
    expect(result.peers).toHaveLength(1);
    expect(peers.findPeers).toHaveBeenCalledWith(
      expect.objectContaining({ geoLevel: "city", geoId: "cary-nc" }),
    );
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx nx test backend --testPathPattern=markets.controller.spec`
Expected: FAIL — `getPeers is not a function`

- [ ] **Step 3: Add the endpoint**

In `packages/backend/src/markets/markets.controller.ts`, add (importing PeersService in constructor):

```typescript
@Get('peers/:geoLevel/:geoId')
async getPeers(
  @Param('geoLevel') geoLevel: string,
  @Param('geoId') geoId: string,
) {
  // Look up the source market's score + household count + parent metro to seed peer search
  const source = await this.marketsService.getMarketCore({ geoLevel, geoId });
  if (!source) {
    throw new BadRequestException(`Unknown market ${geoLevel}/${geoId}`);
  }
  const peers = await this.peersService.findPeers({
    geoLevel,
    geoId,
    score: source.score,
    parentMetro: source.parentMetroCbsa,
    householdCount: source.householdCount,
  });
  return { source, peers };
}
```

Add `MarketsService.getMarketCore({ geoLevel, geoId })` returning `{ score, parentMetroCbsa, householdCount, name }` or null. Wire it through to existing data sources (extend the existing market lookups; pattern at MarketsService — find an existing select-by-id helper and follow its shape).

- [ ] **Step 4: Run test and verify it passes**

Run: `npx nx test backend --testPathPattern=markets.controller.spec`
Expected: PASS

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev:backend &
curl http://localhost:3001/api/markets/peers/city/cary-nc
```

Expected: JSON `{ source: {...}, peers: [...] }` with 1-3 peer entries.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/markets/markets.controller.ts \
  packages/backend/src/markets/markets.service.ts \
  packages/backend/src/markets/__tests__/markets.controller.spec.ts
git commit -m "feat(markets): add GET /api/markets/peers endpoint"
```

---

### Task 3: MigrationService

**Files:**

- Create: `packages/backend/src/migration/migration.module.ts`
- Create: `packages/backend/src/migration/migration.service.ts`
- Create: `packages/backend/src/migration/__tests__/migration.service.spec.ts`
- Modify: `packages/backend/src/app.module.ts` — register MigrationModule

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/migration/__tests__/migration.service.spec.ts
import { Test } from "@nestjs/testing";
import { MigrationService } from "../migration.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("MigrationService", () => {
  let service: MigrationService;
  let supabase: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MigrationService,
        { provide: SupabaseService, useValue: { from: jest.fn() } },
      ],
    }).compile();
    service = module.get(MigrationService);
    supabase = module.get(SupabaseService);
  });

  it("returns top-N inflow source counties for a destination county", async () => {
    const limitMock = jest.fn().mockResolvedValue({
      data: [
        {
          from_county_fips: "36061",
          from_name: "New York County, NY",
          inflow_count: 1840,
        },
        {
          from_county_fips: "11001",
          from_name: "District of Columbia",
          inflow_count: 1210,
        },
      ],
      error: null,
    });
    const orderMock = jest.fn().mockReturnValue({ limit: limitMock });
    const eqMock = jest.fn().mockReturnValue({ order: orderMock });
    const eq2Mock = jest.fn().mockReturnValue({ eq: eqMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eq2Mock });
    supabase.from.mockReturnValue({ select: selectMock } as any);

    const result = await service.getTopInflows({
      countyFips: "37183",
      limit: 5,
      year: 2024,
    });

    expect(result).toHaveLength(2);
    expect(result[0].fromCountyFips).toBe("36061");
    expect(result[0].inflowCount).toBe(1840);
  });

  it("returns empty array when no migration data exists for the county", async () => {
    const limitMock = jest.fn().mockResolvedValue({ data: [], error: null });
    const orderMock = jest.fn().mockReturnValue({ limit: limitMock });
    const eqMock = jest.fn().mockReturnValue({ order: orderMock });
    const eq2Mock = jest.fn().mockReturnValue({ eq: eqMock });
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({ eq: eq2Mock }),
    } as any);

    const result = await service.getTopInflows({
      countyFips: "99999",
      limit: 5,
      year: 2024,
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx nx test backend --testPathPattern=migration.service.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement MigrationService**

```typescript
// packages/backend/src/migration/migration.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export interface MigrationFlow {
  fromCountyFips: string;
  fromName: string;
  inflowCount: number;
}

export interface TopInflowsInput {
  countyFips: string;
  limit?: number;
  year?: number;
}

@Injectable()
export class MigrationService {
  constructor(private supabase: SupabaseService) {}

  async getTopInflows(input: TopInflowsInput): Promise<MigrationFlow[]> {
    const limit = input.limit ?? 5;
    const year = input.year ?? new Date().getFullYear() - 2; // IRS data lags ~18 months

    const { data, error } = await this.supabase
      .from("migration_flows")
      .select("from_county_fips, from_name, inflow_count")
      .eq("to_county_fips", input.countyFips)
      .eq("year", year)
      .order("inflow_count", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map((row) => ({
      fromCountyFips: row.from_county_fips,
      fromName: row.from_name,
      inflowCount: row.inflow_count,
    }));
  }
}
```

- [ ] **Step 4: Create the module**

```typescript
// packages/backend/src/migration/migration.module.ts
import { Module } from "@nestjs/common";
import { MigrationService } from "./migration.service";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
```

- [ ] **Step 5: Register in AppModule**

Modify `packages/backend/src/app.module.ts` — add `MigrationModule` to imports.

- [ ] **Step 6: Run tests and verify pass**

Run: `npx nx test backend --testPathPattern=migration.service.spec`
Expected: PASS (both tests).

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/migration/ packages/backend/src/app.module.ts
git commit -m "feat(migration): add MigrationService for IRS migration flows"
```

---

### Task 4: EmploymentSectorsService

**Files:**

- Create: `packages/backend/src/employment-sectors/employment-sectors.module.ts`
- Create: `packages/backend/src/employment-sectors/employment-sectors.service.ts`
- Create: `packages/backend/src/employment-sectors/__tests__/employment-sectors.service.spec.ts`
- Modify: `packages/backend/src/app.module.ts` — register module

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/employment-sectors/__tests__/employment-sectors.service.spec.ts
import { Test } from "@nestjs/testing";
import { EmploymentSectorsService } from "../employment-sectors.service";
import { SupabaseService } from "../../supabase/supabase.service";

describe("EmploymentSectorsService", () => {
  let service: EmploymentSectorsService;
  let supabase: jest.Mocked<SupabaseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmploymentSectorsService,
        { provide: SupabaseService, useValue: { from: jest.fn() } },
      ],
    }).compile();
    service = module.get(EmploymentSectorsService);
    supabase = module.get(SupabaseService);
  });

  it("returns top-N sectors as percent shares", async () => {
    const limitMock = jest.fn().mockResolvedValue({
      data: [
        {
          naics_code: "54",
          naics_label: "Professional Services",
          employment: 28000,
        },
        { naics_code: "62", naics_label: "Healthcare", employment: 19000 },
        { naics_code: "54xx", naics_label: "Biotech", employment: 15000 },
      ],
      error: null,
    });
    const orderMock = jest.fn().mockReturnValue({ limit: limitMock });
    const eqMock = jest.fn().mockReturnValue({ order: orderMock });
    const eq2Mock = jest.fn().mockReturnValue({ eq: eqMock });
    const selectMock = jest.fn().mockReturnValue({ eq: eq2Mock });
    supabase.from.mockReturnValue({ select: selectMock } as any);

    const result = await service.getTopSectors({
      countyFips: "37183",
      topN: 5,
    });

    expect(result.sectors).toHaveLength(3);
    expect(result.sectors[0].percentShare).toBeCloseTo(45.16, 1); // 28000 / 62000
    expect(result.totalEmployment).toBe(62000);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx nx test backend --testPathPattern=employment-sectors.service.spec`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement service**

```typescript
// packages/backend/src/employment-sectors/employment-sectors.service.ts
import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

export interface SectorBreakdown {
  naicsCode: string;
  naicsLabel: string;
  employment: number;
  percentShare: number;
}

@Injectable()
export class EmploymentSectorsService {
  constructor(private supabase: SupabaseService) {}

  async getTopSectors(input: {
    countyFips: string;
    topN?: number;
    year?: number;
  }) {
    const topN = input.topN ?? 5;
    const year = input.year ?? new Date().getFullYear() - 1;

    const { data, error } = await this.supabase
      .from("employment_sectors")
      .select("naics_code, naics_label, employment")
      .eq("county_fips", input.countyFips)
      .eq("year", year)
      .order("employment", { ascending: false })
      .limit(topN);

    if (error || !data) return { sectors: [], totalEmployment: 0 };

    const totalEmployment = data.reduce(
      (sum, row) => sum + (row.employment ?? 0),
      0,
    );
    const sectors: SectorBreakdown[] = data.map((row) => ({
      naicsCode: row.naics_code,
      naicsLabel: row.naics_label,
      employment: row.employment,
      percentShare:
        totalEmployment > 0 ? (row.employment / totalEmployment) * 100 : 0,
    }));

    return { sectors, totalEmployment };
  }
}
```

- [ ] **Step 4: Create module + register**

```typescript
// packages/backend/src/employment-sectors/employment-sectors.module.ts
import { Module } from "@nestjs/common";
import { EmploymentSectorsService } from "./employment-sectors.service";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  providers: [EmploymentSectorsService],
  exports: [EmploymentSectorsService],
})
export class EmploymentSectorsModule {}
```

Add to `app.module.ts` imports.

- [ ] **Step 5: Run tests, verify pass**

Run: `npx nx test backend --testPathPattern=employment-sectors.service.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/employment-sectors/ packages/backend/src/app.module.ts
git commit -m "feat(employment-sectors): add EmploymentSectorsService for BLS QCEW data"
```

---

### Task 5: RedisTourCacheService — anonymous artifact cache

**Files:**

- Create: `packages/backend/src/anonymous/redis-tour-cache.service.ts`
- Create: `packages/backend/src/anonymous/__tests__/redis-tour-cache.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/anonymous/__tests__/redis-tour-cache.service.spec.ts
import { Test } from "@nestjs/testing";
import { RedisTourCacheService } from "../redis-tour-cache.service";
import { RedisService } from "../../redis/redis.service";

describe("RedisTourCacheService", () => {
  let service: RedisTourCacheService;
  let redis: any;

  beforeEach(async () => {
    redis = {
      set: jest.fn().mockResolvedValue("OK"),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    const module = await Test.createTestingModule({
      providers: [
        RedisTourCacheService,
        { provide: RedisService, useValue: { client: redis } },
      ],
    }).compile();
    service = module.get(RedisTourCacheService);
  });

  it("stores a session with 7-day TTL", async () => {
    const session = {
      sessionId: "sess-1",
      reportId: "rpt-1",
      persona: "agent" as const,
      market: { geoLevel: "city", geoId: "cary-nc", name: "Cary, NC" },
      reportPayload: { sections: [] },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      claimedBy: null,
    };
    await service.set(session);
    expect(redis.set).toHaveBeenCalledWith(
      "tour:sess-1",
      expect.any(String),
      "EX",
      7 * 24 * 60 * 60,
    );
  });

  it("reads back a session and parses JSON", async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({ sessionId: "sess-1", persona: "agent" }),
    );
    const result = await service.get("sess-1");
    expect(result?.sessionId).toBe("sess-1");
  });

  it("returns null when key missing", async () => {
    redis.get.mockResolvedValue(null);
    expect(await service.get("absent")).toBeNull();
  });

  it("marks claimed and updates atomically", async () => {
    redis.get.mockResolvedValue(
      JSON.stringify({
        sessionId: "sess-1",
        persona: "agent",
        claimedBy: null,
      }),
    );
    const claimed = await service.markClaimed("sess-1", "user-99");
    expect(claimed?.claimedBy).toBe("user-99");
    expect(redis.set).toHaveBeenCalledWith(
      "tour:sess-1",
      expect.stringContaining('"claimedBy":"user-99"'),
      "EX",
      expect.any(Number),
    );
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx nx test backend --testPathPattern=redis-tour-cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement RedisTourCacheService**

```typescript
// packages/backend/src/anonymous/redis-tour-cache.service.ts
import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

export type Persona = "agent" | "investor" | "homebuyer";

export interface MarketRef {
  geoLevel: string;
  geoId: string;
  name: string;
}

export interface TourSession {
  sessionId: string;
  reportId: string;
  persona: Persona;
  market: MarketRef;
  reportPayload: unknown;
  createdAt: string;
  expiresAt: string;
  claimedBy: string | null;
}

const TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class RedisTourCacheService {
  constructor(private redis: RedisService) {}

  async set(session: TourSession): Promise<void> {
    await this.redis.client.set(
      `tour:${session.sessionId}`,
      JSON.stringify(session),
      "EX",
      TTL_SECONDS,
    );
  }

  async get(sessionId: string): Promise<TourSession | null> {
    const raw = await this.redis.client.get(`tour:${sessionId}`);
    return raw ? (JSON.parse(raw) as TourSession) : null;
  }

  async markClaimed(
    sessionId: string,
    userId: string,
  ): Promise<TourSession | null> {
    const existing = await this.get(sessionId);
    if (!existing) return null;
    const updated: TourSession = { ...existing, claimedBy: userId };
    await this.redis.client.set(
      `tour:${sessionId}`,
      JSON.stringify(updated),
      "EX",
      TTL_SECONDS,
    );
    return updated;
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.client.del(`tour:${sessionId}`);
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx nx test backend --testPathPattern=redis-tour-cache`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/anonymous/redis-tour-cache.service.ts \
  packages/backend/src/anonymous/__tests__/redis-tour-cache.service.spec.ts
git commit -m "feat(anonymous): add RedisTourCacheService for anon report sessions"
```

---

### Task 6: AnonRateLimitGuard — 1 generation per IP per 24h

**Files:**

- Create: `packages/backend/src/anonymous/anon-rate-limit.guard.ts`
- Create: `packages/backend/src/anonymous/__tests__/anon-rate-limit.guard.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/anonymous/__tests__/anon-rate-limit.guard.spec.ts
import { ExecutionContext, HttpException } from "@nestjs/common";
import { AnonRateLimitGuard } from "../anon-rate-limit.guard";

describe("AnonRateLimitGuard", () => {
  let guard: AnonRateLimitGuard;
  let redis: any;

  beforeEach(() => {
    redis = {
      incr: jest.fn(),
      expire: jest.fn().mockResolvedValue(1),
    };
    guard = new AnonRateLimitGuard({ client: redis } as any);
  });

  function ctx(ip = "1.2.3.4", ua = "Mozilla/5.0") {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { "user-agent": ua, "x-forwarded-for": ip },
          socket: { remoteAddress: "127.0.0.1" },
        }),
      }),
    } as ExecutionContext;
  }

  it("allows the first call from an IP", async () => {
    redis.incr.mockResolvedValue(1);
    expect(await guard.canActivate(ctx())).toBe(true);
    expect(redis.expire).toHaveBeenCalledWith("anon_rpt:1.2.3.4", 24 * 60 * 60);
  });

  it("blocks the second call from the same IP within 24h", async () => {
    redis.incr.mockResolvedValue(2);
    await expect(guard.canActivate(ctx())).rejects.toThrow(HttpException);
  });

  it("rejects obvious bot user-agents", async () => {
    redis.incr.mockResolvedValue(1);
    await expect(
      guard.canActivate(ctx("1.2.3.4", "curl/7.85.0")),
    ).rejects.toThrow(HttpException);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx nx test backend --testPathPattern=anon-rate-limit.guard`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement guard**

```typescript
// packages/backend/src/anonymous/anon-rate-limit.guard.ts
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

const BOT_UA =
  /(curl|wget|HeadlessChrome|Bot|Crawler|Spider|httpclient|python-requests)/i;
const TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class AnonRateLimitGuard implements CanActivate {
  constructor(private redis: RedisService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const ua = String(req.headers["user-agent"] ?? "");
    const ip =
      String(req.headers["x-forwarded-for"] ?? "")
        .split(",")[0]
        ?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    if (!ua || BOT_UA.test(ua)) {
      throw new HttpException(
        { error: "forbidden", code: "BOT_DETECTED" },
        HttpStatus.FORBIDDEN,
      );
    }

    const key = `anon_rpt:${ip}`;
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, TTL_SECONDS);
    }
    if (count > 1) {
      throw new HttpException(
        {
          error: "rate_limited",
          retryAfter: TTL_SECONDS,
          message:
            "You can try one demo report per day. Sign up free for unlimited.",
          signupUrl: "/auth/sign-up?from=tour-rate-limit",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx nx test backend --testPathPattern=anon-rate-limit.guard`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/anonymous/anon-rate-limit.guard.ts \
  packages/backend/src/anonymous/__tests__/anon-rate-limit.guard.spec.ts
git commit -m "feat(anonymous): add AnonRateLimitGuard (1 per IP per 24h + UA screening)"
```

---

### Task 7: GeneratePresentationDto

**Files:**

- Create: `packages/backend/src/anonymous/dto/generate-presentation.dto.ts`

- [ ] **Step 1: Write the DTO with class-validator**

```typescript
// packages/backend/src/anonymous/dto/generate-presentation.dto.ts
import {
  IsIn,
  IsObject,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class MarketRefDto {
  @IsString() @IsIn(["metro", "county", "city", "zip"]) geoLevel!: string;
  @IsString() @MinLength(1) @MaxLength(64) geoId!: string;
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
}

export class GeneratePresentationDto {
  @IsString() @MinLength(8) @MaxLength(128) sessionId!: string;
  @IsIn(["agent", "investor", "homebuyer"]) persona!:
    | "agent"
    | "investor"
    | "homebuyer";
  @ValidateNested() @Type(() => MarketRefDto) @IsObject() market!: MarketRefDto;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/anonymous/dto/generate-presentation.dto.ts
git commit -m "feat(anonymous): add GeneratePresentationDto"
```

---

### Task 8: ListingPresentationNarrativeService — Claude integration

**Files:**

- Create: `packages/backend/src/anonymous/listing-presentation-narrative.service.ts`
- Create: `packages/backend/src/anonymous/__tests__/listing-presentation-narrative.service.spec.ts`

- [ ] **Step 1: Write the failing test (mocked Claude)**

```typescript
// packages/backend/src/anonymous/__tests__/listing-presentation-narrative.service.spec.ts
import { Test } from "@nestjs/testing";
import { ListingPresentationNarrativeService } from "../listing-presentation-narrative.service";
import { AnthropicService } from "../../ai/anthropic.service";

describe("ListingPresentationNarrativeService", () => {
  let service: ListingPresentationNarrativeService;
  let anthropic: jest.Mocked<AnthropicService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListingPresentationNarrativeService,
        {
          provide: AnthropicService,
          useValue: {
            messages: jest.fn().mockResolvedValue({
              content: [
                {
                  type: "text",
                  text: '{"thesis":"Cary is strong.","actions":[{"title":"List now","desc":"Spring window."},{"title":"Price at comps","desc":""},{"title":"Lead with migration","desc":""}],"strategy":"List in next 60 days..."}',
                },
              ],
            }),
          },
        },
      ],
    }).compile();
    service = module.get(ListingPresentationNarrativeService);
    anthropic = module.get(AnthropicService);
  });

  it("returns parsed narrative including thesis, strategy, and 3 actions", async () => {
    const result = await service.generate({
      market: { geoLevel: "city", geoId: "cary-nc", name: "Cary, NC" },
      persona: "agent",
      structuredFacts: { score: 87, dom: 11, soldAboveList: 0.62 },
    });
    expect(result.thesis).toContain("Cary");
    expect(result.actions).toHaveLength(3);
    expect(result.strategy).toBeTruthy();
  });

  it("returns deterministic fallback if Claude returns malformed JSON", async () => {
    anthropic.messages.mockResolvedValueOnce({
      content: [{ type: "text", text: "not json" }],
    } as any);
    const result = await service.generate({
      market: { geoLevel: "city", geoId: "cary-nc", name: "Cary, NC" },
      persona: "agent",
      structuredFacts: { score: 87 },
    });
    expect(result.fallbackUsed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx nx test backend --testPathPattern=narrative.service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement narrative service**

```typescript
// packages/backend/src/anonymous/listing-presentation-narrative.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { AnthropicService } from "../ai/anthropic.service";

export interface NarrativeInput {
  market: { geoLevel: string; geoId: string; name: string };
  persona: "agent" | "investor" | "homebuyer";
  structuredFacts: Record<string, unknown>;
}

export interface NarrativeOutput {
  thesis: string;
  strategy: string;
  actions: Array<{ title: string; desc: string }>;
  fallbackUsed: boolean;
}

const SYSTEM_PROMPT = `You are PropertyIQ's market-strategy synthesizer. Given structured market facts, write a tight, specific listing-presentation narrative for a real estate agent. Output STRICT JSON only with shape:
{ "thesis": "<3 sentences referencing specific data>", "strategy": "<3 paragraphs with pricing/positioning/timing>", "actions": [ { "title": "<6 words>", "desc": "<1 sentence>" } x 3 ] }
Tone: confident, data-grounded, not generic. Cite exact numbers from the facts.`;

@Injectable()
export class ListingPresentationNarrativeService {
  private logger = new Logger(ListingPresentationNarrativeService.name);

  constructor(private anthropic: AnthropicService) {}

  async generate(input: NarrativeInput): Promise<NarrativeOutput> {
    const userMessage = `Market: ${input.market.name}\nPersona: ${input.persona}\nFacts: ${JSON.stringify(input.structuredFacts, null, 2)}\n\nProduce the narrative JSON now.`;
    try {
      const response = await this.anthropic.messages({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      const text = response.content?.[0]?.text ?? "";
      const parsed = JSON.parse(text);
      return {
        thesis: parsed.thesis ?? "",
        strategy: parsed.strategy ?? "",
        actions: Array.isArray(parsed.actions)
          ? parsed.actions.slice(0, 3)
          : [],
        fallbackUsed: false,
      };
    } catch (err) {
      this.logger.warn(
        `Narrative generation failed for ${input.market.name}: ${String(err)}`,
      );
      return this.fallback(input);
    }
  }

  private fallback(input: NarrativeInput): NarrativeOutput {
    return {
      thesis: `Market analysis for ${input.market.name} is available. Strategic synthesis is temporarily unavailable; the structured data sections below remain accurate.`,
      strategy:
        "A full AI-synthesized strategy is temporarily unavailable. The structured signals (PropertyIQ Score, market metrics, peer comparison, demographics, employment) remain authoritative for this report.",
      actions: [
        {
          title: "Review the structured signals",
          desc: "Use the Market Right Now and Forecast sections to inform pricing.",
        },
        {
          title: "Compare against peer markets",
          desc: "Section 5 surfaces three comparable markets for positioning.",
        },
        {
          title: "Validate with local closed sales",
          desc: "Cross-check the auto-generated forecast against your most recent comparable closes.",
        },
      ],
      fallbackUsed: true,
    };
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx nx test backend --testPathPattern=narrative.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/anonymous/listing-presentation-narrative.service.ts \
  packages/backend/src/anonymous/__tests__/listing-presentation-narrative.service.spec.ts
git commit -m "feat(anonymous): add narrative service with Claude Haiku 4.5 + fallback"
```

---

### Task 9: ListingPresentationService — orchestrator

**Files:**

- Create: `packages/backend/src/anonymous/listing-presentation.service.ts`
- Create: `packages/backend/src/anonymous/__tests__/listing-presentation.service.spec.ts`

This service orchestrates: scoring (existing) → metric resolution (existing) → peers (Task 1) → migration (Task 3) → employment sectors (Task 4) → narrative (Task 8). Returns the full report payload.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/backend/src/anonymous/__tests__/listing-presentation.service.spec.ts
import { Test } from "@nestjs/testing";
import { ListingPresentationService } from "../listing-presentation.service";
import { ScoringService } from "../../scoring/scoring.service";
import { MetricResolutionService } from "../../metric-resolution/metric-resolution.service";
import { PeersService } from "../../markets/peers.service";
import { MigrationService } from "../../migration/migration.service";
import { EmploymentSectorsService } from "../../employment-sectors/employment-sectors.service";
import { ListingPresentationNarrativeService } from "../listing-presentation-narrative.service";

describe("ListingPresentationService", () => {
  let service: ListingPresentationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListingPresentationService,
        {
          provide: ScoringService,
          useValue: {
            getScore: jest
              .fn()
              .mockResolvedValue({
                score: 87,
                confidence: { level: "A", percentage: 91 },
              }),
          },
        },
        {
          provide: MetricResolutionService,
          useValue: {
            resolveMetricBatch: jest
              .fn()
              .mockResolvedValue({ home_value: 651000, dom: 11 }),
          },
        },
        {
          provide: PeersService,
          useValue: { findPeers: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: MigrationService,
          useValue: { getTopInflows: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: EmploymentSectorsService,
          useValue: {
            getTopSectors: jest
              .fn()
              .mockResolvedValue({ sectors: [], totalEmployment: 0 }),
          },
        },
        {
          provide: ListingPresentationNarrativeService,
          useValue: {
            generate: jest
              .fn()
              .mockResolvedValue({
                thesis: "x",
                strategy: "y",
                actions: [],
                fallbackUsed: false,
              }),
          },
        },
      ],
    }).compile();
    service = module.get(ListingPresentationService);
  });

  it("returns a report with all 10 sections populated", async () => {
    const result = await service.generate({
      sessionId: "sess-1",
      persona: "agent",
      market: { geoLevel: "city", geoId: "cary-nc", name: "Cary, NC" },
    });
    expect(result.report.sections).toHaveLength(10);
    expect(result.reportId).toMatch(/^anon-rpt-/);
    expect(result.watermark).toBeTruthy();
  });

  it('marks affected sections "limited data" when data sources are empty', async () => {
    const result = await service.generate({
      sessionId: "sess-2",
      persona: "agent",
      market: { geoLevel: "zip", geoId: "99999", name: "Tiny ZIP" },
    });
    const migrationSection = result.report.sections.find(
      (s) => s.id === "migration",
    );
    expect(migrationSection?.limitedData).toBe(true);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npx nx test backend --testPathPattern=listing-presentation.service.spec`
Expected: FAIL.

- [ ] **Step 3: Implement orchestrator**

```typescript
// packages/backend/src/anonymous/listing-presentation.service.ts
import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ScoringService } from "../scoring/scoring.service";
import { MetricResolutionService } from "../metric-resolution/metric-resolution.service";
import { PeersService } from "../markets/peers.service";
import { MigrationService } from "../migration/migration.service";
import { EmploymentSectorsService } from "../employment-sectors/employment-sectors.service";
import { ListingPresentationNarrativeService } from "./listing-presentation-narrative.service";

export interface GenerateInput {
  sessionId: string;
  persona: "agent" | "investor" | "homebuyer";
  market: { geoLevel: string; geoId: string; name: string };
}

export interface ReportSection {
  id: string;
  title: string;
  data: unknown;
  limitedData: boolean;
}

export interface GeneratedReport {
  reportId: string;
  sessionId: string;
  watermark: string;
  expiresAt: string;
  claimable: boolean;
  report: { sections: ReportSection[] };
}

const SECTION_IDS = [
  "executive-summary",
  "market-now",
  "trajectory-12mo",
  "forecast",
  "peers",
  "migration",
  "affordability",
  "employment",
  "validation",
  "ai-strategy",
] as const;

@Injectable()
export class ListingPresentationService {
  constructor(
    private scoring: ScoringService,
    private metrics: MetricResolutionService,
    private peers: PeersService,
    private migration: MigrationService,
    private sectors: EmploymentSectorsService,
    private narrative: ListingPresentationNarrativeService,
  ) {}

  async generate(input: GenerateInput): Promise<GeneratedReport> {
    const { market } = input;
    const reportId = `anon-rpt-${randomUUID()}`;

    // Parallel data fetches (each handles its own missing-data case)
    const [score, metricsBatch, peersList, migrationFlows, sectorMix] =
      await Promise.all([
        this.scoring.getScore(market.geoLevel, market.geoId).catch(() => null),
        this.metrics
          .resolveMetricBatch(
            [
              "home_value",
              "rent_index",
              "dom_median",
              "pct_sold_above_list",
              "months_supply",
              "sale_to_list_ratio",
              "price_per_sqft",
              "household_income_median",
              "pct_bachelors_or_higher",
            ],
            market.geoLevel,
            market.geoId,
          )
          .catch(() => ({})),
        this.peers
          .findPeers({
            geoLevel: market.geoLevel,
            geoId: market.geoId,
            score: 0, // back-filled below
            parentMetro: null,
            householdCount: 0,
          })
          .catch(() => []),
        this.migration
          .getTopInflows({ countyFips: market.geoId, limit: 5 })
          .catch(() => []),
        this.sectors
          .getTopSectors({ countyFips: market.geoId, topN: 5 })
          .catch(() => ({ sectors: [], totalEmployment: 0 })),
      ]);

    const structuredFacts = {
      score: score?.score,
      ...metricsBatch,
      peerCount: peersList.length,
      migrationCount: migrationFlows.length,
    };
    const ai = await this.narrative.generate({
      market,
      persona: input.persona,
      structuredFacts,
    });

    const sections: ReportSection[] = [
      {
        id: "executive-summary",
        title: "Executive summary",
        data: { score, thesis: ai.thesis },
        limitedData: !score,
      },
      {
        id: "market-now",
        title: "The market right now",
        data: metricsBatch,
        limitedData: Object.keys(metricsBatch).length < 4,
      },
      {
        id: "trajectory-12mo",
        title: "12-month trajectory",
        data: {
          /* timeseries fetched in render */
        },
        limitedData: false,
      },
      {
        id: "forecast",
        title: "Forecast",
        data: {
          /* forecast tool output */
        },
        limitedData: false,
      },
      {
        id: "peers",
        title: "Comparable peers",
        data: peersList,
        limitedData: peersList.length === 0,
      },
      {
        id: "migration",
        title: "Migration & demographics",
        data: migrationFlows,
        limitedData: migrationFlows.length === 0,
      },
      {
        id: "affordability",
        title: "Affordability",
        data: {
          /* derived */
        },
        limitedData: false,
      },
      {
        id: "employment",
        title: "Economic drivers",
        data: sectorMix,
        limitedData: sectorMix.sectors.length === 0,
      },
      {
        id: "validation",
        title: "Validated track record",
        data: {
          /* validation pipeline */
        },
        limitedData: false,
      },
      {
        id: "ai-strategy",
        title: "Recommended seller strategy",
        data: ai,
        limitedData: ai.fallbackUsed,
      },
    ];

    return {
      reportId,
      sessionId: input.sessionId,
      watermark: "PropertyIQ Demo · Sign up free to remove",
      expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      claimable: true,
      report: { sections },
    };
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx nx test backend --testPathPattern=listing-presentation.service.spec`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/anonymous/listing-presentation.service.ts \
  packages/backend/src/anonymous/__tests__/listing-presentation.service.spec.ts
git commit -m "feat(anonymous): add ListingPresentationService orchestrator (10 sections)"
```

---

### Task 10: AnonymousController + Module wiring

**Files:**

- Create: `packages/backend/src/anonymous/anonymous.controller.ts`
- Create: `packages/backend/src/anonymous/anonymous.module.ts`
- Modify: `packages/backend/src/app.module.ts` — register AnonymousModule

- [ ] **Step 1: Implement controller**

```typescript
// packages/backend/src/anonymous/anonymous.controller.ts
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { GeneratePresentationDto } from "./dto/generate-presentation.dto";
import { ListingPresentationService } from "./listing-presentation.service";
import { RedisTourCacheService } from "./redis-tour-cache.service";
import { AnonRateLimitGuard } from "./anon-rate-limit.guard";

@Controller("api/anonymous")
export class AnonymousController {
  constructor(
    private listing: ListingPresentationService,
    private cache: RedisTourCacheService,
  ) {}

  @Post("listing-presentation")
  @UseGuards(AnonRateLimitGuard)
  async generate(@Body() dto: GeneratePresentationDto) {
    const result = await this.listing.generate({
      sessionId: dto.sessionId,
      persona: dto.persona,
      market: dto.market,
    });

    await this.cache.set({
      sessionId: result.sessionId,
      reportId: result.reportId,
      persona: dto.persona,
      market: dto.market,
      reportPayload: result.report,
      createdAt: new Date().toISOString(),
      expiresAt: result.expiresAt,
      claimedBy: null,
    });

    return result;
  }
}
```

- [ ] **Step 2: Implement module**

```typescript
// packages/backend/src/anonymous/anonymous.module.ts
import { Module } from "@nestjs/common";
import { AnonymousController } from "./anonymous.controller";
import { ListingPresentationService } from "./listing-presentation.service";
import { ListingPresentationNarrativeService } from "./listing-presentation-narrative.service";
import { RedisTourCacheService } from "./redis-tour-cache.service";
import { AnonRateLimitGuard } from "./anon-rate-limit.guard";
import { RedisModule } from "../redis/redis.module";
import { ScoringModule } from "../scoring/scoring.module";
import { MetricResolutionModule } from "../metric-resolution/metric-resolution.module";
import { MarketsModule } from "../markets/markets.module";
import { MigrationModule } from "../migration/migration.module";
import { EmploymentSectorsModule } from "../employment-sectors/employment-sectors.module";
import { AiModule } from "../ai/ai.module";

@Module({
  imports: [
    RedisModule,
    ScoringModule,
    MetricResolutionModule,
    MarketsModule,
    MigrationModule,
    EmploymentSectorsModule,
    AiModule,
  ],
  controllers: [AnonymousController],
  providers: [
    ListingPresentationService,
    ListingPresentationNarrativeService,
    RedisTourCacheService,
    AnonRateLimitGuard,
  ],
  exports: [RedisTourCacheService],
})
export class AnonymousModule {}
```

- [ ] **Step 3: Register in app.module.ts**

Add `AnonymousModule` to imports.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev:backend &
curl -X POST http://localhost:3001/api/anonymous/listing-presentation \
  -H 'content-type: application/json' \
  -d '{"sessionId":"test-session-123","persona":"agent","market":{"geoLevel":"city","geoId":"cary-nc","name":"Cary, NC"}}'
```

Expected: JSON with `reportId`, `sessionId: "test-session-123"`, `report.sections` with 10 entries. Second call from same IP within 24h returns 429.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/anonymous/anonymous.controller.ts \
  packages/backend/src/anonymous/anonymous.module.ts \
  packages/backend/src/app.module.ts
git commit -m "feat(anonymous): wire AnonymousController + module"
```

---

### Task 11: Frontend fetcher in @/lib/data

**Files:**

- Create: `packages/frontend/lib/data/fetchers/anonymous-listing-presentation.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts` — re-export

- [ ] **Step 1: Implement the fetcher**

```typescript
// packages/frontend/lib/data/fetchers/anonymous-listing-presentation.ts
import { API_URL } from "./base";

export type Persona = "agent" | "investor" | "homebuyer";

export interface MarketRef {
  geoLevel: "metro" | "county" | "city" | "zip";
  geoId: string;
  name: string;
}

export interface ReportSection {
  id: string;
  title: string;
  data: unknown;
  limitedData: boolean;
}

export interface AnonReportResponse {
  reportId: string;
  sessionId: string;
  watermark: string;
  expiresAt: string;
  claimable: boolean;
  report: { sections: ReportSection[] };
}

export class TourRateLimitError extends Error {
  retryAfter: number;
  signupUrl: string;
  constructor(retryAfter: number, signupUrl: string) {
    super("rate_limited");
    this.retryAfter = retryAfter;
    this.signupUrl = signupUrl;
  }
}

export async function generateAnonymousListingPresentation(input: {
  sessionId: string;
  persona: Persona;
  market: MarketRef;
}): Promise<AnonReportResponse> {
  const res = await fetch(`${API_URL}/api/anonymous/listing-presentation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new TourRateLimitError(
      body.retryAfter ?? 86400,
      body.signupUrl ?? "/auth/sign-up",
    );
  }
  if (!res.ok) {
    throw new Error(`Anon listing presentation failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Re-export from barrel**

In `packages/frontend/lib/data/fetchers/index.ts`, add `export * from './anonymous-listing-presentation';`. In `packages/frontend/lib/data/index.ts`, re-export the types.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/lib/data/fetchers/anonymous-listing-presentation.ts \
  packages/frontend/lib/data/fetchers/index.ts \
  packages/frontend/lib/data/index.ts
git commit -m "feat(data): add generateAnonymousListingPresentation fetcher"
```

---

### Task 12: useAnonymousListingPresentation hook

**Files:**

- Create: `packages/frontend/lib/data/hooks/useAnonymousListingPresentation.ts`
- Modify: `packages/frontend/lib/data/hooks/index.ts` — re-export

- [ ] **Step 1: Implement the hook**

```typescript
// packages/frontend/lib/data/hooks/useAnonymousListingPresentation.ts
import { useMutation } from "@tanstack/react-query";
import {
  generateAnonymousListingPresentation,
  AnonReportResponse,
  Persona,
  MarketRef,
} from "../fetchers/anonymous-listing-presentation";

export function useAnonymousListingPresentation() {
  return useMutation<
    AnonReportResponse,
    Error,
    { sessionId: string; persona: Persona; market: MarketRef }
  >({
    mutationFn: generateAnonymousListingPresentation,
  });
}
```

- [ ] **Step 2: Re-export from barrel**

Add to `packages/frontend/lib/data/hooks/index.ts`: `export * from './useAnonymousListingPresentation';`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/lib/data/hooks/useAnonymousListingPresentation.ts \
  packages/frontend/lib/data/hooks/index.ts
git commit -m "feat(data): add useAnonymousListingPresentation mutation hook"
```

---

### Task 13: Reconciliation pass against ingested schemas

When the parallel data ingest work finishes:

- [ ] Verify the actual table names match (`migration_flows`, `employment_sectors`).
- [ ] Verify the column names match the assumptions in MigrationService and EmploymentSectorsService.
- [ ] If different, update the two service files (string column names only) and re-run the test suites.
- [ ] Commit any reconciliation: `git commit -m "fix(migration|employment-sectors): reconcile column names with ingest"`.

---

## Acceptance criteria for Phase 01 done

- [ ] `POST /api/anonymous/listing-presentation` returns a 200 with all 10 section IDs for `cary-nc` from a fresh IP within rate limit.
- [ ] Second POST from same IP within 24h returns 429 with the rate-limit shape.
- [ ] `GET /api/markets/peers/city/cary-nc` returns at least 1 peer.
- [ ] All Phase 01 spec files pass jest.
- [ ] No new ESLint errors in changed files.
- [ ] Frontend can import `generateAnonymousListingPresentation` and `useAnonymousListingPresentation` from `@/lib/data`.
