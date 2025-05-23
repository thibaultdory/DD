import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  ToggleButton, 
  ToggleButtonGroup, 
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
  Avatar,
  DialogContentText
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
  Edit,
  Delete,
  ChevronLeft,
  ChevronRight,
  Today,
  CalendarViewWeek,
  CalendarMonth
} from '@mui/icons-material';
import { 
  format, 
  startOfWeek, 
  startOfMonth, 
  endOfMonth,
  addDays, 
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  isSameDay, 
  isSameMonth,
  parseISO, 
  isPast, 
  isToday 
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { Task, Privilege, RuleViolation } from '../types';
import { taskService } from '../services/api';
import Layout from '../components/Layout/Layout';

// Color schemes for children (consistent across the app)
const CHILD_COLORS = [
  { primary: '#1976d2', light: '#e3f2fd', dark: '#0d47a1', contrast: '#ffffff' }, // Blue
  { primary: '#388e3c', light: '#e8f5e8', dark: '#1b5e20', contrast: '#ffffff' }, // Green
  { primary: '#f57c00', light: '#fff3e0', dark: '#e65100', contrast: '#ffffff' }, // Orange
  { primary: '#7b1fa2', light: '#f3e5f5', dark: '#4a148c', contrast: '#ffffff' }, // Purple
  { primary: '#d32f2f', light: '#ffebee', dark: '#b71c1c', contrast: '#ffffff' }, // Red
  { primary: '#00796b', light: '#e0f2f1', dark: '#004d40', contrast: '#ffffff' }, // Teal
  { primary: '#455a64', light: '#eceff1', dark: '#263238', contrast: '#ffffff' }, // Blue Grey
  { primary: '#f9a825', light: '#fffde7', dark: '#f57f17', contrast: '#000000' }, // Amber
];

// Type colors (consistent for all users)
const TYPE_COLORS = {
  task: {
    completed: { bg: '#4caf50', color: '#ffffff', light: '#c8e6c9' },
    pending: { bg: '#ff9800', color: '#ffffff', light: '#ffe0b2' },
    overdue: { bg: '#f44336', color: '#ffffff', light: '#ffcdd2' }
  },
  privilege: {
    earned: { bg: '#9c27b0', color: '#ffffff', light: '#e1bee7' },
    notEarned: { bg: '#607d8b', color: '#ffffff', light: '#cfd8dc' }
  },
  violation: {
    default: { bg: '#e91e63', color: '#ffffff', light: '#f8bbd9' }
  }
};

const Calendar: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const { 
    familyTasks, 
    familyPrivileges, 
    familyViolations, 
    rules, 
    initialLoading, 
    dataLoading,
    refreshFamilyDataForDateRange,
    getCalendarTasks
  } = useDataCache();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [viewMode, setViewMode] = useState<'personal' | 'family'>('family');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItemType, setSelectedItemType] = useState<'task' | 'privilege' | 'violation' | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Récupérer les enfants de la famille
  const children = authState.family.filter(user => !user.isParent);

  // Utility functions for colors
  const getChildColorScheme = (userId: string) => {
    const childIndex = children.findIndex(child => child.id === userId);
    return CHILD_COLORS[childIndex % CHILD_COLORS.length];
  };

  const getTaskColor = (task: Task) => {
    if (task.completed) {
      return TYPE_COLORS.task.completed;
    } else if (isPast(parseISO(task.dueDate)) && !isToday(parseISO(task.dueDate))) {
      return TYPE_COLORS.task.overdue;
    } else {
      return TYPE_COLORS.task.pending;
    }
  };

  const getPrivilegeColor = (privilege: Privilege) => {
    return privilege.earned ? TYPE_COLORS.privilege.earned : TYPE_COLORS.privilege.notEarned;
  };

  const getViolationColor = () => {
    return TYPE_COLORS.violation.default;
  };

  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  // Navigation functions
  const handlePreviousPeriod = () => {
    setSelectedDate(prevDate => 
      calendarView === 'week' ? subWeeks(prevDate, 1) : subMonths(prevDate, 1)
    );
  };

  const handleNextPeriod = () => {
    setSelectedDate(prevDate => 
      calendarView === 'week' ? addWeeks(prevDate, 1) : addMonths(prevDate, 1)
    );
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleCalendarViewChange = (
    _: React.MouseEvent<HTMLElement>,
    newView: 'week' | 'month',
  ) => {
    if (newView !== null) {
      setCalendarView(newView);
    }
  };

  // Generate days based on current view - memoized to prevent unnecessary recalculations
  const daysToDisplay = useMemo(() => {
    if (calendarView === 'week') {
      const startOfCurrentWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
      return [...Array(7)].map((_, i) => addDays(startOfCurrentWeek, i));
    } else {
      // Month view: show full month with padding days
      const start = startOfMonth(selectedDate);
      const end = endOfMonth(selectedDate);
      const startOfFirstWeek = startOfWeek(start, { weekStartsOn: 1 });
      const endOfLastWeek = addDays(startOfWeek(end, { weekStartsOn: 1 }), 6);
      
      const days = [];
      let currentDay = startOfFirstWeek;
      while (currentDay <= endOfLastWeek) {
        days.push(currentDay);
        currentDay = addDays(currentDay, 1);
      }
      return days;
    }
  }, [selectedDate, calendarView]);

  // Fetch data for the specific date range being displayed
  useEffect(() => {
    if (!authState.currentUser || initialLoading) return;
    
    const fetchDataForCurrentPeriod = async () => {
      // Calculate days to display inside the effect to avoid dependency issues
      const currentDaysToDisplay = daysToDisplay;
      const startDate = currentDaysToDisplay[0];
      const endDate = currentDaysToDisplay[currentDaysToDisplay.length - 1];
      
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      console.log(`[Calendar] Fetching data for period: ${startDateStr} to ${endDateStr} (view: ${calendarView})`);
      
      try {
        // Use the new date range fetching method
        await refreshFamilyDataForDateRange(startDateStr, endDateStr);
        console.log(`[Calendar] Data fetch completed for period: ${startDateStr} to ${endDateStr}`);
      } catch (error) {
        console.error('Error fetching data for current period:', error);
      }
    };

    // Debounce the fetch to avoid excessive calls during rapid navigation
    const timeoutId = setTimeout(fetchDataForCurrentPeriod, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedDate, calendarView, authState.currentUser, initialLoading, refreshFamilyDataForDateRange]);

  useEffect(() => {
    // Si l'utilisateur est un parent et qu'il y a des enfants, sélectionner le premier enfant par défaut
    if (authState.currentUser?.isParent && children.length > 0 && !selectedChild && viewMode === 'personal') {
      setSelectedChild(children[0].id);
    }
  }, [authState.currentUser, children, selectedChild, viewMode]);

  // Update displayed data when cache, view mode, or selected date changes
  useEffect(() => {
    if (!authState.currentUser || initialLoading) return;

    if (viewMode === 'family') {
      // Family view - show all data
      setTasks(familyTasks || []);
      setPrivileges(familyPrivileges || []);
      setViolations(familyViolations || []);
    } else {
      // Personal view - filter data for specific user
      const userId = authState.currentUser.isParent && selectedChild 
        ? selectedChild 
        : authState.currentUser.id;
      
      // Use cached data for tasks
      const userTasks = getCalendarTasks(userId);
      setTasks(userTasks);
      
      // Filter privileges and violations for the user
      const userPrivileges = (familyPrivileges || []).filter(privilege => 
        privilege.assignedTo === userId && privilege.canView !== false
      );
      const userViolations = (familyViolations || []).filter(violation => 
        violation.childId === userId && violation.canView !== false
      );
      
      setPrivileges(userPrivileges);
      setViolations(userViolations);
    }
  }, [
    authState.currentUser, 
    familyTasks, 
    familyPrivileges, 
    familyViolations, 
    viewMode, 
    selectedChild, 
    selectedDate, // Added selectedDate to dependencies
    initialLoading,
    getCalendarTasks
  ]);

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
      // La mise à jour des tâches sera gérée par l'abonnement du cache
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  };

  const handleEditTask = (task: Task) => {
    navigate(`/tasks/edit/${task.id}`);
  };

  const handleDeleteTask = (task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      // For recurring tasks, ask if they want to delete future instances
      const deleteFuture = taskToDelete.isRecurring && !taskToDelete.parentTaskId;
      await taskService.deleteTask(taskToDelete.id, deleteFuture);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      // Data will be updated via cache subscription
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const cancelDeleteTask = () => {
    setDeleteDialogOpen(false);
    setTaskToDelete(null);
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
    const rule = rules?.find(r => r.id === ruleId);
    return rule ? rule.description : ruleId;
  };

  console.log('Calendar tasks to display:', tasks);

  // Helper function to render day cell content
  const renderDayCell = (day: Date) => {
    const dayTasks = getTasksForDay(day);
    const dayPrivileges = getPrivilegesForDay(day);
    const dayViolations = getViolationsForDay(day);
    const isCurrentMonth = calendarView === 'week' || isSameMonth(day, selectedDate);
    
    return (
      <TableCell 
        key={day.toString()} 
        sx={{ 
          height: calendarView === 'week' ? '200px' : '150px', 
          verticalAlign: 'top',
          opacity: isCurrentMonth ? 1 : 0.3,
          border: isToday(day) ? '2px solid #1976d2' : undefined,
          width: '14.28%',
          maxWidth: 0, // Force table-layout: fixed to work
          overflow: 'hidden',
          padding: '4px'
        }}
      >
        <Box sx={{ 
          minHeight: '100%', 
          p: 0.5,
          overflow: 'hidden',
          width: '100%'
        }}>
          {/* Date header for month view */}
          {calendarView === 'month' && (
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: isToday(day) ? 'bold' : 'normal',
                color: isCurrentMonth ? 'text.primary' : 'text.disabled',
                mb: 0.5,
                display: 'block'
              }}
            >
              {format(day, 'd')}
            </Typography>
          )}
          
          {/* Tâches */}
          {dayTasks.length > 0 && (
            <Box sx={{ mb: 1 }}>
              {calendarView === 'week' && (
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Assignment fontSize="small" sx={{ mr: 0.5 }} />
                  Tâches
                </Typography>
              )}
              {dayTasks.map(task => {
                const taskColor = getTaskColor(task);
                const childColorScheme = getChildColorScheme(task.assignedTo[0]);
                
                return (
                  <Box 
                    key={task.id} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 0.5,
                      p: calendarView === 'week' ? 0.5 : 0.25,
                      borderRadius: 1,
                      bgcolor: taskColor.light,
                      border: `1px solid ${childColorScheme.primary}`,
                      borderLeft: `4px solid ${childColorScheme.primary}`,
                      opacity: task.completed ? 0.7 : 1,
                      fontSize: calendarView === 'month' ? '0.75rem' : 'inherit',
                      position: 'relative'
                    }}
                  >
                    {task.completed ? (
                      <CheckCircle fontSize="small" sx={{ mr: 0.5, color: taskColor.bg }} />
                    ) : (
                      <Cancel fontSize="small" sx={{ mr: 0.5, color: taskColor.bg }} />
                    )}
                    
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography 
                        variant={calendarView === 'month' ? 'caption' : 'body2'}
                        sx={{ 
                          textDecoration: task.completed ? 'line-through' : 'none',
                          fontWeight: 500,
                          color: 'text.primary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {calendarView === 'month' && task.title.length > 12 
                          ? `${task.title.substring(0, 12)}...` 
                          : task.title
                        }
                      </Typography>
                      
                      {/* Child name - always show in family view, improved for month view */}
                      {viewMode === 'family' && (
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5,
                          mt: calendarView === 'month' ? 0.25 : 0.5 
                        }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: childColorScheme.primary,
                              flexShrink: 0
                            }}
                          />
                          <Typography 
                            variant="caption"
                            sx={{ 
                              color: childColorScheme.primary,
                              fontWeight: 600,
                              fontSize: calendarView === 'month' ? '0.7rem' : '0.75rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {getFirstName(getUserName(task.assignedTo[0]))}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
                      <Tooltip title="Voir détails">
                        <IconButton 
                          size="small" 
                          onClick={() => handleItemClick(task, 'task')}
                          sx={{ p: 0.25 }}
                        >
                          <Info fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      {/* Show fewer buttons in month view to save space */}
                      {calendarView === 'week' && (
                        <>
                          {/* Edit and Delete buttons for parents who created the task */}
                          {authState.currentUser?.isParent && task.createdBy === authState.currentUser.id && (
                            <>
                              <Tooltip title="Modifier la tâche">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleEditTask(task)}
                                  sx={{ p: 0.25 }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Supprimer la tâche">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDeleteTask(task)}
                                  sx={{ p: 0.25 }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          
                          {/* Only show completion buttons if user can modify the task */}
                          {task.canModify !== false && (
                            <>
                              {task.completed ? (
                                <Tooltip title="Marquer comme non terminé">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleToggleTaskComplete(task)}
                                    sx={{ p: 0.25 }}
                                  >
                                    <Undo fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Tooltip title={!(isPast(parseISO(task.dueDate)) || isToday(parseISO(task.dueDate))) ? "Impossible de terminer une tâche future" : "Marquer comme terminé"}>
                                  <span>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleToggleTaskComplete(task)}
                                      disabled={!(isPast(parseISO(task.dueDate)) || isToday(parseISO(task.dueDate)))}
                                      sx={{ p: 0.25 }}
                                    >
                                      <Check fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Privilèges */}
          {dayPrivileges.length > 0 && (
            <Box sx={{ mb: 1 }}>
              {calendarView === 'week' && (
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <EmojiEvents fontSize="small" sx={{ mr: 0.5 }} />
                  Privilèges
                </Typography>
              )}
              {dayPrivileges.map(privilege => {
                const privilegeColor = getPrivilegeColor(privilege);
                const childColorScheme = getChildColorScheme(privilege.assignedTo);
                
                return (
                  <Box 
                    key={privilege.id} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 0.5,
                      p: calendarView === 'week' ? 0.5 : 0.25,
                      borderRadius: 1,
                      bgcolor: privilegeColor.light,
                      border: `1px solid ${childColorScheme.primary}`,
                      borderLeft: `4px solid ${childColorScheme.primary}`,
                      position: 'relative'
                    }}
                  >
                    <EmojiEvents 
                      fontSize="small" 
                      sx={{ 
                        mr: 0.5, 
                        color: privilegeColor.bg 
                      }} 
                    />
                    
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography 
                        variant={calendarView === 'month' ? 'caption' : 'body2'} 
                        sx={{ 
                          fontWeight: 500,
                          color: 'text.primary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {calendarView === 'month' && privilege.title.length > 12 
                          ? `${privilege.title.substring(0, 12)}...` 
                          : privilege.title
                        }
                      </Typography>
                      
                      {/* Child name - always show in family view */}
                      {viewMode === 'family' && (
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5,
                          mt: calendarView === 'month' ? 0.25 : 0.5 
                        }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: childColorScheme.primary,
                              flexShrink: 0
                            }}
                          />
                          <Typography 
                            variant="caption"
                            sx={{ 
                              color: childColorScheme.primary,
                              fontWeight: 600,
                              fontSize: calendarView === 'month' ? '0.7rem' : '0.75rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {getFirstName(getUserName(privilege.assignedTo))}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    
                    <Tooltip title="Voir détails">
                      <IconButton 
                        size="small" 
                        onClick={() => handleItemClick(privilege, 'privilege')}
                        sx={{ p: 0.25 }}
                      >
                        <Info fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                );
              })}
            </Box>
          )}

          {/* Infractions */}
          {dayViolations.length > 0 && (
            <Box>
              {calendarView === 'week' && (
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                  <Warning fontSize="small" sx={{ mr: 0.5 }} />
                  Infractions
                </Typography>
              )}
              {dayViolations.map(violation => {
                const violationColor = getViolationColor();
                const childColorScheme = getChildColorScheme(violation.childId);
                
                return (
                  <Box 
                    key={violation.id} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 0.5,
                      p: calendarView === 'week' ? 0.5 : 0.25,
                      borderRadius: 1,
                      bgcolor: violationColor.light,
                      border: `1px solid ${childColorScheme.primary}`,
                      borderLeft: `4px solid ${childColorScheme.primary}`,
                      position: 'relative'
                    }}
                  >
                    <Warning 
                      fontSize="small" 
                      sx={{ 
                        mr: 0.5, 
                        color: violationColor.bg 
                      }} 
                    />
                    
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography 
                        variant={calendarView === 'month' ? 'caption' : 'body2'} 
                        sx={{ 
                          fontWeight: 500,
                          color: 'text.primary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {calendarView === 'month' && getRuleName(violation.ruleId).length > 12 
                          ? `${getRuleName(violation.ruleId).substring(0, 12)}...` 
                          : getRuleName(violation.ruleId)
                        }
                      </Typography>
                      
                      {/* Child name - always show in family view */}
                      {viewMode === 'family' && (
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5,
                          mt: calendarView === 'month' ? 0.25 : 0.5 
                        }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: childColorScheme.primary,
                              flexShrink: 0
                            }}
                          />
                          <Typography 
                            variant="caption"
                            sx={{ 
                              color: childColorScheme.primary,
                              fontWeight: 600,
                              fontSize: calendarView === 'month' ? '0.7rem' : '0.75rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {getFirstName(getUserName(violation.childId))}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    
                    <Tooltip title="Voir détails">
                      <IconButton 
                        size="small" 
                        onClick={() => handleItemClick(violation, 'violation')}
                        sx={{ p: 0.25 }}
                      >
                        <Info fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                );
              })}
            </Box>
          )}

          {dayTasks.length === 0 && dayPrivileges.length === 0 && dayViolations.length === 0 && (
            <Typography 
              variant="caption" 
              color="text.secondary" 
              align="center"
              sx={{ display: calendarView === 'week' ? 'block' : 'none' }}
            >
              Aucun événement
            </Typography>
          )}
        </Box>
      </TableCell>
    );
  };

  // Helper function to chunk days into weeks for month view
  const chunkDaysIntoWeeks = (days: Date[]) => {
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  };

  if (initialLoading) {
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
        
        {/* Navigation Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <IconButton 
            onClick={handlePreviousPeriod}
            disabled={dataLoading}
            aria-label="Période précédente"
          >
            <ChevronLeft />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                minWidth: { xs: 'auto', sm: '200px' }, 
                textAlign: 'center',
                fontSize: { xs: '1rem', sm: '1.25rem' }
              }}
            >
              {calendarView === 'week' 
                ? `Semaine du ${format(daysToDisplay[0], 'd MMM', { locale: fr })} au ${format(daysToDisplay[daysToDisplay.length - 1], 'd MMM yyyy', { locale: fr })}`
                : format(selectedDate, 'MMMM yyyy', { locale: fr })
              }
            </Typography>
            
            <Button
              onClick={handleToday}
              disabled={dataLoading}
              variant="outlined"
              size="small"
              startIcon={<Today />}
              sx={{ 
                ml: { xs: 0, sm: 2 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                padding: { xs: '4px 8px', sm: '6px 16px' }
              }}
            >
              {calendarView === 'week' ? 'Cette semaine' : 'Ce mois'}
            </Button>
          </Box>
          
          <IconButton 
            onClick={handleNextPeriod}
            disabled={dataLoading}
            aria-label="Période suivante"
          >
            <ChevronRight />
          </IconButton>
        </Box>

        {/* View Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {/* Calendar View Toggle */}
            <ToggleButtonGroup
              value={calendarView}
              exclusive
              onChange={handleCalendarViewChange}
              aria-label="Type de vue"
              disabled={dataLoading}
              size="small"
            >
              <ToggleButton value="week" aria-label="Vue semaine">
                <CalendarViewWeek fontSize="small" sx={{ mr: 1 }} />
                Semaine
              </ToggleButton>
              <ToggleButton value="month" aria-label="Vue mois">
                <CalendarMonth fontSize="small" sx={{ mr: 1 }} />
                Mois
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Family/Personal View Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              aria-label="Mode d'affichage"
              disabled={dataLoading}
              size="small"
            >
              <ToggleButton value="personal" aria-label="Vue personnelle">
                Vue personnelle
              </ToggleButton>
              <ToggleButton value="family" aria-label="Vue familiale">
                Vue familiale
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          
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
            {children.map(child => {
              const childColorScheme = getChildColorScheme(child.id);
              return (
                <Tooltip key={child.id} title={child.name}>
                  <Avatar
                    src={child.profilePicture}
                    alt={child.name}
                    sx={{ 
                      width: 40, 
                      height: 40, 
                      cursor: dataLoading ? 'default' : 'pointer',
                      border: selectedChild === child.id ? `3px solid ${childColorScheme.primary}` : `2px solid ${childColorScheme.light}`,
                      opacity: dataLoading ? 0.5 : (selectedChild === child.id ? 1 : 0.7),
                      bgcolor: childColorScheme.light,
                      color: childColorScheme.primary,
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={dataLoading ? undefined : () => handleChildSelect(child.id)}
                  >
                    {!child.profilePicture && getFirstName(child.name).charAt(0).toUpperCase()}
                  </Avatar>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Color Legend */}
      {viewMode === 'family' && children.length > 1 && (
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #e0e0e0' }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Légende des couleurs par enfant :
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {children.map(child => {
              const childColorScheme = getChildColorScheme(child.id);
              return (
                <Box key={child.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: childColorScheme.primary,
                      border: `2px solid ${childColorScheme.light}`
                    }}
                  />
                  <Typography variant="body2" sx={{ color: childColorScheme.primary, fontWeight: 500 }}>
                    {getFirstName(child.name)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Chaque enfant a sa propre couleur pour faciliter l'identification des tâches, privilèges et infractions.
          </Typography>
        </Box>
      )}

      <TableContainer component={Paper} sx={{ overflowX: 'auto', maxWidth: '100%' }}>
        <Table sx={{ minWidth: 'auto', tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {/* Week view: show all days in header */}
              {calendarView === 'week' && daysToDisplay.map((day) => (
                <TableCell key={day.toString()} align="center" sx={{ width: '14.28%' }}>
                  <Typography variant="subtitle1">
                    {format(day, 'EEEE', { locale: fr })}
                  </Typography>
                  <Typography variant="body2">
                    {format(day, 'd MMMM', { locale: fr })}
                  </Typography>
                </TableCell>
              ))}
              
              {/* Month view: show day names only */}
              {calendarView === 'month' && ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((dayName) => (
                <TableCell key={dayName} align="center" sx={{ width: '14.28%' }}>
                  <Typography variant="subtitle1">
                    {dayName}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {calendarView === 'week' ? (
              /* Week view: single row */
              <TableRow>
                {daysToDisplay.map((day) => renderDayCell(day))}
              </TableRow>
            ) : (
              /* Month view: multiple rows for weeks */
              chunkDaysIntoWeeks(daysToDisplay).map((week, weekIndex) => (
                <TableRow key={weekIndex}>
                  {week.map((day) => renderDayCell(day))}
                </TableRow>
              ))
            )}
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
            <>
              {/* Edit and Delete buttons for parents who created the task */}
              {authState.currentUser?.isParent && selectedItem.createdBy === authState.currentUser.id && (
                <>
                  <Button 
                    onClick={() => {
                      handleEditTask(selectedItem as Task);
                      handleCloseDetails();
                    }}
                    color="primary"
                    variant="outlined"
                    startIcon={<Edit />}
                  >
                    Modifier
                  </Button>
                  <Button 
                    onClick={() => {
                      handleDeleteTask(selectedItem as Task);
                      handleCloseDetails();
                    }}
                    color="error"
                    variant="outlined"
                    startIcon={<Delete />}
                  >
                    Supprimer
                  </Button>
                </>
              )}
              {/* Complete/Uncomplete button */}
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
            </>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDeleteTask}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Confirmer la suppression
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {taskToDelete && (
              <>
                Êtes-vous sûr de vouloir supprimer la tâche "{taskToDelete.title}" ?
                {taskToDelete.isRecurring && !taskToDelete.parentTaskId && (
                  <><br /><br />
                  <strong>Note :</strong> Cette tâche est récurrente. Sa suppression supprimera également toutes les instances futures de cette tâche.
                  </>
                )}
                {taskToDelete.parentTaskId && (
                  <><br /><br />
                  <strong>Note :</strong> Ceci est une instance d'une tâche récurrente. Seule cette occurrence sera supprimée.
                  </>
                )}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDeleteTask}>
            Annuler
          </Button>
          <Button onClick={confirmDeleteTask} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Calendar;