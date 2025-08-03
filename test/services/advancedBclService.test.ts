/**
 * Tests for Advanced BCL Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvancedBclService } from '../../src/services/advancedBclService';
import { BCLApiClient } from '../../src/services/bclApiClient';
import {
  AdvancedSearchRequest,
  GeospatialSearchRequest,
  MeasureComparisonRequest,
  BclAnalyticsRequest,
} from '../../src/interfaces/advancedBcl';

// Mock dependencies
vi.mock('../../src/services/bclApiClient');
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
    })),
  },
}));

describe('AdvancedBclService', () => {
  let advancedBclService: AdvancedBclService;
  let mockBclApiClient: BCLApiClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock BCL API client
    mockBclApiClient = {
      searchMeasures: vi.fn(),
      downloadMeasure: vi.fn(),
      installMeasure: vi.fn(),
      updateMeasure: vi.fn(),
      recommendMeasures: vi.fn(),
    } as unknown as BCLApiClient;

    advancedBclService = new AdvancedBclService();
    // Override the internal bclApiClient with our mock
    (advancedBclService as any).bclApiClient = mockBclApiClient;
  });

  describe('advancedSearch', () => {
    it('should perform basic advanced search with query', async () => {
      const mockMeasures = [
        {
          id: 'measure1',
          name: 'Test Measure 1',
          description: 'A test measure for HVAC',
          version: '1.0.0',
          modelerDescription: 'Test description',
          tags: ['hvac', 'energy efficiency'],
          arguments: [],
        },
        {
          id: 'measure2',
          name: 'Test Measure 2',
          description: 'A test measure for lighting',
          version: '1.1.0',
          modelerDescription: 'Another test description',
          tags: ['lighting', 'led'],
          arguments: [],
        },
      ];

      vi.mocked(mockBclApiClient.searchMeasures).mockResolvedValue(mockMeasures);

      const request: AdvancedSearchRequest = {
        query: 'energy efficiency',
        limit: 10,
        includeMetadata: true,
      };

      const result = await advancedBclService.advancedSearch(request);

      expect(result.success).toBe(true);
      expect(result.measures).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.facets).toBeDefined();
      expect(mockBclApiClient.searchMeasures).toHaveBeenCalledWith('energy efficiency');
    });

    it('should apply building type filters', async () => {
      const mockMeasures = [
        {
          id: 'measure1',
          name: 'Office Measure',
          description: 'For office buildings',
          version: '1.0.0',
          modelerDescription: 'Office specific',
          tags: ['office'],
          arguments: [],
        },
      ];

      vi.mocked(mockBclApiClient.searchMeasures).mockResolvedValue(mockMeasures);

      const request: AdvancedSearchRequest = {
        query: 'building',
        filters: {
          buildingTypes: ['Office'],
          minEnergySavings: 10,
          maxPaybackPeriod: 5,
        },
      };

      const result = await advancedBclService.advancedSearch(request);

      expect(result.success).toBe(true);
      expect(result.appliedFilters).toEqual(request.filters);
    });

    it('should sort measures by different criteria', async () => {
      const mockMeasures = [
        {
          id: 'measure1',
          name: 'A Measure',
          description: 'First measure',
          version: '1.0.0',
          modelerDescription: '',
          tags: [],
          arguments: [],
        },
        {
          id: 'measure2',
          name: 'B Measure',
          description: 'Second measure',
          version: '1.0.0',
          modelerDescription: '',
          tags: [],
          arguments: [],
        },
      ];

      vi.mocked(mockBclApiClient.searchMeasures).mockResolvedValue(mockMeasures);

      const request: AdvancedSearchRequest = {
        query: 'test',
        sortOptions: {
          field: 'name',
          direction: 'asc',
        },
      };

      const result = await advancedBclService.advancedSearch(request);

      expect(result.success).toBe(true);
      expect(result.measures[0].name).toBe('A Measure');
      expect(result.measures[1].name).toBe('B Measure');
    });

    it('should handle search errors gracefully', async () => {
      vi.mocked(mockBclApiClient.searchMeasures).mockRejectedValue(new Error('API Error'));

      const request: AdvancedSearchRequest = {
        query: 'test',
      };

      await expect(advancedBclService.advancedSearch(request)).rejects.toThrow(
        'Advanced search failed: API Error',
      );
    });

    it('should apply pagination correctly', async () => {
      const mockMeasures = Array.from({ length: 50 }, (_, i) => ({
        id: `measure${i}`,
        name: `Measure ${i}`,
        description: 'Test measure',
        version: '1.0.0',
        modelerDescription: '',
        tags: [],
        arguments: [],
      }));

      vi.mocked(mockBclApiClient.searchMeasures).mockResolvedValue(mockMeasures);

      const request: AdvancedSearchRequest = {
        query: 'test',
        limit: 10,
        offset: 5,
      };

      const result = await advancedBclService.advancedSearch(request);

      expect(result.measures).toHaveLength(10);
      expect(result.totalCount).toBe(50);
      expect(result.measures[0].name).toBe('Measure 5');
    });
  });

  describe('geospatialSearch', () => {
    it('should perform location-based search', async () => {
      const mockMeasures = [
        {
          id: 'measure1',
          name: 'Local Measure',
          description: 'A measure for this location',
          version: '1.0.0',
          modelerDescription: '',
          tags: [],
          arguments: [],
        },
      ];

      vi.mocked(mockBclApiClient.searchMeasures).mockResolvedValue(mockMeasures);

      const request: GeospatialSearchRequest = {
        query: 'efficiency',
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          climateZone: '4A',
        },
        radius: 100,
        clusterResults: true,
        maxClusters: 5,
      };

      const result = await advancedBclService.geospatialSearch(request);

      expect(result.success).toBe(true);
      expect(result.geographicClusters).toBeDefined();
      expect(Array.isArray(result.geographicClusters)).toBe(true);
    });

    it('should generate geographic clusters when requested', async () => {
      const mockMeasures = [
        {
          id: 'measure1',
          name: 'Measure 1',
          description: 'Test',
          version: '1.0.0',
          modelerDescription: '',
          tags: [],
          arguments: [],
        },
        {
          id: 'measure2',
          name: 'Measure 2',
          description: 'Test',
          version: '1.0.0',
          modelerDescription: '',
          tags: [],
          arguments: [],
        },
      ];

      vi.mocked(mockBclApiClient.searchMeasures).mockResolvedValue(mockMeasures);

      const request: GeospatialSearchRequest = {
        location: {
          latitude: 40.7128,
          longitude: -74.006,
        },
        radius: 50,
        clusterResults: true,
        maxClusters: 3,
      };

      const result = await advancedBclService.geospatialSearch(request);

      expect(result.success).toBe(true);
      expect(result.geographicClusters).toBeDefined();
      if (result.geographicClusters) {
        expect(result.geographicClusters.length).toBeLessThanOrEqual(3);
      }
    });

    it('should handle geospatial search errors', async () => {
      vi.mocked(mockBclApiClient.searchMeasures).mockRejectedValue(
        new Error('Location service error'),
      );

      const request: GeospatialSearchRequest = {
        location: {
          latitude: 40.7128,
          longitude: -74.006,
        },
        radius: 50,
      };

      await expect(advancedBclService.geospatialSearch(request)).rejects.toThrow(
        'Geospatial search failed: Advanced search failed: Location service error',
      );
    });
  });

  describe('compareMeasures', () => {
    it('should compare multiple measures successfully', async () => {
      const request: MeasureComparisonRequest = {
        measureIds: ['measure1', 'measure2', 'measure3'],
        criteria: {
          includePerformance: true,
          includeCompatibility: true,
          includeRatings: true,
        },
      };

      // Mock the getEnhancedMeasureById method
      const mockGetEnhancedMeasure = vi.spyOn(advancedBclService as any, 'getEnhancedMeasureById');
      mockGetEnhancedMeasure
        .mockResolvedValueOnce({
          id: 'measure1',
          name: 'Measure 1',
          description: 'First measure',
          version: '1.0.0',
          modelerDescription: '',
          tags: [],
          arguments: [],
          rating: 4.5,
          expectedEnergySavings: 20,
          typicalPaybackPeriod: 3,
        })
        .mockResolvedValueOnce({
          id: 'measure2',
          name: 'Measure 2',
          description: 'Second measure',
          version: '1.1.0',
          modelerDescription: '',
          tags: [],
          arguments: [],
          rating: 4.0,
          expectedEnergySavings: 15,
          typicalPaybackPeriod: 4,
        })
        .mockResolvedValueOnce({
          id: 'measure3',
          name: 'Measure 3',
          description: 'Third measure',
          version: '1.2.0',
          modelerDescription: '',
          tags: [],
          arguments: [],
          rating: 4.8,
          expectedEnergySavings: 25,
          typicalPaybackPeriod: 2,
        });

      const result = await advancedBclService.compareMeasures(request);

      expect(result.success).toBe(true);
      expect(result.measures).toHaveLength(3);
      expect(result.comparison).toBeDefined();
      expect(result.comparison.features).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            feature: 'Expected Energy Savings (%)',
          }),
        ]),
      );
      expect(result.performanceAnalysis).toBeDefined();
      expect(result.compatibilityAnalysis).toBeDefined();
    });

    it('should reject comparison with less than 2 measures', async () => {
      const request: MeasureComparisonRequest = {
        measureIds: ['measure1'],
      };

      const result = await advancedBclService.compareMeasures(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least 2 measures are required');
    });

    it('should reject comparison with more than 10 measures', async () => {
      const request: MeasureComparisonRequest = {
        measureIds: Array.from({ length: 15 }, (_, i) => `measure${i}`),
      };

      const result = await advancedBclService.compareMeasures(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum of 10 measures');
    });

    it('should handle comparison errors gracefully', async () => {
      const request: MeasureComparisonRequest = {
        measureIds: ['measure1', 'measure2'],
      };

      // Mock method to throw error
      const mockGetEnhancedMeasure = vi.spyOn(advancedBclService as any, 'getEnhancedMeasureById');
      mockGetEnhancedMeasure.mockRejectedValue(new Error('Measure not found'));

      const result = await advancedBclService.compareMeasures(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Measure not found');
    });
  });

  describe('generateAnalytics', () => {
    it('should generate performance analytics', async () => {
      const request: BclAnalyticsRequest = {
        analyticsType: 'performance',
        parameters: {
          categories: ['HVAC', 'Lighting'],
          buildingTypes: ['Office', 'Retail'],
        },
      };

      const result = await advancedBclService.generateAnalytics(request);

      expect(result.success).toBe(true);
      expect(result.analyticsType).toBe('performance');
      expect(result.results.summary).toBeDefined();
      expect(result.results.data).toBeDefined();
      expect(result.results.insights).toBeDefined();
      expect(result.results.recommendations).toBeDefined();
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should generate popularity analytics', async () => {
      const request: BclAnalyticsRequest = {
        analyticsType: 'popularity',
        parameters: {
          timePeriod: {
            startDate: '2024-01-01',
            endDate: '2024-12-31',
          },
        },
      };

      const result = await advancedBclService.generateAnalytics(request);

      expect(result.success).toBe(true);
      expect(result.analyticsType).toBe('popularity');
      expect(result.results.summary.totalDownloads).toBeDefined();
      expect(result.results.summary.mostPopularCategory).toBeDefined();
    });

    it('should generate trend analytics', async () => {
      const request: BclAnalyticsRequest = {
        analyticsType: 'trends',
        parameters: {
          categories: ['Heat Pumps', 'Solar'],
        },
      };

      const result = await advancedBclService.generateAnalytics(request);

      expect(result.success).toBe(true);
      expect(result.analyticsType).toBe('trends');
      expect(result.results.summary.emergingCategory).toBeDefined();
      expect(result.results.summary.fastestGrowing).toBeDefined();
    });

    it('should generate geographic analytics', async () => {
      const request: BclAnalyticsRequest = {
        analyticsType: 'geographic',
        parameters: {
          geographicScope: {
            latitude: 40.7128,
            longitude: -74.006,
            radius: 500,
          },
        },
      };

      const result = await advancedBclService.generateAnalytics(request);

      expect(result.success).toBe(true);
      expect(result.analyticsType).toBe('geographic');
      expect(result.results.summary.topRegion).toBeDefined();
      expect(result.results.summary.climateZoneLeader).toBeDefined();
    });

    it('should generate compatibility analytics', async () => {
      const request: BclAnalyticsRequest = {
        analyticsType: 'compatibility',
        parameters: {
          measureIds: ['measure1', 'measure2', 'measure3'],
        },
      };

      const result = await advancedBclService.generateAnalytics(request);

      expect(result.success).toBe(true);
      expect(result.analyticsType).toBe('compatibility');
      expect(result.results.summary.compatibilityRate).toBeDefined();
      expect(result.results.summary.strongSynergies).toBeDefined();
    });

    it('should handle unsupported analytics type', async () => {
      const request: BclAnalyticsRequest = {
        analyticsType: 'unsupported' as any,
        parameters: {},
      };

      const result = await advancedBclService.generateAnalytics(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported analytics type');
    });

    it('should handle analytics generation errors', async () => {
      const request: BclAnalyticsRequest = {
        analyticsType: 'performance',
        parameters: {},
      };

      // Mock analytics method to throw error
      const mockGeneratePerformanceAnalytics = vi.spyOn(
        advancedBclService as any,
        'generatePerformanceAnalytics',
      );
      mockGeneratePerformanceAnalytics.mockRejectedValue(
        new Error('Analytics service unavailable'),
      );

      const result = await advancedBclService.generateAnalytics(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Analytics service unavailable');
    });
  });

  describe('helper methods', () => {
    it('should calculate distance between locations correctly', async () => {
      const calculateDistance = (advancedBclService as any).calculateDistance.bind(advancedBclService);

      const loc1 = { latitude: 40.7128, longitude: -74.006 }; // New York
      const loc2 = { latitude: 34.0522, longitude: -118.2437 }; // Los Angeles

      const distance = calculateDistance(loc1, loc2);

      // Distance between NYC and LA is approximately 3944 km
      expect(distance).toBeCloseTo(3944, -2); // Within 100km accuracy
    });

    it('should generate search facets correctly', async () => {
      const mockMeasures = [
        {
          id: 'measure1',
          name: 'HVAC Measure',
          description: 'Test',
          version: '1.0.0',
          modelerDescription: '',
          tags: ['hvac', 'energy'],
          arguments: [],
          applicableBuildingTypes: ['Office'],
          rating: 4.5,
          author: 'Author 1',
        },
        {
          id: 'measure2',
          name: 'Lighting Measure',
          description: 'Test',
          version: '1.0.0',
          modelerDescription: '',
          tags: ['lighting', 'led'],
          arguments: [],
          applicableBuildingTypes: ['Retail'],
          rating: 4.0,
          author: 'Author 2',
        },
      ];

      const generateSearchFacets = (advancedBclService as any).generateSearchFacets;
      const facets = generateSearchFacets(mockMeasures);

      expect(facets.buildingTypes).toContainEqual({ value: 'Office', count: 1 });
      expect(facets.buildingTypes).toContainEqual({ value: 'Retail', count: 1 });
      expect(facets.categories).toContainEqual({ value: 'hvac', count: 1 });
      expect(facets.categories).toContainEqual({ value: 'lighting', count: 1 });
      expect(facets.ratings).toContainEqual({ value: 4, count: 2 });
      expect(facets.authors).toContainEqual({ value: 'Author 1', count: 1 });
    });

    it('should enhance measures with metadata', async () => {
      const basicMeasures = [
        {
          id: 'measure1',
          name: 'Test Measure',
          description: 'A test measure',
          version: '1.0.0',
          modelerDescription: 'Test description',
          tags: ['test'],
          arguments: [],
        },
      ];

      const enhanceMeasuresWithMetadata = (advancedBclService as any).enhanceMeasuresWithMetadata.bind(advancedBclService);
      const enhancedMeasures = await enhanceMeasuresWithMetadata(basicMeasures);

      expect(enhancedMeasures).toHaveLength(1);
      expect(enhancedMeasures[0]).toMatchObject({
        id: 'measure1',
        name: 'Test Measure',
        downloadCount: expect.any(Number),
        rating: expect.any(Number),
        ratingCount: expect.any(Number),
        lastUpdated: expect.any(String),
        author: expect.any(String),
        organization: expect.any(String),
        expectedEnergySavings: expect.any(Number),
        typicalPaybackPeriod: expect.any(Number),
      });
    });
  });
});
