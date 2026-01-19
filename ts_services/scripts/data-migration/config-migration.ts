/**
 * Configuration Migration
 *
 * Migrate configuration files from old format to new format.
 */

import type { LLMConfig, PricingConfig, SystemConfig } from '../../src/types/index.js';
import type { DataMapping } from './migration.types.js';
import { MigrationRunner } from './migration-runner.js';

/**
 * Configuration Mappings
 */
export class ConfigMigration {
  private runner: MigrationRunner;

  constructor(projectRoot?: string) {
    this.runner = new MigrationRunner(projectRoot);
  }

  /**
   * Migrate models.json
   */
  async migrateModels(options = { backup: true, dryRun: false }) {
    const { backup, dryRun } = options;

    console.log('\n📋 Migrating models.json...');

    // Load old config
    const oldModels = await this.runner.loadJSON<any[]>('config/models.json');

    // Create backup
    if (backup && !dryRun) {
      await this.runner.createBackup('config/models.json');
    }

    // Migration mapping
    const mapping: DataMapping<any, LLMConfig> = {
      transform: (item) => ({
        provider: item.provider,
        modelName: item.model_name,
        apiKey: item.api_key || '',
        baseUrl: item.base_url,
        maxTokens: item.max_tokens || 4000,
        temperature: item.temperature || 0.7,
        enabled: item.enabled ?? true,
      }),
      validate: (config) => {
        return !!config.provider && !!config.modelName;
      },
      filter: (item) => {
        return item.enabled !== false; // Only include enabled models
      },
    };

    // Run migration
    const result = await this.runner.runMigration(
      'models.json',
      oldModels,
      mapping,
      { dryRun }
    );

    // Save migrated config
    if (!dryRun && result.success) {
      const migrated = oldModels.map(item => mapping.transform(item));
      await this.runner.saveJSON('config/models.json', migrated);
      console.log('   💾 Saved migrated config to config/models.json');
    }

    return result;
  }

  /**
   * Migrate pricing.json
   */
  async migratePricing(options = { backup: true, dryRun: false }) {
    const { backup, dryRun } = options;

    console.log('\n📋 Migrating pricing.json...');

    // Load old config
    const oldPricing = await this.runner.loadJSON<any[]>('config/pricing.json');

    // Create backup
    if (backup && !dryRun) {
      await this.runner.createBackup('config/pricing.json');
    }

    // Migration mapping
    const mapping: DataMapping<any, PricingConfig> = {
      transform: (item) => ({
        provider: item.provider,
        modelName: item.model_name,
        inputPricePer1k: item.input_price_per_1k || 0,
        outputPricePer1k: item.output_price_per_1k || 0,
        currency: item.currency || 'USD',
      }),
      validate: (config) => {
        return !!config.provider && !!config.modelName;
      },
    };

    // Run migration
    const result = await this.runner.runMigration(
      'pricing.json',
      oldPricing,
      mapping,
      { dryRun }
    );

    // Save migrated config
    if (!dryRun && result.success) {
      const migrated = oldPricing.map(item => mapping.transform(item));
      await this.runner.saveJSON('config/pricing.json', migrated);
      console.log('   💾 Saved migrated config to config/pricing.json');
    }

    return result;
  }

  /**
   * Migrate settings.json
   */
  async migrateSettings(options = { backup: true, dryRun: false }) {
    const { backup, dryRun } = options;

    console.log('\n📋 Migrating settings.json...');

    // Load old config
    const oldSettings = await this.runner.loadJSON<Record<string, any>>('config/settings.json');

    // Create backup
    if (backup && !dryRun) {
      await this.runner.createBackup('config/settings.json');
    }

    // Transform settings (this is a key-value mapping, not array)
    const newSettings: SystemConfig = {
      projectDir: oldSettings.project_dir || '',
      resultsDir: oldSettings.results_dir || '',
      dataDir: oldSettings.data_dir || '',
      dataCacheDir: oldSettings.data_cache_dir || '',
      llmProvider: (oldSettings.llm_provider || 'dashscope') as any,
      deepThinkLlm: oldSettings.deep_think_llm || '',
      quickThinkLlm: oldSettings.quick_think_llm || '',
      backendUrl: oldSettings.backend_url || '',
      maxDebateRounds: oldSettings.max_debate_rounds || 1,
      maxRiskDiscussRounds: oldSettings.max_risk_discuss_rounds || 2,
      maxRecurLimit: oldSettings.max_recur_limit || 100,
      onlineTools: oldSettings.online_tools ?? true,
      onlineNews: oldSettings.online_news ?? true,
      realtimeData: oldSettings.realtime_data ?? true,
      memoryEnabled: oldSettings.memory_enabled ?? true,
      selectedAnalysts: oldSettings.selected_analysts || [],
      debug: oldSettings.debug ?? false,
      researchDepth: oldSettings.research_depth || '标准',
      quickProvider: oldSettings.quick_provider || 'dashscope',
      deepProvider: oldSettings.deep_provider || 'dashscope',
      quickBackendUrl: oldSettings.quick_backend_url || '',
      deepBackendUrl: oldSettings.deep_backend_url || '',
      maxConcurrentTasks: oldSettings.max_concurrent_tasks || 3,
      defaultAnalysisTimeout: oldSettings.default_analysis_timeout || 300,
      enableCache: oldSettings.enable_cache ?? true,
      cacheTtl: oldSettings.cache_ttl || 3600,
      logLevel: (oldSettings.log_level || 'INFO') as any,
      enableMonitoring: oldSettings.enable_monitoring ?? true,
    };

    console.log(`   Settings transformed: ${Object.keys(newSettings).length} keys`);

    // Save migrated config
    if (!dryRun) {
      await this.runner.saveJSON('config/settings.json', newSettings);
      console.log('   💾 Saved migrated config to config/settings.json');
    }

    return {
      name: 'settings.json',
      success: true,
      processed: 1,
      succeeded: 1,
      failed: 0,
      duration: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Run all config migrations
   */
  async migrateAll(options = { backup: true, dryRun: false }) {
    console.log('\n🚀 Starting Configuration Migration');
    console.log('='.repeat(70));

    const results = await Promise.all([
      this.migrateModels(options),
      this.migratePricing(options),
      this.migrateSettings(options),
    ]);

    this.runner.printReport();

    return results;
  }
}
