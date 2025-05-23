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
    refreshFamilyData,
    getCalendarTasks
  } = useDataCache();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [viewMode, setViewMode] = useState<'personal' | 'family'>('personal');
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

  // Generate days based on current view
  const getDaysToDisplay = () => {
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
  };

  const daysToDisplay = getDaysToDisplay();

  // Refresh data when navigating to a different month to ensure we have tasks for the new period
  useEffect(() => {
    if (!authState.currentUser || initialLoading) return;
    
    // Check if we've navigated to a significantly different period (different month)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();
    
    // If we're viewing a different month than current, refresh family data to ensure we have all tasks
    const isSignificantDateChange = 
      Math.abs((selectedYear - currentYear) * 12 + (selectedMonth - currentMonth)) > 1;
    
    if (isSignificantDateChange) {
      console.log('Significant date change detected, refreshing family data...');
      // Note: In a future improvement, we should modify the API to accept date ranges
      // For now, we refresh all data when navigating far from current month
      if (authState.currentUser) {
        // Small delay to debounce rapid navigation
        const timeoutId = setTimeout(() => {
          refreshFamilyData();
        }, 300);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [selectedDate, authState.currentUser, initialLoading, refreshFamilyData]);

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
          border: isToday(day) ? '2px solid #1976d2' : undefined
        }}
      >
        <Box sx={{ minHeight: '100%', p: 1 }}>
          {/* Date header for month view */}
          {calendarView === 'month' && (
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: isToday(day) ? 'bold' : 'normal',
                color: isCurrentMonth ? 'text.primary' : 'text.disabled'
              }}
            >
              {format(day, 'd')}
            </Typography>
          )}
          
          {/* Tâches */}
          {dayTasks.length > 0 && (
            <Box sx={{ mb: 1 }}>
              {calendarView === 'week' && (
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Assignment fontSize="small" sx={{ mr: 0.5 }} />
                  Tâches
                </Typography>
              )}
              {dayTasks.map(task => (
                <Box 
                  key={task.id} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 0.5,
                    p: calendarView === 'week' ? 0.5 : 0.25,
                    borderRadius: 1,
                    bgcolor: task.completed ? 'success.light' : 'error.light',
                    opacity: task.completed ? 0.7 : 1,
                    fontSize: calendarView === 'month' ? '0.75rem' : 'inherit'
                  }}
                >
                  {task.completed ? (
                    <CheckCircle fontSize="small" color="success" sx={{ mr: 0.5 }} />
                  ) : (
                    <Cancel fontSize="small" color="error" sx={{ mr: 0.5 }} />
                  )}
                  <Typography 
                    variant={calendarView === 'month' ? 'caption' : 'body2'}
                    sx={{ 
                      flexGrow: 1,
                      textDecoration: task.completed ? 'line-through' : 'none'
                    }}
                  >
                    {calendarView === 'month' && task.title.length > 15 
                      ? `${task.title.substring(0, 15)}...` 
                      : task.title
                    }
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {viewMode === 'family' && calendarView === 'week' && (
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
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer la tâche">
                              <IconButton 
                                size="small" 
                                onClick={() => handleDeleteTask(task)}
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
              ))}
            </Box>
          )}

          {/* Privilèges */}
          {dayPrivileges.length > 0 && (
            <Box sx={{ mb: 1 }}>
              {calendarView === 'week' && (
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center' }}>
                  <EmojiEvents fontSize="small" sx={{ mr: 0.5 }} />
                  Privilèges
                </Typography>
              )}
              {dayPrivileges.map(privilege => (
                <Box 
                  key={privilege.id} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 0.5,
                    p: calendarView === 'week' ? 0.5 : 0.25,
                    borderRadius: 1,
                    bgcolor: privilege.earned ? 'success.light' : 'warning.light'
                  }}
                >
                  <Typography 
                    variant={calendarView === 'month' ? 'caption' : 'body2'} 
                    sx={{ flexGrow: 1 }}
                  >
                    {calendarView === 'month' && privilege.title.length > 15 
                      ? `${privilege.title.substring(0, 15)}...` 
                      : privilege.title
                    }
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {viewMode === 'family' && calendarView === 'week' && (
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
              {calendarView === 'week' && (
                <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Warning fontSize="small" sx={{ mr: 0.5 }} />
                  Infractions
                </Typography>
              )}
              {dayViolations.map(violation => (
                <Box 
                  key={violation.id} 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    mb: 0.5,
                    p: calendarView === 'week' ? 0.5 : 0.25,
                    borderRadius: 1,
                    bgcolor: 'error.light'
                  }}
                >
                  <Typography 
                    variant={calendarView === 'month' ? 'caption' : 'body2'} 
                    sx={{ flexGrow: 1 }}
                  >
                    {calendarView === 'month' && getRuleName(violation.ruleId).length > 15 
                      ? `${getRuleName(violation.ruleId).substring(0, 15)}...` 
                      : getRuleName(violation.ruleId)
                    }
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {viewMode === 'family' && calendarView === 'week' && (
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
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 3 }}>
          <IconButton 
            onClick={handlePreviousPeriod}
            disabled={dataLoading}
            aria-label="Période précédente"
          >
            <ChevronLeft />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mx: 3 }}>
            <IconButton 
              onClick={handleToday}
              disabled={dataLoading}
              aria-label="Aujourd'hui"
              sx={{ mr: 2 }}
            >
              <Today />
            </IconButton>
            
            <Typography variant="h6" sx={{ minWidth: '200px', textAlign: 'center' }}>
              {calendarView === 'week' 
                ? `Semaine du ${format(daysToDisplay[0], 'd MMM', { locale: fr })} au ${format(daysToDisplay[daysToDisplay.length - 1], 'd MMM yyyy', { locale: fr })}`
                : format(selectedDate, 'MMMM yyyy', { locale: fr })
              }
            </Typography>
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
              {/* Week view: show all days in header */}
              {calendarView === 'week' && daysToDisplay.map((day) => (
                <TableCell key={day.toString()} align="center">
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
                <TableCell key={dayName} align="center">
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