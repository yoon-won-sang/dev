import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "child" | "parent";

export interface AuthUser {
  id: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (id: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "@habit_tracker_auth_user";

// jiwoo -> 아이(child) 계정, admin -> 부모/관리자(parent) 계정
const USER_ROLES: Record<string, UserRole> = {
  jiwoo7942: "child",
  admin7942: "parent",
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Failed to load auth state:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = (rawId: string): boolean => {
    const id = rawId.trim().toLowerCase();
    const role = USER_ROLES[id];
    if (!role) return false;

    const nextUser: AuthUser = { id, role };
    setUser(nextUser);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser)).catch((error) =>
      console.error("Failed to persist auth state:", error),
    );
    return true;
  };

  const logout = () => {
    setUser(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch((error) =>
      console.error("Failed to clear auth state:", error),
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin: user?.role === "parent",
        login,
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
