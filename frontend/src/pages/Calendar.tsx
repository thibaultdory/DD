import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  ToggleButton, 
  ToggleButtonGroup, 
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Avatar
} from '@mui/material';
import { 
  CheckCircle, 
  Cancel, 
  Assignment, 
  EmojiEvents, 
  Warning,
  Info,
  Check
} from '@mui/icons-material';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Task, Privilege, RuleViolation, User, Rule } from '../types';
import { 
  taskService, 
  privilegeService, 
  ruleViolationService, 
  ruleService 
} from '../services/api';
import Layout from '../components/Layout/Layout';

const Calendar: React.FC = () => {
  const { authState } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'personal' | 'family'>('personal');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItemType, setSelectedItemType] = useState<'task' | 'privilege' | 'violation' | null>(null);

  // Récupérer les enfants de la famille
  const children = authState.family.filter(user => !user.isParent);

  // Générer les jours de la semaine
  const startOfCurrentWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(startOfCurrentWeek, i));

  useEffect(() => {
    // Si l'utilisateur est un parent et qu'il y a des enfants, sélectionner le premier enfant par défaut
    if (authState.currentUser?.isParent && children.length > 0 && !selectedChild && viewMode === 'personal') {
      setSelectedChild(children[0].id);
    }
  }, [authState.currentUser, children, selectedChild, viewMode]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (authState.currentUser) {
          // Récupérer les règles (communes à tous)
          const fetchedRules = await ruleService.getRules();
          setRules(fetchedRules);

          let fetchedTasks: Task[] = [];
          let fetchedPrivileges: Privilege[] = [];
          let fetchedViolations: RuleViolation[] = [];

          if (viewMode === 'personal') {
            // Vue personnelle
            const userId = authState.currentUser.isParent && selectedChild 
              ? selectedChild 
              : authState.currentUser.id;
            
            fetchedTasks = await taskService.getUserTasks(userId);
            fetchedPrivileges = await privilegeService.getUserPrivileges(userId);
            fetchedViolations = await ruleViolationService.getChildRuleViolations(userId);
          } else {
            // Vue familiale
            fetchedTasks = await taskService.getTasks();
            fetchedPrivileges = await privilegeService.getPrivileges();
            fetchedViolations = await ruleViolationService.getRuleViolations();
          }

          setTasks(fetchedTasks);
          setPrivileges(fetchedPrivileges);
          setViolations(fetchedViolations);
        }
      } catch (error) {
        console.error('Error fetching calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // S'abonner aux changements de données
    const unsubscribeTasks = taskService.subscribe(() => {
      if (authState.currentUser) {
        if (viewMode === 'personal') {
          const userId = authState.currentUser.isParent && selectedChild 
            ? selectedChild 
            : authState.currentUser.id;
          taskService.getUserTasks(userId).then(setTasks);
        } else {
          taskService.getTasks().then(setTasks);
        }
      }
    });

    const unsubscribePrivileges = privilegeService.subscribe(() => {
      if (authState.currentUser) {
        if (viewMode === 'personal') {
          const userId = authState.currentUser.isParent && selectedChild 
            ? selectedChild 
            : authState.currentUser.id;
          privilegeService.getUserPrivileges(userId).then(setPrivileges);
        } else {
          privilegeService.getPrivileges().then(setPrivileges);
        }
      }
    });

    const unsubscribeViolations = ruleViolationService.subscribe(() => {
      if (authState.currentUser) {
        if (viewMode === 'personal') {
          const userId = authState.currentUser.isParent && selectedChild 
            ? selectedChild 
            : authState.currentUser.id;
          ruleViolationService.getChildRuleViolations(userId).then(setViolations);
        } else {
          ruleViolationService.getRuleViolations().then(setViolations);
        }
      }
    });

    return () => {
      unsubscribeTasks();
      unsubscribePrivileges();
      unsubscribeViolations();
    };
  }, [authState.currentUser, viewMode, selectedChild]);

  const handleViewModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: 'personal' | 'family',
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
      // Réinitialiser l'enfant sélectionné si on passe en vue familiale
      if (newMode === 'family') {
        setSelectedChild(null);
      }
    }
  };

  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId);
      // La mise à jour des tâches sera gérée par l'abonnement
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handleItemClick = (item: any, type: 'task' | 'privilege' | 'violation') => {
    setSelectedItem(item);
    setSelectedItemType(type);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedItem(null);
    setSelectedItemType(null);
  };

  const getTasksForDay = (date: Date) => {
    return tasks.filter(task => isSameDay(parseISO(task.dueDate), date));
  };

  const getPrivilegesForDay = (date: Date) => {
    return privileges.filter(privilege => isSameDay(parseISO(privilege.date), date));
  };

  const getViolationsForDay = (date: Date) => {
    return violations.filter(violation => isSameDay(parseISO(violation.date), date));
  };

  // Fonction pour obtenir le nom de l'utilisateur à partir de son ID
  const getUserName = (userId: string): string => {
    const user = authState.family.find(u => u.id === userId);
    return user ? user.name : 'Inconnu';
  };

  // Fonction pour obtenir le nom de la règle à partir de son ID
  const getRuleName = (ruleId: string): string => {
    const rule = rules.find(r => r.id === ruleId);
    return rule ? rule.description : ruleId;
  };

  if (loading) {
    return <Typography>Chargement...</Typography>;
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Calendrier
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            aria-label="Mode d'affichage"
          >
            <ToggleButton value="personal" aria-label="Vue personnelle">
              Vue personnelle
            </ToggleButton>
            <ToggleButton value="family" aria-label="Vue familiale">
              Vue familiale
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Sélecteur d'enfant pour les parents en vue personnelle */}
      {authState.currentUser?.isParent && viewMode === 'personal' && children.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ mr: 2 }}>
            Afficher le calendrier de :
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {children.map(child => (
              <Tooltip key={child.id} title={child.name}>
                <Avatar
                  src={child.profilePicture}
                  alt={child.name}
                  sx={{ 
                    width: 40, 
                    height: 40, 
                    cursor: 'pointer',
                    border: selectedChild === child.id ? '2px solid #1976d2' : 'none',
                    opacity: selectedChild === child.id ? 1 : 0.6
                  }}
                  onClick={() => handleChildSelect(child.id)}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {weekDays.map((day) => (
                <TableCell key={day.toString()} align="center">
                  <Typography variant="subtitle1">
                    {format(day, 'EEEE', { locale: fr })}
                  </Typography>
                  <Typography variant="body2">
                    {format(day, 'd MMMM', { locale: fr })}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              {weekDays.map((day) => {
                const dayTasks = getTasksForDay(day);
                const dayPrivileges = getPrivilegesForDay(day);
                const dayViolations = getViolationsForDay(day);
                
                return (
                  <TableCell key={day.toString()} sx={{ height: '200px', verticalAlign: 'top' }}>
                    <Box sx={{ minHeight: '100%', p: 1 }}>
                      {/* Tâches */}
                      {dayTasks.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center' }}>
                            <Assignment fontSize="small" sx={{ mr: 0.5 }} />
                            Tâches
                          </Typography>
                          {dayTasks.map(task => (
                            <Box 
                              key={task.id} 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                mb: 0.5,
                                p: 0.5,
                                borderRadius: 1,
                                bgcolor: task.completed ? 'success.light' : 'error.light',
                                opacity: task.completed ? 0.7 : 1
                              }}
                            >
                              {task.completed ? (
                                <CheckCircle fontSize="small" color="success" sx={{ mr: 0.5 }} />
                              ) : (
                                <Cancel fontSize="small" color="error" sx={{ mr: 0.5 }} />
                              )}
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  flexGrow: 1,
                                  textDecoration: task.completed ? 'line-through' : 'none'
                                }}
                              >
                                {task.title}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {viewMode === 'family' && (
                                  <Chip 
                                    label={getUserName(task.assignedTo[0])} 
                                    size="small" 
                                    sx={{ mr: 0.5 }}
                                  />
                                )}
                                <Tooltip title="Voir détails">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleItemClick(task, 'task')}
                                  >
                                    <Info fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {!task.completed && (
                                  <Tooltip title="Marquer comme terminé">
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleCompleteTask(task.id)}
                                    >
                                      <Check fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {/* Privilèges */}
                      {dayPrivileges.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center' }}>
                            <EmojiEvents fontSize="small" sx={{ mr: 0.5 }} />
                            Privilèges
                          </Typography>
                          {dayPrivileges.map(privilege => (
                            <Box 
                              key={privilege.id} 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                mb: 0.5,
                                p: 0.5,
                                borderRadius: 1,
                                bgcolor: privilege.earned ? 'success.light' : 'warning.light'
                              }}
                            >
                              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                {privilege.title}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {viewMode === 'family' && (
                                  <Chip 
                                    label={getUserName(privilege.assignedTo)} 
                                    size="small" 
                                    sx={{ mr: 0.5 }}
                                  />
                                )}
                                <Tooltip title="Voir détails">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleItemClick(privilege, 'privilege')}
                                  >
                                    <Info fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {/* Infractions */}
                      {dayViolations.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center' }}>
                            <Warning fontSize="small" sx={{ mr: 0.5 }} />
                            Infractions
                          </Typography>
                          {dayViolations.map(violation => (
                            <Box 
                              key={violation.id} 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                mb: 0.5,
                                p: 0.5,
                                borderRadius: 1,
                                bgcolor: 'error.light'
                              }}
                            >
                              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                {getRuleName(violation.ruleId)}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {viewMode === 'family' && (
                                  <Chip 
                                    label={getUserName(violation.childId)} 
                                    size="small" 
                                    sx={{ mr: 0.5 }}
                                  />
                                )}
                                <Tooltip title="Voir détails">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleItemClick(violation, 'violation')}
                                  >
                                    <Info fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}

                      {dayTasks.length === 0 && dayPrivileges.length === 0 && dayViolations.length === 0 && (
                        <Typography variant="body2" color="text.secondary" align="center">
                          Aucun événement
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialogue de détails */}
      <Dialog open={detailsOpen} onClose={handleCloseDetails}>
        <DialogTitle>
          {selectedItemType === 'task' && 'Détails de la tâche'}
          {selectedItemType === 'privilege' && 'Détails du privilège'}
          {selectedItemType === 'violation' && 'Détails de l\'infraction'}
        </DialogTitle>
        <DialogContent>
          {selectedItem && selectedItemType === 'task' && (
            <>
              <Typography variant="h6">{selectedItem.title}</Typography>
              {selectedItem.description && (
                <Typography variant="body1" paragraph>
                  {selectedItem.description}
                </Typography>
              )}
              <Typography variant="body2">
                <strong>Statut:</strong> {selectedItem.completed ? 'Terminé' : 'À faire'}
              </Typography>
              <Typography variant="body2">
                <strong>Date d'échéance:</strong> {selectedItem.dueDate}
              </Typography>
              <Typography variant="body2">
                <strong>Assigné à:</strong> {selectedItem.assignedTo.map((id: string) => getUserName(id)).join(', ')}
              </Typography>
              <Typography variant="body2">
                <strong>Créé par:</strong> {getUserName(selectedItem.createdBy)}
              </Typography>
            </>
          )}

          {selectedItem && selectedItemType === 'privilege' && (
            <>
              <Typography variant="h6">{selectedItem.title}</Typography>
              {selectedItem.description && (
                <Typography variant="body1" paragraph>
                  {selectedItem.description}
                </Typography>
              )}
              <Typography variant="body2">
                <strong>Statut:</strong> {selectedItem.earned ? 'Mérité' : 'Non mérité'}
              </Typography>
              <Typography variant="body2">
                <strong>Date:</strong> {selectedItem.date}
              </Typography>
              <Typography variant="body2">
                <strong>Assigné à:</strong> {getUserName(selectedItem.assignedTo)}
              </Typography>
            </>
          )}

          {selectedItem && selectedItemType === 'violation' && (
            <>
              <Typography variant="h6">Infraction: {getRuleName(selectedItem.ruleId)}</Typography>
              {selectedItem.description && (
                <Typography variant="body1" paragraph>
                  {selectedItem.description}
                </Typography>
              )}
              <Typography variant="body2">
                <strong>Date:</strong> {selectedItem.date}
              </Typography>
              <Typography variant="body2">
                <strong>Enfant:</strong> {getUserName(selectedItem.childId)}
              </Typography>
              <Typography variant="body2">
                <strong>Signalé par:</strong> {getUserName(selectedItem.reportedBy)}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails}>Fermer</Button>
          {selectedItemType === 'task' && !selectedItem.completed && (
            <Button 
              onClick={() => {
                handleCompleteTask(selectedItem.id);
                handleCloseDetails();
              }}
              color="primary"
            >
              Marquer comme terminé
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Calendar;