import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Grid,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Card,
  CardContent,
  CardActions,
  OutlinedInput,
  SelectChangeEvent
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Contract, Rule } from '../types';
import { contractService, ruleService } from '../services/api';
import Layout from '../components/Layout/Layout';

interface ContractFormData {
  title: string;
  childId: string;
  parentId: string;
  ruleIds: string[];
  dailyReward: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

const Contracts: React.FC = () => {
  const { authState } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [availableRules, setAvailableRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [formData, setFormData] = useState<ContractFormData>({
    title: '',
    childId: '',
    parentId: '',
    ruleIds: [],
    dailyReward: 1,
    startDate: '',
    endDate: '',
    active: true
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedContracts, fetchedRules] = await Promise.all([
          authState.currentUser?.isParent 
            ? contractService.getContracts()
            : authState.currentUser 
              ? contractService.getChildContracts(authState.currentUser.id)
              : [],
          ruleService.getRules()
        ]);
        
        setContracts(fetchedContracts);
        setAvailableRules(fetchedRules);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authState.currentUser]);

  const handleOpenDialog = (contract?: Contract) => {
    if (contract) {
      setSelectedContract(contract);
      setFormData({
        title: contract.title,
        childId: contract.childId,
        parentId: contract.parentId,
        ruleIds: contract.rules.map(rule => rule.id),
        dailyReward: contract.dailyReward,
        startDate: contract.startDate,
        endDate: contract.endDate,
        active: contract.active
      });
    } else {
      setSelectedContract(null);
      setFormData({
        title: '',
        childId: '',
        parentId: authState.currentUser?.id || '',
        ruleIds: [],
        dailyReward: 1,
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        active: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedContract(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'dailyReward' ? parseFloat(value) : value
    });
  };

  const handleSelectChange = (e: SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleRuleSelectChange = (e: SelectChangeEvent<string[]>) => {
    const value = e.target.value;
    setFormData({
      ...formData,
      ruleIds: typeof value === 'string' ? value.split(',') : value
    });
  };

  const handleSubmit = async () => {
    try {
      if (!formData.title || !formData.childId || !formData.parentId || !formData.startDate || !formData.endDate) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
      }

      if (!formData.ruleIds || formData.ruleIds.length === 0) {
        alert('Veuillez sélectionner au moins une règle pour le contrat');
        return;
      }

      if (selectedContract) {
        // Mise à jour d'un contrat existant
        await contractService.updateContract(selectedContract.id, formData);
        // Refresh contracts to get updated data with rules
        const updatedContracts = await contractService.getContracts();
        setContracts(updatedContracts);
      } else {
        // Création d'un nouveau contrat
        const newContract = await contractService.createContract(formData);
        setContracts([...contracts, newContract]);
      }
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving contract:', error);
      alert('Une erreur est survenue lors de l\'enregistrement du contrat');
    }
  };

  const handleDeactivateContract = async (contractId: string) => {
    try {
      await contractService.deactivateContract(contractId);
      setContracts(contracts.map(c => 
        c.id === contractId ? { ...c, active: false } : c
      ));
    } catch (error) {
      console.error('Error deactivating contract:', error);
      alert('Une erreur est survenue lors de la désactivation du contrat');
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return;

    const confirmMessage = `Êtes-vous sûr de vouloir supprimer définitivement le contrat "${contract.title}" ?\n\nCette action est irréversible. Le contrat sera supprimé, mais les transactions de portefeuille associées seront conservées.`;
    
    if (window.confirm(confirmMessage)) {
      try {
        await contractService.deleteContract(contractId);
        setContracts(contracts.filter(c => c.id !== contractId));
      } catch (error) {
        console.error('Error deleting contract:', error);
        alert('Une erreur est survenue lors de la suppression du contrat');
      }
    }
  };

  const getChildName = (childId: string) => {
    const child = authState.family.find(user => user.id === childId);
    return child ? child.name : 'Inconnu';
  };

  const getParentName = (parentId: string) => {
    const parent = authState.family.find(user => user.id === parentId);
    return parent ? parent.name : 'Inconnu';
  };

  const getChildren = () => {
    return authState.family.filter(user => !user.isParent);
  };

  const getParents = () => {
    return authState.family.filter(user => user.isParent);
  };

  const getSelectedRules = () => {
    return availableRules.filter(rule => formData.ruleIds.includes(rule.id));
  };

  if (loading) {
    return <Typography>Chargement...</Typography>;
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" gutterBottom>
            Contrats
          </Typography>
          {authState.currentUser?.isParent && (
            <Button 
              variant="contained" 
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
            >
              Nouveau contrat
            </Button>
          )}
        </Box>
        <Typography variant="subtitle1">
          Gérez les contrats entre parents et enfants
        </Typography>
      </Box>

      {contracts.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Aucun contrat à afficher
          </Typography>
          {authState.currentUser?.isParent && (
            <Button 
              variant="outlined" 
              startIcon={<Add />} 
              sx={{ mt: 2 }}
              onClick={() => handleOpenDialog()}
            >
              Créer un contrat
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {contracts.map(contract => (
            <Grid size={{ xs: 12, md: 6 }} key={contract.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  opacity: contract.active ? 1 : 0.7
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="div">
                      {contract.title}
                    </Typography>
                    <Chip 
                      label={contract.active ? 'Actif' : 'Inactif'} 
                      color={contract.active ? 'success' : 'error'} 
                      size="small" 
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Entre {getChildName(contract.childId)} et {getParentName(contract.parentId)}
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Récompense journalière:</strong> {contract.dailyReward}€
                  </Typography>
                  
                  <Typography variant="body2" gutterBottom>
                    <strong>Période:</strong> Du {format(parseISO(contract.startDate), 'd MMMM yyyy', { locale: fr })} au {format(parseISO(contract.endDate), 'd MMMM yyyy', { locale: fr })}
                  </Typography>
                  
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                    Règles:
                  </Typography>
                  
                  <List dense>
                    {contract.rules.map(rule => (
                      <ListItem key={rule.id}>
                        <ListItemText 
                          primary={rule.description}
                          secondary={rule.isTask ? 'Tâche à accomplir' : 'Règle à respecter'}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
                
                {authState.currentUser?.isParent && (
                  <CardActions>
                    {contract.active ? (
                      <>
                        <Button 
                          size="small" 
                          startIcon={<Edit />}
                          onClick={() => handleOpenDialog(contract)}
                        >
                          Modifier
                        </Button>
                        <Button 
                          size="small" 
                          color="warning" 
                          onClick={() => handleDeactivateContract(contract.id)}
                        >
                          Désactiver
                        </Button>
                        <Button 
                          size="small" 
                          color="error" 
                          startIcon={<Delete />}
                          onClick={() => handleDeleteContract(contract.id)}
                        >
                          Supprimer
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="small" 
                        color="error" 
                        startIcon={<Delete />}
                        onClick={() => handleDeleteContract(contract.id)}
                      >
                        Supprimer
                      </Button>
                    )}
                  </CardActions>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialogue de création/modification de contrat */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedContract ? 'Modifier le contrat' : 'Nouveau contrat'}
        </DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="title"
              label="Titre du contrat"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
            />
            
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth margin="normal" required>
                  <InputLabel id="child-label">Enfant</InputLabel>
                  <Select
                    labelId="child-label"
                    id="childId"
                    name="childId"
                    value={formData.childId}
                    label="Enfant"
                    onChange={handleSelectChange}
                  >
                    {getChildren().map(child => (
                      <MenuItem key={child.id} value={child.id}>
                        {child.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth margin="normal" required>
                  <InputLabel id="parent-label">Parent</InputLabel>
                  <Select
                    labelId="parent-label"
                    id="parentId"
                    name="parentId"
                    value={formData.parentId}
                    label="Parent"
                    onChange={handleSelectChange}
                  >
                    {getParents().map(parent => (
                      <MenuItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="dailyReward"
                  label="Récompense journalière (€)"
                  name="dailyReward"
                  type="number"
                  inputProps={{ min: 0, step: 0.1 }}
                  value={formData.dailyReward}
                  onChange={handleInputChange}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="startDate"
                  label="Date de début"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="endDate"
                  label="Date de fin"
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            
            <FormControl fullWidth margin="normal" required>
              <InputLabel id="rules-label">Règles du contrat</InputLabel>
              <Select
                labelId="rules-label"
                id="ruleIds"
                multiple
                value={formData.ruleIds}
                onChange={handleRuleSelectChange}
                input={<OutlinedInput label="Règles du contrat" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const rule = availableRules.find(r => r.id === value);
                      return (
                        <Chip 
                          key={value} 
                          label={rule?.description || value}
                          size="small"
                          color={rule?.isTask ? 'primary' : 'secondary'}
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {availableRules.map((rule) => (
                  <MenuItem key={rule.id} value={rule.id}>
                    <Checkbox checked={formData.ruleIds.indexOf(rule.id) > -1} />
                    <ListItemText 
                      primary={rule.description}
                      secondary={rule.isTask ? 'Tâche à accomplir' : 'Règle à respecter'}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {availableRules.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Aucune règle disponible. Créez d'abord des règles dans la section "Gestion des Règles".
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annuler</Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedContract ? 'Mettre à jour' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Contracts;