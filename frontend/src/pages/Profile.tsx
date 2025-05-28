import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Avatar, 
  Grid, 
  Card, 
  CardContent,
  List,
  ListItem,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  ListItemSecondaryAction
} from '@mui/material';
import { Edit, Tablet, Info } from '@mui/icons-material';
import { format, parseISO, differenceInYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { usePin } from '../contexts/PinContext';
import Layout from '../components/Layout/Layout';

const Profile: React.FC = () => {
  const { authState } = useAuth();
  const {
    pinAuthState,
    tabletConfig,
    enableTabletMode,
    disableTabletMode,
    updateProfile,
    autoCreateProfilesFromFamily,
    isTabletModeAvailable,
    getTabletDetectionResults
  } = usePin();
  
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editPin, setEditPin] = useState('');
  const [showDetectionInfo, setShowDetectionInfo] = useState(false);
  
  if (!authState.currentUser) {
    return (
      <Layout>
        <Typography variant="h5" align="center" sx={{ mt: 4 }}>
          Veuillez vous connecter pour voir votre profil
        </Typography>
      </Layout>
    );
  }

  const { currentUser, family } = authState;
  const birthDate = parseISO(currentUser.birthDate);
  const age = differenceInYears(new Date(), birthDate);

  const handleToggleTabletMode = (): void => {
    if (tabletConfig.enabled) {
      disableTabletMode();
    } else {
      // Auto-create profiles when enabling tablet mode
      autoCreateProfilesFromFamily(authState.family);
      enableTabletMode();
    }
  };

  const handleEditPin = (memberId: string): void => {
    const profile = pinAuthState.availableProfiles.find(p => p.userId === memberId);
    if (profile) {
      setEditingMember(memberId);
      setEditPin(profile.pin);
    }
  };

  const handleSavePin = (): void => {
    if (editingMember && editPin) {
      const profile = pinAuthState.availableProfiles.find(p => p.userId === editingMember);
      if (profile) {
        updateProfile(profile.id, { pin: editPin });
      }
    }
    setEditingMember(null);
    setEditPin('');
  };

  const getPinForMember = (memberId: string): string | null => {
    const profile = pinAuthState.availableProfiles.find(p => p.userId === memberId);
    return profile ? profile.pin : null;
  };

  const detectionResults = getTabletDetectionResults();
  const isTabletDetected = isTabletModeAvailable();

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Profil
        </Typography>
      </Box>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
              <Avatar
                src={currentUser.profilePicture}
                alt={currentUser.name}
                sx={{ width: 120, height: 120, mb: 2 }}
              />
              <Typography variant="h5" gutterBottom>
                {currentUser.name}
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                {currentUser.isParent ? 'Parent' : 'Enfant'}
              </Typography>
              <Typography variant="body2">
                Date de naissance: {format(birthDate, 'd MMMM yyyy', { locale: fr })}
              </Typography>
              <Typography variant="body2">
                Âge: {age} ans
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Membres de la famille
              </Typography>
              {currentUser.isParent && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    icon={<Tablet />}
                    label={tabletConfig.enabled ? "Mode tablette activé" : "Mode tablette désactivé"}
                    color={tabletConfig.enabled ? "primary" : "default"}
                    variant="outlined"
                  />
                  <Button
                    size="small"
                    startIcon={<Info />}
                    onClick={() => setShowDetectionInfo(true)}
                  >
                    Détails
                  </Button>
                </Box>
              )}
            </Box>

            {/* Tablet mode toggle for parents */}
            {currentUser.isParent && (
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={tabletConfig.enabled}
                      onChange={handleToggleTabletMode}
                    />
                  }
                  label="Activer le mode tablette avec codes PIN"
                />
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Le mode tablette active l'authentification par PIN et la déconnexion automatique.
                  {!tabletConfig.enabled && " Les codes PIN seront créés automatiquement."}
                </Typography>
                
                {tabletConfig.enabled && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      Mode tablette actif. Cliquez sur l'icône d'édition à côté de chaque membre pour modifier son code PIN.
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}

            <List>
              {/* Current user */}
              <ListItem>
                <Avatar
                  src={currentUser.profilePicture}
                  alt={currentUser.name}
                  sx={{ mr: 2 }}
                />
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {currentUser.name}
                      <Chip label="Vous" size="small" color="primary" variant="outlined" />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        {currentUser.isParent ? 'Parent' : 'Enfant'} - {age} ans
                      </Typography>
                      {tabletConfig.enabled && (
                        <Chip 
                          label={`PIN: ${getPinForMember(currentUser.id) || 'Non configuré'}`}
                          size="small"
                          variant="outlined"
                          color={getPinForMember(currentUser.id) === '0000' || getPinForMember(currentUser.id) === '1234' ? 'warning' : 'success'}
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  }
                />
                {tabletConfig.enabled && currentUser.isParent && (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleEditPin(currentUser.id)}
                      size="small"
                    >
                      <Edit />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
              
              <Divider variant="inset" component="li" />

              {/* Other family members */}
              {family
                .filter(member => member.id !== currentUser.id)
                .map((member, index, array) => (
                  <React.Fragment key={member.id}>
                    <ListItem>
                      <Avatar
                        src={member.profilePicture}
                        alt={member.name}
                        sx={{ mr: 2 }}
                      />
                      <ListItemText
                        primary={member.name}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {member.isParent ? 'Parent' : 'Enfant'} - {
                                differenceInYears(new Date(), parseISO(member.birthDate))
                              } ans
                            </Typography>
                            {tabletConfig.enabled && (
                              <Chip 
                                label={`PIN: ${getPinForMember(member.id) || 'Non configuré'}`}
                                size="small"
                                variant="outlined"
                                color={getPinForMember(member.id) === '0000' || getPinForMember(member.id) === '1234' ? 'warning' : 'success'}
                                sx={{ mt: 1 }}
                              />
                            )}
                          </Box>
                        }
                      />
                      {tabletConfig.enabled && currentUser.isParent && (
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => handleEditPin(member.id)}
                            size="small"
                          >
                            <Edit />
                          </IconButton>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                    {index < array.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
            </List>
          </Paper>
        </Grid>
      </Grid>

      {/* Edit PIN Dialog */}
      <Dialog open={!!editingMember} onClose={() => setEditingMember(null)}>
        <DialogTitle>Modifier le code PIN</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Code PIN"
            type="password"
            fullWidth
            variant="outlined"
            value={editPin}
            onChange={(e) => setEditPin(e.target.value)}
            inputProps={{ maxLength: 6 }}
            helperText="4-6 chiffres recommandés"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingMember(null)}>Annuler</Button>
          <Button onClick={handleSavePin} variant="contained">
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detection Info Dialog */}
      <Dialog open={showDetectionInfo} onClose={() => setShowDetectionInfo(false)}>
        <DialogTitle>Informations de détection tablette</DialogTitle>
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
              <strong>Détection actuelle :</strong> {isTabletDetected ? "Tablette détectée" : "Tablette non détectée"}
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetectionInfo(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Profile;