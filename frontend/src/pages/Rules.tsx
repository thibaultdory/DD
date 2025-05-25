import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
  Card,
  CardContent,
  CardActions
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { Rule } from '../types';
import { ruleService } from '../services/api';
import Layout from '../components/Layout/Layout';

const Rules: React.FC = () => {
  const { authState } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [formData, setFormData] = useState<Partial<Rule>>({
    description: '',
    isTask: false
  });

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const fetchedRules = await ruleService.getRules();
        setRules(fetchedRules);
      } catch (error) {
        console.error('Error fetching rules:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, []);

  const handleOpenDialog = (rule?: Rule) => {
    if (rule) {
      setSelectedRule(rule);
      setFormData({
        description: rule.description,
        isTask: rule.isTask
      });
    } else {
      setSelectedRule(null);
      setFormData({
        description: '',
        isTask: false
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedRule(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      isTask: e.target.checked
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.description) {
        alert('Veuillez saisir une description pour la règle');
        return;
      }

      if (selectedRule) {
        // Mise à jour d'une règle existante
        const updatedRule = await ruleService.updateRule(selectedRule.id, formData);
        setRules(rules.map(r => 
          r.id === selectedRule.id ? updatedRule : r
        ));
      } else {
        // Création d'une nouvelle règle
        const newRule = await ruleService.createRule(formData as Omit<Rule, 'id' | 'active'>);
        setRules([...rules, newRule]);
      }
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Une erreur est survenue lors de l\'enregistrement de la règle');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    const confirmMessage = `Êtes-vous sûr de vouloir supprimer la règle "${rule.description}" ?\n\nCette action désactivera la règle mais conservera l'historique des violations et contrats associés.`;
    
    if (window.confirm(confirmMessage)) {
      try {
        await ruleService.deleteRule(ruleId);
        setRules(rules.filter(r => r.id !== ruleId));
      } catch (error) {
        console.error('Error deleting rule:', error);
        alert('Une erreur est survenue lors de la suppression de la règle');
      }
    }
  };

  if (loading) {
    return <Typography>Chargement...</Typography>;
  }

  // Only parents can access this page
  if (!authState.currentUser?.isParent) {
    return (
      <Layout>
        <Typography variant="h4" color="error">
          Accès non autorisé
        </Typography>
        <Typography>
          Seuls les parents peuvent gérer les règles.
        </Typography>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" gutterBottom>
            Gestion des Règles
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Nouvelle règle
          </Button>
        </Box>
        <Typography variant="subtitle1">
          Gérez les règles globales utilisées dans les contrats
        </Typography>
      </Box>

      {rules.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Aucune règle définie
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<Add />} 
            sx={{ mt: 2 }}
            onClick={() => handleOpenDialog()}
          >
            Créer une règle
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rules.map(rule => (
            <Card key={rule.id}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="div">
                      {rule.description}
                    </Typography>
                    <Chip 
                      label={rule.isTask ? 'Tâche à accomplir' : 'Règle à respecter'} 
                      color={rule.isTask ? 'primary' : 'secondary'} 
                      size="small" 
                      sx={{ mt: 1 }}
                    />
                  </Box>
                </Box>
              </CardContent>
              <CardActions>
                <Button 
                  size="small" 
                  startIcon={<Edit />}
                  onClick={() => handleOpenDialog(rule)}
                >
                  Modifier
                </Button>
                <Button 
                  size="small" 
                  color="error" 
                  startIcon={<Delete />}
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  Supprimer
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      {/* Dialogue de création/modification de règle */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedRule ? 'Modifier la règle' : 'Nouvelle règle'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="description"
              label="Description de la règle"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              multiline
              rows={3}
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isTask || false}
                  onChange={handleCheckboxChange}
                  name="isTask"
                />
              }
              label="Cette règle est une tâche à accomplir"
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedRule ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Rules; 