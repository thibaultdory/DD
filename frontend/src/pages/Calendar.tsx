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
  Undo
} from '@mui/icons-material';
import { format, startOfWeek, addDays, isSameDay, parseISO, isPast, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false); // For partial updates
  const [viewMode, setViewMode] = useState<'personal' | 'family'>('personal');
  const [selectedDate] = useState(new Date());
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItemType, setSelectedItemType] = useState<'task' | 'privilege' | 'violation' | null>(null);

  // Cache for family data to avoid refetching
  const [familyDataCache, setFamilyDataCache] = useState<{
    tasks: Task[] | null;
    privileges: Privilege[] | null;
    violations: RuleViolation[] | null;
  }>({
    tasks: null,
    privileges: null,
    violations: null
  });

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

  // Initial data loading only
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!authState.currentUser) return;
      setLoading(true);
      try {
        // Fetch rules (only once)
        const fetchedRules = await ruleService.getRules();
        setRules(fetchedRules);

        // Fetch family data and cache it
        const [tasksResponse, privilegesResponse, violationsResponse] = await Promise.all([
          taskService.getTasksForCalendar(),
          privilegeService.getPrivilegesForCalendar(),
          ruleViolationService.getRuleViolationsForCalendar()
        ]);

        const allTasks = Array.isArray(tasksResponse) ? tasksResponse : [];
        const allPrivileges = Array.isArray(privilegesResponse) ? privilegesResponse : [];
        const allViolations = Array.isArray(violationsResponse) ? violationsResponse : [];

        // Cache family data
        setFamilyDataCache({
          tasks: allTasks,
          privileges: allPrivileges,
          violations: allViolations
        });

        // Set initial data based on current view mode
        if (viewMode === 'family') {
          setTasks(allTasks);
          setPrivileges(allPrivileges);
          setViolations(allViolations);
        } else {
          // Personal view - filter data
          const userId = authState.currentUser.isParent && selectedChild 
            ? selectedChild 
            : authState.currentUser.id;
          
          const filteredTasks = allTasks.filter(task => task.assignedTo.includes(userId));
          setTasks(filteredTasks);

          // For personal view, we still need to fetch individual privileges and violations
          try {
            const personalPrivilegesResponse = await privilegeService.getUserPrivileges(userId);
            const personalViolationsResponse = await ruleViolationService.getChildRuleViolations(userId);
            
            setPrivileges(Array.isArray(personalPrivilegesResponse) ? personalPrivilegesResponse : (personalPrivilegesResponse.privileges || []));
            setViolations(Array.isArray(personalViolationsResponse) ? personalViolationsResponse : (personalViolationsResponse.violations || []));
          } catch (err) {
            console.error('Error fetching personal data:', err);
          }
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [authState.currentUser]); // Only depend on current user for initial load

  // Handle view mode and selected child changes (without full reload)
  useEffect(() => {
    const updateViewData = async () => {
      if (!authState.currentUser || loading) return; // Skip if still loading initially
      
      setDataLoading(true);
      try {
        if (viewMode === 'family') {
          // Use cached family data
          if (familyDataCache.tasks) {
            setTasks(familyDataCache.tasks);
            setPrivileges(familyDataCache.privileges || []);
            setViolations(familyDataCache.violations || []);
          }
        } else {
          // Personal view - filter from cache or fetch if needed
          const userId = authState.currentUser.isParent && selectedChild 
            ? selectedChild 
            : authState.currentUser.id;

          if (familyDataCache.tasks) {
            // Filter tasks from cache
            const filteredTasks = familyDataCache.tasks.filter(task => task.assignedTo.includes(userId));
            setTasks(filteredTasks);
          }

          // Fetch fresh personal privileges and violations
          try {
            const [personalPrivilegesResponse, personalViolationsResponse] = await Promise.all([
              privilegeService.getUserPrivileges(userId),
              ruleViolationService.getChildRuleViolations(userId)
            ]);
            
            setPrivileges(Array.isArray(personalPrivilegesResponse) ? personalPrivilegesResponse : (personalPrivilegesResponse.privileges || []));
            setViolations(Array.isArray(personalViolationsResponse) ? personalViolationsResponse : (personalViolationsResponse.violations || []));
          } catch (err) {
            console.error('Error fetching personal data:', err);
          }
        }
      } finally {
        setDataLoading(false);
      }
    };

    updateViewData();
  }, [viewMode, selectedChild, familyDataCache]); // React to view changes

  // Subscription for real-time updates (separate from view changes)
  useEffect(() => {
    if (!authState.currentUser) return;

    const unsubscribeTasks = taskService.subscribe(() => {
      // Refresh family data cache
      taskService.getTasksForCalendar().then(response => {
        const allTasks = Array.isArray(response) ? response : [];
        setFamilyDataCache(prev => ({ ...prev, tasks: allTasks }));
        
        // Update current view
        if (viewMode === 'family') {
          setTasks(allTasks);
        } else if (authState.currentUser) {
          const userId = authState.currentUser.isParent && selectedChild 
            ? selectedChild 
            : authState.currentUser.id;
          const filteredTasks = allTasks.filter(task => task.assignedTo.includes(userId));
          setTasks(filteredTasks);
        }
      });
    });

    const unsubscribePrivileges = privilegeService.subscribe(() => {
      if (viewMode === 'family') {
        privilegeService.getPrivilegesForCalendar().then(response => {
          const privileges = Array.isArray(response) ? response : [];
          setFamilyDataCache(prev => ({ ...prev, privileges }));
          setPrivileges(privileges);
        });
      } else if (authState.currentUser) {
        const userId = authState.currentUser.isParent && selectedChild 
          ? selectedChild 
          : authState.currentUser.id;
        privilegeService.getUserPrivileges(userId).then(response => {
          const privileges = Array.isArray(response) ? response : (response.privileges || []);
          setPrivileges(privileges);
        });
      }
    });

    const unsubscribeViolations = ruleViolationService.subscribe(() => {
      if (viewMode === 'family') {
        ruleViolationService.getRuleViolationsForCalendar().then(response => {
          const violations = Array.isArray(response) ? response : [];
          setFamilyDataCache(prev => ({ ...prev, violations }));
          setViolations(violations);
        });
      } else if (authState.currentUser) {
        const userId = authState.currentUser.isParent && selectedChild 
          ? selectedChild 
          : authState.currentUser.id;
        ruleViolationService.getChildRuleViolations(userId).then(response => {
          const violations = Array.isArray(response) ? response : (response.violations || []);
          setViolations(violations);
        });
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
    // Check if user has permission to modify this task
    if (task.canModify === false) {
      console.warn('User does not have permission to modify this task');
      return;
    }
    
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
    const dayPrivileges = Array.isArray(privileges) ? privileges.filter(privilege => isSameDay(parseISO(privilege.date), date)) : [];
    // Filter out privileges that children can't view in family mode
    if (!authState.currentUser?.isParent && viewMode === 'family') {
      return dayPrivileges.filter(privilege => privilege.canView !== false);
    }
    return dayPrivileges;
  };

  const getViolationsForDay = (date: Date) => {
    const dayViolations = Array.isArray(violations) ? violations.filter(violation => isSameDay(parseISO(violation.date), date)) : [];
    // Filter out violations that children can't view in family mode
    if (!authState.currentUser?.isParent && viewMode === 'family') {
      return dayViolations.filter(violation => violation.canView !== false);
    }
    return dayViolations;
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

  console.log('Calendar tasks to display:', tasks);

  if (loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <Typography>Chargement...</Typography>
        </Box>
      </Layout>
    );
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
            disabled={dataLoading}
          >
            <ToggleButton value="personal" aria-label="Vue personnelle">
              Vue personnelle
            </ToggleButton>
            <ToggleButton value="family" aria-label="Vue familiale">
              Vue familiale
            </ToggleButton>
          </ToggleButtonGroup>
          
          {dataLoading && (
            <Typography variant="body2" color="text.secondary">
              Mise à jour...
            </Typography>
          )}
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
                    cursor: dataLoading ? 'default' : 'pointer',
                    border: selectedChild === child.id ? '2px solid #1976d2' : 'none',
                    opacity: dataLoading ? 0.5 : (selectedChild === child.id ? 1 : 0.6)
                  }}
                  onClick={dataLoading ? undefined : () => handleChildSelect(child.id)}
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
                                {/* Only show completion buttons if user can modify the task */}
                                {task.canModify !== false && (
                                  <>
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
                                  </>
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