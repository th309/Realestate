/**
 * RentcastService — response-shape transform tests.
 *
 * Exercises the two mapper modules end-to-end via the service so we catch
 * wiring bugs as well as mapping bugs:
 *   - `/properties` array unwrapping + full property-record field coverage
 *   - sales-comp vs rental-comp price-vs-rent routing
 */

import { RentcastService } from '../rentcast.service';
import {
  makeRedisClient,
  makeRedisService,
  makeConfig,
  expectedCacheKey,
} from './test-helpers';

describe('RentcastService — response mapping', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('unwraps /properties array response and maps every documented field', async () => {
    const client = makeRedisClient();
    // RentCast returns an ARRAY for /properties; previous mapping treated it
    // as an object and silently dropped every field. The raw payload below
    // mirrors a real response from 123 S Market St, Frederick, MD.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [
        {
          id: '123-S-Market-St,-Frederick,-MD-21701',
          formattedAddress: '123 S Market St, Frederick, MD 21701',
          addressLine1: '123 S Market St',
          addressLine2: null,
          city: 'Frederick',
          state: 'MD',
          zipCode: '21701',
          county: 'Frederick',
          countyFips: '021',
          latitude: 39.411131,
          longitude: -77.411531,
          propertyType: 'Townhouse',
          bedrooms: 3,
          bathrooms: 3.5,
          squareFootage: 3320,
          lotSize: 1786,
          yearBuilt: 2007,
          assessorID: '02-592069',
          legalDescription: 'UNIT 123',
          subdivision: 'MARKET SQUARE',
          lastSaleDate: '2020-11-06T00:00:00.000Z',
          lastSalePrice: 495000,
          hoa: { fee: 270 },
          features: {
            architectureType: 'Colonial Revival',
            unitCount: 1,
            floorCount: 4,
            garage: true,
            garageSpaces: 2,
          },
          taxAssessments: {
            '2024': {
              year: 2024,
              value: 485000,
              land: 145000,
              improvements: 340000,
            },
            '2023': {
              year: 2023,
              value: 459000,
              land: null,
              improvements: null,
            },
          },
          propertyTaxes: {
            '2024': { year: 2024, total: 8738 },
            '2023': { year: 2023, total: 8262 },
          },
          history: {
            '2020-11-06': {
              event: 'Sale',
              date: '2020-11-06T00:00:00.000Z',
              price: 495000,
            },
            '2018-05-14': {
              event: 'Sale',
              date: '2018-05-14T00:00:00.000Z',
              price: 470000,
            },
          },
          owner: {
            names: ['Troy Houston'],
            type: 'Individual',
          },
          ownerOccupied: true,
        },
      ],
    });

    const svc = new RentcastService(
      makeConfig({ RENTCAST_API_KEY_HEADER: 'X-Custom-Key' }),
      makeRedisService(client),
    );
    const result = await svc.getPropertyRecord('123 S Market St');

    // Identity
    expect(result.id).toBe('123-S-Market-St,-Frederick,-MD-21701');
    expect(result.formattedAddress).toBe(
      '123 S Market St, Frederick, MD 21701',
    );
    expect(result.city).toBe('Frederick');
    expect(result.state).toBe('MD');
    expect(result.zipCode).toBe('21701');
    expect(result.county).toBe('Frederick');
    expect(result.countyFips).toBe('021');

    // Physical
    expect(result.beds).toBe(3);
    expect(result.baths).toBe(3.5);
    expect(result.sqft).toBe(3320);
    expect(result.lotSize).toBe(1786);
    expect(result.yearBuilt).toBe(2007);
    expect(result.propertyType).toBe('Townhouse');

    // Location
    expect(result.lat).toBe(39.411131);
    expect(result.lon).toBe(-77.411531);

    // Public records
    expect(result.assessorID).toBe('02-592069');
    expect(result.subdivision).toBe('MARKET SQUARE');

    // Last sale
    expect(result.lastSaleDate).toBe('2020-11-06T00:00:00.000Z');
    expect(result.lastSalePrice).toBe(495000);

    // HOA + features
    expect(result.hoaFee).toBe(270);
    expect(result.architectureType).toBe('Colonial Revival');
    expect(result.garage).toBe(true);
    expect(result.garageSpaces).toBe(2);
    expect(result.floorCount).toBe(4);
    expect(result.unitCount).toBe(1);

    // Tax history — newest-first, latestAssessment surfaced
    expect(result.taxAssessments[0]).toEqual({
      year: 2024,
      value: 485000,
      land: 145000,
      improvements: 340000,
    });
    expect(result.taxAssessment).toBe(485000);
    expect(result.propertyTaxes[0]).toEqual({ year: 2024, total: 8738 });

    // Sale history — newest-first
    expect(result.saleHistory[0]).toEqual({
      date: '2020-11-06T00:00:00.000Z',
      event: 'Sale',
      price: 495000,
    });

    // Owner
    expect(result.ownerNames).toEqual(['Troy Houston']);
    expect(result.ownerType).toBe('Individual');
    expect(result.ownerOccupied).toBe(true);

    // Fetch + cache mechanics
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.rentcast.io/v1/properties?address=123%20S%20Market%20St',
    );
    expect(init.headers['X-Custom-Key']).toBe('rc-test-key');
    expect(client.incr).toHaveBeenCalledTimes(1);
    expect(client.set).toHaveBeenCalledWith(
      expectedCacheKey('properties', '123 S Market St'),
      expect.any(String),
      'EX',
      60 * 60 * 24 * 30,
    );
  });

  it('returns all-null property record (but valid shape) when /properties is empty', async () => {
    const client = makeRedisClient();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [],
    });
    const svc = new RentcastService(makeConfig(), makeRedisService(client));
    const result = await svc.getPropertyRecord('999 Nowhere Rd');

    expect(result.beds).toBeNull();
    expect(result.sqft).toBeNull();
    expect(result.lat).toBeNull();
    expect(result.taxAssessments).toEqual([]);
    expect(result.saleHistory).toEqual([]);
    expect(result.ownerNames).toBeNull();
  });

  it('maps sales-comp price into `price` and leaves `rent` null', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        price: 691000,
        priceRangeLow: 536000,
        priceRangeHigh: 846000,
        subjectProperty: {
          formattedAddress: '123 S Market St, Frederick, MD 21701',
        },
        comparables: [
          {
            id: '822-Lindley-Rd,-Frederick,-MD-21701',
            formattedAddress: '822 Lindley Rd, Frederick, MD 21701',
            addressLine1: '822 Lindley Rd',
            city: 'Frederick',
            state: 'MD',
            zipCode: '21701',
            county: 'Frederick',
            countyFips: '021',
            latitude: 39.422726,
            longitude: -77.395356,
            propertyType: 'Townhouse',
            bedrooms: 3,
            bathrooms: 3.5,
            squareFootage: 2945,
            lotSize: 1600,
            yearBuilt: 2019,
            status: 'Active',
            price: 625000,
            listingType: 'Standard',
            listedDate: '2026-04-08T00:00:00.000Z',
            removedDate: null,
            lastSeenDate: '2026-05-18T08:12:23.108Z',
            daysOnMarket: 41,
            distance: 1.1791,
            daysOld: 1,
            correlation: 0.9623,
          },
        ],
      }),
    });
    const svc = new RentcastService(
      makeConfig(),
      makeRedisService(makeRedisClient()),
    );
    const result = await svc.getValueEstimate('123 S Market St');
    expect(result.comps).toHaveLength(1);
    const c = result.comps[0];
    expect(c.price).toBe(625000);
    expect(c.rent).toBeNull();
    expect(c.status).toBe('Active');
    expect(c.listingType).toBe('Standard');
    expect(c.listedDate).toBe('2026-04-08T00:00:00.000Z');
    expect(c.daysOnMarket).toBe(41);
    expect(c.lotSize).toBe(1600);
    expect(c.yearBuilt).toBe(2019);
    expect(c.propertyType).toBe('Townhouse');
    // Sale-date falls back to lastSeenDate when removedDate is null
    expect(c.saleDate).toBe('2026-05-18T08:12:23.108Z');
  });

  it('maps rental-comp price into `rent` and leaves `price` null', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        rent: 3350,
        rentRangeLow: 2940,
        rentRangeHigh: 3760,
        subjectProperty: {
          formattedAddress: '123 S Market St, Frederick, MD 21701',
        },
        comparables: [
          {
            id: '620-N-Bentz-St,-Frederick,-MD-21701',
            formattedAddress: '620 N Bentz St, Frederick, MD 21701',
            city: 'Frederick',
            state: 'MD',
            zipCode: '21701',
            latitude: 39.422163,
            longitude: -77.411699,
            bedrooms: 3,
            bathrooms: 3.5,
            squareFootage: 2605,
            // RentCast puts the monthly rent in `price` on rent comps —
            // this is the bug we're fixing.
            price: 2850,
            status: 'Inactive',
            listedDate: '2025-10-26T00:00:00.000Z',
            removedDate: '2025-12-24T00:00:00.000Z',
            daysOnMarket: 59,
            distance: 0.7631,
            daysOld: 147,
            correlation: 0.9366,
          },
        ],
      }),
    });
    const svc = new RentcastService(
      makeConfig(),
      makeRedisService(makeRedisClient()),
    );
    const result = await svc.getRentEstimate('123 S Market St');
    expect(result.comps).toHaveLength(1);
    const c = result.comps[0];
    expect(c.rent).toBe(2850);
    expect(c.price).toBeNull();
    expect(c.saleDate).toBeNull(); // rentals never get a sale date
    expect(c.status).toBe('Inactive');
    expect(c.removedDate).toBe('2025-12-24T00:00:00.000Z');
    expect(c.daysOnMarket).toBe(59);
  });
});
