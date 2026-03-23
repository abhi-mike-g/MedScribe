import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export type UserRole = 'doctor' | 'patient' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  patient_id?: string;
  specialty?: string;
  license_number?: string;
  age?: number;
  gender?: string;
  phone?: string;
  blood_group?: string;
  department?: string;
  hospital?: string;
  bio?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  registerDoctor: (data: { name: string; email: string; password: string; specialty: string; license_number: string }) => Promise<void>;
  registerPatient: (data: { name: string; email: string; password: string; age: number; gender: string; phone: string; blood_group: string }) => Promise<void>;
  registerAdmin: (data: { name: string; email: string; password: string; department: string }) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => { loadStoredAuth(); }, []);

  const loadStoredAuth = async () => {
    try {
      const t = await AsyncStorage.getItem('medscribe_token');
      const u = await AsyncStorage.getItem('medscribe_user');
      if (t && u) {
        tokenRef.current = t;
        setToken(t);
        setUser(JSON.parse(u));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const saveAuth = async (t: string, u: User) => {
    await AsyncStorage.setItem('medscribe_token', t);
    await AsyncStorage.setItem('medscribe_user', JSON.stringify(u));
    tokenRef.current = t;
    setToken(t); setUser(u);
  };

  const login = async (email: string, password: string, role: UserRole) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Login failed'); }
    const data = await res.json();
    await saveAuth(data.token, data.user);
  };

  const registerDoctor = async (d: { name: string; email: string; password: string; specialty: string; license_number: string }) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/register/doctor`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Registration failed'); }
    const data = await res.json();
    await saveAuth(data.token, data.user);
  };

  const registerPatient = async (d: { name: string; email: string; password: string; age: number; gender: string; phone: string; blood_group: string }) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/register/patient`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Registration failed'); }
    const data = await res.json();
    await saveAuth(data.token, data.user);
  };

  const registerAdmin = async (d: { name: string; email: string; password: string; department: string }) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/register/admin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Registration failed'); }
    const data = await res.json();
    await saveAuth(data.token, data.user);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('medscribe_token');
    await AsyncStorage.removeItem('medscribe_user');
    tokenRef.current = null;
    setToken(null); setUser(null);
  };

  // Use ref to always get the latest token, avoiding stale closures
  const authFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const currentToken = tokenRef.current;
    return fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
        ...(options.headers || {}),
      },
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, registerDoctor, registerPatient, registerAdmin, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}
