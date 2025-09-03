#!/usr/bin/env node

import dotenv from 'dotenv';
import { SupabaseTicketOperations } from './supabase/operations.js';
import { Utils } from './utils.js';
import chalk from 'chalk';
import path from 'path';

// Load environment variables
dotenv.config();

console.log(chalk.cyan.bold('\n🗄️  Supabase Cloud Import Utility\n'));

class SupabaseImporter {
  constructor() {
    this.operations = new SupabaseTicketOperations();
  }

  async run() {
    try {
      const args = process.argv.slice(2);
      const command = args[0];

      switch (command) {
        case 'import':
          await this.importCommand(args.slice(1));
          break;
        
        case 'search':
          await this.searchCommand(args.slice(1));
          break;
          
        case 'stats':
          await this.statsCommand();
          break;
          
        case 'test':
          await this.testConnectionCommand();
          break;

        case 'timeline':
          await this.timelineCommand(args.slice(1));
          break;

        case 'enhanced-timeline':
          await this.enhancedTimelineCommand(args.slice(1));
          break;

        case 'validate-journeys':
          await this.validateJourneysCommand(args.slice(1));
          break;
          
        default:
          this.showHelp();
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Operation failed:'), error.message);
      if (process.env.NODE_ENV === 'development') {
        console.error(chalk.gray('Stack trace:'), error.stack);
      }
      process.exit(1);
    }
  }

  async importCommand(args) {
    const inputDir = args[0] || './3_OCR_TXT_Files';
    
    console.log(chalk.blue(`🔄 Starting bulk import to Supabase from: ${inputDir}`));
    
    if (!await require('fs-extra').pathExists(inputDir)) {
      throw new Error(`Input directory not found: ${inputDir}`);
    }

    const startTime = Date.now();
    const stats = await this.operations.bulkImportFromDirectory(inputDir);
    const duration = (Date.now() - startTime) / 1000;

    // Display results
    console.log(chalk.cyan('\n📊 SUPABASE IMPORT COMPLETE'));
    console.log(chalk.cyan('='.repeat(35)));
    console.log(chalk.white(`⏱️  Duration: ${Math.round(duration)}s`));
    console.log(chalk.green(`✅ Imported: ${stats.imported}`));
    console.log(chalk.blue(`📝 Updated: ${stats.updated}`));
    
    if (stats.failed > 0) {
      console.log(chalk.red(`❌ Failed: ${stats.failed}`));
    }
    
    if (stats.duplicates > 0) {
      console.log(chalk.yellow(`⚠️  Duplicates: ${stats.duplicates}`));
    }
    
    console.log(chalk.white(`🎯 Success rate: ${stats.successRate}%`));

    // Generate report
    const reportPath = `./reports/supabase-import-report-${new Date().getTime()}.txt`;
    await require('fs-extra').ensureDir('./reports');
    await this.operations.generateImportReport(reportPath);
    console.log(chalk.gray(`\n📄 Detailed report: ${reportPath}`));

    // Show next steps
    if (stats.successRate > 0) {
      console.log(chalk.green('\n🎉 Next Steps:'));
      console.log(chalk.gray('   • Data is now available via Supabase REST APIs'));
      console.log(chalk.gray('   • Build your Next.js app using @supabase/supabase-js'));
      console.log(chalk.gray('   • APIs available at: https://your-project.supabase.co/rest/v1/'));
    }
  }

  async searchCommand(args) {
    if (args.length === 0) {
      console.log(chalk.yellow('Usage: npm run supabase search <pnr> [passenger_name] [passenger_age]'));
      return;
    }

    const [pnr, passengerName, passengerAge] = args;
    
    console.log(chalk.blue(`🔍 Searching Supabase for PNR: ${pnr}`));
    if (passengerName) console.log(chalk.gray(`   Passenger: ${passengerName}`));
    if (passengerAge) console.log(chalk.gray(`   Age: ${passengerAge}`));

    if (passengerName) {
      // Search with passenger details
      const result = await this.operations.getTicketByPNRAndPassenger(pnr, passengerName, passengerAge ? parseInt(passengerAge) : null);
      
      if (result) {
        console.log(chalk.green('\n✅ Ticket found in Supabase!'));
        console.log(chalk.cyan('Ticket Details:'));
        console.log(`   PNR: ${result.ticket.pnr}`);
        console.log(`   Transaction ID: ${result.ticket.transaction_id || 'N/A'}`);
        console.log(`   Passengers: ${result.ticket.passengers.length}`);
        console.log(`   Journeys: ${result.ticket.journeys.length}`);
        console.log(`   Total Fare: ₹${result.ticket.payment?.total || 'N/A'}`);
        
        if (result.matchedPassenger) {
          console.log(chalk.blue('\nMatched Passenger:'));
          console.log(`   Name: ${result.matchedPassenger.name}`);
          console.log(`   Age: ${result.matchedPassenger.age}`);
          console.log(`   Status: ${result.matchedPassenger.current_status}`);
        }
      } else {
        console.log(chalk.yellow('⚠️ No matching ticket found in Supabase'));
      }
    } else {
      // Search by PNR only
      const tickets = await this.operations.searchTickets({ pnr });
      
      if (tickets.length > 0) {
        console.log(chalk.green(`\n✅ Found ${tickets.length} ticket(s) in Supabase`));
        
        tickets.forEach((ticket, index) => {
          console.log(chalk.cyan(`\nTicket ${index + 1}:`));
          console.log(`   PNR: ${ticket.pnr}`);
          console.log(`   Passengers: ${ticket.passengers.length}`);
          console.log(`   Journeys: ${ticket.journeys.length}`);
          console.log(`   Total: ₹${ticket.payment?.total || 'N/A'}`);
        });
      } else {
        console.log(chalk.yellow('⚠️ No tickets found in Supabase'));
      }
    }
  }

  async timelineCommand(args) {
    if (args.length === 0) {
      console.log(chalk.yellow('Usage: npm run supabase timeline <pnr>'));
      return;
    }

    const pnr = args[0];
    console.log(chalk.blue(`🚂 Getting journey timeline for PNR: ${pnr}`));

    const timeline = await this.operations.getJourneyTimeline(pnr);

    if (timeline) {
      console.log(chalk.green('\n✅ Journey Timeline Found!'));
      console.log(chalk.cyan(`PNR: ${timeline.pnr}`));
      console.log(chalk.white(`Total Journeys: ${timeline.total_journeys}`));
      
      timeline.timeline.forEach((journey, index) => {
        console.log(chalk.blue(`\nJourney ${journey.sequence}:`));
        console.log(`   Train: ${journey.train_number} - ${journey.train_name}`);
        console.log(`   From: ${journey.boarding_station} (${new Date(journey.boarding_datetime).toLocaleString()})`);
        console.log(`   To: ${journey.destination_station} (${new Date(journey.destination_datetime).toLocaleString()})`);
        console.log(`   Class: ${journey.class} | Distance: ${journey.distance_km} km`);
      });
    } else {
      console.log(chalk.yellow('⚠️ No journey timeline found for this PNR'));
    }
  }

  async statsCommand() {
    console.log(chalk.blue('📊 Retrieving Supabase database statistics...'));
    
    const stats = await this.operations.getDatabaseStats();
    
    console.log(chalk.cyan('\n📈 SUPABASE DATABASE STATISTICS'));
    console.log(chalk.cyan('='.repeat(35)));
    console.log(chalk.white(`🎫 Total Tickets: ${stats.tickets.totalTickets}`));
    console.log(chalk.white(`👥 Total Passengers: ${stats.tickets.totalPassengers}`));
    console.log(chalk.white(`🚂 Total Journeys: ${stats.tickets.totalJourneys}`));
    console.log(chalk.white(`📊 Avg Passengers/Ticket: ${Math.round(stats.tickets.averagePassengers * 10) / 10}`));
    console.log(chalk.white(`💰 Total Revenue: ₹${Math.round(stats.tickets.totalRevenue)}`));
    
    console.log(chalk.cyan('\n🔌 SUPABASE CONNECTION'));
    console.log(chalk.cyan('='.repeat(35)));
    console.log(chalk.white(`Status: ${stats.connection.isConnected ? 'Connected' : 'Disconnected'}`));
    console.log(chalk.white(`URL: ${stats.connection.url}`));
    console.log(chalk.white(`Client Ready: ${stats.connection.hasClient}`));

    if (stats.tickets.totalTickets > 0) {
      console.log(chalk.green('\n🚀 API ENDPOINTS AVAILABLE'));
      console.log(chalk.gray('   REST API: https://your-project.supabase.co/rest/v1/tickets'));
      console.log(chalk.gray('   Search: GET /tickets?pnr=eq.YOUR_PNR'));
      console.log(chalk.gray('   Passengers: GET /passengers?ticket_id=eq.TICKET_ID'));
      console.log(chalk.gray('   Journeys: GET /journeys?ticket_id=eq.TICKET_ID'));
    }
  }

  async enhancedTimelineCommand(args) {
    if (args.length === 0) {
      console.log(chalk.yellow('Usage: npm run supabase enhanced-timeline <pnr>'));
      return;
    }

    const pnr = args[0];
    console.log(chalk.blue(`🚂 Getting enhanced journey timeline for PNR: ${pnr}`));

    try {
      const timeline = await this.operations.getEnhancedJourneyTimeline(pnr);

      if (timeline) {
        console.log(chalk.green('\n✅ Enhanced Journey Timeline Found!'));
        console.log(chalk.cyan(`PNR: ${timeline.pnr}`));
        console.log(chalk.white(`Journey Type: ${timeline.journeyType}`));
        console.log(chalk.white(`Total Journeys: ${timeline.total_journeys}`));
        console.log(chalk.white(`Total Distance: ${timeline.totalDistance} km`));
        console.log(chalk.white(`Total Travel Time: ${Math.round(timeline.totalTravelTime / 60)} hours ${timeline.totalTravelTime % 60} minutes`));

        // Show individual journeys
        timeline.timeline.forEach((journey, index) => {
          console.log(chalk.blue(`\nJourney ${journey.sequence}:`));
          console.log(`   Train: ${journey.train_number} - ${journey.train_name}`);
          console.log(`   From: ${journey.boarding_station} (${new Date(journey.boarding_datetime).toLocaleString()})`);
          console.log(`   To: ${journey.destination_station} (${new Date(journey.destination_datetime).toLocaleString()})`);
          console.log(`   Class: ${journey.class} | Distance: ${journey.distance_km} km`);
        });

        // Show connections
        if (timeline.connections && timeline.connections.length > 0) {
          console.log(chalk.green(`\n🔗 Journey Connections (${timeline.connections.length}):`));
          timeline.connections.forEach((connection, index) => {
            const waitHours = Math.floor(connection.waitTime / 60);
            const waitMinutes = connection.waitTime % 60;
            console.log(chalk.cyan(`\n  Connection ${index + 1}:`));
            console.log(`    From: ${connection.from.station} (Train ${connection.from.trainNumber})`);
            console.log(`    To: ${connection.to.station} (Train ${connection.to.trainNumber})`);
            console.log(`    Type: ${connection.connectionType}`);
            console.log(`    Wait Time: ${waitHours}h ${waitMinutes}m`);
          });
        }

        // Show connection analysis
        if (timeline.connectionAnalysis) {
          console.log(chalk.blue('\n📊 Connection Analysis:'));
          console.log(`   Has Connections: ${timeline.connectionAnalysis.hasConnections ? 'Yes' : 'No'}`);
          console.log(`   Multi-segment Journey: ${timeline.connectionAnalysis.isMultiSegmentJourney ? 'Yes' : 'No'}`);
        }
      } else {
        console.log(chalk.yellow('⚠️ No enhanced journey timeline found for this PNR'));
      }

    } catch (error) {
      console.error(chalk.red(`❌ Failed to get enhanced timeline: ${error.message}`));
    }
  }

  async validateJourneysCommand(args) {
    if (args.length === 0) {
      console.log(chalk.yellow('Usage: npm run supabase validate-journeys <pnr>'));
      return;
    }

    const pnr = args[0];
    console.log(chalk.blue(`🔍 Validating journeys for PNR: ${pnr}`));

    try {
      // Get ticket data first
      const tickets = await this.operations.searchTickets({ pnr });
      
      if (tickets.length === 0) {
        console.log(chalk.yellow('⚠️ No ticket found for this PNR'));
        return;
      }

      const ticket = tickets[0];
      
      // Validate journey sequence
      const validation = await this.operations.validateJourneySequence({
        pnr: ticket.pnr,
        journeys: ticket.journeys
      });

      console.log(chalk.cyan('\n🔍 Journey Validation Results:'));
      console.log(chalk.white(`Overall Validity: ${validation.isValid ? chalk.green('✅ Valid') : chalk.red('❌ Invalid')}`));

      if (validation.errors.length > 0) {
        console.log(chalk.red('\n❌ Errors:'));
        validation.errors.forEach(error => {
          console.log(chalk.red(`  • ${error}`));
        });
      }

      if (validation.warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️ Warnings:'));
        validation.warnings.forEach(warning => {
          console.log(chalk.yellow(`  • ${warning}`));
        });
      }

      if (validation.connectionAnalysis) {
        const analysis = validation.connectionAnalysis;
        console.log(chalk.blue('\n🔗 Connection Analysis:'));
        console.log(`  Total Journeys: ${analysis.totalJourneys}`);
        console.log(`  Has Connections: ${analysis.hasConnections ? 'Yes' : 'No'}`);
        console.log(`  Multi-segment Journey: ${analysis.isMultiSegmentJourney ? 'Yes' : 'No'}`);
        console.log(`  Number of Connections: ${analysis.connections?.length || 0}`);

        if (analysis.connections && analysis.connections.length > 0) {
          console.log(chalk.cyan('\n  Connection Details:'));
          analysis.connections.forEach((conn, index) => {
            const waitHours = Math.floor(conn.waitTime / 60);
            const waitMinutes = conn.waitTime % 60;
            console.log(`    ${index + 1}. ${conn.from.station} → ${conn.to.station} (${waitHours}h ${waitMinutes}m wait)`);
          });
        }
      }

      if (validation.isValid && validation.errors.length === 0 && validation.warnings.length === 0) {
        console.log(chalk.green('\n🎉 All journeys are properly sequenced and connected!'));
      }

    } catch (error) {
      console.error(chalk.red(`❌ Journey validation failed: ${error.message}`));
    }
  }

  async testConnectionCommand() {
    console.log(chalk.blue('🔄 Testing Supabase connection...'));
    
    try {
      await this.operations.ensureConnection();
      const stats = await this.operations.getDatabaseStats();
      
      console.log(chalk.green('✅ Supabase connection successful!'));
      console.log(chalk.gray(`   URL: ${stats.connection.url}`));
      console.log(chalk.gray(`   Client Status: ${stats.connection.hasClient ? 'Ready' : 'Not Ready'}`));
      console.log(chalk.gray(`   Data Available: ${stats.tickets.totalTickets} tickets`));
      
    } catch (error) {
      console.log(chalk.red('❌ Supabase connection failed!'));
      console.log(chalk.red(`   Error: ${error.message}`));
      
      if (error.message.includes('SUPABASE_URL') || error.message.includes('SUPABASE_ANON_KEY')) {
        console.log(chalk.yellow('\n💡 Setup Instructions:'));
        console.log(chalk.gray('   1. Create a Supabase project at https://supabase.com'));
        console.log(chalk.gray('   2. Copy .env.example to .env'));
        console.log(chalk.gray('   3. Add your Supabase URL and anon key to .env'));
        console.log(chalk.gray('   4. Run the SQL schema in your Supabase SQL Editor'));
        console.log(chalk.gray('   5. Make sure Row Level Security policies allow access'));
      }
    }
  }

  showHelp() {
    console.log(chalk.cyan('Supabase Cloud Import Utility'));
    console.log(chalk.cyan('='.repeat(35)));
    console.log('\nCommands:');
    console.log(chalk.white('  import [directory]     '), chalk.gray('- Import structured JSON files to Supabase'));
    console.log(chalk.white('  search <pnr> [name]    '), chalk.gray('- Search for tickets'));
    console.log(chalk.white('  timeline <pnr>         '), chalk.gray('- Get journey timeline'));
    console.log(chalk.white('  enhanced-timeline <pnr>'), chalk.gray('- Get enhanced journey timeline with connections'));
    console.log(chalk.white('  validate-journeys <pnr>'), chalk.gray('- Validate journey sequence and connections'));
    console.log(chalk.white('  stats                  '), chalk.gray('- Show database statistics'));
    console.log(chalk.white('  test                   '), chalk.gray('- Test Supabase connection'));
    
    console.log('\nExamples:');
    console.log(chalk.gray('  node src/supabase-import.js import'));
    console.log(chalk.gray('  node src/supabase-import.js search 2341068596'));
    console.log(chalk.gray('  node src/supabase-import.js search 2341068596 HITESH 43'));
    console.log(chalk.gray('  node src/supabase-import.js timeline 2341068596'));
    console.log(chalk.gray('  node src/supabase-import.js enhanced-timeline 2341068596'));
    console.log(chalk.gray('  node src/supabase-import.js validate-journeys 2341068596'));
    console.log(chalk.gray('  node src/supabase-import.js stats'));
    console.log(chalk.gray('  node src/supabase-import.js test'));
    
    console.log(chalk.yellow('\n⚠️  Make sure to:'));
    console.log(chalk.gray('   • Create your Supabase project at https://supabase.com'));
    console.log(chalk.gray('   • Configure .env with SUPABASE_URL and SUPABASE_ANON_KEY'));
    console.log(chalk.gray('   • Run the schema.sql in your Supabase SQL Editor'));
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const importer = new SupabaseImporter();
  importer.run();
}

export { SupabaseImporter };