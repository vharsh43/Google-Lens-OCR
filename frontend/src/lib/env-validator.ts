// Environment variable validator for Next.js frontend
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class FrontendEnvironmentValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  validateEnvironment(): ValidationResult {
    console.log('🔍 Validating frontend environment...');
    
    // Check required Supabase variables
    this.validateSupabaseUrl();
    this.validateSupabaseAnonKey();
    
    // Display results
    this.displayResults();
    
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  private validateSupabaseUrl(): void {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!url) {
      this.errors.push(
        'NEXT_PUBLIC_SUPABASE_URL is missing. Add it to your .env.local file.'
      );
      return;
    }
    
    // Skip validation for example/placeholder URLs
    if (url.includes('your-project') || url.includes('example')) {
      this.errors.push(
        'NEXT_PUBLIC_SUPABASE_URL is still using placeholder value. Replace with your actual Supabase URL.'
      );
      return;
    }
    
    if (!url.startsWith('https://')) {
      this.errors.push(
        'NEXT_PUBLIC_SUPABASE_URL must start with https://'
      );
    }
    
    if (!url.includes('.supabase.co')) {
      this.errors.push(
        'NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase URL (contains .supabase.co)'
      );
    }
  }

  private validateSupabaseAnonKey(): void {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!key) {
      this.errors.push(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Add it to your .env.local file.'
      );
      return;
    }
    
    if (key.length < 100) {
      this.errors.push(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be invalid (too short)'
      );
    }
    
    if (!key.startsWith('eyJ')) {
      this.errors.push(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be invalid (should start with eyJ)'
      );
    }
  }

  private displayResults(): void {
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ Frontend environment validation passed!');
      return;
    }
    
    if (this.errors.length > 0) {
      console.error('❌ Environment configuration errors:');
      this.errors.forEach((error, index) => {
        console.error(`${index + 1}. ${error}`);
      });
      
      console.log('\n📋 Quick Fix:');
      console.log('1. Create frontend/.env.local file');
      console.log('2. Add your Supabase credentials:');
      console.log('   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
      console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
      console.log('3. Get credentials from: Supabase Dashboard → Settings → API');
    }
    
    if (this.warnings.length > 0) {
      console.warn('⚠️ Environment warnings:');
      this.warnings.forEach((warning, index) => {
        console.warn(`${index + 1}. ${warning}`);
      });
    }
  }
}

// Error data for React component
export interface EnvironmentErrorProps {
  errors: string[];
}

// Hook for validating environment in components
export function useEnvironmentValidation() {
  const validator = new FrontendEnvironmentValidator();
  return validator.validateEnvironment();
}