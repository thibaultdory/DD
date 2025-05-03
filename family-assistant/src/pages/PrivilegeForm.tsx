import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormHelperText,
  FormControlLabel,
  Switch,
  Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { privilegeService } from '../services/api';
import Layout from '../components/Layout/Layout';
import { format } from 'date-fns';

const PrivilegeForm: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const { privilegeId } = useParams<{ privilegeId: string }>();
  const isEditing = !!privilegeId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | null>(new Date());
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [earned, setEarned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Récupérer les enfants de la famille
  const children = authState.family.filter(user => !user.isParent);

  useEffect(() => {
    const fetchPrivilege = async () => {
      if (isEditing && privilegeId) {
        try {
          setLoading(true);
          const privileges = await privilegeService.getPrivileges();
          const privilege = privileges.find(p => p.id === privilegeId);
          
          if (privilege) {
            setTitle(privilege.title);
            setDescription(privilege.description || '');
            setDate(new Date(privilege.date));
            setAssignedTo(privilege.assignedTo);
            setEarned(privilege.earned);
          } else {
            setError('Privilège non trouvé');
          }
        } catch (error) {
          console.error('Error fetching privilege:', error);
          setError('Erreur lors de la récupération du privilège');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchPrivilege();
  }, [isEditing, privilegeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }
    
    if (!assignedTo) {
      setError('Veuillez assigner le privilège à un enfant');
      return;
    }
    
    if (!date) {
      setError('La date est requise');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const formattedDate = format(date, 'yyyy-MM-dd');
      
      if (isEditing && privilegeId) {
        await privilegeService.updatePrivilege(privilegeId, {
          title,
          description,
          date: formattedDate,
          assignedTo,
          earned
        });
        setSuccess('Privilège mis à jour avec succès');
      } else {
        await privilegeService.createPrivilege({
          title,
          description,
          date: formattedDate,
          assignedTo,
          earned
        });
        setSuccess('Privilège créé avec succès');
      }
      
      // Rediriger après un court délai pour montrer le message de succès
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('Error saving privilege:', error);
      setError('Erreur lors de l\'enregistrement du privilège');
    } finally {
      setLoading(false);
    }
  };

  if (!authState.currentUser?.isParent) {
    return (
      <Layout>
        <Alert severity="warning">
          Seuls les parents peuvent créer ou modifier des privilèges
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {isEditing ? 'Modifier le privilège' : 'Nouveau privilège'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Titre"
            fullWidth
            margin="normal"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="assigned-to-label">Assigné à</InputLabel>
            <Select
              labelId="assigned-to-label"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              label="Assigné à"
              required
            >
              {children.map((child) => (
                <MenuItem key={child.id} value={child.id}>
                  {child.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Sélectionnez l'enfant à qui accorder ce privilège</FormHelperText>
          </FormControl>
          
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
              label="Date"
              value={date}
              onChange={(newValue) => setDate(newValue)}
              sx={{ mt: 2, width: '100%' }}
            />
          </LocalizationProvider>
          
          <FormControlLabel
            control={
              <Switch
                checked={earned}
                onChange={(e) => setEarned(e.target.checked)}
                color="primary"
              />
            }
            label="Privilège mérité"
            sx={{ mt: 2, display: 'block' }}
          />
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button 
              variant="outlined" 
              onClick={() => navigate('/')}
            >
              Annuler
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              disabled={loading}
            >
              {isEditing ? 'Mettre à jour' : 'Créer'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Layout>
  );
};

export default PrivilegeForm;