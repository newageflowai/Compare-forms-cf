import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://bcfpyvfpnfohnjwyuexe.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZnB5dmZwbmZvaG5qd3l1ZXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzQ2MDEsImV4cCI6MjA4NzcxMDYwMX0.zSR_t2zB-19pjLynbrqtEk0S6i9SA7zucl3A5qVIlyM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
