/**
 * Market Configuration Repository
 *
 * Handles market categories and data source groupings storage operations.
 *
 * Based on: config.repository.ts lines 610-851
 *
 * @module config-market-repository
 */

import { injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import type {
  MarketCategory,
  DataSourceGrouping,
  Entity,
} from '../../types/index.js';
import { ConfigRepositoryBase, DEFAULT_MARKET_CATEGORIES } from './config-base.repository.js';

const logger = ConfigRepositoryBase.getLogger();

/**
 * Market Configuration Repository
 *
 * Manages market categories and data source groupings storage.
 */
@injectable()
export class MarketConfigRepository extends ConfigRepositoryBase {
  /** Market categories storage */
  private readonly marketCategories = new Map<string, MarketCategory>();

  /** Data source groupings storage */
  private readonly dataSourceGroupings = new Map<string, DataSourceGrouping>();

  // ========================================================================
  // Market Category Operations
  // ========================================================================

  /**
   * Get all market categories
   *
   * @returns Array of market categories (sorted by sortOrder)
   */
  async getMarketCategories(): Promise<MarketCategory[]> {
    const categories = Array.from(this.marketCategories.values());
    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Get market category by ID
   *
   * @param id - Category ID
   * @returns Market category or null
   */
  async getMarketCategory(id: string): Promise<MarketCategory | null> {
    return this.marketCategories.get(id) || null;
  }

  /**
   * Add market category
   *
   * @param category - Market category to add
   * @returns Added market category
   */
  async addMarketCategory(
    category: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> & MarketCategory,
  ): Promise<MarketCategory> {
    const now = Date.now();
    const newCategory: MarketCategory = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...category,
    };

    this.marketCategories.set(category.id, newCategory);
    logger.info(`✅ Added market category: ${category.id}`);
    return newCategory;
  }

  /**
   * Update market category
   *
   * @param id - Category ID
   * @param updates - Fields to update
   * @returns Updated market category or null
   */
  async updateMarketCategory(
    id: string,
    updates: Partial<Omit<MarketCategory, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<MarketCategory | null> {
    const category = this.marketCategories.get(id);
    if (!category) {
      return null;
    }

    const updated: MarketCategory = {
      ...category,
      ...updates,
      updatedAt: Date.now(),
    };

    this.marketCategories.set(id, updated);
    logger.info(`✅ Updated market category: ${id}`);
    return updated;
  }

  /**
   * Delete market category
   *
   * @param id - Category ID
   * @returns True if deleted
   */
  async deleteMarketCategory(id: string): Promise<boolean> {
    // Check if any data sources use this category
    const groupings = Array.from(this.dataSourceGroupings.values()).filter(
      (g) => g.marketCategoryId === id,
    );
    if (groupings.length > 0) {
      logger.warn(`Cannot delete market category ${id}: data sources still use it`);
      return false;
    }

    const existed = this.marketCategories.delete(id);
    if (existed) {
      logger.info(`✅ Deleted market category: ${id}`);
    }
    return existed;
  }

  // ========================================================================
  // Data Source Grouping Operations
  // ========================================================================

  /**
   * Get all data source groupings
   *
   * @returns Array of data source groupings
   */
  async getDataSourceGroupings(): Promise<DataSourceGrouping[]> {
    return Array.from(this.dataSourceGroupings.values());
  }

  /**
   * Get data source groupings by market category
   *
   * @param marketCategoryId - Market category ID
   * @returns Array of data source groupings
   */
  async getDataSourceGroupingsByCategory(marketCategoryId: string): Promise<DataSourceGrouping[]> {
    const groupings = Array.from(this.dataSourceGroupings.values());
    return groupings.filter((g) => g.marketCategoryId === marketCategoryId);
  }

  /**
   * Add data source to market category
   *
   * @param grouping - Data source grouping to add
   * @returns Added data source grouping
   */
  async addDataSourceToCategory(
    grouping: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'> & DataSourceGrouping,
  ): Promise<DataSourceGrouping> {
    const now = Date.now();
    const key = `${grouping.dataSourceName}:${grouping.marketCategoryId}`;
    const newGrouping: DataSourceGrouping = {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      ...grouping,
    };

    this.dataSourceGroupings.set(key, newGrouping);
    logger.info(`✅ Added data source to category: ${grouping.dataSourceName} -> ${grouping.marketCategoryId}`);
    return newGrouping;
  }

  /**
   * Update data source grouping
   *
   * @param dataSourceName - Data source name
   * @param marketCategoryId - Market category ID
   * @param updates - Fields to update
   * @returns Updated data source grouping or null
   */
  async updateDataSourceGrouping(
    dataSourceName: string,
    marketCategoryId: string,
    updates: Partial<Omit<DataSourceGrouping, 'id' | 'createdAt' | 'updatedAt' | 'dataSourceName' | 'marketCategoryId'>>,
  ): Promise<DataSourceGrouping | null> {
    const key = `${dataSourceName}:${marketCategoryId}`;
    const grouping = this.dataSourceGroupings.get(key);
    if (!grouping) {
      return null;
    }

    const updated: DataSourceGrouping = {
      ...grouping,
      ...updates,
      updatedAt: Date.now(),
    };

    this.dataSourceGroupings.set(key, updated);
    logger.info(`✅ Updated data source grouping: ${dataSourceName} -> ${marketCategoryId}`);
    return updated;
  }

  /**
   * Remove data source from market category
   *
   * @param dataSourceName - Data source name
   * @param marketCategoryId - Market category ID
   * @returns True if removed
   */
  async removeDataSourceFromCategory(dataSourceName: string, marketCategoryId: string): Promise<boolean> {
    const key = `${dataSourceName}:${marketCategoryId}`;
    const existed = this.dataSourceGroupings.delete(key);
    if (existed) {
      logger.info(`✅ Removed data source from category: ${dataSourceName} -> ${marketCategoryId}`);
    }
    return existed;
  }

  /**
   * Initialize default market categories
   */
  initializeDefaults(): void {
    const now = Date.now();

    // Create default market categories
    for (const category of DEFAULT_MARKET_CATEGORIES) {
      const marketCategory: MarketCategory = {
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        ...category,
      };
      this.marketCategories.set(marketCategory.id, marketCategory);
    }

    logger.info('✅ Default market categories initialized');
  }
}
