#!/usr/bin/env node

import dotenv from 'dotenv';
import { SupabaseTicketOperations } from './operations.js';
import { Utils } from '../utils.js';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

// Load environment variables
dotenv.config();

console.log(chalk.cyan.bold('\n🗄️  Supabase Database Migration Runner\n'));

class MigrationRunner {
  constructor() {
    this.operations = new SupabaseTicketOperations();
    this.migrationPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'migration_passenger_profiles.sql');
  }

  async run() {
    try {
      const args = process.argv.slice(2);
      const command = args[0];

      switch (command) {
        case 'apply':
          await this.applyMigration();
          break;
        
        case 'status':
          await this.checkMigrationStatus();
          break;
          
        case 'cleanup':
          await this.cleanupDuplicates();
          break;

        case 'test':
          await this.testMigration();
          break;
          
        default:
          this.showHelp();
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Migration failed:'), error.message);
      if (process.env.NODE_ENV === 'development') {
        console.error(chalk.gray('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }

  async applyMigration() {
    console.log(chalk.blue('🚀 Applying passenger profiles migration...'));
    
    try {
      await this.operations.ensureConnection();
      
      // Read migration SQL
      const migrationSQL = await fs.readFile(this.migrationPath, 'utf8');
      console.log(chalk.gray(`📁 Read migration file: ${this.migrationPath}`));
      
      // Split into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('COMMENT'));

      console.log(chalk.blue(`📝 Found ${statements.length} migration statements`));

      // Execute each statement
      let successCount = 0;
      let skipCount = 0;

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        try {
          console.log(chalk.gray(`  ${i + 1}/${statements.length}: Executing statement...`));
          
          const { error } = await this.operations.client.rpc('exec_sql', {
            sql: statement + ';'
          });

          if (error) {
            // Check if it's a "already exists" error which we can skip
            if (error.message.includes('already exists') || 
                error.message.includes('relation') && error.message.includes('exists')) {
              console.log(chalk.yellow(`    ⏭️  Skipped (already exists): ${statement.substring(0, 50)}...`));
              skipCount++;
            } else {
              throw error;
            }
          } else {
            console.log(chalk.green(`    ✅ Success: ${statement.substring(0, 50)}...`));
            successCount++;
          }

        } catch (statementError) {
          // Try direct SQL execution as fallback
          try {
            const result = await this.operations.client.from('_sql_exec').insert({ sql: statement + ';' });
            if (!result.error) {
              console.log(chalk.green(`    ✅ Success (fallback): ${statement.substring(0, 50)}...`));
              successCount++;
            } else {
              throw result.error;
            }
          } catch (fallbackError) {
            console.error(chalk.red(`    ❌ Failed: ${statement.substring(0, 50)}...`));
            console.error(chalk.red(`       Error: ${statementError.message}`));
            
            // Continue with next statement instead of failing completely
            if (!statementError.message.includes('already exists')) {
              console.log(chalk.yellow('    ⚠️  Continuing with next statement...'));
            }
          }
        }

        // Small delay between statements
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(chalk.cyan('\n📊 Migration Results:'));
      console.log(chalk.green(`✅ Successful: ${successCount}`));
      console.log(chalk.yellow(`⏭️  Skipped: ${skipCount}`));
      console.log(chalk.red(`❌ Failed: ${statements.length - successCount - skipCount}`));

      // Test the migration by checking if passenger_profiles table exists
      console.log(chalk.blue('\n🔍 Verifying migration...'));
      await this.checkMigrationStatus();

      console.log(chalk.green('\n🎉 Migration process completed!'));
      console.log(chalk.gray('Note: Some statements may have been skipped if already applied.'));
      console.log(chalk.gray('Manual verification in Supabase SQL Editor is recommended.'));

    } catch (error) {
      console.error(chalk.red('❌ Migration application failed:'), error.message);
      console.log(chalk.yellow('\n💡 Alternative approach:'));
      console.log(chalk.gray('1. Copy the migration SQL from:'));
      console.log(chalk.gray(`   ${this.migrationPath}`));
      console.log(chalk.gray('2. Run it manually in your Supabase SQL Editor'));
      console.log(chalk.gray('3. Then run: npm run db-migrate test'));
      throw error;
    }
  }

  async checkMigrationStatus() {
    console.log(chalk.blue('🔍 Checking migration status...'));
    
    try {
      await this.operations.ensureConnection();

      // Check if passenger_profiles table exists
      const { data: profilesTableExists, error: profilesError } = await this.operations.client
        .from('passenger_profiles')
        .select('count', { count: 'exact', head: true });

      const hasProfilesTable = !profilesError;

      // Check if passengers table has new columns
      const { data: samplePassenger, error: passengerError } = await this.operations.client
        .from('passengers')
        .select('passenger_profile_id, allocated_cost')
        .limit(1);

      const hasNewColumns = !passengerError;

      // Check enhanced views
      const { data: enhancedView, error: viewError } = await this.operations.client
        .from('enhanced_ticket_details')
        .select('pnr')
        .limit(1);

      const hasEnhancedView = !viewError;

      console.log(chalk.cyan('\n📋 Migration Status:'));
      console.log(chalk.white(`passenger_profiles table: ${hasProfilesTable ? chalk.green('✅ Created') : chalk.red('❌ Missing')}`));
      console.log(chalk.white(`passengers new columns: ${hasNewColumns ? chalk.green('✅ Added') : chalk.red('❌ Missing')}`));
      console.log(chalk.white(`enhanced_ticket_details view: ${hasEnhancedView ? chalk.green('✅ Created') : chalk.red('❌ Missing')}`));

      if (hasProfilesTable) {
        // Get passenger profiles count
        const { count: profilesCount } = await this.operations.client
          .from('passenger_profiles')
          .select('*', { count: 'exact', head: true });

        console.log(chalk.blue(`\n📊 Current passenger profiles: ${profilesCount || 0}`));

        if (profilesCount > 0) {
          // Get frequent travelers
          const { data: frequentTravelers } = await this.operations.client
            .from('passenger_profiles')
            .select('name, age, travel_count')
            .gte('travel_count', 2)
            .order('travel_count', { ascending: false })
            .limit(5);

          if (frequentTravelers && frequentTravelers.length > 0) {
            console.log(chalk.green('\n🏆 Top Frequent Travelers:'));
            frequentTravelers.forEach((traveler, index) => {
              console.log(chalk.white(`  ${index + 1}. ${traveler.name} (${traveler.age}) - ${traveler.travel_count} trips`));
            });
          }
        }
      }

      const migrationComplete = hasProfilesTable && hasNewColumns && hasEnhancedView;
      
      if (migrationComplete) {
        console.log(chalk.green('\n🎉 Migration is fully applied and functional!'));
      } else {
        console.log(chalk.yellow('\n⚠️  Migration is incomplete. Run "npm run db-migrate apply" to fix.'));
      }

      return migrationComplete;

    } catch (error) {
      console.error(chalk.red('❌ Status check failed:'), error.message);
      throw error;
    }
  }

  async cleanupDuplicates() {
    console.log(chalk.blue('🧹 Cleaning up duplicate passenger profiles...'));
    
    try {
      await this.operations.ensureConnection();

      // Check if cleanup function exists
      const { data, error } = await this.operations.client.rpc('cleanup_duplicate_passenger_profiles');

      if (error) {
        console.error(chalk.red('❌ Cleanup function not available. Please run migration first.'));
        throw error;
      }

      const result = data[0];
      console.log(chalk.cyan('\n🧹 Cleanup Results:'));
      console.log(chalk.white(`Merged groups: ${result.merged_groups}`));
      console.log(chalk.white(`Total profiles processed: ${result.profiles_merged}`));
      console.log(chalk.white(`Duplicate profiles deleted: ${result.profiles_deleted}`));

      if (result.profiles_deleted > 0) {
        console.log(chalk.green(`\n✅ Successfully cleaned up ${result.profiles_deleted} duplicate profiles!`));
      } else {
        console.log(chalk.blue('\n✨ No duplicate profiles found. Database is clean!'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Cleanup failed:'), error.message);
      throw error;
    }
  }

  async testMigration() {
    console.log(chalk.blue('🧪 Testing migration functionality...'));
    
    try {
      await this.operations.ensureConnection();

      // Test 1: Check if we can create a passenger profile
      console.log(chalk.gray('Test 1: Creating test passenger profile...'));
      
      const testProfile = await this.operations.getOrCreatePassengerProfile({
        name: 'TEST_PASSENGER',
        age: 25,
        gender: 'Male'
      });

      console.log(chalk.green(`✅ Test profile created: ${testProfile.id}`));

      // Test 2: Check if enhanced stats work
      console.log(chalk.gray('Test 2: Fetching enhanced database stats...'));
      
      const { data: stats, error: statsError } = await this.operations.client.rpc('get_enhanced_database_stats');
      
      if (statsError) throw statsError;

      const stat = stats[0];
      console.log(chalk.green('✅ Enhanced stats working:'));
      console.log(chalk.white(`  - Tickets: ${stat.total_tickets}`));
      console.log(chalk.white(`  - Passenger profiles: ${stat.unique_passenger_profiles}`));
      console.log(chalk.white(`  - Frequent travelers: ${stat.frequent_travelers}`));

      // Test 3: Clean up test data
      console.log(chalk.gray('Test 3: Cleaning up test data...'));
      
      await this.operations.client
        .from('passenger_profiles')
        .delete()
        .eq('id', testProfile.id);

      console.log(chalk.green('✅ Test data cleaned up'));

      console.log(chalk.green('\n🎉 All migration tests passed successfully!'));

    } catch (error) {
      console.error(chalk.red('❌ Migration test failed:'), error.message);
      throw error;
    }
  }

  showHelp() {
    console.log(chalk.cyan('Supabase Database Migration Runner'));
    console.log(chalk.cyan('='.repeat(35)));
    console.log('\nCommands:');
    console.log(chalk.white('  apply              '), chalk.gray('- Apply passenger profiles migration'));
    console.log(chalk.white('  status             '), chalk.gray('- Check migration status'));
    console.log(chalk.white('  cleanup            '), chalk.gray('- Clean up duplicate passenger profiles'));
    console.log(chalk.white('  test               '), chalk.gray('- Test migration functionality'));
    
    console.log('\nExamples:');
    console.log(chalk.gray('  node src/supabase/run-migrations.js apply'));
    console.log(chalk.gray('  node src/supabase/run-migrations.js status'));
    console.log(chalk.gray('  node src/supabase/run-migrations.js cleanup'));
    console.log(chalk.gray('  node src/supabase/run-migrations.js test'));

    console.log(chalk.yellow('\n⚠️  Requirements:'));
    console.log(chalk.gray('   • Supabase project with basic schema already applied'));
    console.log(chalk.gray('   • SUPABASE_URL and SUPABASE_ANON_KEY in .env file'));
    console.log(chalk.gray('   • Database connection with sufficient permissions'));
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new MigrationRunner();
  runner.run();
}

export { MigrationRunner };