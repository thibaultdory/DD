import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip
} from '@mui/material';
import { PinProfile } from '../../types';

interface ProfileSelectorProps {
  profiles: PinProfile[];
  onProfileSelect: (profile: PinProfile) => void;
  selectedProfileId?: string;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles,
  onProfileSelect,
  selectedProfileId
}) => {
  const getAvatarColor = (profile: PinProfile): string => {
    if (profile.color) return profile.color;
    
    // Generate a consistent color based on the profile name
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    const index = profile.name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (profiles.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="h6" color="textSecondary">
          Aucun profil configuré
        </Typography>
        <Typography variant="body2" color="textSecondary" mt={1}>
          Veuillez configurer les profils dans les paramètres
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" textAlign="center" mb={3}>
        Choisissez votre profil
      </Typography>
      
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center',
          maxWidth: 800,
          mx: 'auto'
        }}
      >
        {profiles.map((profile) => (
          <Box
            key={profile.id}
            sx={{
              flex: '0 1 200px',
              minWidth: 150,
              maxWidth: 250
            }}
          >
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                transform: selectedProfileId === profile.id ? 'scale(1.05)' : 'scale(1)',
                boxShadow: selectedProfileId === profile.id ? 4 : 1,
                border: selectedProfileId === profile.id ? 2 : 0,
                borderColor: 'primary.main',
                '&:hover': {
                  transform: 'scale(1.02)',
                  boxShadow: 3
                }
              }}
              onClick={() => onProfileSelect(profile)}
            >
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Avatar
                  sx={{
                    width: 64,
                    height: 64,
                    mx: 'auto',
                    mb: 2,
                    bgcolor: getAvatarColor(profile),
                    fontSize: '1.5rem',
                    fontWeight: 'bold'
                  }}
                  src={profile.avatar}
                >
                  {!profile.avatar && getInitials(profile.name)}
                </Avatar>
                
                <Typography variant="h6" gutterBottom>
                  {profile.name}
                </Typography>
                
                {profile.isParent && (
                  <Chip
                    label="Parent"
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default ProfileSelector; 