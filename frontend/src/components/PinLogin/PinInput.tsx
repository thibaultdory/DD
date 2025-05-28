import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Avatar,
  Alert,
  IconButton
} from '@mui/material';
import { Backspace, ArrowBack } from '@mui/icons-material';
import { PinProfile } from '../../types';

interface PinInputProps {
  profile: PinProfile;
  onPinSubmit: (pin: string) => Promise<boolean>;
  onBack: () => void;
  maxAttempts?: number;
}

const PinInput: React.FC<PinInputProps> = ({
  profile,
  onPinSubmit,
  onBack,
  maxAttempts = 3
}) => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  const pinLength = 4; // Standard PIN length

  useEffect(() => {
    if (attempts >= maxAttempts) {
      setIsBlocked(true);
      setError(`Trop de tentatives. Veuillez attendre 30 secondes.`);
      
      const timer = setTimeout(() => {
        setIsBlocked(false);
        setAttempts(0);
        setError(null);
      }, 30000); // 30 seconds block

      return () => clearTimeout(timer);
    }
  }, [attempts, maxAttempts]);

  const handleNumberClick = (number: string): void => {
    if (isBlocked || isLoading || pin.length >= pinLength) return;
    
    const newPin = pin + number;
    setPin(newPin);
    setError(null);

    // Auto-submit when PIN is complete
    if (newPin.length === pinLength) {
      handleSubmit(newPin);
    }
  };

  const handleBackspace = (): void => {
    if (isBlocked || isLoading) return;
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleSubmit = async (pinToSubmit: string = pin): Promise<void> => {
    if (isBlocked || isLoading || pinToSubmit.length !== pinLength) return;

    setIsLoading(true);
    setError(null);

    try {
      const success = await onPinSubmit(pinToSubmit);
      
      if (!success) {
        setAttempts(prev => prev + 1);
        setPin('');
        setError('Code PIN incorrect');
      }
    } catch (error) {
      setError('Erreur lors de la vérification du PIN');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const getAvatarColor = (): string => {
    if (profile.color) return profile.color;
    
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3'];
    const index = profile.name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getInitials = (): string => {
    return profile.name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderPinDots = (): React.ReactNode => {
    return (
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 3 }}>
        {Array.from({ length: pinLength }).map((_, index) => (
          <Box
            key={index}
            sx={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              bgcolor: index < pin.length ? 'primary.main' : 'grey.300',
              transition: 'background-color 0.2s ease'
            }}
          />
        ))}
      </Box>
    );
  };

  const renderKeypad = (): React.ReactNode => {
    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];
    
    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          maxWidth: 300,
          mx: 'auto'
        }}
      >
        {numbers.map((number, index) => {
          if (number === '') {
            if (index === 11) {
              // Backspace button
              return (
                <Button
                  key={index}
                  variant="outlined"
                  onClick={handleBackspace}
                  disabled={isBlocked || isLoading || pin.length === 0}
                  sx={{
                    height: 60,
                    fontSize: '1.2rem',
                    borderRadius: 2
                  }}
                >
                  <Backspace />
                </Button>
              );
            }
            return <Box key={index} />; // Empty space
          }

          return (
            <Button
              key={index}
              variant="outlined"
              onClick={() => handleNumberClick(number)}
              disabled={isBlocked || isLoading}
              sx={{
                height: 60,
                fontSize: '1.5rem',
                fontWeight: 'bold',
                borderRadius: 2,
                '&:hover': {
                  transform: 'scale(1.05)'
                }
              }}
            >
              {number}
            </Button>
          );
        })}
      </Box>
    );
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', textAlign: 'center' }}>
      {/* Header with back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={onBack} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h5" sx={{ flex: 1 }}>
          Code PIN
        </Typography>
      </Box>

      {/* Profile info */}
      <Box sx={{ mb: 4 }}>
        <Avatar
          sx={{
            width: 80,
            height: 80,
            mx: 'auto',
            mb: 2,
            bgcolor: getAvatarColor(),
            fontSize: '2rem',
            fontWeight: 'bold'
          }}
          src={profile.avatar}
        >
          {!profile.avatar && getInitials()}
        </Avatar>
        <Typography variant="h6" gutterBottom>
          {profile.name}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Entrez votre code PIN
        </Typography>
      </Box>

      {/* Error message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          {attempts > 0 && attempts < maxAttempts && (
            <Typography variant="caption" display="block" mt={1}>
              Tentatives restantes: {maxAttempts - attempts}
            </Typography>
          )}
        </Alert>
      )}

      {/* PIN dots */}
      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        {renderPinDots()}
      </Paper>

      {/* Keypad */}
      {!isBlocked && renderKeypad()}

      {/* Loading state */}
      {isLoading && (
        <Typography variant="body2" color="textSecondary" mt={2}>
          Vérification en cours...
        </Typography>
      )}
    </Box>
  );
};

export default PinInput; 