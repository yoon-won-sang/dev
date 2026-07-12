import { onAuthStateChange, supabase } from "@/lib/supabase";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "child" | "parent";

export interface AuthUser {
  id: string;
  role: UserRole;
  email?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const {
      data: { subscription },
    } = onAuthStateChange(async (event, session) => {
      if (session?.user) {
        // Fetch user profile to get role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, display_name")
          .eq("id", session.user.id)
          .single();

        setUser({
          id: session.user.id,
          role: profile?.role || "child",
          email: session.user.email || undefined,
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        console.error("Login error:", error);
        return false;
      }

      // Fetch user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      setUser({
        id: data.user.id,
        role: profile?.role || "child",
        email: data.user.email || undefined,
      });

      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const signup = async (
    email: string,
    password: string,
    role: UserRole,
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            display_name: email.split("@")[0],
          },
        },
      });

      if (error || !data.user) {
        console.error("Signup error:", error);
        return false;
      }

      // Manually create profile (in case trigger doesn't fire)
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        role,
        display_name: email.split("@")[0],
      });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Continue anyway - trigger might have created it
      }

      return true;
    } catch (error) {
      console.error("Signup error:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin: user?.role === "parent",
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
