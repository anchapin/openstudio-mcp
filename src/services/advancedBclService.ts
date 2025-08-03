/**
 * Advanced BCL Service
 * Provides enhanced BCL capabilities including geospatial search, advanced filtering, and measure comparison
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils';
import { BCLApiClient } from './bclApiClient';
import {
  AdvancedSearchRequest,
  AdvancedSearchResult,
  EnhancedMeasure,
  GeospatialSearchRequest,
  MeasureComparisonRequest,
  MeasureComparisonResult,
  BclAnalyticsRequest,
  BclAnalyticsResult,
  GeographicLocation,
  AdvancedSearchFilters,
  SortOptions,
  ComparisonMatrix,
  PerformanceAnalysis,
  CompatibilityAnalysis,
  SearchFacets,
  GeographicCluster,
} from '../interfaces/advancedBcl';
import { Measure } from '../interfaces/measure';

/**
 * Advanced BCL Service class
 */
export class AdvancedBclService {
  private bclApiClient: BCLApiClient;
  private geoService: AxiosInstance;

  constructor() {
    this.bclApiClient = new BCLApiClient();

    // Initialize geographic service (using a mock service for now)
    this.geoService = axios.create({
      baseURL: 'https://api.example-geo-service.com',
      timeout: 15000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OpenStudio-MCP-Advanced/0.1.0',
      },
    });
  }

  /**
   * Perform advanced search with enhanced filtering and sorting
   */
  async advancedSearch(request: AdvancedSearchRequest): Promise<AdvancedSearchResult> {
    const startTime = Date.now();

    try {
      logger.info('Performing advanced BCL search', { request });

      // Start with basic search if query is provided
      let measures: Measure[] = [];
      if (request.query) {
        measures = await this.bclApiClient.searchMeasures(request.query);
      } else {
        // If no query, get popular measures as starting point
        measures = await this.getPopularMeasures(request.limit || 50);
      }

      // Convert to enhanced measures with additional metadata
      let enhancedMeasures = await this.enhanceMeasuresWithMetadata(measures);

      // Apply advanced filters
      if (request.filters) {
        enhancedMeasures = await this.applyAdvancedFilters(enhancedMeasures, request.filters);
      }

      // Apply geographic filtering if location is specified
      if (request.filters?.location) {
        enhancedMeasures = await this.applyGeographicFiltering(
          enhancedMeasures,
          request.filters.location,
          request.filters.searchRadius || 100,
        );
      }

      // Sort results
      if (request.sortOptions) {
        enhancedMeasures = this.sortMeasures(enhancedMeasures, request.sortOptions);
      }

      // Apply pagination
      const totalCount = enhancedMeasures.length;
      const offset = request.offset || 0;
      const limit = request.limit || 20;
      const paginatedMeasures = enhancedMeasures.slice(offset, offset + limit);

      // Generate facets for filtering UI
      const facets = this.generateSearchFacets(enhancedMeasures);

      // Generate geographic clusters if location-based search
      let geographicClusters: GeographicCluster[] | undefined;
      if (request.filters?.location) {
        geographicClusters = await this.generateGeographicClusters(enhancedMeasures);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        measures: paginatedMeasures,
        totalCount,
        executionTime,
        appliedFilters: request.filters || {},
        geographicClusters,
        facets,
      };
    } catch (error) {
      logger.error('Error in advanced search', { error, request });
      throw new Error(
        `Advanced search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Perform geospatial search for measures
   */
  async geospatialSearch(request: GeospatialSearchRequest): Promise<AdvancedSearchResult> {
    try {
      logger.info('Performing geospatial BCL search', { request });

      // Convert geospatial request to advanced search request
      const advancedRequest: AdvancedSearchRequest = {
        query: request.query,
        filters: {
          ...request.filters,
          location: request.location,
          searchRadius: request.radius,
        },
        sortOptions: request.sortOptions,
        limit: request.limit,
        includeMetadata: true,
      };

      // Perform advanced search
      const result = await this.advancedSearch(advancedRequest);

      // Enhanced clustering for geospatial results
      if (request.clusterResults) {
        result.geographicClusters = await this.generateGeographicClusters(
          result.measures,
          request.maxClusters || 10,
        );
      }

      return result;
    } catch (error) {
      logger.error('Error in geospatial search', { error, request });
      throw new Error(
        `Geospatial search failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Compare multiple measures side by side
   */
  async compareMeasures(request: MeasureComparisonRequest): Promise<MeasureComparisonResult> {
    try {
      logger.info('Comparing measures', { request });

      if (request.measureIds.length < 2) {
        throw new Error('At least 2 measures are required for comparison');
      }

      if (request.measureIds.length > 10) {
        throw new Error('Maximum of 10 measures can be compared at once');
      }

      // Get detailed information for each measure
      const measures: EnhancedMeasure[] = [];
      for (const measureId of request.measureIds) {
        const measure = await this.getEnhancedMeasureById(measureId);
        if (measure) {
          measures.push(measure);
        }
      }

      if (measures.length === 0) {
        throw new Error('No valid measures found for comparison');
      }

      // Generate comparison matrix
      const comparison = await this.generateComparisonMatrix(measures, request.criteria);

      // Perform performance analysis if requested
      let performanceAnalysis: PerformanceAnalysis | undefined;
      if (request.criteria?.includePerformance) {
        performanceAnalysis = await this.performPerformanceAnalysis(measures, request.modelPath);
      }

      // Perform compatibility analysis if requested
      let compatibilityAnalysis: CompatibilityAnalysis | undefined;
      if (request.criteria?.includeCompatibility) {
        compatibilityAnalysis = await this.performCompatibilityAnalysis(measures);
      }

      return {
        success: true,
        measures,
        comparison,
        performanceAnalysis,
        compatibilityAnalysis,
      };
    } catch (error) {
      logger.error('Error in measure comparison', { error, request });
      return {
        success: false,
        measures: [],
        comparison: {
          features: [],
          arguments: [],
          performance: [],
          summary: [],
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate analytics for BCL measures
   */
  async generateAnalytics(request: BclAnalyticsRequest): Promise<BclAnalyticsResult> {
    const startTime = Date.now();

    try {
      logger.info('Generating BCL analytics', { request });

      let results: BclAnalyticsResult['results'];

      switch (request.analyticsType) {
        case 'performance':
          results = await this.generatePerformanceAnalytics(request.parameters);
          break;
        case 'popularity':
          results = await this.generatePopularityAnalytics(request.parameters);
          break;
        case 'trends':
          results = await this.generateTrendAnalytics(request.parameters);
          break;
        case 'geographic':
          results = await this.generateGeographicAnalytics(request.parameters);
          break;
        case 'compatibility':
          results = await this.generateCompatibilityAnalytics(request.parameters);
          break;
        default:
          throw new Error(`Unsupported analytics type: ${request.analyticsType}`);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        analyticsType: request.analyticsType,
        results,
        metadata: {
          executionTime,
          dataSources: ['BCL API', 'Local Database', 'Geographic Service'],
          parameters: request.parameters,
        },
      };
    } catch (error) {
      logger.error('Error generating analytics', { error, request });
      return {
        success: false,
        analyticsType: request.analyticsType,
        results: {
          summary: {},
          data: [],
          insights: [],
          recommendations: [],
        },
        metadata: {
          executionTime: Date.now() - startTime,
          dataSources: [],
          parameters: request.parameters,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Enhance basic measures with additional metadata
   */
  private async enhanceMeasuresWithMetadata(measures: Measure[]): Promise<EnhancedMeasure[]> {
    const enhancedMeasures: EnhancedMeasure[] = [];

    for (const measure of measures) {
      const enhanced: EnhancedMeasure = {
        ...measure,
        // Add mock metadata - in real implementation, this would come from various APIs
        downloadCount: Math.floor(Math.random() * 10000),
        rating: Math.round((Math.random() * 4 + 1) * 10) / 10, // 1.0 to 5.0
        ratingCount: Math.floor(Math.random() * 500),
        lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        author: `Author ${Math.floor(Math.random() * 100)}`,
        organization: ['NREL', 'LBNL', 'ORNL', 'PNNL'][Math.floor(Math.random() * 4)],
        license: 'MIT',
        fileSize: Math.floor(Math.random() * 10000000), // 0-10MB
        compatibleVersions: ['3.4.0', '3.5.0', '3.6.0'],
        applicableBuildingTypes: this.generateRandomBuildingTypes(),
        applicableClimateZones: this.generateRandomClimateZones(),
        expectedEnergySavings: Math.round(Math.random() * 30 * 10) / 10, // 0-30%
        typicalPaybackPeriod: Math.round(Math.random() * 15 * 10) / 10, // 0-15 years
        utilityPrograms: this.generateRandomUtilityPrograms(),
        certifications: this.generateRandomCertifications(),
        geographicAvailability: this.generateRandomGeographicAvailability(),
        dependencies: [],
        conflicts: [],
      };

      enhancedMeasures.push(enhanced);
    }

    return enhancedMeasures;
  }

  /**
   * Apply advanced filters to measures
   */
  private async applyAdvancedFilters(
    measures: EnhancedMeasure[],
    filters: AdvancedSearchFilters,
  ): Promise<EnhancedMeasure[]> {
    let filtered = measures;

    // Filter by building types
    if (filters.buildingTypes && filters.buildingTypes.length > 0) {
      filtered = filtered.filter((measure) =>
        measure.applicableBuildingTypes?.some((type) => filters.buildingTypes!.includes(type)),
      );
    }

    // Filter by categories
    if (filters.categories && filters.categories.length > 0) {
      filtered = filtered.filter((measure) =>
        measure.tags.some((tag) =>
          filters.categories!.some((category) =>
            tag.toLowerCase().includes(category.toLowerCase()),
          ),
        ),
      );
    }

    // Filter by minimum energy savings
    if (filters.minEnergySavings !== undefined) {
      filtered = filtered.filter(
        (measure) => (measure.expectedEnergySavings || 0) >= filters.minEnergySavings!,
      );
    }

    // Filter by maximum payback period
    if (filters.maxPaybackPeriod !== undefined) {
      filtered = filtered.filter(
        (measure) => (measure.typicalPaybackPeriod || 0) <= filters.maxPaybackPeriod!,
      );
    }

    // Filter by minimum rating
    if (filters.minRating !== undefined) {
      filtered = filtered.filter((measure) => (measure.rating || 0) >= filters.minRating!);
    }

    // Filter by date range
    if (filters.dateRange) {
      const startDate = new Date(filters.dateRange.startDate);
      const endDate = new Date(filters.dateRange.endDate);
      filtered = filtered.filter((measure) => {
        if (!measure.lastUpdated) return false;
        const updateDate = new Date(measure.lastUpdated);
        return updateDate >= startDate && updateDate <= endDate;
      });
    }

    // Filter by certifications
    if (filters.certifications && filters.certifications.length > 0) {
      filtered = filtered.filter((measure) =>
        measure.certifications?.some((cert) => filters.certifications!.includes(cert)),
      );
    }

    // Filter by utility programs
    if (filters.utilityPrograms && filters.utilityPrograms.length > 0) {
      filtered = filtered.filter((measure) =>
        measure.utilityPrograms?.some((program) => filters.utilityPrograms!.includes(program)),
      );
    }

    // Filter by include tags
    if (filters.includeTags && filters.includeTags.length > 0) {
      filtered = filtered.filter((measure) =>
        filters.includeTags!.some((tag) =>
          measure.tags.some((measureTag) => measureTag.toLowerCase().includes(tag.toLowerCase())),
        ),
      );
    }

    // Filter by exclude tags
    if (filters.excludeTags && filters.excludeTags.length > 0) {
      filtered = filtered.filter(
        (measure) =>
          !filters.excludeTags!.some((tag) =>
            measure.tags.some((measureTag) => measureTag.toLowerCase().includes(tag.toLowerCase())),
          ),
      );
    }

    return filtered;
  }

  /**
   * Apply geographic filtering based on location and radius
   */
  private async applyGeographicFiltering(
    measures: EnhancedMeasure[],
    location: GeographicLocation,
    radiusKm: number,
  ): Promise<EnhancedMeasure[]> {
    return measures.filter((measure) => {
      if (!measure.geographicAvailability) return true;

      return measure.geographicAvailability.some((availableLocation) => {
        const distance = this.calculateDistance(location, availableLocation);
        return distance <= radiusKm;
      });
    });
  }

  /**
   * Sort measures based on sort options
   */
  private sortMeasures(measures: EnhancedMeasure[], sortOptions: SortOptions): EnhancedMeasure[] {
    return measures.sort((a, b) => {
      const primaryComparison = this.compareMeasuresBy(
        a,
        b,
        sortOptions.field,
        sortOptions.direction,
      );

      if (primaryComparison !== 0) {
        return primaryComparison;
      }

      // If primary comparison is equal, use secondary sort
      if (sortOptions.secondaryField) {
        return this.compareMeasuresBy(
          a,
          b,
          sortOptions.secondaryField,
          sortOptions.secondaryDirection || 'asc',
        );
      }

      return 0;
    });
  }

  /**
   * Compare two measures by a specific field
   */
  private compareMeasuresBy(
    a: EnhancedMeasure,
    b: EnhancedMeasure,
    field: SortOptions['field'],
    direction: 'asc' | 'desc',
  ): number {
    let comparison = 0;

    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'rating':
        comparison = (a.rating || 0) - (b.rating || 0);
        break;
      case 'downloads':
        comparison = (a.downloadCount || 0) - (b.downloadCount || 0);
        break;
      case 'date':
        const dateA = new Date(a.lastUpdated || 0);
        const dateB = new Date(b.lastUpdated || 0);
        comparison = dateA.getTime() - dateB.getTime();
        break;
      case 'savings':
        comparison = (a.expectedEnergySavings || 0) - (b.expectedEnergySavings || 0);
        break;
      case 'payback':
        comparison = (a.typicalPaybackPeriod || 0) - (b.typicalPaybackPeriod || 0);
        break;
      case 'relevance':
      default:
        // Relevance based on multiple factors
        const scoreA = this.calculateRelevanceScore(a);
        const scoreB = this.calculateRelevanceScore(b);
        comparison = scoreA - scoreB;
        break;
    }

    return direction === 'desc' ? -comparison : comparison;
  }

  /**
   * Calculate relevance score for a measure
   */
  private calculateRelevanceScore(measure: EnhancedMeasure): number {
    let score = 0;

    // Rating contributes to relevance
    score += (measure.rating || 0) * 20;

    // Download count contributes to relevance
    score += Math.log10(measure.downloadCount || 1) * 10;

    // Recent updates boost relevance
    if (measure.lastUpdated) {
      const daysSinceUpdate =
        (Date.now() - new Date(measure.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 50 - daysSinceUpdate) * 0.1;
    }

    // Energy savings boost relevance
    score += (measure.expectedEnergySavings || 0) * 2;

    // Short payback period boosts relevance
    if (measure.typicalPaybackPeriod && measure.typicalPaybackPeriod > 0) {
      score += Math.max(0, 20 - measure.typicalPaybackPeriod) * 2;
    }

    return score;
  }

  /**
   * Generate search facets for filtering UI
   */
  private generateSearchFacets(measures: EnhancedMeasure[]): SearchFacets {
    const buildingTypeCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const climateZoneCounts = new Map<string, number>();
    const ratingCounts = new Map<number, number>();
    const authorCounts = new Map<string, number>();

    measures.forEach((measure) => {
      // Building types
      measure.applicableBuildingTypes?.forEach((type) => {
        buildingTypeCounts.set(type, (buildingTypeCounts.get(type) || 0) + 1);
      });

      // Categories (derived from tags)
      measure.tags.forEach((tag) => {
        categoryCounts.set(tag, (categoryCounts.get(tag) || 0) + 1);
      });

      // Climate zones
      measure.applicableClimateZones?.forEach((zone) => {
        climateZoneCounts.set(zone, (climateZoneCounts.get(zone) || 0) + 1);
      });

      // Ratings
      if (measure.rating) {
        const ratingBucket = Math.floor(measure.rating);
        ratingCounts.set(ratingBucket, (ratingCounts.get(ratingBucket) || 0) + 1);
      }

      // Authors
      if (measure.author) {
        authorCounts.set(measure.author, (authorCounts.get(measure.author) || 0) + 1);
      }
    });

    return {
      buildingTypes: Array.from(buildingTypeCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      categories: Array.from(categoryCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20), // Limit to top 20
      climateZones: Array.from(climateZoneCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
      ratings: Array.from(ratingCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value - b.value),
      authors: Array.from(authorCounts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10), // Limit to top 10
    };
  }

  /**
   * Generate geographic clusters for location-based results
   */
  private async generateGeographicClusters(
    measures: EnhancedMeasure[],
    maxClusters: number = 10,
  ): Promise<GeographicCluster[]> {
    // Simple clustering algorithm - in real implementation, use proper clustering
    const clusters: GeographicCluster[] = [];
    const processedMeasures = new Set<string>();

    for (const measure of measures) {
      if (processedMeasures.has(measure.id) || !measure.geographicAvailability?.length) {
        continue;
      }

      const centerLocation = measure.geographicAvailability[0];
      const cluster: GeographicCluster = {
        center: centerLocation,
        count: 1,
        radius: 50, // 50km default radius
        sampleMeasures: [measure],
      };

      // Find other measures within cluster radius
      for (const otherMeasure of measures) {
        if (
          processedMeasures.has(otherMeasure.id) ||
          otherMeasure.id === measure.id ||
          !otherMeasure.geographicAvailability?.length
        ) {
          continue;
        }

        const distance = this.calculateDistance(
          centerLocation,
          otherMeasure.geographicAvailability[0],
        );
        if (distance <= cluster.radius) {
          cluster.count++;
          if (cluster.sampleMeasures.length < 3) {
            cluster.sampleMeasures.push(otherMeasure);
          }
          processedMeasures.add(otherMeasure.id);
        }
      }

      clusters.push(cluster);
      processedMeasures.add(measure.id);

      if (clusters.length >= maxClusters) {
        break;
      }
    }

    return clusters.sort((a, b) => b.count - a.count);
  }

  /**
   * Generate comparison matrix for measures
   */
  private async generateComparisonMatrix(
    measures: EnhancedMeasure[],
    criteria?: MeasureComparisonRequest['criteria'],
  ): Promise<ComparisonMatrix> {
    const features = [];
    const argumentComparisons = [];
    const performance = [];
    const summary = [];

    // Feature comparison
    if (criteria?.includePerformance !== false) {
      features.push({
        feature: 'Expected Energy Savings (%)',
        values: measures.map((m) => m.expectedEnergySavings || 0),
        differs: new Set(measures.map((m) => m.expectedEnergySavings || 0)).size > 1,
        recommendation: Math.max(...measures.map((m) => m.expectedEnergySavings || 0)),
      });

      features.push({
        feature: 'Typical Payback Period (years)',
        values: measures.map((m) => m.typicalPaybackPeriod || 0),
        differs: new Set(measures.map((m) => m.typicalPaybackPeriod || 0)).size > 1,
        recommendation: Math.min(
          ...measures.map((m) => m.typicalPaybackPeriod || Infinity).filter((p) => p !== Infinity),
        ),
      });
    }

    if (criteria?.includeRatings !== false) {
      features.push({
        feature: 'User Rating',
        values: measures.map((m) => m.rating || 0),
        differs: new Set(measures.map((m) => m.rating || 0)).size > 1,
        recommendation: Math.max(...measures.map((m) => m.rating || 0)),
      });
    }

    features.push({
      feature: 'Download Count',
      values: measures.map((m) => m.downloadCount || 0),
      differs: new Set(measures.map((m) => m.downloadCount || 0)).size > 1,
    });

    // Performance comparison
    if (criteria?.includePerformance !== false) {
      performance.push({
        metric: 'Energy Savings',
        values: measures.map((m) => m.expectedEnergySavings || 0),
        units: '%',
        bestMeasureIndex: measures.findIndex(
          (m) =>
            m.expectedEnergySavings ===
            Math.max(...measures.map((m2) => m2.expectedEnergySavings || 0)),
        ),
        relativePerformance: measures.map(
          (m) =>
            (m.expectedEnergySavings || 0) /
            Math.max(...measures.map((m2) => m2.expectedEnergySavings || 1)),
        ),
      });
    }

    // Generate summary
    const bestRated = measures.reduce((best, current) =>
      (current.rating || 0) > (best.rating || 0) ? current : best,
    );
    summary.push(`Highest rated: ${bestRated.name} (${bestRated.rating}/5.0)`);

    const bestSavings = measures.reduce((best, current) =>
      (current.expectedEnergySavings || 0) > (best.expectedEnergySavings || 0) ? current : best,
    );
    summary.push(
      `Best energy savings: ${bestSavings.name} (${bestSavings.expectedEnergySavings}%)`,
    );

    return {
      features,
      arguments: argumentComparisons,
      performance,
      summary,
    };
  }

  /**
   * Perform performance analysis on measures
   */
  private async performPerformanceAnalysis(
    measures: EnhancedMeasure[],
    modelPath?: string,
  ): Promise<PerformanceAnalysis> {
    // Mock performance analysis - in real implementation, this would use actual performance data
    const ranking = measures
      .map((measure, index) => ({ measure, index, score: this.calculateRelevanceScore(measure) }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.index);

    const kpis: { [measureId: string]: PerformanceAnalysis['kpis'][string] } = {};
    measures.forEach((measure) => {
      kpis[measure.id] = {
        energySavings: measure.expectedEnergySavings || 0,
        costSavings: (measure.expectedEnergySavings || 0) * 1000, // Mock calculation
        paybackPeriod: measure.typicalPaybackPeriod || 0,
        netPresentValue: Math.random() * 50000,
        carbonReduction: (measure.expectedEnergySavings || 0) * 0.5, // Mock calculation
        performanceScore: Math.min(100, this.calculateRelevanceScore(measure)),
      };
    });

    return {
      ranking,
      kpis,
      trends: [
        {
          category: 'Energy Efficiency',
          description: 'Higher energy savings measures show better long-term value',
          affectedMeasures: measures
            .filter((m) => (m.expectedEnergySavings || 0) > 15)
            .map((m) => m.id),
          impact: 'positive',
          confidence: 0.85,
        },
      ],
      recommendations: [
        'Consider measures with highest energy savings for maximum impact',
        'Balance payback period with long-term savings',
        'Prioritize measures with proven track record (high ratings)',
      ],
    };
  }

  /**
   * Perform compatibility analysis between measures
   */
  private async performCompatibilityAnalysis(
    measures: EnhancedMeasure[],
  ): Promise<CompatibilityAnalysis> {
    // Mock compatibility analysis - in real implementation, this would check actual compatibility
    const n = measures.length;
    const compatibilityMatrix: boolean[][] = [];

    // Initialize compatibility matrix
    for (let i = 0; i < n; i++) {
      compatibilityMatrix[i] = [];
      for (let j = 0; j < n; j++) {
        compatibilityMatrix[i][j] = i === j || Math.random() > 0.2; // 80% compatibility chance
      }
    }

    return {
      overallCompatibility: 'partially_compatible',
      compatibilityMatrix,
      conflicts: [],
      synergies: [
        {
          measureIds: [measures[0].id, measures[1]?.id].filter(Boolean),
          type: 'performance_boost',
          description: 'These measures work well together to maximize energy savings',
          benefitMagnitude: 'medium',
          quantifiedBenefit: 15,
          benefitUnits: '% additional savings',
        },
      ],
      installationOrder: measures.map((m) => m.id),
    };
  }

  // Helper methods for generating mock data
  private generateRandomBuildingTypes(): string[] {
    const types = ['Office', 'Retail', 'Residential', 'Industrial', 'Healthcare', 'Education'];
    return types.filter(() => Math.random() > 0.5);
  }

  private generateRandomClimateZones(): string[] {
    const zones = ['1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A'];
    return zones.filter(() => Math.random() > 0.6);
  }

  private generateRandomUtilityPrograms(): string[] {
    const programs = ['Energy Star', 'Utility Rebate', 'Tax Credit', 'Green Building'];
    return programs.filter(() => Math.random() > 0.7);
  }

  private generateRandomCertifications(): string[] {
    const certs = ['LEED', 'Energy Star', 'BREEAM', 'Living Building Challenge'];
    return certs.filter(() => Math.random() > 0.8);
  }

  private generateRandomGeographicAvailability(): GeographicLocation[] {
    // Return 1-3 random locations
    const count = Math.floor(Math.random() * 3) + 1;
    const locations: GeographicLocation[] = [];

    for (let i = 0; i < count; i++) {
      locations.push({
        latitude: (Math.random() - 0.5) * 180,
        longitude: (Math.random() - 0.5) * 360,
        countryCode: ['US', 'CA', 'GB', 'DE', 'FR'][Math.floor(Math.random() * 5)],
        climateZone: ['1A', '2A', '3A', '4A', '5A'][Math.floor(Math.random() * 5)],
      });
    }

    return locations;
  }

  private async getPopularMeasures(limit: number): Promise<Measure[]> {
    // In real implementation, this would fetch popular measures from BCL
    return this.bclApiClient.searchMeasures('energy efficiency');
  }

  private async getEnhancedMeasureById(measureId: string): Promise<EnhancedMeasure | null> {
    // In real implementation, this would fetch detailed measure data
    try {
      const measures = await this.bclApiClient.searchMeasures(measureId);
      if (measures.length > 0) {
        const enhanced = await this.enhanceMeasuresWithMetadata([measures[0]]);
        return enhanced[0];
      }
    } catch (error) {
      logger.error('Error getting enhanced measure', { measureId, error });
    }
    return null;
  }

  /**
   * Calculate distance between two geographic locations using Haversine formula
   */
  private calculateDistance(loc1: GeographicLocation, loc2: GeographicLocation): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.degToRad(loc2.latitude - loc1.latitude);
    const dLon = this.degToRad(loc2.longitude - loc1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degToRad(loc1.latitude)) *
        Math.cos(this.degToRad(loc2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private degToRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Analytics methods (simplified implementations)
  private async generatePerformanceAnalytics(
    parameters: any,
  ): Promise<BclAnalyticsResult['results']> {
    return {
      summary: {
        totalMeasures: 150,
        averageRating: 4.2,
        averageEnergySavings: 18.5,
        averagePaybackPeriod: 3.2,
      },
      data: [
        { label: 'HVAC Measures', value: 45 },
        { label: 'Lighting Measures', value: 38 },
        { label: 'Envelope Measures', value: 32 },
        { label: 'Controls Measures', value: 25 },
      ],
      insights: [
        'HVAC measures show the highest energy savings potential',
        'Lighting measures have the shortest payback periods',
        'Envelope measures are most popular in cold climates',
      ],
      recommendations: [
        'Focus on HVAC measures for maximum energy impact',
        'Consider lighting upgrades for quick wins',
        'Combine envelope and HVAC measures for synergistic effects',
      ],
    };
  }

  private async generatePopularityAnalytics(
    parameters: any,
  ): Promise<BclAnalyticsResult['results']> {
    return {
      summary: {
        totalDownloads: 125000,
        mostPopularCategory: 'HVAC',
        topRatedMeasure: 'Advanced HVAC Control',
        growthRate: 15.3,
      },
      data: [
        { label: 'Q1 2024', value: 28000 },
        { label: 'Q2 2024', value: 31000 },
        { label: 'Q3 2024', value: 34000 },
        { label: 'Q4 2024', value: 32000 },
      ],
      insights: [
        'Measure downloads increased 15% year over year',
        'HVAC measures account for 35% of all downloads',
        'Peak download activity occurs in spring and fall',
      ],
      recommendations: [
        'Promote HVAC measures during peak seasons',
        'Develop more lighting and envelope measures',
        'Create seasonal marketing campaigns',
      ],
    };
  }

  private async generateTrendAnalytics(parameters: any): Promise<BclAnalyticsResult['results']> {
    return {
      summary: {
        emergingCategory: 'Battery Storage',
        decliningCategory: 'CFL Lighting',
        fastestGrowing: 'Heat Pumps',
        trendStrength: 'Strong',
      },
      data: [
        { label: 'Heat Pumps', value: 85 },
        { label: 'Solar Integration', value: 72 },
        { label: 'Smart Controls', value: 68 },
        { label: 'Battery Storage', value: 45 },
      ],
      insights: [
        'Heat pump measures show strongest upward trend',
        'Smart building controls gaining momentum',
        'Traditional lighting measures declining',
      ],
      recommendations: [
        'Invest in heat pump measure development',
        'Create more smart controls options',
        'Phase out outdated lighting measures',
      ],
    };
  }

  private async generateGeographicAnalytics(
    parameters: any,
  ): Promise<BclAnalyticsResult['results']> {
    return {
      summary: {
        topRegion: 'California',
        mostActiveCities: 5,
        climateZoneLeader: '3A',
        internationalAdoption: 25,
      },
      data: [
        { label: 'North America', value: 65 },
        { label: 'Europe', value: 20 },
        { label: 'Asia Pacific', value: 10 },
        { label: 'Other', value: 5 },
      ],
      insights: [
        'North America leads in measure adoption',
        'Climate zones 3A-5A show highest activity',
        'International adoption growing steadily',
      ],
      recommendations: [
        'Expand European market presence',
        'Develop climate-specific measures',
        'Create localized documentation',
      ],
    };
  }

  private async generateCompatibilityAnalytics(
    parameters: any,
  ): Promise<BclAnalyticsResult['results']> {
    return {
      summary: {
        compatibilityRate: 78,
        commonConflicts: 3,
        strongSynergies: 12,
        optimalCombinations: 25,
      },
      data: [
        { label: 'Fully Compatible', value: 78 },
        { label: 'Partially Compatible', value: 15 },
        { label: 'Conflicting', value: 7 },
      ],
      insights: [
        'Most measures work well together',
        'HVAC and lighting measures show strong synergies',
        'Some envelope measures conflict with ventilation',
      ],
      recommendations: [
        'Create measure compatibility matrix',
        'Develop synergistic measure packages',
        'Provide conflict resolution guidance',
      ],
    };
  }
}
