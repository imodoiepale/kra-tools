// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Fetch companies with their service categories
      const { data: companies, error } = await supabase
        .from('companies')
        .select(`
          id,
          company_name,
          kra_pin,
          service_categories,
          status
        `);

      if (error) {
        throw error;
      }

      // Transform data if needed
      const formattedCompanies = companies.map(company => ({
        id: company.id,
        company_name: company.company_name || 'Unknown',
        kra_pin: company.kra_pin || 'N/A',
        service_categories: company.service_categories || [],
        status: company.status || { is_active: true }
      }));

      return res.status(200).json(formattedCompanies);
    } catch (error) {
      console.error('Error fetching companies:', error);
      return res.status(500).json({ error: 'Failed to fetch companies' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
