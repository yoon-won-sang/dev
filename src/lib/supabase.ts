import { createClient, Session, User } from "@supabase/supabase-js";
import Constants from "expo-constants";

// Get config from app.json extra (works with Expo)
const getSupabaseConfig = () => {
  // Try expo-constants first (from app.json extra)
  if (Constants.expoConfig?.extra) {
    return {
      url: Constants.expoConfig.extra.supabaseUrl || "",
      key: Constants.expoConfig.extra.supabaseAnonKey || "",
    };
  }

  // Fallback to environment variables
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  };
};

const config = getSupabaseConfig();

export const supabase = createClient(config.url, config.key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type { Session, User };

export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback);
}
