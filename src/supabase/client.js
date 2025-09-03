import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Utils } from '../utils.js';

// Load environment variables
dotenv.config();

class SupabaseClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempted = false;
  }

  async initialize() {
    if (this.connectionAttempted) {
      return this.client;
    }

    this.connectionAttempted = true;

    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
      }

      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      });

      // Test connection
      await this.testConnection();
      this.isConnected = true;

      Utils.log('✅ Supabase client initialized successfully', 'success');
      return this.client;

    } catch (error) {
      this.isConnected = false;
      Utils.log(`❌ Failed to initialize Supabase client: ${error.message}`, 'error');
      throw error;
    }
  }

  async testConnection() {
    try {
      // Test with a simple query to verify connection
      const { data, error, count } = await this.client
        .from('tickets')
        .select('*', { count: 'exact', head: true });

      if (error) {
        Utils.log(`❌ Supabase connection test failed: ${error.message}`, 'error');
        throw error;
      }

      Utils.log('📊 Supabase connection test successful', 'success');
      return true;

    } catch (error) {
      Utils.log(`❌ Supabase connection test failed: ${error.message}`, 'error');
      throw error;
    }
  }

  getClient() {
    if (!this.client) {
      throw new Error('Supabase client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  isHealthy() {
    return this.isConnected && this.client !== null;
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      hasClient: this.client !== null,
      url: process.env.SUPABASE_URL || 'Not configured',
      connectionAttempted: this.connectionAttempted
    };
  }

  // Helper method for environment loading
  static loadEnvironment() {
    // Try to load environment variables
    try {
      // Check if we're in a Node.js environment with access to fs
      if (typeof window === 'undefined') {
        // We're in Node.js - try to load .env file if it exists
        const fs = require('fs');
        const path = require('path');
        const envPath = path.join(process.cwd(), '.env');
        
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value && !process.env[key]) {
              process.env[key] = value.trim();
            }
          });
        }
      }
    } catch (error) {
      // Ignore errors - environment might be set through other means
    }
  }
}

// Load environment on import
SupabaseClient.loadEnvironment();

// Singleton instance
const supabaseClient = new SupabaseClient();

export default supabaseClient;
export { SupabaseClient };