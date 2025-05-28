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
  ToggleButtonGroup,
  RadioGroup,
  Radio
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { taskService } from '../services/api';
import Layout from '../components/Layout/Layout';
import { format, addWeeks, addMonths, addYears } from 'date-fns';

const TaskForm: React.FC = () => {
  const { authState, getEffectiveCurrentUser } = useAuth();
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const isEditing = Boolean(taskId);

  // Get the effective current user (considering PIN authentication)
  const effectiveUser = getEffectiveCurrentUser();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(new Date());
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endDateMode, setEndDateMode] = useState<'duration' | 'specific'>('duration');
  const [durationNumber, setDurationNumber] = useState<number>(4);
  const [durationUnit, setDurationUnit] = useState<'weeks' | 'months' | 'years'>('weeks');
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
            if (task.endDate) {
              setEndDate(new Date(task.endDate));
              setEndDateMode('specific');
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

  // Calculate end date when duration changes
  useEffect(() => {
    if (isRecurring && endDateMode === 'duration' && dueDate) {
      let calculatedEndDate: Date;
      switch (durationUnit) {
        case 'weeks':
          calculatedEndDate = addWeeks(dueDate, durationNumber);
          break;
        case 'months':
          calculatedEndDate = addMonths(dueDate, durationNumber);
          break;
        case 'years':
          calculatedEndDate = addYears(dueDate, durationNumber);
          break;
        default:
          calculatedEndDate = addWeeks(dueDate, durationNumber);
      }
      setEndDate(calculatedEndDate);
    }
  }, [isRecurring, endDateMode, durationNumber, durationUnit, dueDate]);

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

    if (isRecurring && !endDate) {
      setError('Veuillez définir une date de fin pour la tâche récurrente');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const formattedDueDate = format(dueDate, 'yyyy-MM-dd');
      const formattedEndDate = endDate && isRecurring ? format(endDate, 'yyyy-MM-dd') : undefined;
      
      if (isEditing && taskId) {
        await taskService.updateTask(taskId, {
          title,
          description,
          dueDate: formattedDueDate,
          assignedTo,
          isRecurring,
          weekdays: isRecurring ? weekdays : undefined,
          endDate: formattedEndDate
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
          weekdays: isRecurring ? weekdays : undefined,
          endDate: formattedEndDate
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

  // Only parents can access this page
  if (!effectiveUser?.isParent) {
    return (
      <Layout>
        <Typography variant="h4" color="error">
          Accès non autorisé
        </Typography>
        <Typography>
          Seuls les parents peuvent créer ou modifier des tâches.
        </Typography>
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

          {isRecurring && (
            <Box sx={{ mt: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Date de fin de la récurrence
              </Typography>
              
              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <RadioGroup
                  value={endDateMode}
                  onChange={(e) => setEndDateMode(e.target.value as 'duration' | 'specific')}
                  row
                >
                  <FormControlLabel
                    value="duration"
                    control={<Radio />}
                    label="Durée"
                  />
                  <FormControlLabel
                    value="specific"
                    control={<Radio />}
                    label="Date spécifique"
                  />
                </RadioGroup>
              </FormControl>

              {endDateMode === 'duration' ? (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      label="Nombre"
                      type="number"
                      value={durationNumber}
                      onChange={(e) => setDurationNumber(Math.max(1, parseInt(e.target.value) || 1))}
                      inputProps={{ min: 1 }}
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <FormControl fullWidth>
                      <InputLabel>Unité</InputLabel>
                      <Select
                        value={durationUnit}
                        label="Unité"
                        onChange={(e) => setDurationUnit(e.target.value as 'weeks' | 'months' | 'years')}
                      >
                        <MenuItem value="weeks">Semaines</MenuItem>
                        <MenuItem value="months">Mois</MenuItem>
                        <MenuItem value="years">Années</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              ) : (
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
                  <DatePicker
                    label="Date de fin"
                    value={endDate}
                    onChange={(newValue) => setEndDate(newValue)}
                    minDate={dueDate || new Date()}
                    sx={{ width: '100%' }}
                  />
                </LocalizationProvider>
              )}

              {endDate && endDateMode === 'duration' && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  La tâche se répétera jusqu'au {format(endDate, 'dd/MM/yyyy', { locale: fr })}
                </Typography>
              )}
            </Box>
          )}

          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
              label={isRecurring ? "Date de début" : "Date d'échéance"}
              value={dueDate}
              onChange={(newValue) => setDueDate(newValue)}
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

export default TaskForm;