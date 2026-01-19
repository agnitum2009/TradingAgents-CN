/**
 * Data Migration Test Script
 *
 * Simple test for migration functionality without full build.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';

// Simple migration result class
class MigrationResult {
  constructor(name, success, processed, succeeded, failed, duration) {
    this.name = name;
    this.success = success;
    this.processed = processed;
    this.succeeded = succeeded;
    this.failed = failed;
    this.duration = duration;
    this.timestamp = Date.now();
  }
}

// Simple migration runner
class MigrationRunner {
  constructor(projectRoot = null) {
    // Use project root (parent of ts_services)
    this.projectRoot = projectRoot || join(process.cwd(), '..', '..');
    this.results = [];
  }

  async runMigration(name, data, transform, options = {}) {
    const startTime = Date.now();
    const dryRun = options.dryRun || false;
    const continueOnError = options.continueOnError || false;

    console.log(`\n🔄 Running migration: ${name}`);
    console.log(`   Items: ${data.length}`);
    console.log(`   Dry run: ${dryRun ? 'Yes' : 'No'}`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const results = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      try {
        const transformed = transform(item);
        results.push(transformed);
        succeeded++;
        processed++;
      } catch (err) {
        failed++;
        processed++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`   Warning: Failed to process item ${i + 1}: ${errorMessage}`);

        if (!continueOnError) {
          throw new Error(`Migration failed at item ${i + 1}: ${errorMessage}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    const result = new MigrationResult(name, failed === 0, processed, succeeded, failed, duration);
    this.results.push(result);

    console.log(`   ✅ Complete: ${succeeded} succeeded, ${failed} failed`);
    console.log(`   ⏱️  Duration: ${duration}ms`);

    return { result, results };
  }

  async loadJSON(filePath) {
    const fullPath = join(this.projectRoot, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
  }

  async saveJSON(filePath, data, pretty = true) {
    const fullPath = join(this.projectRoot, filePath);
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async createBackup(filePath) {
    const backupDir = join(this.projectRoot, 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    const basename = filePath.split(/[\\/]/).pop() || 'backup';
    const date = new Date();
    const ts = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupName = `${basename}.${ts}`;
    const backupPath = join(backupDir, backupName);

    await fs.copyFile(join(this.projectRoot, filePath), backupPath);
    console.log(`   📦 Backup created: ${backupPath}`);

    return backupPath;
  }

  printReport() {
    const summary = {
      total: this.results.length,
      succeeded: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      totalProcessed: this.results.reduce((sum, r) => sum + r.processed, 0),
      totalSucceeded: this.results.reduce((sum, r) => sum + r.succeeded, 0),
      totalFailed: this.results.reduce((sum, r) => sum + r.failed, 0),
      totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
    };

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
      for (const result of this.results) {
        const status = result.success ? 'SUCCESS ✅' : 'FAILED ❌';
        console.log(`${result.name.padEnd(25)} ${status.padStart(10)} ${result.processed.toString().padStart(10)} ${result.succeeded.toString().padStart(10)} ${result.failed.toString().padStart(10)} ${result.duration.toString().padStart(12)}`);
      }
      console.log('-'.repeat(70));
    }
    console.log('');
  }
}

// Configuration migrations
async function migrateConfig(runner, options = {}) {
  const backup = options.backup !== false;
  const dryRun = options.dryRun || false;

  console.log('\n🚀 Starting Configuration Migration');
  console.log('='.repeat(70));

  const results = [];

  // Migrate models.json
  try {
    console.log('\n📋 Migrating models.json...');
    const models = await runner.loadJSON('../config/models.json');

    if (backup && !dryRun) {
      await runner.createBackup('../config/models.json');
    }

    const transform = (item) => ({
      provider: item.provider,
      modelName: item.model_name,
      apiKey: item.api_key || '',
      baseUrl: item.base_url,
      maxTokens: item.max_tokens || 4000,
      temperature: item.temperature || 0.7,
      enabled: item.enabled ?? true,
    });

    const { result, migrated } = await runner.runMigration('models.json', models, transform, { dryRun });

    if (!dryRun && result.success) {
      const transformedModels = models.map(transform);
      await runner.saveJSON('../config/models.json', transformedModels);
      console.log('   💾 Saved migrated config');
    }

    results.push(result);
  } catch (error) {
    console.error('   ❌ Failed to migrate models.json:', error.message);
  }

  runner.printReport();

  return results;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noBackup = args.includes('--no-backup');

  console.log('\n' + '='.repeat(70));
  console.log('                    DATA MIGRATION TOOL');
  console.log('='.repeat(70));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify files)'}`);
  console.log(`Backup: ${noBackup ? 'Disabled' : 'Enabled'}`);
  console.log('='.repeat(70));

  const runner = new MigrationRunner();

  try {
    await migrateConfig(runner, { backup: !noBackup, dryRun });

    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('  1. Review the migrated files');
    console.log('  2. Test the application with new configuration');
    console.log('  3. If everything works, you can delete the backup files');
  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error(error);
    process.exit(1);
  }
}

// Run
main().catch(console.error);
