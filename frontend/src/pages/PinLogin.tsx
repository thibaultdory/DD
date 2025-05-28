import React, { useState, useEffect } from 'react';
import { Box, Container, Paper, Typography, Button, Alert } from '@mui/material';
import { ExitToApp, Warning } from '@mui/icons-material';
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
  const { pinAuthState, authenticateWithPin, autoCreateProfilesFromFamily, forceExitTabletMode } = usePin();
  
  const [currentStep, setCurrentStep] = useState<PinLoginStep>('profile-selection');
  const [selectedProfile, setSelectedProfile] = useState<PinProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmergencyExit, setShowEmergencyExit] = useState(false);

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

    // Auto-create profiles from family members if none exist
    if (pinAuthState.availableProfiles.length === 0 && authState.family.length > 0) {
      console.log('Auto-creating profiles from family members...');
      autoCreateProfilesFromFamily(authState.family);
    }

    // Show emergency exit after 5 seconds if still no profiles
    const timer = setTimeout(() => {
      if (pinAuthState.availableProfiles.length === 0) {
        setShowEmergencyExit(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [pinAuthState, navigate, authState.family, autoCreateProfilesFromFamily]);

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

  const handleEmergencyExit = (): void => {
    if (window.confirm('Êtes-vous sûr de vouloir quitter le mode tablette ? Cela vous déconnectera complètement.')) {
      forceExitTabletMode();
    }
  };

  // If not authenticated with Google, redirect to login
  if (!authState.isAuthenticated) {
    navigate('/login');
    return null;
  }

  // Show loading state while profiles are being created
  if (pinAuthState.availableProfiles.length === 0 && !showEmergencyExit) {
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
          <Paper
            elevation={3}
            sx={{
              p: 4,
              minHeight: 300,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <Typography variant="h5" gutterBottom>
              Configuration du mode tablette...
            </Typography>
            <Typography variant="body1" color="textSecondary" textAlign="center">
              Création automatique des profils à partir des membres de la famille.
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
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
            {showEmergencyExit && (
              <Button
                variant="outlined"
                startIcon={<Warning />}
                onClick={handleEmergencyExit}
                size="small"
                color="warning"
              >
                Sortir du mode tablette
              </Button>
            )}
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

          {pinAuthState.availableProfiles.length === 0 && showEmergencyExit && (
            <Box textAlign="center">
              <Alert severity="warning" sx={{ mb: 3 }}>
                Aucun profil n'a pu être créé automatiquement. Cela peut être dû à un problème de configuration.
              </Alert>
              <Typography variant="h6" gutterBottom>
                Mode tablette bloqué
              </Typography>
              <Typography variant="body1" color="textSecondary" paragraph>
                Utilisez le bouton "Sortir du mode tablette" ci-dessus pour revenir au mode normal.
              </Typography>
            </Box>
          )}

          {currentStep === 'profile-selection' && pinAuthState.availableProfiles.length > 0 && (
            <>
              <ProfileSelector
                profiles={pinAuthState.availableProfiles}
                onProfileSelect={handleProfileSelect}
              />
              
              {/* Show default PIN info for first-time users */}
              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  <strong>Codes PIN configurés :</strong><br />
                  {pinAuthState.availableProfiles.map(profile => (
                    <span key={profile.id}>
                      • {profile.name} ({profile.isParent ? 'Parent' : 'Enfant'}) : <strong>{profile.pin}</strong><br />
                    </span>
                  ))}
                  <em>Les parents peuvent modifier ces codes dans les paramètres en mode normal.</em>
                </Typography>
              </Alert>
            </>
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