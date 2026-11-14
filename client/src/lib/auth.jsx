import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

export const Auth = createContext(null);
export const useAuth = () => useContext(Auth);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = sessionStorage.getItem('unievents_token');
    if (t)
      api
        .get('/auth/me')
        .then((x) => setUser(x.user))
        .catch(() => {
          sessionStorage.removeItem('unievents_token');
          sessionStorage.removeItem('unievents_role');
        })
        .finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  const login = async (email, password) => {
    sessionStorage.removeItem('unievents_role');
    const x = await api.post('/auth/login', { email, password });
    sessionStorage.setItem('unievents_token', x.token);
    setUser(x.user);
    return x.user;
  };
  const switchRole = async (role) => {
    sessionStorage.setItem('unievents_role', role);
    const x = await api.get('/auth/me');
    setUser(x.user);
  };
  const logout = () => {
    sessionStorage.removeItem('unievents_token');
    sessionStorage.removeItem('unievents_role');
    setUser(null);
  };
  return (
    <Auth.Provider value={{ user, setUser, login, logout, switchRole, loading }}>{children}</Auth.Provider>
  );
}
