/**
 * Data Migration Script
 *
 * Main entry point for data migration operations.
 * Run with: node scripts/data-migration/index.js
 */

import { ConfigMigration } from './config-migration.js';
import { MigrationRunner } from './migration-runner.js';

/**
 * Main migration function
 */
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

  const options = {
    backup: !noBackup,
    dryRun,
  };

  try {
    // Run configuration migrations
    const configMigration = new ConfigMigration();
    await configMigration.migrateAll(options);

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

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ConfigMigration, MigrationRunner };
export * from './migration.types.js';
