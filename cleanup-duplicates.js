#!/usr/bin/env node

import supabaseClient from './src/supabase/client.js';
import { Utils } from './src/utils.js';

async function cleanupDuplicates() {
  try {
    await supabaseClient.initialize();
    const client = supabaseClient.getClient();

    console.log('🧹 Starting duplicate cleanup process...\n');

    // Get all tickets with their passenger and journey counts
    const { data: tickets, error } = await client
      .from('tickets')
      .select(`
        id, pnr,
        passengers(id, name, age, gender),
        journeys(id, train_number, sequence)
      `);

    if (error) throw error;

    let totalCleaned = 0;

    for (const ticket of tickets) {
      const passengers = ticket.passengers || [];
      const journeys = ticket.journeys || [];
      
      // Create deduplicated passenger list
      const seenPassengers = new Set();
      const uniquePassengers = [];
      const duplicatePassengerIds = [];
      
      for (const passenger of passengers) {
        const key = `${passenger.name}_${passenger.age}_${passenger.gender}`;
        if (seenPassengers.has(key)) {
          duplicatePassengerIds.push(passenger.id);
        } else {
          seenPassengers.add(key);
          uniquePassengers.push(passenger);
        }
      }
      
      // Create deduplicated journey list  
      const seenJourneys = new Set();
      const uniqueJourneys = [];
      const duplicateJourneyIds = [];
      
      for (const journey of journeys) {
        const key = `${journey.train_number}_${journey.sequence || 1}`;
        if (seenJourneys.has(key)) {
          duplicateJourneyIds.push(journey.id);
        } else {
          seenJourneys.add(key);
          uniqueJourneys.push(journey);
        }
      }
      
      // Report duplicates found
      if (duplicatePassengerIds.length > 0 || duplicateJourneyIds.length > 0) {
        console.log(`PNR ${ticket.pnr}:`);
        console.log(`  Passengers: ${passengers.length} → ${uniquePassengers.length} (removing ${duplicatePassengerIds.length})`);
        console.log(`  Journeys: ${journeys.length} → ${uniqueJourneys.length} (removing ${duplicateJourneyIds.length})`);
        
        // Try to delete duplicates one by one
        for (const id of duplicatePassengerIds) {
          try {
            const { error: delError } = await client
              .from('passengers')
              .delete()
              .eq('id', id);
            if (!delError) {
              totalCleaned++;
            } else {
              console.log(`    ⚠️  Could not delete passenger ${id}: ${delError.message}`);
            }
          } catch (e) {
            console.log(`    ⚠️  Could not delete passenger ${id}: ${e.message}`);
          }
        }
        
        for (const id of duplicateJourneyIds) {
          try {
            const { error: delError } = await client
              .from('journeys')  
              .delete()
              .eq('id', id);
            if (!delError) {
              totalCleaned++;
            } else {
              console.log(`    ⚠️  Could not delete journey ${id}: ${delError.message}`);
            }
          } catch (e) {
            console.log(`    ⚠️  Could not delete journey ${id}: ${e.message}`);
          }
        }
        
        console.log('');
      }
    }

    if (totalCleaned > 0) {
      console.log(`✅ Cleanup completed! Removed ${totalCleaned} duplicate records.`);
    } else {
      console.log('✅ No duplicates found or cleanup was blocked by RLS policies.');
      console.log('💡 You may need to run the cleanup SQL manually in Supabase SQL Editor:');
      console.log('');
      console.log('-- Add missing RLS policies for DELETE operations');
      console.log(`CREATE POLICY "Allow public delete on passengers" ON passengers FOR DELETE USING (true);`);
      console.log(`CREATE POLICY "Allow public delete on journeys" ON journeys FOR DELETE USING (true);`);
      console.log(`CREATE POLICY "Allow public delete on tickets" ON tickets FOR DELETE USING (true);`);
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run cleanup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDuplicates();
}

export { cleanupDuplicates };