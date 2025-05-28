import React from 'react';
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
  Divider
} from '@mui/material';
import { format, parseISO, differenceInYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout/Layout';
import TabletSettings from '../components/TabletSettings/TabletSettings';

const Profile: React.FC = () => {
  const { authState } = useAuth();
  
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
            <Typography variant="h6" gutterBottom>
              Membres de la famille
            </Typography>
            <List>
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
                        secondary={`${member.isParent ? 'Parent' : 'Enfant'} - ${
                          differenceInYears(new Date(), parseISO(member.birthDate))
                        } ans`}
                      />
                    </ListItem>
                    {index < array.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
            </List>
          </Paper>

          {/* Tablet Settings - Only show for parents */}
          {currentUser.isParent && (
            <Paper sx={{ p: 3 }}>
              <TabletSettings />
            </Paper>
          )}
        </Grid>
      </Grid>
    </Layout>
  );
};

export default Profile;