import { createClient, Session, User } from "@supabase/supabase-js";

// Get config from app.json extra (works with Expo)
const getSupabaseConfig = () => {
  try {
    // @ts-ignore - expo-constants provides this
    const { expoConfig } = require("expo-config");
    if (expoConfig?.extra) {
      return {
        url: expoConfig.extra.supabaseUrl || "",
        key: expoConfig.extra.supabaseAnonKey || "",
      };
    }
  } catch (e) {
    console.log("expo-config not available, using env vars");
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
