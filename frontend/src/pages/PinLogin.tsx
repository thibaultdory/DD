import React, { useState, useEffect } from 'react';
import { Box, Container, Paper, Typography, Button, Alert } from '@mui/material';
import { Settings, ExitToApp } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePin } from '../contexts/PinContext';
import { PinProfile } from '../types';
import ProfileSelector from '../components/PinLogin/ProfileSelector';
import PinInput from '../components/PinLogin/PinInput';

type PinLoginStep = 'profile-selection' | 'pin-input';

const PinLogin: React.FC = () => {
  const navigate = useNavigate();
  const { authState, logout } = useAuth();
  const { pinAuthState, authenticateWithPin } = usePin();
  
  const [currentStep, setCurrentStep] = useState<PinLoginStep>('profile-selection');
  const [selectedProfile, setSelectedProfile] = useState<PinProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not in tablet mode or if already authenticated
  useEffect(() => {
    if (!pinAuthState.isTabletMode) {
      navigate('/');
      return;
    }

    if (pinAuthState.isPinAuthenticated) {
      navigate('/');
      return;
    }

    // If no profiles are configured, show error
    if (pinAuthState.availableProfiles.length === 0) {
      setError('Aucun profil configuré. Veuillez configurer les profils dans les paramètres.');
    }
  }, [pinAuthState, navigate]);

  const handleProfileSelect = (profile: PinProfile): void => {
    setSelectedProfile(profile);
    setCurrentStep('pin-input');
    setError(null);
  };

  const handlePinSubmit = async (pin: string): Promise<boolean> => {
    if (!selectedProfile) return false;

    try {
      const success = await authenticateWithPin(selectedProfile.id, pin);
      if (success) {
        navigate('/');
      }
      return success;
    } catch (error) {
      console.error('PIN authentication error:', error);
      return false;
    }
  };

  const handleBackToProfiles = (): void => {
    setSelectedProfile(null);
    setCurrentStep('profile-selection');
    setError(null);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // If not authenticated with Google, redirect to login
  if (!authState.isAuthenticated) {
    navigate('/login');
    return null;
  }

  return (
    <Container component="main" maxWidth="md">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          py: 4
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Assistant de Vie Familiale
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Settings />}
              onClick={() => navigate('/profile')}
              size="small"
            >
              Paramètres
            </Button>
            <Button
              variant="outlined"
              startIcon={<ExitToApp />}
              onClick={handleLogout}
              size="small"
              color="error"
            >
              Déconnexion
            </Button>
          </Box>
        </Box>

        {/* Main content */}
        <Paper
          elevation={3}
          sx={{
            p: 4,
            minHeight: 500,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {currentStep === 'profile-selection' && (
            <ProfileSelector
              profiles={pinAuthState.availableProfiles}
              onProfileSelect={handleProfileSelect}
            />
          )}

          {currentStep === 'pin-input' && selectedProfile && (
            <PinInput
              profile={selectedProfile}
              onPinSubmit={handlePinSubmit}
              onBack={handleBackToProfiles}
            />
          )}
        </Paper>

        {/* Footer info */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            Mode tablette activé • Connecté en tant que {authState.currentUser?.name}
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default PinLogin; 