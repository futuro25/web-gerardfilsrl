const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://woviowmbddnedkkustkx.supabase.co";

// service role secret key
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvdmlvd21iZGRuZWRra3VzdGt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTI1Mjc0NCwiZXhwIjoyMDYwODI4NzQ0fQ.8OR_s0R_Ciq4FL0IRmX27vdd_UaiM3cOsZvVe9tNCjE";

// anon public key
// const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvdmlvd21iZGRuZWRra3VzdGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNTI3NDQsImV4cCI6MjA2MDgyODc0NH0.5H_HIhq1qYjniBZEHAQliU-WLUmcEdUPDUcGSNWuFYs";

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
