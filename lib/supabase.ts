import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Enhanced fetch function that handles both certificate and CORS errors
const enhancedFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
  try {
    // First attempt with regular fetch
    return await fetch(url, init);
  } catch (error) {
    console.error('Supabase fetch error:', error);
    
    // Handle certificate errors
    if (error instanceof Error && error.message.includes('certificate')) {
      console.warn('Certificate validation error detected.');
      
      const enhancedError = new Error(
        'SSL Certificate validation failed. This could be due to:\n' +
        '1. Network connectivity issues\n' +
        '2. System time being out of sync\n' +
        '3. Firewall or proxy settings\n' +
        'Please check your internet connection and system time.'
      );
      
      enhancedError.cause = error;
      throw enhancedError;
    }
    
    // Handle CORS errors
    if (error instanceof Error && 
        (error.message.includes('CORS') || 
         error.message.includes('cross-origin') || 
         error.message.includes('Access-Control-Allow-Origin'))) {
      console.warn('CORS error detected.');
      
      const corsError = new Error(
        'CORS (Cross-Origin Resource Sharing) error detected. This could be due to:\n' +
        '1. Missing CORS headers on the Supabase API\n' +
        '2. Incorrect origin configuration in your Supabase project\n' +
        '3. Using localhost in development without proper CORS settings\n\n' +
        'Solutions:\n' +
        '1. Check your Supabase project settings and ensure your domain is in the allowed origins\n' +
        '2. For local development, add http://localhost:3000 to allowed origins in Supabase dashboard\n' +
        '3. Try using a CORS proxy for development purposes\n' +
        '4. If using custom domains, ensure they are properly configured in Supabase'
      );
      
      corsError.cause = error;
      throw corsError;
    }
    
    // For other errors, just rethrow
    throw error;
  }
};

// Create Supabase client with enhanced error handling
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: enhancedFetch,
    headers: {
      'X-Client-Info': 'kra-tools-app',
      // Add headers that might help with CORS
      'Origin': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    }
  },
  db: {
    schema: 'public',
  }
});

// Helper function to check if Supabase is accessible
export const checkSupabaseConnection = async () => {
  try {
    // Make a simple query to check connection
    const { data, error } = await supabase
      .from('payroll_cycles')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return {
        connected: false,
        error: error.message,
        details: error.details,
        hint: error.hint || 'Check your network connection and Supabase configuration.'
      };
    }
    
    return { connected: true };
  } catch (error) {
    console.error('Supabase connection check error:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error && error.cause ? String(error.cause) : undefined
    };
  }
};