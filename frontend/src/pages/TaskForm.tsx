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
  FormControlLabel
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
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
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
          const tasks = await taskService.getTasks();
          const task = tasks.find(t => t.id === taskId);
          
          if (task) {
            setTitle(task.title);
            setDescription(task.description || '');
            setDueDate(new Date(task.dueDate));
            setAssignedTo(task.assignedTo);
            if (task.recurrence) {
              setIsRecurring(true);
              setRecurrenceInterval(task.recurrence.interval || 1);
            }
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

    try {
      setLoading(true);
      setError(null);
      
      const formattedDueDate = format(dueDate, 'yyyy-MM-dd');
      
      // Préparer le pattern de récurrence si nécessaire
      const recurrence = isRecurring ? {
        type: 'weekly' as const,
        dayOfWeek: dueDate.getDay(),
        interval: recurrenceInterval
      } : undefined;
      
      if (isEditing && taskId) {
        await taskService.updateTask(taskId, {
          title,
          description,
          dueDate: formattedDueDate,
          assignedTo,
          recurrence
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
          recurrence
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
          
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
              label="Date d'échéance"
              value={dueDate}
              onChange={(newValue) => setDueDate(newValue)}
              sx={{ mt: 2, width: '100%' }}
            />
          </LocalizationProvider>

          <FormControl fullWidth margin="normal">
            <FormControlLabel
              control={
                <Switch
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
              }
              label="Tâche récurrente"
            />
          </FormControl>

          {isRecurring && (
            <FormControl fullWidth margin="normal">
              <InputLabel id="recurrence-interval-label">Répéter toutes les</InputLabel>
              <Select
                labelId="recurrence-interval-label"
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                label="Répéter toutes les"
              >
                {[1, 2, 3, 4].map((interval) => (
                  <MenuItem key={interval} value={interval}>
                    {interval} {interval === 1 ? 'semaine' : 'semaines'}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                La tâche sera répétée le même jour de la semaine toutes les {recurrenceInterval} semaine{recurrenceInterval > 1 ? 's' : ''}
              </FormHelperText>
            </FormControl>
          )}
          
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

export default TaskForm;