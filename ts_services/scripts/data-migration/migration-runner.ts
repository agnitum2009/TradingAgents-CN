/**
 * Migration Runner
 *
 * Core migration runner for executing data migrations.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  MigrationResult,
  MigrationOptions,
  MigrationProgress,
  BackupOptions,
} from './migration.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Migration Runner Class
 */
export class MigrationRunner {
  private results: MigrationResult[] = [];
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Run a migration
   */
  async runMigration<TFrom, TTo>(
    name: string,
    data: TFrom[],
    mapping: {
      transform: (from: TFrom) => TTo | Promise<TTo>;
      validate?: (to: TTo) => boolean | Promise<boolean>;
      filter?: (from: TFrom) => boolean | Promise<boolean>;
    },
    options: MigrationOptions = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const {
      dryRun = false,
      continueOnError = false,
      onProgress,
    } = options;

    console.log(`\n🔄 Running migration: ${name}`);
    console.log(`   Items: ${data.length}`);
    console.log(`   Dry run: ${dryRun ? 'Yes' : 'No'}`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let error: string | undefined;

    const total = data.length;
    const results: TTo[] = [];

    try {
      // Filter items if filter function provided
      let filteredData = data;
      if (mapping.filter) {
        filteredData = data.filter(item => {
          const result = mapping.filter(item);
          return typeof result === 'boolean' ? result : true;
        });
        console.log(`   After filter: ${filteredData.length} items`);
      }

      // Transform items
      for (let i = 0; i < filteredData.length; i++) {
        const item = filteredData[i];

        // Report progress
        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            percentage: Math.round(((i + 1) / total) * 100),
            currentItem: JSON.stringify(item).slice(0, 50),
          });
        }

        try {
          // Transform
          const transformed = await mapping.transform(item);

          // Validate if validate function provided
          if (mapping.validate) {
            const isValid = await mapping.validate(transformed);
            if (!isValid) {
              failed++;
              processed++;
              continue;
            }
          }

          results.push(transformed);
          succeeded++;
          processed++;
        } catch (err) {
          failed++;
          processed++;
          const errorMessage = err instanceof Error ? err.message : String(err);

          if (!continueOnError) {
            throw new Error(`Migration failed at item ${i + 1}: ${errorMessage}`);
          }

          console.warn(`   Warning: Failed to process item ${i + 1}: ${errorMessage}`);
        }
      }

      const duration = Date.now() - startTime;

      const result: MigrationResult = {
        name,
        success: failed === 0 || (continueOnError && succeeded > 0),
        processed,
        succeeded,
        failed,
        duration,
        timestamp: Date.now(),
      };

      this.results.push(result);

      console.log(`   ✅ Complete: ${succeeded} succeeded, ${failed} failed`);
      console.log(`   ⏱️  Duration: ${duration}ms`);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error = errorMessage;
      const duration = Date.now() - startTime;

      const result: MigrationResult = {
        name,
        success: false,
        processed,
        succeeded,
        failed,
        error: errorMessage,
        duration,
        timestamp: Date.now(),
      };

      this.results.push(result);

      console.log(`   ❌ Failed: ${errorMessage}`);
      console.log(`   ⏱️  Duration: ${duration}ms`);

      return result;
    }
  }

  /**
   * Create backup
   */
  async createBackup(
    filePath: string,
    options: BackupOptions = {}
  ): Promise<string> {
    const {
      dir = join(this.projectRoot, 'backups'),
      timestamp = true,
      format = 'none',
    } = options;

    // Create backup directory
    await fs.mkdir(dir, { recursive: true });

    // Generate backup filename
    const basename = filePath.split(/[\\/]/).pop() || 'backup';
    let backupName = basename;

    if (timestamp) {
      const date = new Date();
      const ts = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
      backupName = `${basename}.${ts}`;
    }

    const backupPath = join(dir, backupName);

    // Copy file
    await fs.copyFile(filePath, backupPath);

    console.log(`   📦 Backup created: ${backupPath}`);

    return backupPath;
  }

  /**
   * Load JSON file
   */
  async loadJSON<T>(filePath: string): Promise<T> {
    const fullPath = join(this.projectRoot, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save JSON file
   */
  async saveJSON<T>(filePath: string, data: T, pretty = true): Promise<void> {
    const fullPath = join(this.projectRoot, filePath);
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  /**
   * Get all results
   */
  getResults(): MigrationResult[] {
    return [...this.results];
  }

  /**
   * Get summary
   */
  getSummary(): {
    total: number;
    succeeded: number;
    failed: number;
    totalProcessed: number;
    totalSucceeded: number;
    totalFailed: number;
    totalDuration: number;
  } {
    return {
      total: this.results.length,
      succeeded: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      totalProcessed: this.results.reduce((sum, r) => sum + r.processed, 0),
      totalSucceeded: this.results.reduce((sum, r) => sum + r.succeeded, 0),
      totalFailed: this.results.reduce((sum, r) => sum + r.failed, 0),
      totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
    };
  }

  /**
   * Print summary report
   */
  printReport(): void {
    const summary = this.getSummary();

    console.log('\n' + '='.repeat(70));
    console.log('                    MIGRATION SUMMARY REPORT');
    console.log('='.repeat(70));
    console.log(`Total Migrations: ${summary.total}`);
    console.log(`Succeeded: ${summary.succeeded} ✅`);
    console.log(`Failed: ${summary.failed} ${summary.failed > 0 ? '❌' : ''}`);
    console.log('='.repeat(70));
    console.log(`Total Items Processed: ${summary.totalProcessed}`);
    console.log(`Total Items Succeeded: ${summary.totalSucceeded}`);
    console.log(`Total Items Failed: ${summary.totalFailed}`);
    console.log(`Total Duration: ${summary.totalDuration}ms`);
    console.log('='.repeat(70));

    if (this.results.length > 0) {
      console.log('\nMigration Details:');
      console.log('-'.repeat(70));
      console.log(
        `${'Migration'.padEnd(25)} ${'Status'.padStart(10)} ${'Processed'.padStart(10)} ${'Success'.padStart(10)} ${'Failed'.padStart(10)} ${'Duration'.padStart(12)}`
      );
      console.log('-'.repeat(70));

      for (const result of this.results) {
        const status = result.success ? 'SUCCESS ✅' : 'FAILED ❌';
        console.log(
          `${result.name.padEnd(25)} ${status.padStart(10)} ${result.processed.toString().padStart(10)} ${result.succeeded.toString().padStart(10)} ${result.failed.toString().padStart(10)} ${result.duration.toString().padStart(12)}`
        );
      }

      console.log('-'.repeat(70));
    }

    console.log('');
  }
}
