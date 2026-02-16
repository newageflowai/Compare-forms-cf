import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = { user_id: string; role: "admin" | "user"; org_id: string | null; full_name: string | null };
type AuthCtx = { loading: boolean; user: any; profile: Profile | null; signOut: () => Promise<void> };

const Ctx = createContext<AuthCtx>({ loading: true, user: null, profile: null, signOut: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function loadProfile(uid: string) {
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", uid).single();
    if (!error) setProfile(data as any);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) await loadProfile(u.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setProfile(null);
      if (u) await loadProfile(u.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        loading,
        user,
        profile,
        signOut: async () => {
          await supabase.auth.signOut();
        }
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
