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
  const { authState, getEffectiveCurrentUser } = useAuth();
  const { pinAuthState, tabletConfig } = usePin();
  
  // Get the effective current user (considering PIN authentication)
  const effectiveUser = getEffectiveCurrentUser();
  
  // Debug logging
  React.useEffect(() => {
    console.log('ProtectedRoute state check:', {
      isAuthenticated: authState.isAuthenticated,
      tabletEnabled: tabletConfig.enabled,
      isTabletMode: pinAuthState.isTabletMode,
      isPinAuthenticated: pinAuthState.isPinAuthenticated,
      currentProfile: pinAuthState.currentPinProfile?.name,
      effectiveUser: effectiveUser?.name,
      effectiveUserIsParent: effectiveUser?.isParent
    });
  }, [authState.isAuthenticated, tabletConfig.enabled, pinAuthState.isTabletMode, pinAuthState.isPinAuthenticated, pinAuthState.currentPinProfile, effectiveUser]);
  
  if (!authState.isAuthenticated) {
    // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
    console.log('Redirecting to login - not authenticated');
    return <Navigate to="/login" replace />;
  }

  // Check if tablet mode is enabled and PIN authentication is required
  if (tabletConfig.enabled && pinAuthState.isTabletMode) {
    if (!pinAuthState.isPinAuthenticated) {
      // Redirect to PIN login if tablet mode is active but not PIN authenticated
      console.log('Redirecting to PIN login - tablet mode active but not PIN authenticated');
      return <Navigate to="/pin-login" replace />;
    }

    // Check parent requirement against effective user (PIN profile user)
    if (requireParent && !effectiveUser?.isParent) {
      // Redirect to home if route requires parent but effective user is not a parent
      console.log('Redirecting to home - parent required but effective user is not parent');
      return <Navigate to="/" replace />;
    }
  } else {
    // Normal authentication check (non-tablet mode)
    if (requireParent && !effectiveUser?.isParent) {
      // Rediriger vers la page d'accueil si la route nécessite un parent mais l'utilisateur effectif n'en est pas un
      console.log('Redirecting to home - parent required but effective user is not parent');
      return <Navigate to="/" replace />;
    }
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;