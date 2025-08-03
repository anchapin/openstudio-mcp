/**
 * Advanced BCL integration interfaces
 */

import { Measure, MeasureArgument } from './measure';

/**
 * Geographic location interface
 */
export interface GeographicLocation {
  /** Latitude in decimal degrees */
  latitude: number;
  /** Longitude in decimal degrees */
  longitude: number;
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode?: string;
  /** State/province code */
  stateCode?: string;
  /** City name */
  city?: string;
  /** Climate zone identifier */
  climateZone?: string;
  /** ASHRAE climate zone */
  ashraeClimateZone?: string;
  /** DOE climate zone */
  doeClimateZone?: string;
}

/**
 * Advanced search filters
 */
export interface AdvancedSearchFilters {
  /** Building types to filter by */
  buildingTypes?: string[];
  /** Building vintages to filter by */
  buildingVintages?: string[];
  /** Measure categories to filter by */
  categories?: string[];
  /** Minimum energy savings percentage */
  minEnergySavings?: number;
  /** Maximum payback period in years */
  maxPaybackPeriod?: number;
  /** Minimum measure rating (1-5) */
  minRating?: number;
  /** Geographic location for climate-specific filtering */
  location?: GeographicLocation;
  /** Search radius in kilometers (when location is specified) */
  searchRadius?: number;
  /** Date range for measure updates */
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  /** Certification requirements */
  certifications?: string[];
  /** Utility programs */
  utilityPrograms?: string[];
  /** Tags to include */
  includeTags?: string[];
  /** Tags to exclude */
  excludeTags?: string[];
}

/**
 * Sort options for BCL search results
 */
export interface SortOptions {
  /** Primary sort field */
  field: 'relevance' | 'name' | 'rating' | 'downloads' | 'date' | 'savings' | 'payback';
  /** Sort direction */
  direction: 'asc' | 'desc';
  /** Secondary sort field */
  secondaryField?: 'relevance' | 'name' | 'rating' | 'downloads' | 'date' | 'savings' | 'payback';
  /** Secondary sort direction */
  secondaryDirection?: 'asc' | 'desc';
}

/**
 * Enhanced measure with additional metadata
 */
export interface EnhancedMeasure extends Measure {
  /** Download count */
  downloadCount?: number;
  /** User rating (1-5) */
  rating?: number;
  /** Number of ratings */
  ratingCount?: number;
  /** Last update date */
  lastUpdated?: string;
  /** Author information */
  author?: string;
  /** Organization */
  organization?: string;
  /** License type */
  license?: string;
  /** File size in bytes */
  fileSize?: number;
  /** Compatible OpenStudio versions */
  compatibleVersions?: string[];
  /** Applicable building types */
  applicableBuildingTypes?: string[];
  /** Applicable climate zones */
  applicableClimateZones?: string[];
  /** Expected energy savings percentage */
  expectedEnergySavings?: number;
  /** Typical payback period in years */
  typicalPaybackPeriod?: number;
  /** Utility program eligibility */
  utilityPrograms?: string[];
  /** Certifications */
  certifications?: string[];
  /** Geographic availability */
  geographicAvailability?: GeographicLocation[];
  /** Dependencies on other measures */
  dependencies?: string[];
  /** Conflicts with other measures */
  conflicts?: string[];
}

/**
 * Advanced search request
 */
export interface AdvancedSearchRequest {
  /** Search query string */
  query?: string;
  /** Advanced filters */
  filters?: AdvancedSearchFilters;
  /** Sort options */
  sortOptions?: SortOptions;
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Include detailed metadata */
  includeMetadata?: boolean;
}

/**
 * Search result with metadata
 */
export interface AdvancedSearchResult {
  /** Success status */
  success: boolean;
  /** Array of enhanced measures */
  measures: EnhancedMeasure[];
  /** Total number of matching measures */
  totalCount: number;
  /** Search execution time in milliseconds */
  executionTime: number;
  /** Applied filters summary */
  appliedFilters: AdvancedSearchFilters;
  /** Geographic clustering information */
  geographicClusters?: GeographicCluster[];
  /** Faceted search results */
  facets?: SearchFacets;
  /** Error message if search failed */
  error?: string;
}

/**
 * Geographic clustering for location-based results
 */
export interface GeographicCluster {
  /** Cluster center location */
  center: GeographicLocation;
  /** Number of measures in this cluster */
  count: number;
  /** Cluster radius in kilometers */
  radius: number;
  /** Representative measures from this cluster */
  sampleMeasures: EnhancedMeasure[];
}

/**
 * Faceted search results for filtering UI
 */
export interface SearchFacets {
  /** Building type facets */
  buildingTypes: { value: string; count: number }[];
  /** Category facets */
  categories: { value: string; count: number }[];
  /** Climate zone facets */
  climateZones: { value: string; count: number }[];
  /** Rating distribution */
  ratings: { value: number; count: number }[];
  /** Author facets */
  authors: { value: string; count: number }[];
}

/**
 * Measure comparison request
 */
export interface MeasureComparisonRequest {
  /** Array of measure IDs to compare */
  measureIds: string[];
  /** Comparison criteria */
  criteria?: ComparisonCriteria;
  /** Model context for comparison */
  modelPath?: string;
}

/**
 * Comparison criteria
 */
export interface ComparisonCriteria {
  /** Include performance comparison */
  includePerformance?: boolean;
  /** Include cost comparison */
  includeCost?: boolean;
  /** Include compatibility comparison */
  includeCompatibility?: boolean;
  /** Include argument comparison */
  includeArguments?: boolean;
  /** Include rating comparison */
  includeRatings?: boolean;
}

/**
 * Measure comparison result
 */
export interface MeasureComparisonResult {
  /** Success status */
  success: boolean;
  /** Array of compared measures */
  measures: EnhancedMeasure[];
  /** Comparison matrix */
  comparison: ComparisonMatrix;
  /** Performance analysis */
  performanceAnalysis?: PerformanceAnalysis;
  /** Compatibility analysis */
  compatibilityAnalysis?: CompatibilityAnalysis;
  /** Error message if comparison failed */
  error?: string;
}

/**
 * Comparison matrix showing differences between measures
 */
export interface ComparisonMatrix {
  /** Feature comparison */
  features: FeatureComparison[];
  /** Argument comparison */
  arguments: ArgumentComparison[];
  /** Performance metrics comparison */
  performance: PerformanceComparison[];
  /** Summary of key differences */
  summary: string[];
}

/**
 * Feature comparison between measures
 */
export interface FeatureComparison {
  /** Feature name */
  feature: string;
  /** Values for each measure */
  values: (string | number | boolean | null)[];
  /** Whether values differ across measures */
  differs: boolean;
  /** Recommended value based on best practices */
  recommendation?: string | number | boolean;
}

/**
 * Argument comparison between measures
 */
export interface ArgumentComparison {
  /** Argument name */
  argumentName: string;
  /** Argument details for each measure */
  measureArguments: (MeasureArgument | null)[];
  /** Whether argument exists in all measures */
  commonArgument: boolean;
  /** Compatibility assessment */
  compatibility: 'compatible' | 'different_types' | 'different_ranges' | 'incompatible';
}

/**
 * Performance comparison between measures
 */
export interface PerformanceComparison {
  /** Performance metric name */
  metric: string;
  /** Values for each measure */
  values: (number | null)[];
  /** Units for the metric */
  units: string;
  /** Best performing measure index */
  bestMeasureIndex: number;
  /** Performance relative to baseline */
  relativePerformance: number[];
}

/**
 * Performance analysis results
 */
export interface PerformanceAnalysis {
  /** Overall performance ranking */
  ranking: number[];
  /** Key performance indicators */
  kpis: { [measureId: string]: PerformanceKPI };
  /** Performance trends */
  trends: PerformanceTrend[];
  /** Recommendations based on performance */
  recommendations: string[];
}

/**
 * Key performance indicators for a measure
 */
export interface PerformanceKPI {
  /** Energy savings percentage */
  energySavings: number;
  /** Cost savings per year */
  costSavings: number;
  /** Payback period in years */
  paybackPeriod: number;
  /** Net present value */
  netPresentValue: number;
  /** Carbon footprint reduction */
  carbonReduction: number;
  /** Overall performance score (0-100) */
  performanceScore: number;
}

/**
 * Performance trend analysis
 */
export interface PerformanceTrend {
  /** Trend category */
  category: string;
  /** Trend description */
  description: string;
  /** Affected measures */
  affectedMeasures: string[];
  /** Trend impact (positive/negative) */
  impact: 'positive' | 'negative' | 'neutral';
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Compatibility analysis between measures
 */
export interface CompatibilityAnalysis {
  /** Overall compatibility status */
  overallCompatibility: 'compatible' | 'partially_compatible' | 'incompatible';
  /** Detailed compatibility matrix */
  compatibilityMatrix: boolean[][];
  /** Identified conflicts */
  conflicts: MeasureConflict[];
  /** Synergies between measures */
  synergies: MeasureSynergy[];
  /** Installation order recommendations */
  installationOrder: string[];
}

/**
 * Conflict between measures
 */
export interface MeasureConflict {
  /** Conflicting measure IDs */
  measureIds: string[];
  /** Conflict type */
  type: 'direct_conflict' | 'resource_conflict' | 'dependency_conflict' | 'performance_conflict';
  /** Conflict description */
  description: string;
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Possible resolutions */
  resolutions: string[];
}

/**
 * Synergy between measures
 */
export interface MeasureSynergy {
  /** Synergistic measure IDs */
  measureIds: string[];
  /** Synergy type */
  type: 'performance_boost' | 'cost_reduction' | 'operational_synergy' | 'maintenance_synergy';
  /** Synergy description */
  description: string;
  /** Expected benefit magnitude */
  benefitMagnitude: 'low' | 'medium' | 'high';
  /** Quantified benefit if available */
  quantifiedBenefit?: number;
  /** Units for quantified benefit */
  benefitUnits?: string;
}

/**
 * Geospatial search request
 */
export interface GeospatialSearchRequest {
  /** Search query */
  query?: string;
  /** Center location for search */
  location: GeographicLocation;
  /** Search radius in kilometers */
  radius: number;
  /** Additional filters */
  filters?: AdvancedSearchFilters;
  /** Whether to cluster results by location */
  clusterResults?: boolean;
  /** Maximum number of clusters */
  maxClusters?: number;
  /** Sort options */
  sortOptions?: SortOptions;
  /** Maximum results */
  limit?: number;
}

/**
 * Request interfaces for MCP capabilities
 */
export interface AdvancedBclSearchRequest {
  /** Advanced search parameters */
  searchRequest: AdvancedSearchRequest;
}

export interface GeospatialBclSearchRequest {
  /** Geospatial search parameters */
  searchRequest: GeospatialSearchRequest;
}

export interface BclMeasureComparisonRequest {
  /** Comparison parameters */
  comparisonRequest: MeasureComparisonRequest;
}

/**
 * Analytics request for BCL measures
 */
export interface BclAnalyticsRequest {
  /** Analytics type */
  analyticsType: 'performance' | 'popularity' | 'trends' | 'geographic' | 'compatibility';
  /** Analysis parameters */
  parameters: {
    /** Time period for analysis */
    timePeriod?: {
      startDate: string;
      endDate: string;
    };
    /** Geographic scope */
    geographicScope?: GeographicLocation;
    /** Measure categories to analyze */
    categories?: string[];
    /** Building types to analyze */
    buildingTypes?: string[];
    /** Specific measures to analyze */
    measureIds?: string[];
  };
}

/**
 * Analytics result
 */
export interface BclAnalyticsResult {
  /** Success status */
  success: boolean;
  /** Analytics type */
  analyticsType: string;
  /** Analysis results */
  results: {
    /** Summary statistics */
    summary: { [key: string]: number | string };
    /** Detailed data points */
    data: AnalyticsDataPoint[];
    /** Charts and visualizations data */
    visualizations?: VisualizationData[];
    /** Key insights */
    insights: string[];
    /** Recommendations */
    recommendations: string[];
  };
  /** Analysis metadata */
  metadata: {
    /** Analysis execution time */
    executionTime: number;
    /** Data sources used */
    dataSources: string[];
    /** Analysis parameters */
    parameters: unknown;
  };
  /** Error message if analysis failed */
  error?: string;
}

/**
 * Analytics data point
 */
export interface AnalyticsDataPoint {
  /** Data point label */
  label: string;
  /** Data point value */
  value: number | string;
  /** Data point timestamp */
  timestamp?: string;
  /** Additional metadata */
  metadata?: { [key: string]: unknown };
}

/**
 * Visualization data for charts and graphs
 */
export interface VisualizationData {
  /** Visualization type */
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap' | 'geographic';
  /** Chart title */
  title: string;
  /** Data series */
  series: {
    name: string;
    data: (number | string)[];
    color?: string;
  }[];
  /** X-axis labels */
  xAxisLabels?: string[];
  /** Y-axis labels */
  yAxisLabels?: string[];
  /** Visualization options */
  options?: { [key: string]: unknown };
}
