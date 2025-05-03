import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireParent?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireParent = false 
}) => {
  const { authState } = useAuth();
  
  if (!authState.isAuthenticated) {
    // Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
    return <Navigate to="/login" replace />;
  }
  
  if (requireParent && !authState.currentUser?.isParent) {
    // Rediriger vers la page d'accueil si la route nécessite un parent mais l'utilisateur n'en est pas un
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;