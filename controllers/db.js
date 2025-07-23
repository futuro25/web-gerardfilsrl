const { createClient } = require("@supabase/supabase-js");

let supabaseUrl = "";
let supabaseKey = "";

// si estoy en localhost, uso la url y key de mi proyecto de supabase
if (process.env.APP_ENV === "production") {
  console.log("Using production Supabase URL and Key");
  supabaseUrl = "https://woviowmbddnedkkustkx.supabase.co";
  supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvdmlvd21iZGRuZWRra3VzdGt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTI1Mjc0NCwiZXhwIjoyMDYwODI4NzQ0fQ.8OR_s0R_Ciq4FL0IRmX27vdd_UaiM3cOsZvVe9tNCjE";
} else {
  console.log("Using test Supabase URL and Key");
  supabaseUrl = "https://cgovbdbjajveieeawdnr.supabase.co";
  supabaseKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnb3ZiZGJqYWp2ZWllZWF3ZG5yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjMzNjQ2OSwiZXhwIjoyMDY3OTEyNDY5fQ.TZwjQKjN9Wn6ifWW6eug6enRSNi9UGv5mkEDTk_O4Y8";
}

supabaseUrl = "https://woviowmbddnedkkustkx.supabase.co";
supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvdmlvd21iZGRuZWRra3VzdGt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTI1Mjc0NCwiZXhwIjoyMDYwODI4NzQ0fQ.8OR_s0R_Ciq4FL0IRmX27vdd_UaiM3cOsZvVe9tNCjE";

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
