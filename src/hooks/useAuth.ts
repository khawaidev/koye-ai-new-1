import { useEffect, useState } from "react"
import { getCurrentUser, getSession, supabase } from "../services/supabase"
import type { User } from "@supabase/supabase-js"

/**
 * React hook for authentication state
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setSession(session)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkUser = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
    } catch (error) {
      console.error("Error checking user:", error)
      setUser(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    refresh: checkUser,
  }
}

