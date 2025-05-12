import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthState } from '../types';
import { authService } from '../services/api';
// API_BASE_URL is defined in the global scope by the config.js script
declare const API_BASE_URL: string;

// Valeurs par défaut du contexte
const defaultAuthState: AuthState = {
  isAuthenticated: false,
  currentUser: null,
  family: []
};

// Création du contexte
const AuthContext = createContext<{
  authState: AuthState;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  authState: defaultAuthState,
  login: async () => {},
  logout: async () => {}
});

// Hook personnalisé pour utiliser le contexte d'authentification
export const useAuth = () => useContext(AuthContext);

// Propriétés du provider
interface AuthProviderProps {
  children: ReactNode;
}

// Provider du contexte d'authentification
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(defaultAuthState);
  const [loading, setLoading] = useState<boolean>(true);

  // Vérifier si l'utilisateur est déjà connecté au chargement
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          const family = await authService.getFamilyMembers();
          setAuthState({
            isAuthenticated: true,
            currentUser: user,
            family
          });
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Fonction de connexion
  const login = async () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  // Fonction de déconnexion
  const logout = async () => {
    try {
      await authService.logout();
      setAuthState(defaultAuthState);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Valeur du contexte
  const value = {
    authState,
    login,
    logout
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};