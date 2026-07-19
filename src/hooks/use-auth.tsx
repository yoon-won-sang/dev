import { onAuthStateChange, supabase } from "@/lib/supabase";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "child" | "parent";

export interface AuthUser {
  id: string;
  role: UserRole;
  email?: string;
  displayName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  isPasswordRecovery: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (
    email: string,
    password: string,
    role: UserRole,
    displayName?: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Listen for auth state changes
    const {
      data: { subscription },
    } = onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        setIsLoading(false);
        return;
      }

      if (session?.user) {
        // Fetch user profile to get role and display name
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, display_name")
          .eq("id", session.user.id)
          .single();

        setUser({
          id: session.user.id,
          role: profile?.role || "child",
          email: session.user.email || undefined,
          displayName: profile?.display_name || undefined,
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

  const resetPassword = async (email: string): Promise<boolean> => {
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : "dev://reset-password";
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error("Reset password error:", error);
        alert("비밀번호 재설정 이메일 전송 중 오류가 발생했습니다.");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Reset password error:", error);
      alert("비밀번호 재설정 중 오류가 발생했습니다.");
      return false;
    }
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("Update password error:", error);
        alert("비밀번호 변경 중 오류가 발생했습니다.");
        return false;
      }

      setIsPasswordRecovery(false);
      alert(
        "비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.",
      );
      await supabase.auth.signOut();
      return true;
    } catch (error) {
      console.error("Update password error:", error);
      alert("비밀번호 변경 중 오류가 발생했습니다.");
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);
        if (error.message.includes("Invalid login credentials")) {
          alert("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else if (error.message.includes("Email not confirmed")) {
          alert(
            "이메일 확인이 필요합니다. Supabase 대시보드에서 'Confirm email'를 비활성화하세요.",
          );
        }
        return false;
      }

      if (!data.user) {
        return false;
      }

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, display_name")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
      }

      // Profile should be created by the database trigger
      // If it doesn't exist, the trigger may not have fired yet
      // We'll use default values and the profile will be loaded on next login
      setUser({
        id: data.user.id,
        role: profile?.role || "child",
        email: data.user.email || undefined,
        displayName:
          profile?.display_name || data.user.email?.split("@")[0] || undefined,
      });

      return true;
    } catch (error) {
      console.error("Login error:", error);
      alert("로그인 중 오류가 발생했습니다.");
      return false;
    }
  };

  const signup = async (
    email: string,
    password: string,
    role: UserRole,
    displayName?: string,
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            display_name: displayName || email.split("@")[0],
          },
        },
      });

      if (error || !data.user) {
        console.error("Signup error:", error);
        return false;
      }

      // Profile is automatically created by the database trigger (handle_new_user)
      // The trigger reads role and display_name from raw_user_meta_data
      console.log("Signup successful, profile will be created by trigger");
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
        isPasswordRecovery,
        login,
        signup,
        logout,
        resetPassword,
        updatePassword,
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
