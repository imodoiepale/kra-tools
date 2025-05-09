const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Initialize Supabase client
const supabase = createClient(
  'https://zyszsqgdlrpnunkegipk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5c3pzcWdkbHJwbnVua2VnaXBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwODMyNzg5NCwiZXhwIjoyMDIzOTAzODk0fQ.7ICIGCpKqPMxaSLiSZ5MNMWRPqrTr5pHprM0lBaNing'
);

// Fetch all KRA PINs
const getAllKraPins = async () => {
  const pageSize = 1000;
  let page = 0;
  let allPins = [];

  while (true) {
    const { data, error } = await supabase
      .from('acc_portal_kra_suppliers')
      .select('pin_no')
      .not('pin_no', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`Error fetching page ${page + 1}:`, error);
      break;
    }

    if (!data || data.length === 0) break;

    allPins = [...allPins, ...data.map(row => row.pin_no)];
    if (data.length < pageSize) break;

    page++;
  }

  return allPins;
};

// Send all in parallel
const sendAllRequests = async () => {
  const kra_pins = await getAllKraPins();
  const type = "suppliers";

  const requests = kra_pins.map(kra_pin => {
    const url = `https://primary-production-079f.up.railway.app/webhook-test/manufucturerDetails?kra_pin=${encodeURIComponent(kra_pin)}&type=${encodeURIComponent(type)}`;
    return fetch(url)
      .then(res => res.json())
      .then(data => ({ kra_pin, success: true, data }))
      .catch(error => ({ kra_pin, success: false, error: error.message }));
  });

  const results = await Promise.allSettled(requests);
  console.log("✅ All requests sent. Results:");
  console.log(results);
};

// Start
sendAllRequests();
