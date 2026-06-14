import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key";

// Standard Supabase client (Client-side and public Server-side use)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin Supabase client (Server-side only, bypasses RLS for anonymous writes and syncs)
// WARNING: Never import or use this client on the client-side!
export const supabaseAdmin = typeof window === "undefined"
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : supabase;
