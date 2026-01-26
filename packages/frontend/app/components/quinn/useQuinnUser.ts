/**
 * useQuinnUser Hook
 * 
 * Provides user identification for Quinn chat sessions.
 * Uses Supabase auth when available, falls back to localStorage for anonymous users.
 */

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const ANON_USER_KEY = 'quinn_anon_user_id';

/**
 * Generate a unique anonymous user ID
 */
function generateAnonId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `anon_${timestamp}_${randomPart}`;
}

/**
 * Get or create anonymous user ID from localStorage
 */
function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') {
    return generateAnonId();
  }
  
  let anonId = localStorage.getItem(ANON_USER_KEY);
  if (!anonId) {
    anonId = generateAnonId();
    localStorage.setItem(ANON_USER_KEY, anonId);
  }
  return anonId;
}

interface QuinnUser {
  /** User ID - either Supabase user ID or anonymous ID */
  userId: string;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether we're still loading auth state */
  isLoading: boolean;
}

/**
 * Hook to get the current user ID for Quinn chat sessions.
 * 
 * - If user is logged in via Supabase: returns their user ID
 * - If user is anonymous: returns a persistent localStorage-based ID
 */
export function useQuinnUser(): QuinnUser {
  const [userId, setUserId] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Check current session
    async function checkUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          setUserId(user.id);
          setIsAuthenticated(true);
        } else {
          setUserId(getOrCreateAnonId());
          setIsAuthenticated(false);
        }
      } catch {
        // If auth check fails, fall back to anonymous
        setUserId(getOrCreateAnonId());
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUserId(session.user.id);
          setIsAuthenticated(true);
        } else {
          setUserId(getOrCreateAnonId());
          setIsAuthenticated(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { userId, isAuthenticated, isLoading };
}

/**
 * Generate a conversation ID for a new chat session
 */
export function generateConversationId(userId: string): string {
  const timestamp = Date.now();
  return `${userId}/chat_${timestamp}`;
}
