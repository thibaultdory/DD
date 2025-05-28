import React, { useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Card,
  CardContent,
  Alert,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Grid
} from '@mui/material';
import { Add, Edit, Delete, Tablet, Info, Warning, Settings as SettingsIcon } from '@mui/icons-material';
import { usePin } from '../../contexts/PinContext';
import { useAuth } from '../../contexts/AuthContext';
import { PinProfile } from '../../types';

const TabletSettings: React.FC = () => {
  const { authState } = useAuth();
  const {
    pinAuthState,
    tabletConfig,
    enableTabletMode,
    disableTabletMode,
    addProfile,
    updateProfile,
    removeProfile,
    isTabletModeAvailable,
    getTabletDetectionResults,
    autoCreateProfilesFromFamily
  } = usePin();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PinProfile | null>(null);
  const [showDetectionInfo, setShowDetectionInfo] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);

  // If currently in tablet mode, show warning
  if (pinAuthState.isTabletMode) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tablet />
          Paramètres Tablette
        </Typography>

        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            <Warning sx={{ mr: 1, verticalAlign: 'middle' }} />
            Mode tablette actif
          </Typography>
          <Typography variant="body2">
            Les paramètres de tablette ne peuvent être modifiés qu'en mode normal. 
            Déconnectez-vous du mode PIN pour accéder aux paramètres complets.
          </Typography>
        </Alert>

        {/* Show current profiles in read-only mode */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Profils actuels (lecture seule)
            </Typography>
            
            {pinAuthState.availableProfiles.length === 0 ? (
              <Alert severity="info">
                Aucun profil configuré.
              </Alert>
            ) : (
              <List>
                {pinAuthState.availableProfiles.map((profile, index) => (
                  <React.Fragment key={profile.id}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar
                          sx={{ bgcolor: getAvatarColor(profile) }}
                          src={profile.avatar}
                        >
                          {!profile.avatar && getInitials(profile.name)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={profile.name}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            {profile.isParent && (
                              <Chip label="Parent" size="small" color="primary" variant="outlined" />
                            )}
                            <Chip label={`PIN: ${profile.pin}`} size="small" variant="outlined" />
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  }

  const handleToggleTabletMode = (): void => {
    if (tabletConfig.enabled) {
      disableTabletMode();
    } else {
      // Show setup dialog when enabling for the first time
      setShowSetupDialog(true);
    }
  };

  const handleSetupTabletMode = (customProfiles?: PinProfile[]): void => {
    if (customProfiles) {
      // Use custom profiles from setup dialog
      customProfiles.forEach(profile => {
        addProfile(profile);
      });
    } else {
      // Auto-create profiles when enabling tablet mode
      autoCreateProfilesFromFamily(authState.family);
    }
    enableTabletMode();
    setShowSetupDialog(false);
  };

  const handleAddProfile = (): void => {
    setEditingProfile(null);
    setShowAddDialog(true);
  };

  const handleEditProfile = (profile: PinProfile): void => {
    setEditingProfile(profile);
    setShowAddDialog(true);
  };

  const handleDeleteProfile = (profileId: string): void => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce profil ?')) {
      removeProfile(profileId);
    }
  };

  const getAvatarColor = (profile: PinProfile): string => {
    if (profile.color) return profile.color;
    
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3'];
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

  const detectionResults = getTabletDetectionResults();
  const isTabletDetected = isTabletModeAvailable();

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tablet />
        Paramètres Tablette
      </Typography>

      {/* Detection Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Détection de tablette
            </Typography>
            <Button
              size="small"
              startIcon={<Info />}
              onClick={() => setShowDetectionInfo(true)}
            >
              Détails
            </Button>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip
              label={isTabletDetected ? "Tablette détectée" : "Tablette non détectée"}
              color={isTabletDetected ? "success" : "default"}
              variant="outlined"
            />
            <Chip
              label={tabletConfig.enabled ? "Mode activé" : "Mode désactivé"}
              color={tabletConfig.enabled ? "primary" : "default"}
              variant="outlined"
            />
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={tabletConfig.enabled}
                onChange={handleToggleTabletMode}
              />
            }
            label="Activer le mode tablette"
          />
          
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Le mode tablette active l'authentification par PIN et la déconnexion automatique.
            Vous pourrez configurer les codes PIN lors de l'activation.
          </Typography>
        </CardContent>
      </Card>

      {/* Profiles Management */}
      {tabletConfig.enabled && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Profils PIN
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddProfile}
              >
                Ajouter un profil
              </Button>
            </Box>

            {pinAuthState.availableProfiles.length === 0 ? (
              <Alert severity="info">
                Aucun profil configuré. Les profils seront créés automatiquement lors de l'activation du mode tablette.
              </Alert>
            ) : (
              <List>
                {pinAuthState.availableProfiles.map((profile, index) => (
                  <React.Fragment key={profile.id}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar
                          sx={{ bgcolor: getAvatarColor(profile) }}
                          src={profile.avatar}
                        >
                          {!profile.avatar && getInitials(profile.name)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={profile.name}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            {profile.isParent && (
                              <Chip label="Parent" size="small" color="primary" variant="outlined" />
                            )}
                            <Chip 
                              label={`PIN: ${profile.pin}`} 
                              size="small" 
                              variant="outlined"
                              color={profile.pin === '0000' || profile.pin === '1234' ? 'warning' : 'success'}
                            />
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleEditProfile(profile)}
                          sx={{ mr: 1 }}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteProfile(profile.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}

      {/* Setup Dialog */}
      <SetupDialog
        open={showSetupDialog}
        onClose={() => setShowSetupDialog(false)}
        familyMembers={authState.family}
        onSetup={handleSetupTabletMode}
      />

      {/* Add/Edit Profile Dialog */}
      <ProfileDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        profile={editingProfile}
        familyMembers={authState.family}
        onSave={(profileData) => {
          if (editingProfile) {
            updateProfile(editingProfile.id, profileData);
          } else {
            addProfile(profileData);
          }
          setShowAddDialog(false);
        }}
      />

      {/* Detection Info Dialog */}
      <Dialog open={showDetectionInfo} onClose={() => setShowDetectionInfo(false)}>
        <DialogTitle>Informations de détection</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Voici les résultats des différentes méthodes de détection de tablette :
          </Typography>
          
          <List dense>
            {Object.entries(detectionResults).map(([method, result]) => (
              <ListItem key={method}>
                <ListItemText
                  primary={method}
                  secondary={result ? "Détectée" : "Non détectée"}
                />
                <Chip
                  label={result ? "✓" : "✗"}
                  color={result ? "success" : "default"}
                  size="small"
                />
              </ListItem>
            ))}
          </List>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Options de détection :</strong><br />
              • <strong>userAgent</strong> : Détection basée sur l'agent utilisateur<br />
              • <strong>screenSize</strong> : Détection basée sur la taille d'écran<br />
              • <strong>touchAndSize</strong> : Détection tactile + taille<br />
              • <strong>localStorage</strong> : Mode manuel via stockage local<br />
              • <strong>urlParam</strong> : Mode manuel via paramètre URL (?tablet=true)
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetectionInfo(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Setup Dialog Component
interface SetupDialogProps {
  open: boolean;
  onClose: () => void;
  familyMembers: any[];
  onSetup: (customProfiles?: PinProfile[]) => void;
}

const SetupDialog: React.FC<SetupDialogProps> = ({
  open,
  onClose,
  familyMembers,
  onSetup
}) => {
  const [useCustomPins, setUseCustomPins] = useState(false);
  const [profiles, setProfiles] = useState<Array<{
    userId: string;
    name: string;
    pin: string;
    isParent: boolean;
    avatar?: string;
  }>>([]);

  React.useEffect(() => {
    if (open) {
      // Initialize profiles from family members
      const initialProfiles = familyMembers.map(member => ({
        userId: member.id,
        name: member.name,
        pin: member.isParent ? '0000' : '1234',
        isParent: member.isParent,
        avatar: member.profilePicture
      }));
      setProfiles(initialProfiles);
    }
  }, [open, familyMembers]);

  const handlePinChange = (userId: string, newPin: string): void => {
    setProfiles(prev => prev.map(profile =>
      profile.userId === userId ? { ...profile, pin: newPin } : profile
    ));
  };

  const handleSetup = (): void => {
    if (useCustomPins) {
      // Convert to PinProfile format
      const customProfiles: PinProfile[] = profiles.map(profile => ({
        id: `profile_${profile.userId}_${Date.now()}`,
        userId: profile.userId,
        name: profile.name,
        pin: profile.pin,
        isParent: profile.isParent,
        avatar: profile.avatar,
        color: getDefaultColorForUser(profile.name)
      }));
      onSetup(customProfiles);
    } else {
      onSetup(); // Use auto-creation
    }
  };

  const getDefaultColorForUser = (name: string): string => {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        Configuration du mode tablette
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" paragraph>
            Le mode tablette va être activé. Vous pouvez utiliser les codes PIN par défaut ou les personnaliser.
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={useCustomPins}
                onChange={(e) => setUseCustomPins(e.target.checked)}
              />
            }
            label="Personnaliser les codes PIN"
          />
        </Box>

        {!useCustomPins ? (
          <Alert severity="info">
            <Typography variant="body2">
              <strong>Codes PIN par défaut :</strong><br />
              • Parents : 0000<br />
              • Enfants : 1234<br />
              <em>Vous pourrez les modifier plus tard dans les paramètres.</em>
            </Typography>
          </Alert>
        ) : (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configurez les codes PIN pour chaque membre :
            </Typography>
            <Grid container spacing={2}>
              {profiles.map((profile) => (
                <Grid size={{ xs: 12, sm: 6 }} key={profile.userId}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ mr: 2 }} src={profile.avatar}>
                          {!profile.avatar && profile.name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1">{profile.name}</Typography>
                          <Chip 
                            label={profile.isParent ? "Parent" : "Enfant"} 
                            size="small" 
                            color={profile.isParent ? "primary" : "default"}
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                      <TextField
                        label="Code PIN"
                        type="password"
                        value={profile.pin}
                        onChange={(e) => handlePinChange(profile.userId, e.target.value)}
                        fullWidth
                        inputProps={{ maxLength: 6 }}
                        helperText="4-6 chiffres recommandés"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleSetup} variant="contained">
          Activer le mode tablette
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Profile Dialog Component
interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: PinProfile | null;
  familyMembers: any[];
  onSave: (profileData: Omit<PinProfile, 'id'>) => void;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({
  open,
  onClose,
  profile,
  familyMembers,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    userId: '',
    pin: '',
    isParent: false,
    color: '#2196f3'
  });

  React.useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        userId: profile.userId,
        pin: profile.pin,
        isParent: profile.isParent,
        color: profile.color || '#2196f3'
      });
    } else {
      setFormData({
        name: '',
        userId: '',
        pin: '',
        isParent: false,
        color: '#2196f3'
      });
    }
  }, [profile, open]);

  const handleSubmit = (): void => {
    if (!formData.name || !formData.userId || !formData.pin) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.pin.length < 4) {
      alert('Le PIN doit contenir au moins 4 caractères');
      return;
    }

    onSave(formData);
  };

  const colors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', 
    '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
    '#009688', '#4caf50', '#8bc34a', '#cddc39',
    '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {profile ? 'Modifier le profil' : 'Ajouter un profil'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          <TextField
            label="Nom du profil"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            fullWidth
            required
          />

          <FormControl fullWidth required>
            <InputLabel>Membre de la famille</InputLabel>
            <Select
              value={formData.userId}
              onChange={(e) => {
                const selectedUser = familyMembers.find(u => u.id === e.target.value);
                setFormData(prev => ({
                  ...prev,
                  userId: e.target.value,
                  isParent: selectedUser?.isParent || false
                }));
              }}
            >
              {familyMembers.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.name} {member.isParent && '(Parent)'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Code PIN"
            type="password"
            value={formData.pin}
            onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value }))}
            fullWidth
            required
            helperText="Minimum 4 caractères"
          />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Couleur du profil
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {colors.map((color) => (
                <Box
                  key={color}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: color,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: formData.color === color ? '3px solid #000' : '2px solid transparent',
                    '&:hover': {
                      transform: 'scale(1.1)'
                    }
                  }}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit} variant="contained">
          {profile ? 'Modifier' : 'Ajouter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TabletSettings; 