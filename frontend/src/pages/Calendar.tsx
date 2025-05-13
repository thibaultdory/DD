import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
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
  Check,
  Undo,
  Edit, // Add Edit icon
  Delete // Add Delete icon
} from '@mui/icons-material';
import { format, startOfWeek, addDays, isSameDay, parseISO, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Task, Privilege, RuleViolation, Rule } from '../types';
import { 
  taskService, 
  privilegeService, 
  ruleViolationService, 
  ruleService 
} from '../services/api';
import Layout from '../components/Layout/Layout';

const Calendar: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'personal' | 'family'>('personal');
  const [selectedDate] = useState(new Date());
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
            
            const tasksResponse = await taskService.getUserTasks(userId);
            fetchedTasks = Array.isArray(tasksResponse) ? tasksResponse : (tasksResponse.tasks || []);
            const privilegesResponse = await privilegeService.getUserPrivileges(userId);
            fetchedPrivileges = Array.isArray(privilegesResponse) ? privilegesResponse : (privilegesResponse.privileges || []);
            const violationsResponse = await ruleViolationService.getChildRuleViolations(userId);
            fetchedViolations = Array.isArray(violationsResponse) ? violationsResponse : (violationsResponse.violations || []);
          } else {
            // Vue familiale
            const tasksResponse = await taskService.getTasks();
            fetchedTasks = Array.isArray(tasksResponse) ? tasksResponse : (tasksResponse.tasks || []);
            const privilegesResponse = await privilegeService.getPrivileges();
            fetchedPrivileges = Array.isArray(privilegesResponse) ? privilegesResponse : (privilegesResponse.privileges || []);
            const violationsResponse = await ruleViolationService.getRuleViolations();
            fetchedViolations = Array.isArray(violationsResponse) ? violationsResponse : (violationsResponse.violations || []);
          }

          setTasks(Array.isArray(fetchedTasks) ? fetchedTasks : []);
          setPrivileges(Array.isArray(fetchedPrivileges) ? fetchedPrivileges : []);
          setViolations(Array.isArray(fetchedViolations) ? fetchedViolations : []);
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
          taskService.getUserTasks(userId).then(response => {
            const tasks = Array.isArray(response) ? response : (response.tasks || []);
            setTasks(tasks);
          });
        } else {
          taskService.getTasks().then(response => {
            const tasks = Array.isArray(response) ? response : (response.tasks || []);
            setTasks(tasks);
          });
        }
      }
    });

    const unsubscribePrivileges = privilegeService.subscribe(() => {
      if (authState.currentUser) {
        if (viewMode === 'personal') {
          const userId = authState.currentUser.isParent && selectedChild 
            ? selectedChild 
            : authState.currentUser.id;
          privilegeService.getUserPrivileges(userId).then(response => {
            const privileges = Array.isArray(response) ? response : (response.privileges || []);
            setPrivileges(privileges);
          });
        } else {
          privilegeService.getPrivileges().then(response => {
            const privileges = Array.isArray(response) ? response : (response.privileges || []);
            setPrivileges(privileges);
          });
        }
      }
    });

    const unsubscribeViolations = ruleViolationService.subscribe(() => {
      if (authState.currentUser) {
        if (viewMode === 'personal') {
          const userId = authState.currentUser.isParent && selectedChild 
            ? selectedChild 
            : authState.currentUser.id;
          ruleViolationService.getChildRuleViolations(userId).then(response => {
            const violations = Array.isArray(response) ? response : (response.violations || []);
            setViolations(violations);
          });
        } else {
          ruleViolationService.getRuleViolations().then(response => {
            const violations = Array.isArray(response) ? response : (response.violations || []);
            setViolations(violations);
          });
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

  const handleToggleTaskComplete = async (task: Task) => {
    try {
      if (task.completed) {
        await taskService.uncompleteTask(task.id);
      } else {
        await taskService.completeTask(task.id);
      }
      // La mise à jour des tâches sera gérée par l'abonnement
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  };

  const handleDeleteTaskInstance = async (taskId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation(); // Prevent dialog from opening
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette instance de tâche ?")) {
      return;
    }
    try {
      await taskService.deleteTaskInstance(taskId);
      // La mise à jour des tâches sera gérée par l'abonnement
      // console.log('Task instance deleted successfully');
      setDetailsOpen(false); // Close dialog if open from a delete action within it (though not planned for now)
    } catch (error) {
      console.error('Error deleting task instance:', error);
      // Afficher une notification d'erreur à l'utilisateur
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
    return Array.isArray(tasks) ? tasks.filter(task => isSameDay(parseISO(task.dueDate), date)) : [];
  };

  const getPrivilegesForDay = (date: Date) => {
    return Array.isArray(privileges) ? privileges.filter(privilege => isSameDay(parseISO(privilege.date), date)) : [];
  };

  const getViolationsForDay = (date: Date) => {
    return Array.isArray(violations) ? violations.filter(violation => isSameDay(parseISO(violation.date), date)) : [];
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
                                {authState.currentUser?.isParent && (
                                  <Tooltip title="Modifier la tâche">
                                    <IconButton 
                                      size="small" 
                                      onClick={() => navigate(`/tasks/edit/${task.id}`)}
                                    >
                                      <Edit fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {authState.currentUser?.isParent && (task.parentTaskId || !task.isRecurring) && (
                                  <Tooltip title="Supprimer cette instance">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => handleDeleteTaskInstance(task.id, e)}
                                    >
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
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
                                {task.completed ? (
                                  <Tooltip title="Marquer comme non terminé">
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleToggleTaskComplete(task)}
                                    >
                                      <Undo fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                ) : (
                                  <Tooltip title={!(isPast(parseISO(task.dueDate)) || isToday(parseISO(task.dueDate))) ? "Impossible de terminer une tâche future" : "Marquer comme terminé"}>
                                    <span> {/* IconButton disabled state needs a span wrapper for Tooltip to work */} 
                                      <IconButton 
                                        size="small" 
                                        onClick={() => handleToggleTaskComplete(task)}
                                        disabled={!(isPast(parseISO(task.dueDate)) || isToday(parseISO(task.dueDate)))}
                                      >
                                        <Check fontSize="small" />
                                      </IconButton>
                                    </span>
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
                                {authState.currentUser?.isParent && (
                                  <Tooltip title="Modifier l'infraction">
                                    <IconButton 
                                      size="small" 
                                      onClick={() => navigate(`/violations/edit/${violation.id}`)}
                                    >
                                      <Edit fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
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
          {selectedItemType === 'task' && selectedItem && (
            <Button 
              onClick={() => {
                handleToggleTaskComplete(selectedItem as Task);
                handleCloseDetails();
              }}
              color="primary"
              disabled={!selectedItem.completed && !(isPast(parseISO(selectedItem.dueDate)) || isToday(parseISO(selectedItem.dueDate)))}
            >
              {selectedItem.completed ? "Marquer comme non terminé" : "Marquer comme terminé"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Calendar;