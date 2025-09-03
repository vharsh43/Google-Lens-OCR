import { supabase, type FullTicket, type Ticket, type Passenger, type Journey } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface UploadJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  fileName: string;
  progress: number;
  result?: { data?: { pnr?: string; validationScore?: number } };
  error?: string;
  uploadedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export class TicketAPI {
  // Search tickets by PNR
  static async searchByPNR(pnr: string): Promise<FullTicket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        passengers(*),
        journeys(*)
      `)
      .eq('pnr', pnr.toUpperCase());

    if (error) {
      console.error('Error searching by PNR:', error);
      throw error;
    }

    return data || [];
  }

  // Search tickets by passenger name
  static async searchByPassengerName(name: string): Promise<FullTicket[]> {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        passengers!inner(*),
        journeys(*)
      `)
      .ilike('passengers.name', `%${name}%`);

    if (error) {
      console.error('Error searching by passenger name:', error);
      throw error;
    }

    return data || [];
  }

  // Search with multiple criteria
  static async searchTickets(params: {
    pnr?: string;
    passengerName?: string;
    trainNumber?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<FullTicket[]> {
    let query = supabase
      .from('tickets')
      .select(`
        *,
        passengers(*),
        journeys(*)
      `);

    // Apply filters
    if (params.pnr) {
      query = query.eq('pnr', params.pnr.toUpperCase());
    }

    if (params.passengerName) {
      query = query.filter('passengers.name', 'ilike', `%${params.passengerName}%`);
    }

    if (params.trainNumber) {
      query = query.filter('journeys.train_number', 'eq', params.trainNumber);
    }

    if (params.fromDate) {
      query = query.gte('ticket_print_time', params.fromDate);
    }

    if (params.toDate) {
      query = query.lte('ticket_print_time', params.toDate);
    }

    const { data, error } = await query.order('ticket_print_time', { ascending: false });

    if (error) {
      console.error('Error searching tickets:', error);
      throw error;
    }

    return data || [];
  }

  // Get ticket statistics
  static async getStatistics() {
    const { data, error } = await supabase.rpc('get_ticket_statistics');

    if (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }

    return data;
  }

  // Get journey timeline for a specific PNR
  static async getJourneyTimeline(pnr: string) {
    const { data, error } = await supabase
      .from('journeys')
      .select(`
        *,
        ticket:tickets!inner(pnr, ticket_print_time)
      `)
      .eq('ticket.pnr', pnr.toUpperCase())
      .order('boarding_datetime');

    if (error) {
      console.error('Error getting journey timeline:', error);
      throw error;
    }

    return data || [];
  }

  // Search suggestions for autocomplete
  static async getSearchSuggestions(query: string, type: 'pnr' | 'passenger' | 'train') {
    let supabaseQuery;

    switch (type) {
      case 'pnr':
        supabaseQuery = supabase
          .from('tickets')
          .select('pnr')
          .ilike('pnr', `%${query.toUpperCase()}%`)
          .limit(10);
        break;

      case 'passenger':
        supabaseQuery = supabase
          .from('passengers')
          .select('name')
          .ilike('name', `%${query}%`)
          .limit(10);
        break;

      case 'train':
        supabaseQuery = supabase
          .from('journeys')
          .select('train_number, train_name')
          .or(`train_number.ilike.%${query}%,train_name.ilike.%${query}%`)
          .limit(10);
        break;

      default:
        return [];
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error('Error getting suggestions:', error);
      return [];
    }

    return data || [];
  }

  // File upload functionality
  static async uploadPDF(file: File): Promise<{ jobId: string; fileName: string; message: string }> {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }

  // Check processing status
  static async getJobStatus(jobId: string): Promise<UploadJob> {
    const response = await fetch(`${API_BASE_URL}/api/status/${jobId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get job status');
    }

    return response.json();
  }

  // Get all processing jobs
  static async getAllJobs(): Promise<UploadJob[]> {
    const response = await fetch(`${API_BASE_URL}/api/jobs`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get jobs');
    }

    return response.json();
  }

  // Get API server statistics
  static async getAPIStatistics() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats`);
      
      if (!response.ok) {
        // Fallback to direct Supabase if API server is not available
        return this.getStatistics();
      }

      return response.json();
    } catch (error) {
      // Fallback to direct Supabase
      return this.getStatistics();
    }
  }

  // Check environment status
  static async getEnvironmentStatus() {
    const response = await fetch(`${API_BASE_URL}/api/env-status`);
    
    if (!response.ok) {
      return { valid: false, errors: ['API server not available'] };
    }

    return response.json();
  }

  // Enhanced search using API server (with fallback to direct Supabase)
  static async searchTicketsAPI(params: {
    pnr?: string;
    passengerName?: string;
    trainNumber?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<FullTicket[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tickets/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        // Fallback to direct Supabase
        return this.searchTickets(params);
      }

      return response.json();
    } catch (error) {
      // Fallback to direct Supabase
      return this.searchTickets(params);
    }
  }

  // Check API server health
  static async checkAPIHealth(): Promise<{ status: string; timestamp: string; uptime: number }> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      
      if (!response.ok) {
        throw new Error('API server unhealthy');
      }

      return response.json();
    } catch (error) {
      throw new Error(`API server unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}