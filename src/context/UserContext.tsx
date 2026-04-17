"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/src/utils/supabase/client";

export type UserRole = "admin" | "manager" | "partner" | "mechanic";

export interface Profile {
  id: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  // Add any additional columns from `public.profiles` that you want to expose globally.
  [key: string]: unknown;
}

interface UserContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Used to ignore stale fetches when auth state changes rapidly.
  const fetchIdRef = useRef(0);

  const fetchProfile = useCallback(
    async (currentUser: User | null) => {
      const fetchId = ++fetchIdRef.current;

      if (!currentUser) {
        if (fetchId === fetchIdRef.current) {
          setProfile(null);
          setError(null);
        }
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (fetchId !== fetchIdRef.current) return;

      if (profileError) {
        console.error("Failed to load profile:", profileError);
        setProfile(null);
        setError(profileError.message);
        return;
      }

      setProfile(data as Profile);
      setError(null);
    },
    [supabase]
  );

  const loadInitial = useCallback(async () => {
    setIsLoading(true);

    const {
      data: { session: initialSession },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Failed to load session:", sessionError);
      setError(sessionError.message);
    }

    setSession(initialSession);
    setUser(initialSession?.user ?? null);
    await fetchProfile(initialSession?.user ?? null);
    setIsLoading(false);
  }, [supabase, fetchProfile]);

  useEffect(() => {
    loadInitial();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser(nextUser);
      // Fire-and-forget; fetchProfile guards against stale results.
      fetchProfile(nextUser);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadInitial, fetchProfile]);

  const refresh = useCallback(async () => {
    await fetchProfile(user);
  }, [fetchProfile, user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<UserContextValue>(
    () => ({ user, session, profile, isLoading, error, refresh, signOut }),
    [user, session, profile, isLoading, error, refresh, signOut]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a <UserProvider>");
  }
  return ctx;
}

export function useHasRole(...roles: UserRole[]): boolean {
  const { profile } = useUser();
  return !!profile && roles.includes(profile.role);
}
