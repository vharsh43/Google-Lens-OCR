import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Payment interface
export interface PaymentData {
  total?: number;
  ticket_fare?: number;
  reservation_fee?: number;
  irctc_fee?: number;
  insurance?: number;
  agent_fee?: number;
  pg_charges?: number;
  [key: string]: unknown;
}

// Types for our database tables
export interface Ticket {
  id: string;
  pnr: string;
  transaction_id?: string;
  ticket_print_time?: string;
  class?: string;
  payment?: PaymentData;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Passenger {
  id: string;
  ticket_id: string;
  name: string;
  age?: number;
  gender?: string;
  current_status?: string;
  booking_status?: string;
  created_at: string;
}

export interface Journey {
  id: string;
  ticket_id: string;
  train_number?: string;
  train_name?: string;
  boarding_station?: string;
  boarding_datetime?: string;
  destination_station?: string;
  destination_datetime?: string;
  distance?: number;
  duration_minutes?: number;
  created_at: string;
}

// Combined ticket data with passengers and journeys
export interface FullTicket extends Ticket {
  passengers: Passenger[];
  journeys: Journey[];
}