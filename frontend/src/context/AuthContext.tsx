import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi, LoginCredentials } from '../api/authApi';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  signIn: (session: any) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('pms_user');
    const token = localStorage.getItem('pms_token') || localStorage.getItem('pms_access_token');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('pms_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      const response = await authApi.login(credentials);
      if (response.token) {
        localStorage.setItem('pms_token', response.token);
        localStorage.setItem('pms_access_token', response.token);
      }
      localStorage.setItem('pms_user', JSON.stringify(response));
      setUser(response);
    } finally {
      setLoading(false);
    }
  };

  const signIn = (session: any) => {
    if (session?.token) {
      localStorage.setItem('pms_token', session.token);
      localStorage.setItem('pms_access_token', session.token);
    } else if (session?.accessToken) {
      localStorage.setItem('pms_token', session.accessToken);
      localStorage.setItem('pms_access_token', session.accessToken);
    }
    const userData = session?.user || session;
    localStorage.setItem('pms_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('pms_token');
    localStorage.removeItem('pms_access_token');
    localStorage.removeItem('pms_user');
    setUser(null);
    window.location.href = '/login';
  };

  const signOut = () => {
    logout();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
