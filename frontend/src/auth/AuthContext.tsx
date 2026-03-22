import React, { createContext, useContext, useState, useCallback } from 'react'

interface AuthState {
  token: string | null
  tenantId: string | null
  plan: string
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (token: string, tenantId: string, plan: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem('mb_token')
    const tenantId = localStorage.getItem('mb_tenant_id')
    const plan = localStorage.getItem('mb_plan') ?? 'community'
    return { token, tenantId, plan, isAuthenticated: !!token }
  })

  const login = useCallback((token: string, tenantId: string, plan: string) => {
    localStorage.setItem('mb_token', token)
    localStorage.setItem('mb_tenant_id', tenantId)
    localStorage.setItem('mb_plan', plan)
    setState({ token, tenantId, plan, isAuthenticated: true })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('mb_token')
    localStorage.removeItem('mb_tenant_id')
    localStorage.removeItem('mb_plan')
    setState({ token: null, tenantId: null, plan: 'community', isAuthenticated: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
