
import { createClient } from "@supabase/supabase-js";

const rawUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://okjrwmhkqzmucxmztjbm.supabase.co";
// Pastikan URL selalu mengarah ke base project URL tanpa akhiran /rest/v1/ atau slash ganda
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ranJ3bWhrcXptdWN4bXp0amJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxOTI4MTIsImV4cCI6MjEwOTc2ODgxMn0.6Pd5HNkviLmTsKCRh4vKUF3hbWhvsjXz8CGGw2jzumw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

