"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";

export function useAuth() {
  const [session, setSession] = useState<any>(null);
  const [userId, setUserId] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Auth Modal form states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkAdminStatus = useCallback(async (token?: string) => {
    if (!token) {
      setIsAdmin(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/check", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setIsAdmin(!!data.isAdmin);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    let savedUserId = localStorage.getItem("mangify-user-id");
    if (!savedUserId) {
      const randomPart =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      savedUserId = `anon-${randomPart}`;
      localStorage.setItem("mangify-user-id", savedUserId);
    }
    setUserId(savedUserId);

    // Get current session on mount
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        setSession(currentSession);
        if (currentSession) {
          setUserId(currentSession.user.id);
          checkAdminStatus(currentSession.access_token);
        }
      });

    // Listen to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        setUserId(currentSession.user.id);
        checkAdminStatus(currentSession.access_token);
      } else {
        const localUid =
          localStorage.getItem("mangify-user-id") || savedUserId!;
        setUserId(localUid);
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [checkAdminStatus]);

  /**
   * Returns the resulting session on success (for bookmark sync), or null on failure.
   */
  const handleAuth = async (
    e: React.FormEvent,
    birthYear?: number
  ): Promise<any | null> => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      let resultSession: any = null;

      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        resultSession = data.session;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              birth_year: birthYear
            }
          }
        });
        if (error) throw error;
        resultSession = data.session;
        if (!resultSession) {
          alert(
            "สมัครสมาชิกสำเร็จ! โปรดตรวจสอบอีเมลของคุณเพื่อยืนยันบัญชี"
          );
        }
      }

      setIsAuthModalOpen(false);
      setAuthPassword("");
      return resultSession;
    } catch (err: any) {
      setAuthError(
        err.message || "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์"
      );
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      const savedUserId = localStorage.getItem("mangify-user-id");
      if (savedUserId) setUserId(savedUserId);
      setSession(null);
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  const openAuthModal = (mode: "login" | "signup" = "login") => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
    setAuthError(null);
  };

  return {
    session,
    userId,
    isAdmin,
    isAuthModalOpen,
    setIsAuthModalOpen,
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authLoading,
    authError,
    setAuthError,
    handleAuth,
    handleLogout,
    openAuthModal,
  };
}
