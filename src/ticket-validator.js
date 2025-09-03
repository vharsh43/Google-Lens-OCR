import { Utils } from './utils.js';

export class TicketValidator {
  constructor() {
    this.schemas = {
      pnr: {
        pattern: /^[A-Z0-9]{10}$/,
        required: true,
        description: "10-character alphanumeric PNR"
      },
      transactionId: {
        pattern: /^\d{12,15}$/,
        required: true,
        description: "12-15 digit transaction ID"
      },
      trainNumber: {
        pattern: /^\d{5}$/,
        required: true,
        description: "5-digit train number"
      },
      trainName: {
        minLength: 3,
        maxLength: 50,
        pattern: /^[A-Z0-9\s\-]+$/,
        required: true,
        description: "Train name with uppercase letters, numbers, spaces, hyphens"
      },
      class: {
        enum: ['SL', '3A', '2A', '1A', 'CC', 'EC', 'GN', 'AC'],
        required: true,
        description: "Valid train class"
      },
      quota: {
        pattern: /^[A-Z]{2}$/,
        required: true,
        description: "2-letter quota code"
      },
      passengerName: {
        pattern: /^[A-Z\s]{2,30}$/,
        required: true,
        description: "Passenger name with uppercase letters and spaces"
      },
      age: {
        min: 0,
        max: 120,
        type: 'integer',
        required: true,
        description: "Valid age between 0-120"
      },
      gender: {
        enum: ['Male', 'Female', 'Unknown'],
        required: true,
        description: "Valid gender values"
      },
      stationCode: {
        pattern: /^[A-Z]{2,5}$/,
        required: true,
        description: "Station code with 2-5 uppercase letters"
      },
      datetime: {
        pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
        required: true,
        description: "ISO 8601 datetime format"
      },
      fare: {
        min: 0,
        max: 50000,
        type: 'number',
        required: true,
        description: "Valid fare amount"
      }
    };

    this.businessRules = {
      // Arrival must be after departure
      journeyTiming: (journey) => {
        if (!journey.boarding?.datetime || !journey.destination?.datetime) return true;
        const departure = new Date(journey.boarding.datetime);
        const arrival = new Date(journey.destination.datetime);
        return arrival > departure;
      },
      
      // Total fare should equal sum of components
      fareConsistency: (payment) => {
        const calculated = (payment.ticket_fare || 0) + 
                          (payment.irctc_fee || 0) + 
                          (payment.insurance || 0) + 
                          (payment.agent_fee || 0) + 
                          (payment.pg_charges || 0);
        const tolerance = 0.1; // Allow small rounding differences
        return Math.abs(calculated - (payment.total || 0)) <= tolerance;
      },

      // PNR should be unique per ticket
      pnrUniqueness: (ticketData) => {
        return ticketData.pnr && ticketData.pnr.length === 10;
      },

      // Passenger count consistency
      passengerCount: (ticketData) => {
        return ticketData.passengers && ticketData.passengers.length > 0 && ticketData.passengers.length <= 10;
      }
    };

    this.commonErrors = {
      // Common OCR character confusions
      characterFixes: {
        '0': ['O', 'o', 'D'],
        '1': ['I', 'l', '|'],
        '2': ['Z'],
        '5': ['S'],
        '8': ['B'],
        'O': ['0'],
        'I': ['1', 'l'],
        'S': ['5'],
        'B': ['8']
      },
      
      // Common word corrections
      stationCorrections: {
        'NEW DELEHI': 'NEW DELHI',
        'MUMABI': 'MUMBAI',
        'BANGLORE': 'BANGALORE',
        'HYDER ABAD': 'HYDERABAD'
      }
    };
  }

  validateField(fieldName, value, schema = null) {
    if (!schema) {
      schema = this.schemas[fieldName];
    }
    
    if (!schema) {
      return { isValid: true, confidence: 0.5, errors: [`No schema found for ${fieldName}`] };
    }

    const errors = [];
    let confidence = 1.0;

    // Check if required field is missing
    if (schema.required && (value === null || value === undefined || value === '')) {
      return { isValid: false, confidence: 0, errors: [`${fieldName} is required but missing`] };
    }

    // Skip validation if value is not provided and not required
    if (!schema.required && (value === null || value === undefined || value === '')) {
      return { isValid: true, confidence: 0.8, errors: [] };
    }

    // Type validation
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      errors.push(`${fieldName} must be an integer`);
      confidence -= 0.3;
    }

    if (schema.type === 'number' && isNaN(value)) {
      errors.push(`${fieldName} must be a number`);
      confidence -= 0.3;
    }

    // Pattern validation
    if (schema.pattern && !schema.pattern.test(String(value))) {
      errors.push(`${fieldName} doesn't match expected pattern: ${schema.description}`);
      confidence -= 0.4;
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${fieldName} must be one of: ${schema.enum.join(', ')}`);
      confidence -= 0.5;
    }

    // Range validation
    if (schema.min !== undefined && value < schema.min) {
      errors.push(`${fieldName} must be at least ${schema.min}`);
      confidence -= 0.3;
    }

    if (schema.max !== undefined && value > schema.max) {
      errors.push(`${fieldName} must be at most ${schema.max}`);
      confidence -= 0.3;
    }

    // Length validation
    if (schema.minLength !== undefined && String(value).length < schema.minLength) {
      errors.push(`${fieldName} must be at least ${schema.minLength} characters`);
      confidence -= 0.3;
    }

    if (schema.maxLength !== undefined && String(value).length > schema.maxLength) {
      errors.push(`${fieldName} must be at most ${schema.maxLength} characters`);
      confidence -= 0.3;
    }

    const isValid = errors.length === 0;
    return { isValid, confidence: Math.max(0, confidence), errors };
  }

  validateTicket(ticketData) {
    const results = {
      isValid: true,
      overallConfidence: 0,
      fieldValidations: {},
      businessRuleResults: {},
      errors: [],
      warnings: [],
      suggestions: []
    };

    let totalConfidence = 0;
    let fieldCount = 0;

    // Validate core fields
    const coreFields = ['pnr', 'transactionId'];
    for (const field of coreFields) {
      const validation = this.validateField(field, ticketData[field]);
      results.fieldValidations[field] = validation;
      
      if (!validation.isValid) {
        results.isValid = false;
        results.errors.push(...validation.errors);
      }
      
      totalConfidence += validation.confidence;
      fieldCount++;
    }

    // Validate journey information
    if (ticketData.journeys && ticketData.journeys.length > 0) {
      for (let i = 0; i < ticketData.journeys.length; i++) {
        const journey = ticketData.journeys[i];
        
        const journeyFields = {
          trainNumber: journey.train_number,
          trainName: journey.train_name,
          class: journey.class,
          quota: journey.quota
        };

        for (const [field, value] of Object.entries(journeyFields)) {
          const validation = this.validateField(field, value);
          results.fieldValidations[`journey_${i}_${field}`] = validation;
          
          if (!validation.isValid) {
            results.errors.push(...validation.errors);
          }
          
          totalConfidence += validation.confidence;
          fieldCount++;
        }

        // Validate timing
        const timingResult = this.businessRules.journeyTiming(journey);
        results.businessRuleResults[`journey_${i}_timing`] = {
          isValid: timingResult,
          message: timingResult ? 'Journey timing is logical' : 'Arrival time should be after departure time'
        };
        
        if (!timingResult) {
          results.warnings.push(`Journey ${i + 1}: Arrival time appears to be before departure time`);
        }
      }
    }

    // Validate passengers
    if (ticketData.passengers && ticketData.passengers.length > 0) {
      for (let i = 0; i < ticketData.passengers.length; i++) {
        const passenger = ticketData.passengers[i];
        
        const passengerFields = {
          passengerName: passenger.name,
          age: passenger.age,
          gender: passenger.gender
        };

        for (const [field, value] of Object.entries(passengerFields)) {
          const validation = this.validateField(field, value);
          results.fieldValidations[`passenger_${i}_${field}`] = validation;
          
          if (!validation.isValid) {
            results.errors.push(...validation.errors);
          }
          
          totalConfidence += validation.confidence;
          fieldCount++;
        }
      }

      // Validate passenger count
      const countResult = this.businessRules.passengerCount(ticketData);
      results.businessRuleResults.passengerCount = {
        isValid: countResult,
        message: countResult ? 'Passenger count is reasonable' : 'Passenger count seems unusual'
      };
    }

    // Validate payment information
    if (ticketData.payment) {
      const payment = ticketData.payment;
      const fareFields = ['ticket_fare', 'total'];
      
      for (const field of fareFields) {
        const validation = this.validateField('fare', payment[field]);
        results.fieldValidations[`payment_${field}`] = validation;
        
        if (!validation.isValid) {
          results.errors.push(...validation.errors);
        }
        
        totalConfidence += validation.confidence;
        fieldCount++;
      }

      // Validate fare consistency
      const fareConsistency = this.businessRules.fareConsistency(payment);
      results.businessRuleResults.fareConsistency = {
        isValid: fareConsistency,
        message: fareConsistency ? 'Payment calculation appears correct' : 'Total fare doesn\'t match sum of components'
      };
      
      if (!fareConsistency) {
        const calculated = (payment.ticket_fare || 0) + (payment.irctc_fee || 0) + 
                          (payment.insurance || 0) + (payment.agent_fee || 0) + (payment.pg_charges || 0);
        results.suggestions.push(`Calculated total: ₹${calculated.toFixed(2)}, Declared total: ₹${payment.total || 0}`);
      }
    }

    // Calculate overall confidence
    results.overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;

    // Set overall validity based on critical errors
    const criticalErrors = results.errors.filter(error => 
      error.includes('pnr') || error.includes('transactionId') || error.includes('passengerName')
    );
    
    if (criticalErrors.length > 0) {
      results.isValid = false;
    }

    return results;
  }

  suggestCorrections(ticketData, ocrText) {
    const suggestions = [];

    // Check for common OCR errors in PNR
    if (ticketData.pnr && ticketData.pnr.length === 10) {
      let correctedPnr = ticketData.pnr;
      let changed = false;
      
      for (const [correct, confusions] of Object.entries(this.commonErrors.characterFixes)) {
        for (const confused of confusions) {
          if (correctedPnr.includes(confused)) {
            correctedPnr = correctedPnr.replace(new RegExp(confused, 'g'), correct);
            changed = true;
          }
        }
      }
      
      if (changed) {
        suggestions.push({
          field: 'pnr',
          original: ticketData.pnr,
          suggested: correctedPnr,
          reason: 'OCR character confusion correction'
        });
      }
    }

    // Check station name corrections
    if (ticketData.journeys) {
      for (let i = 0; i < ticketData.journeys.length; i++) {
        const journey = ticketData.journeys[i];
        
        for (const [field, stationName] of [
          ['boarding_station_name', journey.boarding?.station_name],
          ['destination_station_name', journey.destination?.station_name]
        ]) {
          if (stationName && this.commonErrors.stationCorrections[stationName]) {
            suggestions.push({
              field: `journey_${i}_${field}`,
              original: stationName,
              suggested: this.commonErrors.stationCorrections[stationName],
              reason: 'Common station name correction'
            });
          }
        }
      }
    }

    return suggestions;
  }

  generateReport(ticketData, ocrText) {
    const validation = this.validateTicket(ticketData);
    const suggestions = this.suggestCorrections(ticketData, ocrText);
    
    return {
      timestamp: new Date().toISOString(),
      validation,
      suggestions,
      summary: {
        overallConfidence: validation.overallConfidence,
        criticalErrors: validation.errors.filter(e => e.includes('required')).length,
        warnings: validation.warnings.length,
        fieldsPassed: Object.values(validation.fieldValidations).filter(v => v.isValid).length,
        totalFields: Object.keys(validation.fieldValidations).length
      }
    };
  }
}