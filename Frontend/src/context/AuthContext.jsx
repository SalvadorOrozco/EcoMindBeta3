import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchProfile,
  loginRequest,
  registerRequest,
  setAuthToken,
} from '../services/api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'ecomind.token';
const USER_KEY = 'ecomind.user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.warn('No se pudo parsear el usuario almacenado', error);
      return null;
    }
  });
  const [initializing, setInitializing] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (!token) return null;
    const freshUser = await fetchProfile();
    setUser(freshUser);
    return freshUser;
  }, [token]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!token) {
        setInitializing(false);
        return;
      }
      try {
        const freshUser = await refreshProfile();
        if (!active) return;
        if (!freshUser) {
          logout();
        }
      } catch (error) {
        if (!active) return;
        logout();
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, [token, logout, refreshProfile]);

  const login = useCallback(async (credentials) => {
    const { token: authToken, user: authUser } = await loginRequest(credentials);
    setToken(authToken);
    setUser(authUser);
    return authUser;
  }, []);

  const register = useCallback(async (payload) => {
    const { token: authToken, user: authUser } = await registerRequest(payload);
    setToken(authToken);
    setUser(authUser);
    return authUser;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, token, login, register, logout, refreshProfile],
  );

  if (initializing) {
    return (
      <div className="auth-loading" role="status" aria-live="polite">
        <div className="auth-loading-spinner" />
        <p>Inicializando EcoMind...</p>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider');
  }
  return context;
}
