import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePin } from '../contexts/PinContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireParent?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireParent = false 
}) => {
  const { authState } = useAuth();
  const { pinAuthState, tabletConfig } = usePin();
  
  if (!authState.isAuthenticated) {
    // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
    return <Navigate to="/login" replace />;
  }

  // Check if tablet mode is enabled and PIN authentication is required
  if (tabletConfig.enabled && pinAuthState.isTabletMode) {
    if (!pinAuthState.isPinAuthenticated) {
      // Redirect to PIN login if tablet mode is active but not PIN authenticated
      return <Navigate to="/pin-login" replace />;
    }

    // Check parent requirement against PIN profile
    if (requireParent && !pinAuthState.currentPinProfile?.isParent) {
      // Redirect to home if route requires parent but current PIN profile is not a parent
      return <Navigate to="/" replace />;
    }
  } else {
    // Normal authentication check (non-tablet mode)
    if (requireParent && !authState.currentUser?.isParent) {
      // Rediriger vers la page d'accueil si la route nécessite un parent mais l'utilisateur n'en est pas un
      return <Navigate to="/" replace />;
    }
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;