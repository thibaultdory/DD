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
  Chip,
  OutlinedInput,
  SelectChangeEvent,
  Alert,
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { taskService } from '../services/api';
import Layout from '../components/Layout/Layout';
import { format } from 'date-fns';

const TaskForm: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const isEditing = !!taskId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Récupérer les enfants de la famille
  const children = authState.family.filter(user => !user.isParent);

  useEffect(() => {
    const fetchTask = async () => {
      if (isEditing && taskId) {
        try {
          setLoading(true);
          const tasksResponse = await taskService.getTasks();
          const tasksList = Array.isArray(tasksResponse) ? tasksResponse : (tasksResponse.tasks || []);
          const task = tasksList.find((t: any) => t.id === taskId);
          
          if (task) {
            setTitle(task.title);
            setDescription(task.description || '');
            setDueDate(new Date(task.dueDate));
            setAssignedTo(task.assignedTo);
            setIsRecurring(task.isRecurring);
            setWeekdays(task.weekdays || []);
          } else {
            setError('Tâche non trouvée');
          }
        } catch (error) {
          console.error('Error fetching task:', error);
          setError('Erreur lors de la récupération de la tâche');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchTask();
  }, [isEditing, taskId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }
    
    if (assignedTo.length === 0) {
      setError('Veuillez assigner la tâche à au moins un enfant');
      return;
    }
    
    if (!dueDate) {
      setError('La date d\'échéance est requise');
      return;
    }

    if (isRecurring && weekdays.length === 0) {
      setError('Veuillez sélectionner au moins un jour de répétition');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const formattedDueDate = format(dueDate, 'yyyy-MM-dd');
      
      if (isEditing && taskId) {
        await taskService.updateTask(taskId, {
          title,
          description,
          dueDate: formattedDueDate,
          assignedTo,
          isRecurring,
          weekdays: isRecurring ? weekdays : undefined
        });
        setSuccess('Tâche mise à jour avec succès');
      } else {
        await taskService.createTask({
          title,
          description,
          dueDate: formattedDueDate,
          assignedTo,
          completed: false,
          createdBy: authState.currentUser?.id || '',
          isRecurring,
          weekdays: isRecurring ? weekdays : undefined
        });
        setSuccess('Tâche créée avec succès');
      }
      
      // Rediriger après un court délai pour montrer le message de succès
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('Error saving task:', error);
      setError('Erreur lors de l\'enregistrement de la tâche');
    } finally {
      setLoading(false);
    }
  };
\
  const handleDelete = async () => {
    if (!taskId) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await taskService.deleteTask(taskId);
      setSuccess('Tâche supprimée avec succès');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('Error deleting task:', error);
      setError('Erreur lors de la suppression de la tâche');
    } finally {
      setLoading(false);
    }
  };


  const handleAssignedToChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setAssignedTo(typeof value === 'string' ? value.split(',') : value);
  };

  if (!authState.currentUser?.isParent) {
    return (
      <Layout>
        <Alert severity="warning">
          Seuls les parents peuvent créer ou modifier des tâches
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {isEditing ? 'Modifier la tâche' : 'Nouvelle tâche'}
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
              multiple
              value={assignedTo}
              onChange={handleAssignedToChange}
              input={<OutlinedInput label="Assigné à" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const child = children.find(c => c.id === value);
                    return (
                      <Chip key={value} label={child ? child.name : value} />
                    );
                  })}
                </Box>
              )}
            >
              {children.map((child) => (
                <MenuItem key={child.id} value={child.id}>
                  {child.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Sélectionnez les enfants à qui assigner cette tâche</FormHelperText>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
            }
            label="Tâche récurrente"
            sx={{ mt: 2, mb: 1 }}
          />

          {isRecurring && (
            <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Jours de répétition
              </Typography>
              <ToggleButtonGroup
                value={weekdays}
                onChange={(_, newWeekdays) => setWeekdays(newWeekdays)}
                aria-label="jours de la semaine"
              >
                <ToggleButton value={1} aria-label="lundi">L</ToggleButton>
                <ToggleButton value={2} aria-label="mardi">M</ToggleButton>
                <ToggleButton value={3} aria-label="mercredi">M</ToggleButton>
                <ToggleButton value={4} aria-label="jeudi">J</ToggleButton>
                <ToggleButton value={5} aria-label="vendredi">V</ToggleButton>
                <ToggleButton value={6} aria-label="samedi">S</ToggleButton>
                <ToggleButton value={7} aria-label="dimanche">D</ToggleButton>
              </ToggleButtonGroup>
              <FormHelperText>
                Sélectionnez les jours où la tâche doit être répétée
              </FormHelperText>
            </FormControl>
          )}

          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
              label={isRecurring ? "Date de début" : "Date d'échéance"}
              value={dueDate}
              onChange={(newValue) => setDueDate(newValue)}
              sx={{ mt: 2, width: '100%' }}
            />
          </LocalizationProvider>
          
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {isEditing && (
                <Button 
                  variant="outlined" 
                  color="error"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  Supprimer
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant="outlined" 
                onClick={() => navigate('/')}
                disabled={loading} // Also disable cancel when loading
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
          </Box>
        </form>
      </Paper>
    </Layout>
  );
};

export default TaskForm;