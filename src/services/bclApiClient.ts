import axios, { AxiosInstance, AxiosError } from 'axios';
import { Measure, MeasureArgument, BCLIntegration } from '../interfaces/measure';
import logger from '../utils/logger';
import measureManager from '../utils/measureManager';

/**
 * BCL API Client
 * Implements the BCL Integration interface to interact with the Building Component Library API
 */
export class BCLApiClient implements BCLIntegration {
  private readonly apiBaseUrl: string = 'https://bcl.nrel.gov/api';
  private readonly httpClient: AxiosInstance;
  private readonly defaultTimeout: number = 30000; // 30 seconds

  /**
   * Constructor
   * @param baseUrl Optional base URL override for the BCL API
   * @param timeout Optional timeout in milliseconds
   */
  constructor(baseUrl?: string, timeout?: number) {
    this.apiBaseUrl = baseUrl || this.apiBaseUrl;

    this.httpClient = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: timeout || this.defaultTimeout,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'OpenStudio-MCP-Server/0.1.0',
      },
    });

    // Add response interceptor for logging
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        this.handleApiError(error);
        return Promise.reject(error);
      },
    );
  }

  /**
   * Search for measures in the BCL
   * @param query Search query string
   * @returns Promise resolving to an array of measures
   */
  async searchMeasures(query: string): Promise<Measure[]> {
    try {
      logger.info(`Searching BCL for measures with query: ${query}`);

      // Encode the query for URL safety
      const encodedQuery = encodeURIComponent(query);

      // Construct the full URL for debugging
      const searchUrl = `/search?fq[]=bundle:nrel_measure&api_version=2.0&show_rows=20&q=${encodedQuery}`;
      logger.info(`Making request to: ${this.apiBaseUrl}${searchUrl}`);

      // Make the API request to search for measures using the new BCL API
      const response = await this.httpClient.get(searchUrl);

      if (!response.data || !response.data.result) {
        logger.warn('BCL API returned unexpected response format');
        return [];
      }

      // Transform the BCL API response to our Measure interface
      const measures: Measure[] = response.data.result.map((item: { measure: unknown }) =>
        this.transformBclMeasureToMeasure(item.measure),
      );

      logger.info(`Found ${measures.length} measures matching query: ${query}`);
      return measures;
    } catch (error) {
      if (this.isApiUnavailable(error)) {
        logger.error('BCL API is currently unavailable');
        return [];
      }

      // Log more detailed error information
      if (error instanceof Error && 'response' in error) {
        const axiosError = error as AxiosError;
        logger.error(
          `BCL API error: ${axiosError.response?.status} - ${JSON.stringify(axiosError.response?.data)}`,
        );
        logger.error(`Request URL: ${axiosError.config?.url}`);
        logger.error(`Full URL: ${axiosError.config?.baseURL}${axiosError.config?.url}`);
      }

      logger.error(
        `Error searching BCL measures: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Download a measure from the BCL
   * @param measureId BCL measure ID
   * @returns Promise resolving to boolean indicating success
   */
  async downloadMeasure(measureId: string): Promise<boolean> {
    try {
      logger.info(`Downloading measure with ID: ${measureId}`);

      // Get the measure details first to get the download URL
      const response = await this.httpClient.get(`/component/${measureId}`);

      if (!response.data || !response.data.data) {
        logger.warn(`BCL API returned unexpected response format for measure ID: ${measureId}`);
        return false;
      }

      // Find the zip file download URL
      const downloadUrl = response.data.data.files.find(
        (file: { fileName: string; downloadUrl?: string }) => file.fileName.endsWith('.zip'),
      )?.downloadUrl;

      if (!downloadUrl) {
        logger.warn(`No download URL found for measure ID: ${measureId}`);
        return false;
      }

      logger.info(`Downloading measure from URL: ${downloadUrl}`);

      // Download the measure file
      const zipFilePath = await measureManager.downloadMeasureFile(downloadUrl);

      // Validate the downloaded zip file
      const isValid = await measureManager.validateMeasureZip(zipFilePath);

      if (!isValid) {
        logger.error(`Downloaded measure zip file is invalid: ${zipFilePath}`);
        return false;
      }

      // Store the zip file path for later installation
      this.setMeasureZipPath(measureId, zipFilePath);

      return true;
    } catch (error) {
      if (this.isApiUnavailable(error)) {
        logger.error('BCL API is currently unavailable');
        return false;
      }

      logger.error(
        `Error downloading BCL measure: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  // Map to store downloaded measure zip file paths
  private measureZipPaths = new Map<string, string>();

  /**
   * Set the zip file path for a measure
   * @param measureId Measure ID
   * @param zipFilePath Path to the zip file
   */
  private setMeasureZipPath(measureId: string, zipFilePath: string): void {
    this.measureZipPaths.set(measureId, zipFilePath);
  }

  /**
   * Get the zip file path for a measure
   * @param measureId Measure ID
   * @returns Path to the zip file, or undefined if not found
   */
  private getMeasureZipPath(measureId: string): string | undefined {
    return this.measureZipPaths.get(measureId);
  }

  /**
   * Install a measure from the BCL
   * @param measureId BCL measure ID
   * @returns Promise resolving to boolean indicating success
   */
  async installMeasure(measureId: string): Promise<boolean> {
    try {
      logger.info(`Installing measure with ID: ${measureId}`);

      // Check if the measure is already installed
      const isInstalled = await measureManager.isMeasureInstalled(measureId);

      if (isInstalled) {
        logger.info(`Measure with ID ${measureId} is already installed`);
        return true;
      }

      // First download the measure if not already downloaded
      const zipFilePath = this.getMeasureZipPath(measureId);

      if (!zipFilePath) {
        logger.info(`No downloaded zip file found for measure ID: ${measureId}, downloading now`);
        const downloadSuccess = await this.downloadMeasure(measureId);

        if (!downloadSuccess) {
          logger.warn(`Failed to download measure with ID: ${measureId}`);
          return false;
        }
      }

      // Get the zip file path (should be available now)
      const finalZipPath = this.getMeasureZipPath(measureId);

      if (!finalZipPath) {
        logger.error(`Failed to get zip file path for measure ID: ${measureId}`);
        return false;
      }

      // Install the measure from the zip file
      const installSuccess = await measureManager.installMeasureFromZip(finalZipPath, measureId);

      if (!installSuccess) {
        logger.error(`Failed to install measure with ID: ${measureId}`);
        return false;
      }

      logger.info(`Successfully installed measure with ID: ${measureId}`);
      return true;
    } catch (error) {
      logger.error(
        `Error installing BCL measure: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Recommend measures based on context
   * @param context Context string to base recommendations on
   * @param modelPath Optional path to an OpenStudio model file for model-based recommendations
   * @returns Promise resolving to an array of recommended measures
   */
  async recommendMeasures(context: string, modelPath?: string): Promise<Measure[]> {
    try {
      logger.info(`Recommending measures based on context: ${context}`);

      // Extract keywords and categories from the context
      const { keywords, categories } = this.analyzeContext(context);

      logger.info(`Extracted keywords: ${keywords.join(', ')}`);
      logger.info(`Identified categories: ${categories.join(', ')}`);

      // Search for measures using the extracted keywords and categories
      const measures: Measure[] = [];
      const searchPromises: Promise<Measure[]>[] = [];

      // Search by keywords
      for (const keyword of keywords) {
        searchPromises.push(this.searchMeasures(keyword));
      }

      // Search by categories
      for (const category of categories) {
        searchPromises.push(this.searchMeasures(category));
      }

      // Wait for all search promises to resolve
      const searchResults = await Promise.all(searchPromises);

      // Combine all search results
      for (const result of searchResults) {
        measures.push(...result);
      }

      // If a model path is provided, enhance recommendations based on model analysis
      let modelBasedMeasures: Measure[] = [];
      if (modelPath) {
        modelBasedMeasures = await this.getModelBasedRecommendations(modelPath);
        measures.push(...modelBasedMeasures);
      }

      // Remove duplicates based on measure ID
      const uniqueMeasures = this.removeDuplicateMeasures(measures);

      // Calculate relevance scores for each measure
      const scoredMeasures = this.calculateMeasureScores(
        uniqueMeasures,
        context,
        modelPath !== undefined,
      );

      // Sort measures by relevance score
      const sortedMeasures = scoredMeasures.sort((a, b) => b.score - a.score);

      // Get the top measures (up to 10)
      const topMeasures = sortedMeasures.slice(0, 10).map((item) => item.measure);

      // Automatically download the top 3 measures
      await this.downloadTopRecommendedMeasures(topMeasures.slice(0, 3));

      logger.info(`Recommended ${topMeasures.length} measures based on context`);
      return topMeasures;
    } catch (error) {
      logger.error(
        `Error recommending BCL measures: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Download top recommended measures automatically
   * @param measures Array of measures to download
   */
  private async downloadTopRecommendedMeasures(measures: Measure[]): Promise<void> {
    try {
      logger.info(`Automatically downloading ${measures.length} top recommended measures`);

      const downloadPromises = measures.map((measure) => {
        return this.downloadAndInstallMeasureIfNeeded(measure.id);
      });

      await Promise.all(downloadPromises);

      logger.info('Finished downloading top recommended measures');
    } catch (error) {
      logger.error(
        `Error downloading top recommended measures: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Download and install a measure if it's not already installed
   * @param measureId Measure ID
   * @returns Promise resolving to boolean indicating success
   */
  private async downloadAndInstallMeasureIfNeeded(measureId: string): Promise<boolean> {
    try {
      // Check if the measure is already installed
      const isInstalled = await measureManager.isMeasureInstalled(measureId);

      if (isInstalled) {
        logger.info(`Measure ${measureId} is already installed, skipping download`);
        return true;
      }

      // Download and install the measure
      logger.info(`Downloading and installing measure ${measureId}`);

      const downloadSuccess = await this.downloadMeasure(measureId);

      if (!downloadSuccess) {
        logger.warn(`Failed to download measure ${measureId}`);
        return false;
      }

      const installSuccess = await this.installMeasure(measureId);

      if (!installSuccess) {
        logger.warn(`Failed to install measure ${measureId}`);
        return false;
      }

      logger.info(`Successfully downloaded and installed measure ${measureId}`);
      return true;
    } catch (error) {
      logger.error(
        `Error downloading and installing measure ${measureId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Update a previously downloaded measure
   * @param measureId BCL measure ID
   * @returns Promise resolving to boolean indicating success
   */
  async updateMeasure(measureId: string): Promise<boolean> {
    try {
      logger.info(`Updating measure with ID: ${measureId}`);

      // Check if the measure is already installed
      const isInstalled = await measureManager.isMeasureInstalled(measureId);

      if (!isInstalled) {
        logger.info(`Measure with ID ${measureId} is not installed, installing now`);
        return await this.installMeasure(measureId);
      }

      // Get the current installed version
      const currentVersion = await measureManager.getMeasureVersion(measureId);

      // Get the measure details from the BCL to check the latest version
      const response = await this.httpClient.get(`/component/${measureId}`);

      if (!response.data || !response.data.data) {
        logger.warn(`BCL API returned unexpected response format for measure ID: ${measureId}`);
        return false;
      }

      // Get the latest version
      const latestVersion = response.data.data.version_id;

      if (!latestVersion) {
        logger.warn(`No version information found for measure ID: ${measureId}`);
        return false;
      }

      logger.info(`Current version: ${currentVersion}, Latest version: ${latestVersion}`);

      // Compare versions to see if an update is needed
      if (currentVersion === latestVersion) {
        logger.info(
          `Measure with ID ${measureId} is already up to date (version ${currentVersion})`,
        );
        return true;
      }

      // Download and install the latest version
      logger.info(
        `Updating measure with ID ${measureId} from version ${currentVersion} to ${latestVersion}`,
      );

      // Force download and installation to overwrite the existing measure
      const downloadSuccess = await this.downloadMeasure(measureId);

      if (!downloadSuccess) {
        logger.warn(`Failed to download latest version of measure with ID: ${measureId}`);
        return false;
      }

      // Get the zip file path
      const zipFilePath = this.getMeasureZipPath(measureId);

      if (!zipFilePath) {
        logger.error(`Failed to get zip file path for measure ID: ${measureId}`);
        return false;
      }

      // Install the measure with force option to overwrite existing installation
      const installSuccess = await measureManager.installMeasureFromZip(zipFilePath, measureId, {
        force: true,
      });

      if (!installSuccess) {
        logger.error(`Failed to update measure with ID: ${measureId}`);
        return false;
      }

      logger.info(`Successfully updated measure with ID: ${measureId} to version ${latestVersion}`);
      return true;
    } catch (error) {
      logger.error(
        `Error updating BCL measure: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Transform BCL API measure response to our Measure interface
   * @param bclMeasure BCL API measure response
   * @returns Measure object
   */
  private transformBclMeasureToMeasure(bclMeasure: unknown): Measure {
    try {
      // Extract measure arguments from the new API format
      const args: MeasureArgument[] = [];

      // The new API doesn't include arguments in the search results
      // Arguments would need to be fetched separately for each measure

      // Extract tags from attributes if available
      const tags: string[] = [];
      const measure = bclMeasure as Record<string, unknown>; // Type assertion for dynamic API response
      const attributes = measure.attributes as { attribute?: { name?: string; value?: string }[] };
      if (attributes?.attribute) {
        attributes.attribute.forEach((attr: { name?: string; value?: string }) => {
          if (attr.name && attr.value) {
            tags.push(`${attr.name}: ${attr.value}`);
          }
        });
      }

      // Create the measure object
      return {
        id: (measure.uuid as string) || '',
        name: (measure.display_name as string) || (measure.name as string) || '',
        description: (measure.description as string) || '',
        version: (measure.version_id as string) || '0.0.0',
        modelerDescription: (measure.modeler_description as string) || '',
        tags: tags,
        arguments: args,
      };
    } catch (error) {
      logger.error(
        `Error transforming BCL measure: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Return a minimal valid measure object
      const fallbackMeasure = bclMeasure as { uuid?: string; display_name?: string; name?: string };
      return {
        id: fallbackMeasure.uuid || 'unknown',
        name: fallbackMeasure.display_name || fallbackMeasure.name || 'Unknown Measure',
        description: 'Error parsing measure data',
        version: '0.0.0',
        modelerDescription: '',
        tags: [],
        arguments: [],
      };
    }
  }

  /**
   * Analyze context to extract keywords and identify categories
   * @param context Context string
   * @returns Object containing keywords and categories
   */
  private analyzeContext(context: string): { keywords: string[]; categories: string[] } {
    // Convert to lowercase and remove special characters
    const cleanedContext = context.toLowerCase().replace(/[^\w\s]/g, ' ');

    // Split into words
    const words = cleanedContext.split(/\s+/);

    // Filter out common words and short words
    const commonWords = new Set([
      'the',
      'and',
      'or',
      'a',
      'an',
      'in',
      'on',
      'at',
      'to',
      'for',
      'with',
      'by',
      'of',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'but',
      'if',
      'then',
      'else',
      'when',
      'up',
      'down',
      'out',
      'about',
      'who',
      'whom',
      'whose',
      'which',
      'what',
      'where',
      'when',
      'why',
      'how',
    ]);

    const filteredWords = words.filter((word) => word.length > 2 && !commonWords.has(word));

    // Get unique words
    const uniqueWords = [...new Set(filteredWords)];

    // Extract keywords (more specific terms)
    const keywords = this.extractKeywordsFromWords(uniqueWords);

    // Identify categories based on the context
    const categories = this.identifyCategories(cleanedContext);

    return { keywords, categories };
  }

  /**
   * Extract keywords from a list of words
   * @param words Array of words
   * @returns Array of keywords
   */
  private extractKeywordsFromWords(words: string[]): string[] {
    // Identify multi-word phrases first
    const phrases = this.identifyPhrases(words);

    // Combine phrases with single words
    const combinedKeywords = [...phrases, ...words];

    // Get unique keywords
    const uniqueKeywords = [...new Set(combinedKeywords)];

    // Return the top 8 keywords
    return uniqueKeywords.slice(0, 8);
  }

  /**
   * Identify multi-word phrases from a list of words
   * @param words Array of words
   * @returns Array of phrases
   */
  private identifyPhrases(words: string[]): string[] {
    // Common energy efficiency related phrases
    const knownPhrases = [
      'energy efficiency',
      'hvac system',
      'lighting system',
      'building envelope',
      'insulation',
      'air leakage',
      'thermal comfort',
      'indoor air quality',
      'renewable energy',
      'solar panels',
      'heat pump',
      'cooling system',
      'heating system',
      'ventilation',
      'air conditioning',
      'water heating',
      'energy conservation',
      'energy savings',
      'energy use',
      'energy consumption',
      'energy performance',
      'energy model',
      'energy simulation',
      'energy analysis',
      'energy audit',
      'energy retrofit',
      'energy upgrade',
      'energy code',
      'energy standard',
      'energy rating',
      'energy star',
      'leed certification',
      'green building',
      'sustainable design',
      'carbon footprint',
      'greenhouse gas',
      'climate change',
      'net zero',
      'zero energy',
      'passive house',
      'building performance',
      'building automation',
      'building controls',
      'demand response',
      'load shifting',
      'peak demand',
      'utility cost',
      'operating cost',
      'life cycle cost',
      'payback period',
      'return on investment',
      'cost effectiveness',
    ];

    // Find phrases that appear in the context
    const phrases: string[] = [];

    for (const phrase of knownPhrases) {
      // Check if all words in the phrase are in the words array
      const phraseWords = phrase.split(' ');
      if (phraseWords.every((word) => words.includes(word))) {
        phrases.push(phrase);
      }
    }

    return phrases;
  }

  /**
   * Identify categories based on the context
   * @param context Context string
   * @returns Array of categories
   */
  private identifyCategories(context: string): string[] {
    const categories: string[] = [];

    // Define category patterns
    const categoryPatterns: { [key: string]: RegExp[] } = {
      hvac: [
        /hvac/i,
        /heating/i,
        /cooling/i,
        /ventilation/i,
        /air conditioning/i,
        /heat pump/i,
        /furnace/i,
        /boiler/i,
        /chiller/i,
        /fan/i,
        /duct/i,
      ],
      lighting: [
        /lighting/i,
        /light/i,
        /lamp/i,
        /luminaire/i,
        /fixture/i,
        /led/i,
        /daylight/i,
        /illumination/i,
        /glare/i,
      ],
      envelope: [
        /envelope/i,
        /insulation/i,
        /wall/i,
        /roof/i,
        /ceiling/i,
        /floor/i,
        /window/i,
        /glazing/i,
        /door/i,
        /infiltration/i,
        /air leakage/i,
      ],
      renewable: [
        /renewable/i,
        /solar/i,
        /photovoltaic/i,
        /pv/i,
        /wind/i,
        /geothermal/i,
        /biomass/i,
        /biofuel/i,
      ],
      water: [
        /water/i,
        /hot water/i,
        /domestic hot water/i,
        /dhw/i,
        /plumbing/i,
        /shower/i,
        /faucet/i,
        /toilet/i,
        /irrigation/i,
      ],
      controls: [
        /control/i,
        /thermostat/i,
        /sensor/i,
        /automation/i,
        /schedule/i,
        /setpoint/i,
        /setback/i,
        /occupancy/i,
        /demand response/i,
      ],
      plug_loads: [
        /plug load/i,
        /appliance/i,
        /equipment/i,
        /computer/i,
        /server/i,
        /refrigerator/i,
        /freezer/i,
        /dishwasher/i,
        /washer/i,
        /dryer/i,
      ],
      whole_building: [
        /whole building/i,
        /building performance/i,
        /energy model/i,
        /simulation/i,
        /calibration/i,
        /baseline/i,
        /benchmark/i,
        /audit/i,
        /retrofit/i,
      ],
      economics: [
        /cost/i,
        /saving/i,
        /economic/i,
        /financial/i,
        /payback/i,
        /roi/i,
        /investment/i,
        /utility/i,
        /bill/i,
        /tariff/i,
        /incentive/i,
        /rebate/i,
      ],
    };

    // Check each category
    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      if (patterns.some((pattern) => pattern.test(context))) {
        categories.push(category);
      }
    }

    // If no categories were identified, add a default category
    if (categories.length === 0) {
      categories.push('energy_efficiency');
    }

    return categories;
  }

  /**
   * Get model-based measure recommendations
   * @param modelPath Path to the OpenStudio model file
   * @returns Promise resolving to an array of recommended measures
   */
  private async getModelBasedRecommendations(modelPath: string): Promise<Measure[]> {
    try {
      logger.info(`Getting model-based recommendations for model: ${modelPath}`);

      // In a real implementation, we would analyze the model to determine its characteristics
      // For now, we'll use a simplified approach based on the model file name

      const fileName = modelPath.toLowerCase();
      const recommendations: Measure[] = [];

      // Search for measures based on model file name patterns
      if (fileName.includes('commercial') || fileName.includes('office')) {
        // For commercial buildings, recommend commercial-specific measures
        const commercialMeasures = await this.searchMeasures('commercial office');
        recommendations.push(...commercialMeasures);
      } else if (fileName.includes('residential') || fileName.includes('home')) {
        // For residential buildings, recommend residential-specific measures
        const residentialMeasures = await this.searchMeasures('residential home');
        recommendations.push(...residentialMeasures);
      } else if (fileName.includes('retail') || fileName.includes('store')) {
        // For retail buildings, recommend retail-specific measures
        const retailMeasures = await this.searchMeasures('retail store');
        recommendations.push(...retailMeasures);
      } else if (fileName.includes('hospital') || fileName.includes('healthcare')) {
        // For healthcare buildings, recommend healthcare-specific measures
        const healthcareMeasures = await this.searchMeasures('hospital healthcare');
        recommendations.push(...healthcareMeasures);
      } else if (fileName.includes('school') || fileName.includes('education')) {
        // For educational buildings, recommend education-specific measures
        const educationMeasures = await this.searchMeasures('school education');
        recommendations.push(...educationMeasures);
      } else {
        // For unknown building types, recommend general measures
        const generalMeasures = await this.searchMeasures('energy efficiency');
        recommendations.push(...generalMeasures);
      }

      logger.info(`Found ${recommendations.length} model-based recommendations`);
      return recommendations;
    } catch (error) {
      logger.error(
        `Error getting model-based recommendations: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Calculate relevance scores for measures
   * @param measures Array of measures
   * @param context Context string
   * @param hasModelPath Whether a model path was provided
   * @returns Array of scored measures
   */
  private calculateMeasureScores(
    measures: Measure[],
    context: string,
    hasModelPath: boolean,
  ): { measure: Measure; score: number }[] {
    const contextLower = context.toLowerCase();
    const contextWords = contextLower.split(/\s+/).filter((word) => word.length > 2);

    return measures.map((measure) => {
      let score = 0;

      // Name matching (highest weight)
      const nameLower = measure.name.toLowerCase();
      for (const word of contextWords) {
        if (nameLower.includes(word)) {
          score += 5;
        }
      }

      // Description matching
      const descLower = measure.description.toLowerCase();
      for (const word of contextWords) {
        if (descLower.includes(word)) {
          score += 3;
        }
      }

      // Modeler description matching
      const modelerDescLower = measure.modelerDescription.toLowerCase();
      for (const word of contextWords) {
        if (modelerDescLower.includes(word)) {
          score += 2;
        }
      }

      // Tag matching
      const tagsLower = measure.tags.map((tag) => tag.toLowerCase());
      for (const word of contextWords) {
        if (tagsLower.some((tag) => tag.includes(word))) {
          score += 4;
        }
      }

      // Exact phrase matching (highest bonus)
      if (nameLower.includes(contextLower) || descLower.includes(contextLower)) {
        score += 10;
      }

      // Bonus for measures with arguments (more configurable)
      if (measure.arguments.length > 0) {
        score += 2;
      }

      // Bonus for measures with detailed descriptions
      if (measure.description.length > 100) {
        score += 1;
      }

      // If we have a model path, prioritize model-based recommendations
      if (hasModelPath) {
        // This would be more sophisticated in a real implementation
        // For now, we'll just give a small bonus to all measures when a model is provided
        score += 1;
      }

      return { measure, score };
    });
  }

  /**
   * Remove duplicate measures from an array
   * @param measures Array of measures
   * @returns Array of unique measures
   */
  private removeDuplicateMeasures(measures: Measure[]): Measure[] {
    const uniqueMeasures = new Map<string, Measure>();

    for (const measure of measures) {
      if (!uniqueMeasures.has(measure.id)) {
        uniqueMeasures.set(measure.id, measure);
      }
    }

    return Array.from(uniqueMeasures.values());
  }

  /**
   * Sort measures by relevance to a context string
   * @param measures Array of measures
   * @param context Context string
   * @returns Sorted array of measures
   */
  private sortMeasuresByRelevance(measures: Measure[], context: string): Measure[] {
    // This is a simple implementation that could be improved
    // In a real implementation, we might use more sophisticated relevance scoring

    const contextLower = context.toLowerCase();

    return measures.sort((a, b) => {
      // Calculate a simple relevance score based on how many times the measure name and description
      // contain words from the context
      const aScore = this.calculateRelevanceScore(a, contextLower);
      const bScore = this.calculateRelevanceScore(b, contextLower);

      return bScore - aScore; // Sort in descending order
    });
  }

  /**
   * Calculate a relevance score for a measure based on a context string
   * @param measure Measure
   * @param context Lowercase context string
   * @returns Relevance score
   */
  private calculateRelevanceScore(measure: Measure, context: string): number {
    let score = 0;

    // Check if the measure name contains words from the context
    const nameLower = measure.name.toLowerCase();
    if (context.split(' ').some((word) => word.length > 2 && nameLower.includes(word))) {
      score += 3;
    }

    // Check if the measure description contains words from the context
    const descLower = measure.description.toLowerCase();
    if (context.split(' ').some((word) => word.length > 2 && descLower.includes(word))) {
      score += 2;
    }

    // Check if the measure tags contain words from the context
    const tagsLower = measure.tags.map((tag) => tag.toLowerCase());
    if (
      context
        .split(' ')
        .some((word) => word.length > 2 && tagsLower.some((tag) => tag.includes(word)))
    ) {
      score += 1;
    }

    return score;
  }

  /**
   * Handle API errors
   * @param error Axios error
   */
  private handleApiError(error: AxiosError): void {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      logger.error(
        `BCL API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
      );
    } else if (error.request) {
      // The request was made but no response was received
      logger.error('BCL API error: No response received from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      logger.error(`BCL API error: ${error.message}`);
    }
  }

  /**
   * Check if an error indicates that the API is unavailable
   * @param error Error object
   * @returns Boolean indicating if the API is unavailable
   */
  private isApiUnavailable(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      // Network errors or timeout errors indicate API unavailability
      return !error.response || error.code === 'ECONNABORTED';
    }
    return false;
  }
}
