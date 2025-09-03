import supabaseClient from './client.js';
import { Utils } from '../utils.js';
import fs from 'fs-extra';
import path from 'path';

export class SupabaseTicketOperations {
  constructor() {
    this.client = null;
    this.stats = {
      imported: 0,
      updated: 0,
      failed: 0,
      duplicates: 0
    };
  }

  // Convert DD-MM-YYYY HH:MM:SS to PostgreSQL compatible format
  convertDateFormat(dateString) {
    if (!dateString) return null;
    
    try {
      // Handle DD-MM-YYYY HH:MM:SS format
      const parts = dateString.split(' ');
      if (parts.length === 2) {
        const [datePart, timePart] = parts;
        const [day, month, year] = datePart.split('-');
        
        if (day && month && year && timePart) {
          // Convert to YYYY-MM-DD HH:MM:SS format
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${timePart}`;
        }
      }
      
      // If already in correct format or other format, return as is
      return dateString;
    } catch (error) {
      Utils.log(`⚠ Date conversion failed for: ${dateString}`, 'warn');
      return dateString;
    }
  }

  async ensureConnection() {
    if (!this.client) {
      this.client = await supabaseClient.initialize();
    }
    return this.client;
  }

  async importTicketData(ticketData, sourceFile = null) {
    try {
      await this.ensureConnection();

      // Validate the data structure
      if (!this.validateTicketData(ticketData)) {
        throw new Error('Invalid ticket data structure');
      }

      // Enhanced journey validation
      const journeyValidation = await this.validateJourneySequence(ticketData);
      if (!journeyValidation.isValid) {
        Utils.log(`⚠️ Journey validation errors for PNR ${ticketData.pnr}:`, 'warning');
        journeyValidation.errors.forEach(error => {
          Utils.log(`  • ${error}`, 'warning');
        });
      }

      if (journeyValidation.warnings.length > 0) {
        Utils.log(`ℹ️ Journey validation warnings for PNR ${ticketData.pnr}:`, 'info');
        journeyValidation.warnings.forEach(warning => {
          Utils.log(`  • ${warning}`, 'info');
        });
      }

      // Add connection analysis to processing info
      if (!ticketData.processing_info) {
        ticketData.processing_info = {};
      }
      
      ticketData.processing_info.journey_validation = journeyValidation;
      ticketData.processing_info.connection_analysis = journeyValidation.connectionAnalysis;

      Utils.log(`🔄 Importing ticket: PNR ${ticketData.pnr}`, 'info');

      // Check if ticket already exists
      const { data: existingTicket, error: checkError } = await this.client
        .from('tickets')
        .select('id, pnr')
        .eq('pnr', ticketData.pnr)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw checkError;
      }

      let ticketId;

      if (existingTicket) {
        // Update existing ticket
        const { data: updatedTicket, error: updateError } = await this.client
          .from('tickets')
          .update({
            transaction_id: ticketData.transaction_id,
            ticket_print_time: this.convertDateFormat(ticketData.ticket_print_time),
            payment: ticketData.payment,
            processing_info: ticketData.processing_info || {},
            source_file: sourceFile ? path.basename(sourceFile) : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingTicket.id)
          .select('id')
          .single();

        if (updateError) throw updateError;

        ticketId = updatedTicket.id;
        this.stats.updated++;

        // Check if ticket already has the same data to avoid duplicates
        const [existingPassengers, existingJourneys] = await Promise.all([
          this.client.from('passengers').select('name, age, gender').eq('ticket_id', ticketId),
          this.client.from('journeys').select('train_number, sequence').eq('ticket_id', ticketId)
        ]);

        if (existingPassengers.error) throw existingPassengers.error;
        if (existingJourneys.error) throw existingJourneys.error;

        // Compare existing data with new data to detect if re-import is needed
        const existingPassengerData = existingPassengers.data.map(p => `${p.name}_${p.age}_${p.gender}`).sort();
        const newPassengerData = ticketData.passengers.map(p => `${p.name}_${p.age}_${p.gender}`).sort();
        
        const existingJourneyData = existingJourneys.data.map(j => `${j.train_number}_${j.sequence || 1}`).sort();
        const newJourneyData = ticketData.journeys.map((j, idx) => `${j.train_number}_${idx + 1}`).sort();

        const dataUnchanged = JSON.stringify(existingPassengerData) === JSON.stringify(newPassengerData) &&
                             JSON.stringify(existingJourneyData) === JSON.stringify(newJourneyData);

        // Check if data is unchanged AND we have the correct count (no previous duplicates)
        const expectedPassengerCount = ticketData.passengers.length;
        const expectedJourneyCount = ticketData.journeys.length;
        
        if (dataUnchanged && 
            existingPassengers.data.length === expectedPassengerCount &&
            existingJourneys.data.length === expectedJourneyCount) {
          Utils.log(`✅ Ticket data unchanged, skipping duplicate import: PNR ${ticketData.pnr}`, 'info');
          this.stats.skipped = (this.stats.skipped || 0) + 1;
          return { success: true, skipped: true, pnr: ticketData.pnr };
        }
        
        // If counts don't match, we have duplicates from previous imports - need to clean up
        if (existingPassengers.data.length !== expectedPassengerCount || 
            existingJourneys.data.length !== expectedJourneyCount) {
          Utils.log(`🧹 Detected existing duplicates. Expected: ${expectedPassengerCount} passengers, ${expectedJourneyCount} journeys. Found: ${existingPassengers.data.length} passengers, ${existingJourneys.data.length} journeys. Cleaning up...`, 'warning');
        }

        // Skip passenger/journey insertion to avoid duplicates until RLS policies allow proper cleanup
        Utils.log(`⚠️ Skipping passenger/journey insertion due to existing duplicates. Manual cleanup required.`, 'warning');
        Utils.log(`📝 Updated existing ticket: PNR ${ticketData.pnr}`, 'info');
        this.stats.skipped = (this.stats.skipped || 0) + 1;
        return { success: true, skipped: true, pnr: ticketData.pnr, reason: 'duplicate_data_cleanup_required' };

      } else {
        // Create new ticket
        const { data: newTicket, error: insertError } = await this.client
          .from('tickets')
          .insert({
            pnr: ticketData.pnr,
            transaction_id: ticketData.transaction_id,
            ticket_print_time: this.convertDateFormat(ticketData.ticket_print_time),
            payment: ticketData.payment,
            processing_info: ticketData.processing_info || {},
            // source_file: sourceFile ? path.basename(sourceFile) : null // Column may not exist yet
          })
          .select('id')
          .single();

        if (insertError) {
          if (insertError.code === '23505') { // Unique constraint violation
            this.stats.duplicates++;
            Utils.log(`⚠️ Duplicate PNR detected: ${ticketData.pnr}`, 'warning');
            return { success: false, error: 'Duplicate PNR', pnr: ticketData.pnr };
          }
          throw insertError;
        }

        ticketId = newTicket.id;
        this.stats.imported++;
        Utils.log(`✅ Created new ticket: PNR ${ticketData.pnr}`, 'success');
      }

      // Note: For new tickets, passengers and journeys are empty, so no need to delete
      // For existing tickets, we already deleted above during update

      // Insert passengers with profile deduplication
      if (ticketData.passengers && ticketData.passengers.length > 0) {
        const passengersToInsert = [];
        
        for (const passenger of ticketData.passengers) {
          // Create or find passenger profile
          const passengerProfile = await this.getOrCreatePassengerProfile({
            name: passenger.name?.toUpperCase(),
            age: passenger.age,
            gender: passenger.gender
          });

          // Create passenger record linked to profile
          const passengerRecord = {
            ticket_id: ticketId,
            passenger_profile_id: passengerProfile.id,
            name: passenger.name?.toUpperCase(),
            age: passenger.age,
            gender: passenger.gender,
            booking_status: passenger.booking_status,
            current_status: passenger.current_status,
            allocated_cost: passenger.allocated_cost || null
          };

          passengersToInsert.push(passengerRecord);
        }

        const { error: passengersError } = await this.client
          .from('passengers')
          .insert(passengersToInsert);

        if (passengersError) throw passengersError;
      }

      // Insert journeys
      if (ticketData.journeys && ticketData.journeys.length > 0) {
        const journeysToInsert = ticketData.journeys.map((journey, index) => ({
          ticket_id: ticketId,
          train_number: journey.train_number,
          train_name: journey.train_name?.toUpperCase(),
          class: journey.class?.toUpperCase(),
          quota: journey.quota?.toUpperCase(),
          distance_km: journey.distance_km,
          boarding_station: journey.boarding?.station?.toUpperCase(),
          boarding_datetime: this.convertDateFormat(journey.boarding?.datetime),
          destination_station: journey.destination?.station?.toUpperCase(),
          destination_datetime: this.convertDateFormat(journey.destination?.datetime),
          sequence: index + 1
        }));

        const { error: journeysError } = await this.client
          .from('journeys')
          .insert(journeysToInsert);

        if (journeysError) throw journeysError;
      }

      Utils.log(`✅ Successfully imported ticket: PNR ${ticketData.pnr}`, 'success');
      return { 
        success: true, 
        action: existingTicket ? 'updated' : 'created', 
        ticketId,
        pnr: ticketData.pnr
      };

    } catch (error) {
      this.stats.failed++;
      Utils.log(`❌ Failed to import ticket: ${error.message}`, 'error');
      return { success: false, error: error.message, data: ticketData };
    }
  }

  async getOrCreatePassengerProfile(passengerData) {
    try {
      const { name, age, gender } = passengerData;
      
      if (!name || age === undefined || age === null) {
        throw new Error('Name and age are required for passenger profile');
      }

      // Create unique key for passenger (name + age combination)
      const passengerKey = `${name.toUpperCase()}_${age}`;

      // First, try to find existing profile
      const { data: existingProfile, error: searchError } = await this.client
        .from('passenger_profiles')
        .select('*')
        .eq('passenger_key', passengerKey)
        .single();

      if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw searchError;
      }

      if (existingProfile) {
        // Update travel count and last seen
        const { data: updatedProfile, error: updateError } = await this.client
          .from('passenger_profiles')
          .update({
            travel_count: existingProfile.travel_count + 1,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id)
          .select('*')
          .single();

        if (updateError) throw updateError;
        
        Utils.log(`🔄 Updated passenger profile: ${name} (${age}) - Travel count: ${updatedProfile.travel_count}`, 'info');
        return updatedProfile;
      } else {
        // Create new passenger profile
        const newProfile = {
          passenger_key: passengerKey,
          name: name.toUpperCase(),
          age: age,
          gender: gender,
          travel_count: 1,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: createdProfile, error: createError } = await this.client
          .from('passenger_profiles')
          .insert(newProfile)
          .select('*')
          .single();

        if (createError) {
          // Handle race condition - if profile was created by another process
          if (createError.code === '23505') { // Unique constraint violation
            // Retry finding the profile
            const { data: retryProfile, error: retryError } = await this.client
              .from('passenger_profiles')
              .select('*')
              .eq('passenger_key', passengerKey)
              .single();

            if (retryError) throw retryError;
            return retryProfile;
          }
          throw createError;
        }

        Utils.log(`✨ Created new passenger profile: ${name} (${age})`, 'success');
        return createdProfile;
      }

    } catch (error) {
      Utils.log(`❌ Failed to get/create passenger profile: ${error.message}`, 'error');
      throw error;
    }
  }

  async getPassengerTravelHistory(passengerKey) {
    try {
      await this.ensureConnection();

      const { data, error } = await this.client
        .from('passengers')
        .select(`
          *,
          ticket:tickets!inner(*),
          passenger_profile:passenger_profiles!inner(*)
        `)
        .eq('passenger_profile.passenger_key', passengerKey)
        .order('ticket.ticket_print_time', { ascending: false });

      if (error) throw error;

      return data || [];

    } catch (error) {
      Utils.log(`❌ Failed to get travel history: ${error.message}`, 'error');
      throw error;
    }
  }

  async getFrequentTravelers(limit = 10) {
    try {
      await this.ensureConnection();

      const { data, error } = await this.client
        .from('passenger_profiles')
        .select('*')
        .gte('travel_count', 2)
        .order('travel_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      Utils.log(`❌ Failed to get frequent travelers: ${error.message}`, 'error');
      throw error;
    }
  }

  async mergeDuplicatePassengerProfiles(primaryProfileId, duplicateProfileIds) {
    try {
      await this.ensureConnection();

      // Start transaction-like operation
      const updates = [];

      // Update all passenger records to point to primary profile
      for (const duplicateId of duplicateProfileIds) {
        const updatePromise = this.client
          .from('passengers')
          .update({ passenger_profile_id: primaryProfileId })
          .eq('passenger_profile_id', duplicateId);
        
        updates.push(updatePromise);
      }

      // Execute all updates
      await Promise.all(updates);

      // Get travel count from primary profile
      const { data: primaryProfile, error: primaryError } = await this.client
        .from('passenger_profiles')
        .select('travel_count')
        .eq('id', primaryProfileId)
        .single();

      if (primaryError) throw primaryError;

      // Get travel counts from duplicate profiles
      const { data: duplicateProfiles, error: duplicateError } = await this.client
        .from('passenger_profiles')
        .select('travel_count')
        .in('id', duplicateProfileIds);

      if (duplicateError) throw duplicateError;

      // Calculate total travel count
      const totalTravelCount = primaryProfile.travel_count + 
        duplicateProfiles.reduce((sum, profile) => sum + profile.travel_count, 0);

      // Update primary profile with combined travel count
      await this.client
        .from('passenger_profiles')
        .update({ 
          travel_count: totalTravelCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', primaryProfileId);

      // Delete duplicate profiles
      await this.client
        .from('passenger_profiles')
        .delete()
        .in('id', duplicateProfileIds);

      Utils.log(`✅ Merged ${duplicateProfileIds.length} duplicate profiles into primary profile ${primaryProfileId}`, 'success');

      return {
        success: true,
        primaryProfileId,
        mergedProfiles: duplicateProfileIds.length,
        totalTravelCount
      };

    } catch (error) {
      Utils.log(`❌ Failed to merge duplicate profiles: ${error.message}`, 'error');
      throw error;
    }
  }

  async analyzeJourneyConnections(ticketData) {
    try {
      if (!ticketData.journeys || ticketData.journeys.length <= 1) {
        return {
          hasConnections: false,
          connections: [],
          totalJourneys: ticketData.journeys?.length || 0
        };
      }

      const connections = [];
      const journeys = ticketData.journeys.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

      for (let i = 0; i < journeys.length - 1; i++) {
        const currentJourney = journeys[i];
        const nextJourney = journeys[i + 1];

        // Check if destination of current journey connects to boarding of next
        const isConnected = this.detectJourneyConnection(currentJourney, nextJourney);
        
        if (isConnected) {
          connections.push({
            from: {
              journeyIndex: i,
              station: currentJourney.destination?.station,
              datetime: currentJourney.destination?.datetime,
              trainNumber: currentJourney.train_number
            },
            to: {
              journeyIndex: i + 1,
              station: nextJourney.boarding?.station,
              datetime: nextJourney.boarding?.datetime,
              trainNumber: nextJourney.train_number
            },
            connectionType: isConnected.type,
            waitTime: isConnected.waitTime
          });
        }
      }

      return {
        hasConnections: connections.length > 0,
        connections,
        totalJourneys: journeys.length,
        isMultiSegmentJourney: connections.length > 0
      };

    } catch (error) {
      Utils.log(`❌ Failed to analyze journey connections: ${error.message}`, 'error');
      return {
        hasConnections: false,
        connections: [],
        totalJourneys: ticketData.journeys?.length || 0,
        error: error.message
      };
    }
  }

  detectJourneyConnection(currentJourney, nextJourney) {
    try {
      const currentDest = currentJourney.destination?.station?.toUpperCase();
      const nextBoard = nextJourney.boarding?.station?.toUpperCase();

      // Direct connection - same station
      if (currentDest === nextBoard) {
        const waitTime = this.calculateWaitTime(
          currentJourney.destination?.datetime,
          nextJourney.boarding?.datetime
        );

        return {
          type: 'direct',
          waitTime,
          isValid: waitTime > 0 && waitTime < 24 * 60 // Less than 24 hours
        };
      }

      // Check for nearby stations or alternate names
      const isNearbyConnection = this.checkNearbyStations(currentDest, nextBoard);
      if (isNearbyConnection) {
        const waitTime = this.calculateWaitTime(
          currentJourney.destination?.datetime,
          nextJourney.boarding?.datetime
        );

        return {
          type: 'nearby',
          waitTime,
          isValid: waitTime > 0 && waitTime < 24 * 60
        };
      }

      return false;

    } catch (error) {
      Utils.log(`❌ Error detecting journey connection: ${error.message}`, 'error');
      return false;
    }
  }

  calculateWaitTime(arrivalDateTime, departureDateTime) {
    try {
      if (!arrivalDateTime || !departureDateTime) return 0;

      const arrival = new Date(arrivalDateTime);
      const departure = new Date(departureDateTime);

      if (isNaN(arrival.getTime()) || isNaN(departure.getTime())) return 0;

      // Return wait time in minutes
      return Math.round((departure.getTime() - arrival.getTime()) / (1000 * 60));

    } catch (error) {
      return 0;
    }
  }

  checkNearbyStations(station1, station2) {
    if (!station1 || !station2) return false;

    // Common station name variations and nearby stations
    const stationMappings = {
      'NDLS': ['NEW DELHI', 'DELHI', 'DLI'],
      'BCT': ['MUMBAI CENTRAL', 'MUMBAI', 'MMCT'],
      'CSMT': ['MUMBAI CST', 'MUMBAI VT', 'VT'],
      'HWH': ['HOWRAH', 'HOWRAH JN'],
      'MAS': ['CHENNAI CENTRAL', 'CHENNAI'],
      'SBC': ['BANGALORE', 'BENGALURU'],
      'PUNE': ['PUNE JN'],
      'RTM': ['RATLAM', 'RATLAM JN']
    };

    // Check if stations are the same after mapping
    for (const [key, variations] of Object.entries(stationMappings)) {
      const hasStation1 = variations.includes(station1) || station1.includes(key);
      const hasStation2 = variations.includes(station2) || station2.includes(key);
      
      if (hasStation1 && hasStation2) {
        return true;
      }
    }

    // Check for partial matches (same city, different terminals)
    const commonWords = ['JN', 'JUNCTION', 'CENTRAL', 'TERMINUS'];
    const cleanStation1 = this.cleanStationName(station1, commonWords);
    const cleanStation2 = this.cleanStationName(station2, commonWords);

    return cleanStation1 === cleanStation2;
  }

  cleanStationName(stationName, wordsToRemove) {
    if (!stationName) return '';
    
    let cleaned = stationName.toUpperCase();
    wordsToRemove.forEach(word => {
      cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'g'), '').trim();
    });
    
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  async getEnhancedJourneyTimeline(pnr) {
    try {
      await this.ensureConnection();
      
      // Get basic timeline
      const basicTimeline = await this.getJourneyTimeline(pnr);
      
      if (!basicTimeline) return null;

      // Enhance with connection analysis
      const connectionAnalysis = await this.analyzeJourneyConnections({
        journeys: basicTimeline.timeline || []
      });

      return {
        ...basicTimeline,
        connectionAnalysis,
        totalDistance: this.calculateTotalDistance(basicTimeline.timeline),
        totalTravelTime: this.calculateTotalTravelTime(basicTimeline.timeline),
        journeyType: connectionAnalysis.hasConnections ? 'multi-segment' : 'direct',
        connections: connectionAnalysis.connections
      };

    } catch (error) {
      Utils.log(`❌ Failed to get enhanced journey timeline: ${error.message}`, 'error');
      throw error;
    }
  }

  calculateTotalDistance(journeys) {
    if (!journeys || !Array.isArray(journeys)) return 0;
    
    return journeys.reduce((total, journey) => {
      return total + (journey.distance_km || 0);
    }, 0);
  }

  calculateTotalTravelTime(journeys) {
    if (!journeys || !Array.isArray(journeys) || journeys.length === 0) return 0;

    try {
      const sortedJourneys = journeys.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
      const firstJourney = sortedJourneys[0];
      const lastJourney = sortedJourneys[sortedJourneys.length - 1];

      const startTime = new Date(firstJourney.boarding_datetime);
      const endTime = new Date(lastJourney.destination_datetime);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return 0;

      // Return travel time in minutes
      return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    } catch (error) {
      return 0;
    }
  }

  async validateJourneySequence(ticketData) {
    try {
      if (!ticketData.journeys || ticketData.journeys.length <= 1) {
        return { isValid: true, warnings: [], errors: [] };
      }

      const warnings = [];
      const errors = [];
      const journeys = ticketData.journeys.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

      // Check for sequence gaps
      for (let i = 0; i < journeys.length - 1; i++) {
        const currentSequence = journeys[i].sequence || (i + 1);
        const nextSequence = journeys[i + 1].sequence || (i + 2);
        
        if (nextSequence - currentSequence > 1) {
          warnings.push(`Gap in journey sequence: ${currentSequence} to ${nextSequence}`);
        }
      }

      // Check for chronological order
      for (let i = 0; i < journeys.length - 1; i++) {
        const currentEnd = new Date(journeys[i].destination?.datetime);
        const nextStart = new Date(journeys[i + 1].boarding?.datetime);

        if (!isNaN(currentEnd.getTime()) && !isNaN(nextStart.getTime())) {
          if (currentEnd >= nextStart) {
            errors.push(`Journey ${i + 1} ends after journey ${i + 2} starts`);
          }
        }
      }

      // Check for reasonable connection times
      const connectionAnalysis = await this.analyzeJourneyConnections(ticketData);
      
      connectionAnalysis.connections.forEach((connection, index) => {
        if (connection.waitTime < 30) { // Less than 30 minutes
          warnings.push(`Very short connection time (${connection.waitTime} min) between journeys ${connection.from.journeyIndex + 1} and ${connection.to.journeyIndex + 1}`);
        } else if (connection.waitTime > 12 * 60) { // More than 12 hours
          warnings.push(`Very long connection time (${Math.round(connection.waitTime / 60)} hours) between journeys ${connection.from.journeyIndex + 1} and ${connection.to.journeyIndex + 1}`);
        }
      });

      return {
        isValid: errors.length === 0,
        warnings,
        errors,
        connectionAnalysis
      };

    } catch (error) {
      return {
        isValid: false,
        warnings: [],
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }

  async bulkImportFromDirectory(directoryPath) {
    try {
      await this.ensureConnection();
      
      Utils.log(`🔄 Starting Supabase bulk import from: ${directoryPath}`, 'info');
      
      // Find all structured JSON files
      const jsonFiles = await this.findStructuredJsonFiles(directoryPath);
      
      if (jsonFiles.length === 0) {
        Utils.log('⚠️ No structured JSON files found for import', 'warning');
        return this.getImportStats();
      }

      Utils.log(`📊 Found ${jsonFiles.length} JSON files to import to Supabase`, 'info');

      // Reset stats
      this.stats = { imported: 0, updated: 0, failed: 0, duplicates: 0 };

      // Process files in smaller batches for Supabase
      const batchSize = 5; // Smaller batches for better error handling
      for (let i = 0; i < jsonFiles.length; i += batchSize) {
        const batch = jsonFiles.slice(i, i + batchSize);
        
        Utils.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(jsonFiles.length/batchSize)} (${batch.length} files)`, 'info');
        
        await this.processBatch(batch);
        
        // Small delay between batches to avoid overwhelming Supabase
        if (i + batchSize < jsonFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const stats = this.getImportStats();
      Utils.log(`✅ Supabase bulk import completed: ${stats.imported} imported, ${stats.updated} updated, ${stats.failed} failed`, 'success');
      
      return stats;

    } catch (error) {
      Utils.log(`❌ Supabase bulk import failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async processBatch(jsonFiles) {
    const promises = jsonFiles.map(async (filePath) => {
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const ticketData = JSON.parse(fileContent);
        
        return await this.importTicketData(ticketData, filePath);
      } catch (error) {
        this.stats.failed++;
        Utils.log(`❌ Failed to process file ${path.basename(filePath)}: ${error.message}`, 'error');
        return { success: false, file: filePath, error: error.message };
      }
    });

    return await Promise.all(promises);
  }

  async findStructuredJsonFiles(directoryPath) {
    const jsonFiles = [];
    
    const scanDirectory = async (dir) => {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (item.name.endsWith('_structured.json')) {
          jsonFiles.push(fullPath);
        }
      }
    };

    await scanDirectory(directoryPath);
    return jsonFiles;
  }

  validateTicketData(data) {
    // Basic validation of required fields
    const requiredFields = ['pnr', 'journeys', 'passengers'];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        Utils.log(`❌ Missing required field: ${field}`, 'error');
        return false;
      }
    }

    // Validate PNR format
    if (!/^[A-Z0-9]{10}$/.test(data.pnr)) {
      Utils.log(`❌ Invalid PNR format: ${data.pnr}`, 'error');
      return false;
    }

    // Validate arrays are not empty
    if (!Array.isArray(data.journeys) || data.journeys.length === 0) {
      Utils.log('❌ Journeys array is empty or invalid', 'error');
      return false;
    }

    if (!Array.isArray(data.passengers) || data.passengers.length === 0) {
      Utils.log('❌ Passengers array is empty or invalid', 'error');
      return false;
    }

    return true;
  }

  // Search and query methods using Supabase
  async searchTickets(query) {
    try {
      await this.ensureConnection();

      const { pnr, passengerName, passengerAge, trainNumber, limit = 50 } = query;
      
      // Use Supabase RPC function for complex search
      const { data, error } = await this.client
        .rpc('search_tickets', {
          search_pnr: pnr?.toUpperCase(),
          search_passenger_name: passengerName?.toUpperCase(),
          search_passenger_age: passengerAge ? parseInt(passengerAge) : null,
          age_tolerance: 2
        });

      if (error) throw error;

      // Filter by train number if provided (client-side filtering for now)
      let results = data || [];
      if (trainNumber) {
        results = results.filter(ticket => 
          ticket.journeys.some(journey => 
            journey.train_number === trainNumber
          )
        );
      }

      return results.slice(0, limit);

    } catch (error) {
      Utils.log(`❌ Search failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async getTicketByPNRAndPassenger(pnr, passengerName, passengerAge = null) {
    try {
      await this.ensureConnection();
      
      const searchResults = await this.searchTickets({
        pnr,
        passengerName,
        passengerAge,
        limit: 1
      });

      if (searchResults.length > 0) {
        const ticket = searchResults[0];
        return {
          ticket,
          passenger: ticket.matched_passenger,
          matchedPassenger: ticket.matched_passenger
        };
      }
      
      return null;

    } catch (error) {
      Utils.log(`❌ Failed to get ticket: ${error.message}`, 'error');
      throw error;
    }
  }

  async getJourneyTimeline(pnr) {
    try {
      await this.ensureConnection();
      
      const { data, error } = await this.client
        .rpc('get_journey_timeline', { search_pnr: pnr.toUpperCase() });

      if (error) throw error;

      return data && data.length > 0 ? data[0] : null;

    } catch (error) {
      Utils.log(`❌ Failed to get journey timeline: ${error.message}`, 'error');
      throw error;
    }
  }

  async getDatabaseStats() {
    try {
      await this.ensureConnection();
      
      const { data, error } = await this.client
        .rpc('get_database_stats');

      if (error) throw error;

      const stats = data && data.length > 0 ? data[0] : {
        total_tickets: 0,
        total_passengers: 0,
        total_journeys: 0,
        average_passengers_per_ticket: 0,
        total_revenue: 0
      };

      return {
        tickets: {
          totalTickets: parseInt(stats.total_tickets),
          totalPassengers: parseInt(stats.total_passengers),
          totalJourneys: parseInt(stats.total_journeys),
          averagePassengers: parseFloat(stats.average_passengers_per_ticket) || 0,
          totalRevenue: parseFloat(stats.total_revenue) || 0
        },
        connection: supabaseClient.getConnectionStatus()
      };

    } catch (error) {
      Utils.log(`❌ Failed to get database stats: ${error.message}`, 'error');
      throw error;
    }
  }

  getImportStats() {
    return {
      ...this.stats,
      total: this.stats.imported + this.stats.updated + this.stats.failed,
      successRate: this.stats.imported + this.stats.updated > 0 ? 
        Math.round(((this.stats.imported + this.stats.updated) / 
        (this.stats.imported + this.stats.updated + this.stats.failed)) * 100) : 0
    };
  }

  async generateImportReport(outputPath) {
    const stats = this.getImportStats();
    const dbStats = await this.getDatabaseStats();
    
    const report = [
      'SUPABASE IMPORT REPORT',
      '='.repeat(40),
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'IMPORT STATISTICS:',
      `-Total processed: ${stats.total}`,
      `-Successfully imported: ${stats.imported}`,
      `-Updated existing: ${stats.updated}`,
      `-Failed imports: ${stats.failed}`,
      `-Duplicate PNRs: ${stats.duplicates}`,
      `-Success rate: ${stats.successRate}%`,
      '',
      'DATABASE STATISTICS:',
      `-Total tickets: ${dbStats.tickets.totalTickets}`,
      `-Total passengers: ${dbStats.tickets.totalPassengers}`,
      `-Total journeys: ${dbStats.tickets.totalJourneys}`,
      `-Average passengers per ticket: ${Math.round(dbStats.tickets.averagePassengers * 10) / 10}`,
      `-Total revenue: ₹${Math.round(dbStats.tickets.totalRevenue)}`,
      '',
      'CONNECTION STATUS:',
      `-Status: ${dbStats.connection.isConnected ? 'Connected' : 'Disconnected'}`,
      `-URL: ${dbStats.connection.url}`,
      `-Has Client: ${dbStats.connection.hasClient}`,
      '',
      'SUPABASE FEATURES USED:',
      `-PostgreSQL database with JSONB support`,
      `-Row Level Security (RLS) enabled`,
      `-Custom SQL functions for complex queries`,
      `-Auto-generated REST API endpoints`,
      `-Real-time subscriptions available`
    ].join('\n');

    await fs.writeFile(outputPath, report, 'utf8');
    Utils.log(`📄 Supabase import report saved: ${outputPath}`, 'info');
    
    return outputPath;
  }
}