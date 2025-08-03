/**
 * Tests for Advanced BCL Request Handlers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestHandler } from '../../src/handlers/requestHandler';
import { AdvancedBclService } from '../../src/services/advancedBclService';
import {
  AdvancedBclSearchRequest,
  GeospatialBclSearchRequest,
  BclMeasureComparisonRequest,
  BclAnalyticsRequest,
  AdvancedSearchResult,
  MeasureComparisonResult,
  BclAnalyticsResult,
} from '../../src/interfaces/advancedBcl';

// Mock dependencies
vi.mock('../../src/services/advancedBclService');
vi.mock('../../src/services/commandProcessor');
vi.mock('../../src/services/bclApiClient');
vi.mock('../../src/services/workflowService');
vi.mock('../../src/services/enhancedMeasureService');
vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('../../src/config', () => ({
  default: {
    bcl: { apiUrl: 'https://test-bcl-api.com' },
  },
}));

describe('Advanced BCL Request Handlers', () => {
  let requestHandler: RequestHandler;
  let mockAdvancedBclService: AdvancedBclService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock service instance
    mockAdvancedBclService = {
      advancedSearch: vi.fn(),
      geospatialSearch: vi.fn(),
      compareMeasures: vi.fn(),
      generateAnalytics: vi.fn(),
    } as unknown as AdvancedBclService;

    requestHandler = new RequestHandler();
    // Override the internal service with our mock
    (requestHandler as any).advancedBclService = mockAdvancedBclService;
  });

  describe('handleAdvancedBclSearch', () => {
    it('should handle advanced search request successfully', async () => {
      const mockResult: AdvancedSearchResult = {
        measures: [
          {
            id: 'measure1',
            name: 'Test Measure 1',
            description: 'A test measure',
            version: '1.0.0',
            modelerDescription: 'Test description',
            tags: ['hvac'],
            arguments: [],
            rating: 4.5,
            downloadCount: 1000,
            expectedEnergySavings: 20,
          },
        ],
        totalCount: 1,
        executionTime: 150,
        appliedFilters: {},
        facets: {
          buildingTypes: [{ value: 'Office', count: 1 }],
          categories: [{ value: 'hvac', count: 1 }],
          climateZones: [{ value: '4A', count: 1 }],
          ratings: [{ value: 4, count: 1 }],
          authors: [{ value: 'Test Author', count: 1 }],
        },
      };

      vi.mocked(mockAdvancedBclService.advancedSearch).mockResolvedValue(mockResult);

      const params: AdvancedBclSearchRequest = {
        searchRequest: {
          query: 'energy efficiency',
          filters: {
            buildingTypes: ['Office'],
            minEnergySavings: 10,
          },
          sortOptions: {
            field: 'relevance',
            direction: 'desc',
          },
          limit: 20,
        },
      };

      const result = await (requestHandler as any).handleAdvancedBclSearch(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Found 1 measures');
      expect(result.output).toContain('150ms');
      expect(result.data).toEqual(mockResult);
      expect(mockAdvancedBclService.advancedSearch).toHaveBeenCalledWith(params.searchRequest);
    });

    it('should handle missing searchRequest parameter', async () => {
      const params = {} as AdvancedBclSearchRequest;

      const result = await (requestHandler as any).handleAdvancedBclSearch(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('searchRequest is required');
      expect(mockAdvancedBclService.advancedSearch).not.toHaveBeenCalled();
    });

    it('should handle advanced search service errors', async () => {
      vi.mocked(mockAdvancedBclService.advancedSearch).mockRejectedValue(
        new Error('Search service unavailable'),
      );

      const params: AdvancedBclSearchRequest = {
        searchRequest: {
          query: 'test',
        },
      };

      const result = await (requestHandler as any).handleAdvancedBclSearch(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search service unavailable');
    });

    it('should handle complex filters correctly', async () => {
      const mockResult: AdvancedSearchResult = {
        measures: [],
        totalCount: 0,
        executionTime: 100,
        appliedFilters: {
          buildingTypes: ['Office', 'Retail'],
          categories: ['HVAC', 'Lighting'],
          minEnergySavings: 15,
          maxPaybackPeriod: 5,
          location: {
            latitude: 40.7128,
            longitude: -74.006,
            climateZone: '4A',
          },
          searchRadius: 100,
        },
        facets: {
          buildingTypes: [],
          categories: [],
          climateZones: [],
          ratings: [],
          authors: [],
        },
      };

      vi.mocked(mockAdvancedBclService.advancedSearch).mockResolvedValue(mockResult);

      const params: AdvancedBclSearchRequest = {
        searchRequest: {
          query: 'comprehensive search',
          filters: {
            buildingTypes: ['Office', 'Retail'],
            categories: ['HVAC', 'Lighting'],
            minEnergySavings: 15,
            maxPaybackPeriod: 5,
            location: {
              latitude: 40.7128,
              longitude: -74.006,
              climateZone: '4A',
            },
            searchRadius: 100,
          },
          sortOptions: {
            field: 'savings',
            direction: 'desc',
            secondaryField: 'rating',
            secondaryDirection: 'desc',
          },
          limit: 50,
          offset: 10,
        },
      };

      const result = await (requestHandler as any).handleAdvancedBclSearch(params);

      expect(result.success).toBe(true);
      expect(mockAdvancedBclService.advancedSearch).toHaveBeenCalledWith(params.searchRequest);
    });
  });

  describe('handleGeospatialBclSearch', () => {
    it('should handle geospatial search request successfully', async () => {
      const mockResult: AdvancedSearchResult = {
        measures: [
          {
            id: 'measure1',
            name: 'Local Measure',
            description: 'A location-specific measure',
            version: '1.0.0',
            modelerDescription: 'Local description',
            tags: ['local', 'efficient'],
            arguments: [],
            geographicAvailability: [
              {
                latitude: 40.7128,
                longitude: -74.006,
                climateZone: '4A',
                countryCode: 'US',
              },
            ],
          },
        ],
        totalCount: 1,
        executionTime: 200,
        appliedFilters: {},
        geographicClusters: [
          {
            center: {
              latitude: 40.7128,
              longitude: -74.006,
              climateZone: '4A',
            },
            count: 1,
            radius: 50,
            sampleMeasures: [],
          },
        ],
        facets: {
          buildingTypes: [],
          categories: [],
          climateZones: [],
          ratings: [],
          authors: [],
        },
      };

      vi.mocked(mockAdvancedBclService.geospatialSearch).mockResolvedValue(mockResult);

      const params: GeospatialBclSearchRequest = {
        searchRequest: {
          query: 'local efficiency',
          location: {
            latitude: 40.7128,
            longitude: -74.006,
            climateZone: '4A',
          },
          radius: 100,
          clusterResults: true,
          maxClusters: 5,
        },
      };

      const result = await (requestHandler as any).handleGeospatialBclSearch(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Found 1 measures within 100km');
      expect(result.output).toContain('1 geographic clusters');
      expect(result.data).toEqual(mockResult);
      expect(mockAdvancedBclService.geospatialSearch).toHaveBeenCalledWith(params.searchRequest);
    });

    it('should handle missing searchRequest parameter', async () => {
      const params = {} as GeospatialBclSearchRequest;

      const result = await (requestHandler as any).handleGeospatialBclSearch(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('searchRequest is required');
    });

    it('should handle missing location parameter', async () => {
      const params: GeospatialBclSearchRequest = {
        searchRequest: {
          radius: 100,
        } as any,
      };

      const result = await (requestHandler as any).handleGeospatialBclSearch(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('location and radius are required for geospatial search');
    });

    it('should handle missing radius parameter', async () => {
      const params: GeospatialBclSearchRequest = {
        searchRequest: {
          location: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        } as any,
      };

      const result = await (requestHandler as any).handleGeospatialBclSearch(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('location and radius are required for geospatial search');
    });

    it('should handle geospatial search service errors', async () => {
      vi.mocked(mockAdvancedBclService.geospatialSearch).mockRejectedValue(
        new Error('Geospatial service error'),
      );

      const params: GeospatialBclSearchRequest = {
        searchRequest: {
          location: {
            latitude: 40.7128,
            longitude: -74.006,
          },
          radius: 50,
        },
      };

      const result = await (requestHandler as any).handleGeospatialBclSearch(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Geospatial service error');
    });
  });

  describe('handleBclMeasureComparison', () => {
    it('should handle measure comparison request successfully', async () => {
      const mockResult: MeasureComparisonResult = {
        success: true,
        measures: [
          {
            id: 'measure1',
            name: 'Measure 1',
            description: 'First measure',
            version: '1.0.0',
            modelerDescription: '',
            tags: [],
            arguments: [],
            rating: 4.5,
            expectedEnergySavings: 20,
          },
          {
            id: 'measure2',
            name: 'Measure 2',
            description: 'Second measure',
            version: '1.1.0',
            modelerDescription: '',
            tags: [],
            arguments: [],
            rating: 4.0,
            expectedEnergySavings: 15,
          },
        ],
        comparison: {
          features: [
            {
              feature: 'Expected Energy Savings (%)',
              values: [20, 15],
              differs: true,
              recommendation: 20,
            },
            {
              feature: 'User Rating',
              values: [4.5, 4.0],
              differs: true,
              recommendation: 4.5,
            },
          ],
          arguments: [],
          performance: [
            {
              metric: 'Energy Savings',
              values: [20, 15],
              units: '%',
              bestMeasureIndex: 0,
              relativePerformance: [1.0, 0.75],
            },
          ],
          summary: ['Highest rated: Measure 1 (4.5/5.0)', 'Best energy savings: Measure 1 (20%)'],
        },
        performanceAnalysis: {
          ranking: [0, 1],
          kpis: {
            measure1: {
              energySavings: 20,
              costSavings: 2000,
              paybackPeriod: 3,
              netPresentValue: 15000,
              carbonReduction: 10,
              performanceScore: 85,
            },
            measure2: {
              energySavings: 15,
              costSavings: 1500,
              paybackPeriod: 4,
              netPresentValue: 12000,
              carbonReduction: 7.5,
              performanceScore: 75,
            },
          },
          trends: [],
          recommendations: ['Consider Measure 1 for higher energy savings'],
        },
      };

      vi.mocked(mockAdvancedBclService.compareMeasures).mockResolvedValue(mockResult);

      const params: BclMeasureComparisonRequest = {
        comparisonRequest: {
          measureIds: ['measure1', 'measure2'],
          criteria: {
            includePerformance: true,
            includeCompatibility: true,
            includeRatings: true,
          },
          modelPath: '/path/to/model.osm',
        },
      };

      const result = await (requestHandler as any).handleBclMeasureComparison(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Successfully compared 2 measures');
      expect(result.output).toContain('2 feature comparisons');
      expect(result.data).toEqual(mockResult);
      expect(mockAdvancedBclService.compareMeasures).toHaveBeenCalledWith(params.comparisonRequest);
    });

    it('should handle missing comparisonRequest parameter', async () => {
      const params = {} as BclMeasureComparisonRequest;

      const result = await (requestHandler as any).handleBclMeasureComparison(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('comparisonRequest is required');
    });

    it('should handle insufficient measure IDs', async () => {
      const params: BclMeasureComparisonRequest = {
        comparisonRequest: {
          measureIds: ['measure1'],
        },
      };

      const result = await (requestHandler as any).handleBclMeasureComparison(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('At least 2 measure IDs are required for comparison');
    });

    it('should handle too many measure IDs', async () => {
      const params: BclMeasureComparisonRequest = {
        comparisonRequest: {
          measureIds: Array.from({ length: 15 }, (_, i) => `measure${i}`),
        },
      };

      const result = await (requestHandler as any).handleBclMeasureComparison(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Maximum of 10 measures can be compared at once');
    });

    it('should handle comparison service failure', async () => {
      const mockResult: MeasureComparisonResult = {
        success: false,
        measures: [],
        comparison: {
          features: [],
          arguments: [],
          performance: [],
          summary: [],
        },
        error: 'Measures not found',
      };

      vi.mocked(mockAdvancedBclService.compareMeasures).mockResolvedValue(mockResult);

      const params: BclMeasureComparisonRequest = {
        comparisonRequest: {
          measureIds: ['invalid1', 'invalid2'],
        },
      };

      const result = await (requestHandler as any).handleBclMeasureComparison(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Measures not found');
    });

    it('should handle comparison service errors', async () => {
      vi.mocked(mockAdvancedBclService.compareMeasures).mockRejectedValue(
        new Error('Comparison service error'),
      );

      const params: BclMeasureComparisonRequest = {
        comparisonRequest: {
          measureIds: ['measure1', 'measure2'],
        },
      };

      const result = await (requestHandler as any).handleBclMeasureComparison(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Comparison service error');
    });
  });

  describe('handleBclAnalytics', () => {
    it('should handle analytics request successfully', async () => {
      const mockResult: BclAnalyticsResult = {
        success: true,
        analyticsType: 'performance',
        results: {
          summary: {
            totalMeasures: 150,
            averageRating: 4.2,
            averageEnergySavings: 18.5,
          },
          data: [
            { label: 'HVAC Measures', value: 45 },
            { label: 'Lighting Measures', value: 38 },
            { label: 'Envelope Measures', value: 32 },
          ],
          insights: [
            'HVAC measures show the highest energy savings potential',
            'Lighting measures have the shortest payback periods',
          ],
          recommendations: [
            'Focus on HVAC measures for maximum energy impact',
            'Consider lighting upgrades for quick wins',
          ],
        },
        metadata: {
          executionTime: 250,
          dataSources: ['BCL API', 'Local Database'],
          parameters: {},
        },
      };

      vi.mocked(mockAdvancedBclService.generateAnalytics).mockResolvedValue(mockResult);

      const params: BclAnalyticsRequest = {
        analyticsType: 'performance',
        parameters: {
          categories: ['HVAC', 'Lighting'],
          buildingTypes: ['Office', 'Retail'],
        },
      };

      const result = await (requestHandler as any).handleBclAnalytics(params);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Generated performance analytics');
      expect(result.output).toContain('3 data points');
      expect(result.output).toContain('2 insights');
      expect(result.output).toContain('250ms');
      expect(result.data).toEqual(mockResult);
      expect(mockAdvancedBclService.generateAnalytics).toHaveBeenCalledWith(params);
    });

    it('should handle missing analyticsType parameter', async () => {
      const params = {} as BclAnalyticsRequest;

      const result = await (requestHandler as any).handleBclAnalytics(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('analyticsType is required');
    });

    it('should handle invalid analyticsType parameter', async () => {
      const params: BclAnalyticsRequest = {
        analyticsType: 'invalid_type' as any,
        parameters: {},
      };

      const result = await (requestHandler as any).handleBclAnalytics(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid analytics type');
      expect(result.error).toContain('performance, popularity, trends, geographic, compatibility');
    });

    it('should handle each valid analytics type', async () => {
      const analyticsTypes = ['performance', 'popularity', 'trends', 'geographic', 'compatibility'];

      for (const analyticsType of analyticsTypes) {
        const mockResult: BclAnalyticsResult = {
          success: true,
          analyticsType,
          results: {
            summary: { testValue: 123 },
            data: [{ label: 'test', value: 1 }],
            insights: ['Test insight'],
            recommendations: ['Test recommendation'],
          },
          metadata: {
            executionTime: 100,
            dataSources: ['Test Source'],
            parameters: {},
          },
        };

        vi.mocked(mockAdvancedBclService.generateAnalytics).mockResolvedValue(mockResult);

        const params: BclAnalyticsRequest = {
          analyticsType: analyticsType as any,
          parameters: {},
        };

        const result = await (requestHandler as any).handleBclAnalytics(params);

        expect(result.success).toBe(true);
        expect(result.output).toContain(`Generated ${analyticsType} analytics`);
      }
    });

    it('should handle analytics service failure', async () => {
      const mockResult: BclAnalyticsResult = {
        success: false,
        analyticsType: 'performance',
        results: {
          summary: {},
          data: [],
          insights: [],
          recommendations: [],
        },
        metadata: {
          executionTime: 100,
          dataSources: [],
          parameters: {},
        },
        error: 'Analytics data unavailable',
      };

      vi.mocked(mockAdvancedBclService.generateAnalytics).mockResolvedValue(mockResult);

      const params: BclAnalyticsRequest = {
        analyticsType: 'performance',
        parameters: {},
      };

      const result = await (requestHandler as any).handleBclAnalytics(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Analytics data unavailable');
    });

    it('should handle analytics service errors', async () => {
      vi.mocked(mockAdvancedBclService.generateAnalytics).mockRejectedValue(
        new Error('Analytics service unavailable'),
      );

      const params: BclAnalyticsRequest = {
        analyticsType: 'trends',
        parameters: {},
      };

      const result = await (requestHandler as any).handleBclAnalytics(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Analytics service unavailable');
    });

    it('should handle complex analytics parameters', async () => {
      const mockResult: BclAnalyticsResult = {
        success: true,
        analyticsType: 'geographic',
        results: {
          summary: {
            topRegion: 'California',
            climateZoneLeader: '3A',
          },
          data: [
            { label: 'North America', value: 65 },
            { label: 'Europe', value: 20 },
          ],
          insights: ['North America leads in measure adoption'],
          recommendations: ['Expand European market presence'],
        },
        metadata: {
          executionTime: 300,
          dataSources: ['BCL API', 'Geographic Service'],
          parameters: {
            geographicScope: {
              latitude: 37.7749,
              longitude: -122.4194,
              radius: 500,
            },
            timePeriod: {
              startDate: '2024-01-01',
              endDate: '2024-12-31',
            },
            categories: ['HVAC', 'Solar'],
            buildingTypes: ['Office', 'Residential'],
            measureIds: ['measure1', 'measure2'],
          },
        },
      };

      vi.mocked(mockAdvancedBclService.generateAnalytics).mockResolvedValue(mockResult);

      const params: BclAnalyticsRequest = {
        analyticsType: 'geographic',
        parameters: {
          geographicScope: {
            latitude: 37.7749,
            longitude: -122.4194,
            radius: 500,
          },
          timePeriod: {
            startDate: '2024-01-01',
            endDate: '2024-12-31',
          },
          categories: ['HVAC', 'Solar'],
          buildingTypes: ['Office', 'Residential'],
          measureIds: ['measure1', 'measure2'],
        },
      };

      const result = await (requestHandler as any).handleBclAnalytics(params);

      expect(result.success).toBe(true);
      expect(mockAdvancedBclService.generateAnalytics).toHaveBeenCalledWith(params);
    });
  });
});
