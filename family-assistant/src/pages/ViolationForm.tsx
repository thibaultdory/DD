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
  Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ruleViolationService, ruleService } from '../services/api';
import Layout from '../components/Layout/Layout';
import { format } from 'date-fns';
import { Rule } from '../types';

const ViolationForm: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const { violationId } = useParams<{ violationId: string }>();
  const isEditing = !!violationId;

  const [ruleId, setRuleId] = useState('');
  const [childId, setChildId] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date | null>(new Date());
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Récupérer les enfants de la famille
  const children = authState.family.filter(user => !user.isParent);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Récupérer les règles
        const fetchedRules = await ruleService.getRules();
        setRules(fetchedRules);
        
        // Si on est en mode édition, récupérer l'infraction
        if (isEditing && violationId) {
          const violations = await ruleViolationService.getRuleViolations();
          const violation = violations.find(v => v.id === violationId);
          
          if (violation) {
            setRuleId(violation.ruleId);
            setChildId(violation.childId);
            setDescription(violation.description || '');
            setDate(new Date(violation.date));
          } else {
            setError('Infraction non trouvée');
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Erreur lors de la récupération des données');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isEditing, violationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ruleId) {
      setError('Veuillez sélectionner une règle');
      return;
    }
    
    if (!childId) {
      setError('Veuillez sélectionner un enfant');
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
      
      if (isEditing && violationId) {
        // L'API ne supporte pas la mise à jour des infractions, on supprime et on recrée
        await ruleViolationService.deleteRuleViolation(violationId);
        await ruleViolationService.createRuleViolation({
          ruleId,
          childId,
          description,
          date: formattedDate,
          reportedBy: authState.currentUser?.id || ''
        });
        setSuccess('Infraction mise à jour avec succès');
      } else {
        await ruleViolationService.createRuleViolation({
          ruleId,
          childId,
          description,
          date: formattedDate,
          reportedBy: authState.currentUser?.id || ''
        });
        setSuccess('Infraction créée avec succès');
      }
      
      // Rediriger après un court délai pour montrer le message de succès
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('Error saving violation:', error);
      setError('Erreur lors de l\'enregistrement de l\'infraction');
    } finally {
      setLoading(false);
    }
  };

  if (!authState.currentUser?.isParent) {
    return (
      <Layout>
        <Alert severity="warning">
          Seuls les parents peuvent créer ou modifier des infractions
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {isEditing ? 'Modifier l\'infraction' : 'Nouvelle infraction'}
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
          <FormControl fullWidth margin="normal">
            <InputLabel id="rule-label">Règle enfreinte</InputLabel>
            <Select
              labelId="rule-label"
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              label="Règle enfreinte"
              required
            >
              {rules.filter(rule => !rule.isTask).map((rule) => (
                <MenuItem key={rule.id} value={rule.id}>
                  {rule.description}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Sélectionnez la règle qui a été enfreinte</FormHelperText>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="child-label">Enfant</InputLabel>
            <Select
              labelId="child-label"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              label="Enfant"
              required
            >
              {children.map((child) => (
                <MenuItem key={child.id} value={child.id}>
                  {child.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Sélectionnez l'enfant qui a enfreint la règle</FormHelperText>
          </FormControl>
          
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            placeholder="Détails sur l'infraction"
          />
          
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
              label="Date"
              value={date}
              onChange={(newValue) => setDate(newValue)}
              sx={{ mt: 2, width: '100%' }}
            />
          </LocalizationProvider>
          
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

export default ViolationForm;