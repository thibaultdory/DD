import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AuthState, PinAuthState, User } from '../types';
import { authService, API_BASE_URL } from '../services/api';

// Valeurs par défaut du contexte
const defaultAuthState: AuthState = {
  isAuthenticated: false,
  currentUser: null,
  family: [],
  pinAuth: undefined
};

// Création du contexte
const AuthContext = createContext<{
  authState: AuthState;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  updatePinAuth: (pinAuth: PinAuthState) => void;
  getEffectiveCurrentUser: () => User | null;
}>({
  authState: defaultAuthState,
  login: async () => {},
  logout: async () => {},
  authError: null,
  clearAuthError: () => {},
  updatePinAuth: () => {},
  getEffectiveCurrentUser: () => null
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
  const [authError, setAuthError] = useState<string | null>(null);

  // Vérifier si l'utilisateur est déjà connecté au chargement
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for OAuth error parameters in URL
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const message = urlParams.get('message');
        
        if (error) {
          // Set error message based on error type
          let errorMessage = 'Erreur de connexion';
          if (error === 'oauth_failed') {
            errorMessage = 'Échec de l\'authentification avec Google. Veuillez réessayer.';
          } else if (error === 'no_email') {
            errorMessage = 'Aucune adresse email fournie par Google. Veuillez vérifier vos paramètres de compte.';
          } else if (error === 'database_error') {
            errorMessage = 'Erreur lors de la création de votre compte. Veuillez réessayer.';
          } else if (message) {
            errorMessage = decodeURIComponent(message);
          }
          
          setAuthError(errorMessage);
          
          // Clear error parameters from URL without reloading the page
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }

        const user = await authService.getCurrentUser();
        if (user) {
          const family = await authService.getFamilyMembers();
          setAuthState({
            isAuthenticated: true,
            currentUser: user,
            family,
            pinAuth: undefined
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

  // Fonction pour effacer les erreurs d'authentification
  const clearAuthError = () => {
    setAuthError(null);
  };

  // Fonction pour mettre à jour l'état PIN
  const updatePinAuth = useCallback((pinAuth: PinAuthState) => {
    setAuthState(prev => ({
      ...prev,
      pinAuth
    }));
  }, []);

  // Fonction pour obtenir l'utilisateur effectif (Google ou PIN) - memoized
  const getEffectiveCurrentUser = useCallback((): User | null => {
    // If PIN authentication is active and we have a current PIN profile
    if (authState.pinAuth?.isPinAuthenticated && authState.pinAuth.currentPinProfile) {
      const pinProfile = authState.pinAuth.currentPinProfile;
      
      // Find the corresponding user in the family or current user
      const allUsers = authState.currentUser ? [authState.currentUser, ...authState.family] : authState.family;
      const pinUser = allUsers.find(user => user.id === pinProfile.userId);
      
      if (pinUser) {
        return pinUser;
      }
    }
    
    // Default to Google authenticated user
    return authState.currentUser;
  }, [authState.pinAuth, authState.currentUser, authState.family]);

  // Valeur du contexte
  const value = {
    authState,
    login,
    logout,
    authError,
    clearAuthError,
    updatePinAuth,
    getEffectiveCurrentUser
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