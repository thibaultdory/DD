import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Button,
  Avatar,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { 
  CheckCircle,
  Cancel,
  Assignment,
  Warning,
  Undo,
  Check,
  Edit,
  Delete
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { Task, RuleViolation } from '../types';
import { taskService } from '../services/api';
import Layout from '../components/Layout/Layout';
import { isPast as dateFnIsPast, isToday as dateFnIsToday, parseISO, format, addDays, subDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

// Color schemes for children (consistent with calendar)
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

// Type colors (consistent with calendar)
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

// Timeline item type
interface TimelineItem {
  id: string;
  type: 'task' | 'violation';
  date: string;
  data: Task | RuleViolation;
}

const Home: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolled = useRef(false);
  
  const {
    familyTasks, 
    familyViolations, 
    rules,
    initialLoading,
    refreshFamilyDataForDateRange,
    getCalendarTasks
  } = useDataCache();

  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loadingFuture, setLoadingFuture] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  
  // Date range for loaded data
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 7), // Start 7 days ago
    end: addDays(new Date(), 14)   // End 14 days in future
  });

  const children = authState.family.filter(user => !user.isParent);

  // Utility functions for colors (consistent with calendar)
  const getChildColorScheme = (userId: string) => {
    const childIndex = children.findIndex(child => child.id === userId);
    return CHILD_COLORS[childIndex % CHILD_COLORS.length];
  };

  const getTaskColor = (task: Task) => {
    if (task.completed) {
      return TYPE_COLORS.task.completed;
    } else if (dateFnIsPast(parseISO(task.dueDate)) && !dateFnIsToday(parseISO(task.dueDate))) {
      return TYPE_COLORS.task.overdue;
    } else {
      return TYPE_COLORS.task.pending;
    }
  };

  const getViolationColor = () => {
    return TYPE_COLORS.violation.default;
  };

  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  // Convert cached data to timeline items
  const createTimelineItems = useCallback((tasks: Task[], violations: RuleViolation[]): TimelineItem[] => {
    const items: TimelineItem[] = [];
    
    // Add tasks
    tasks.forEach(task => {
      items.push({
        id: `task-${task.id}`,
        type: 'task',
        date: task.dueDate,
        data: task
      });
    });
    
    // Add violations
    violations.forEach(violation => {
      items.push({
        id: `violation-${violation.id}`,
        type: 'violation',
        date: violation.date,
        data: violation
      });
    });
    
    // Sort by date (newest first)
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, []);

  // Filter data based on selected child
  const getFilteredData = useCallback(() => {
    if (!familyTasks || !familyViolations) return { tasks: [], violations: [] };
    
    let filteredTasks: Task[] = [];
    let filteredViolations: RuleViolation[] = [];
    
    if (authState.currentUser?.isParent && selectedChild) {
      // Parent viewing specific child
      filteredTasks = familyTasks.filter(task => 
        task.assignedTo.includes(selectedChild)
      );
      filteredViolations = familyViolations.filter(violation => 
        violation.childId === selectedChild && violation.canView !== false
      );
    } else if (authState.currentUser?.isParent && !selectedChild) {
      // Parent viewing all family data
      filteredTasks = familyTasks;
      filteredViolations = familyViolations.filter(violation => violation.canView !== false);
    } else {
      // Child viewing their own data
      const userId = authState.currentUser?.id || '';
      filteredTasks = getCalendarTasks(userId);
      filteredViolations = familyViolations.filter(violation => 
        violation.childId === userId && violation.canView !== false
      );
    }
    
    return { tasks: filteredTasks, violations: filteredViolations };
  }, [familyTasks, familyViolations, selectedChild, authState.currentUser, getCalendarTasks]);

  // Load initial data and setup timeline
  useEffect(() => {
    if (!authState.currentUser || initialLoading) return;
    
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const initialStart = subDays(new Date(), 7);
        const initialEnd = addDays(new Date(), 14);
        const startDateStr = format(initialStart, 'yyyy-MM-dd');
        const endDateStr = format(initialEnd, 'yyyy-MM-dd');
        
        await refreshFamilyDataForDateRange(startDateStr, endDateStr);
        
        // Set the date range after successful load
        setDateRange({ start: initialStart, end: initialEnd });
      } catch (error) {
        console.error('Error loading initial timeline data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [authState.currentUser, initialLoading, refreshFamilyDataForDateRange]);

  // Update timeline when data or filters change
  useEffect(() => {
    const { tasks, violations } = getFilteredData();
    const items = createTimelineItems(tasks, violations);
    setTimelineItems(items);
  }, [familyTasks, familyViolations, selectedChild, createTimelineItems, getFilteredData]);

  // Auto-scroll to today's items on initial load (only once)
  useEffect(() => {
    if (timelineItems.length > 0 && !loading && !initialLoading && !hasAutoScrolled.current) {
      const timer = setTimeout(() => {
        const todayItem = timelineItems.find(item => 
          isSameDay(parseISO(item.date), new Date())
        );
        
        if (todayItem && scrollContainerRef.current) {
          const itemElement = scrollContainerRef.current.querySelector(`[data-item-id="${todayItem.id}"]`);
          if (itemElement) {
            itemElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }
      }, 500); // Increased timeout to ensure data is rendered
      
      hasAutoScrolled.current = true;
      
      return () => clearTimeout(timer);
    }
  }, [timelineItems, loading, initialLoading]); // Proper dependencies

  // Load more data in past direction
  const loadPastData = useCallback(async () => {
    if (loadingPast) return;
    
    setLoadingPast(true);
    try {
      const newStart = subDays(dateRange.start, 7);
      const startDateStr = format(newStart, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.start, 'yyyy-MM-dd');
      
      await refreshFamilyDataForDateRange(startDateStr, endDateStr);
      setDateRange(prev => ({ ...prev, start: newStart }));
    } catch (error) {
      console.error('Error loading past data:', error);
    } finally {
      setLoadingPast(false);
    }
  }, [loadingPast, dateRange.start, refreshFamilyDataForDateRange]);

  // Load more data in future direction
  const loadFutureData = useCallback(async () => {
    if (loadingFuture) return;
    
    setLoadingFuture(true);
    try {
      const newEnd = addDays(dateRange.end, 7);
      const startDateStr = format(dateRange.end, 'yyyy-MM-dd');
      const endDateStr = format(newEnd, 'yyyy-MM-dd');
      
      await refreshFamilyDataForDateRange(startDateStr, endDateStr);
      setDateRange(prev => ({ ...prev, end: newEnd }));
    } catch (error) {
      console.error('Error loading future data:', error);
    } finally {
      setLoadingFuture(false);
    }
  }, [loadingFuture, dateRange.end, refreshFamilyDataForDateRange]);

  // Scroll event handler for infinite scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Near top - load past data (increased threshold to be less aggressive)
    if (scrollTop < 100 && !loadingPast) {
      loadPastData();
    }
    
    // Near bottom - load future data (increased threshold to be less aggressive)
    if (scrollHeight - scrollTop - clientHeight < 100 && !loadingFuture) {
      loadFutureData();
    }
  }, [loadingPast, loadingFuture, loadPastData, loadFutureData]);

  // Child selection for parents
  useEffect(() => {
    if (authState.currentUser?.isParent && children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [authState.currentUser, children, selectedChild]);

  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
  };

  // Task management functions
  const handleToggleTaskComplete = async (task: Task) => {
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
      const deleteFuture = taskToDelete.isRecurring && !taskToDelete.parentTaskId;
      await taskService.deleteTask(taskToDelete.id, deleteFuture);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const cancelDeleteTask = () => {
    setDeleteDialogOpen(false);
    setTaskToDelete(null);
  };

  // Utility functions
  const getRuleName = (ruleId: string): string => {
    const rule = rules?.find(r => r.id === ruleId);
    return rule ? rule.description : ruleId;
  };

  const getUserName = (userId: string): string => {
    const user = authState.family.find(u => u.id === userId);
    return user ? user.name : 'Inconnu';
  };

  // Group timeline items by date
  const groupedItems = timelineItems.reduce((groups, item) => {
    const date = item.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {} as Record<string, TimelineItem[]>);

  if (initialLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Bonjour, {authState.currentUser?.name} !
        </Typography>
        <Typography variant="subtitle1">
          Bienvenue dans votre assistant de vie familiale
        </Typography>
      </Box>

      {/* Sélecteur d'enfant pour les parents */}
      {authState.currentUser?.isParent && children.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle1" sx={{ mr: 2 }}>
            Afficher les données de :
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
                      cursor: loading ? 'default' : 'pointer',
                      border: selectedChild === child.id ? `3px solid ${childColorScheme.primary}` : `2px solid ${childColorScheme.light}`,
                      opacity: loading ? 0.5 : (selectedChild === child.id ? 1 : 0.7),
                      bgcolor: childColorScheme.light,
                      color: childColorScheme.primary,
                      fontWeight: 'bold',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={loading ? undefined : () => handleChildSelect(child.id)}
                  >
                    {!child.profilePicture && getFirstName(child.name).charAt(0).toUpperCase()}
                  </Avatar>
                </Tooltip>
              );
            })}
          </Box>
          {loading && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              Mise à jour...
            </Typography>
          )}
        </Box>
      )}

      {/* Color Legend for multiple children */}
      {authState.currentUser?.isParent && children.length > 1 && (
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
            Chaque enfant a sa propre couleur pour faciliter l'identification.
          </Typography>
        </Box>
      )}

      {/* Actions Bar */}
      {authState.currentUser?.isParent && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button 
            variant="outlined" 
            startIcon={<Assignment />}
            onClick={() => navigate('/tasks/new')}
          >
            Ajouter une tâche
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<Warning />}
            onClick={() => navigate('/violations/new')}
          >
            Signaler une infraction
          </Button>
        </Box>
      )}

      {/* Timeline Container */}
      <Paper sx={{ p: 0, overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <Typography variant="h6">
            Timeline des événements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tâches et infractions centrées autour d'aujourd'hui
          </Typography>
        </Box>

        {loading && timelineItems.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Chargement de la timeline...
            </Typography>
          </Box>
        ) : timelineItems.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              Aucun événement trouvé dans cette période
            </Typography>
          </Box>
        ) : (
          <Box
            ref={scrollContainerRef}
            onScroll={handleScroll}
            sx={{
              height: 'calc(100vh - 350px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              // Hide scrollbar while maintaining scroll functionality
              '&::-webkit-scrollbar': {
                display: 'none',
              },
              '-ms-overflow-style': 'none',  // IE and Edge
              'scrollbar-width': 'none',     // Firefox
            }}
          >
            {/* Loading indicator for past data */}
            {loadingPast && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <CircularProgress size={20} />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  Chargement des données passées...
                </Typography>
              </Box>
            )}

            {/* Timeline Items */}
            {Object.keys(groupedItems)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
              .map(date => {
                const dayItems = groupedItems[date];
                const isToday = isSameDay(parseISO(date), new Date());
                const parsedDate = parseISO(date);

                return (
                  <Box key={date} sx={{ mb: 2 }}>
                    {/* Date Header */}
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: isToday ? 'primary.light' : 'grey.100',
                      borderTop: isToday ? '2px solid' : '1px solid',
                      borderColor: isToday ? 'primary.main' : 'grey.300',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1
                    }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          color: isToday ? 'primary.main' : 'text.primary',
                          fontWeight: isToday ? 'bold' : '600'
                        }}
                      >
                        {isToday ? 'Aujourd\'hui' : format(parsedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                        {isToday && (
                          <Chip 
                            label="AUJOURD'HUI" 
                            size="small" 
                            sx={{ 
                              ml: 2, 
                              bgcolor: 'primary.main', 
                              color: 'white',
                              fontWeight: 'bold'
                            }} 
                          />
                        )}
                      </Typography>
                    </Box>

                    {/* Day Items */}
                    <List sx={{ p: 0 }}>
                      {dayItems.map(item => {
                        if (item.type === 'task') {
                          const task = item.data as Task;
                          const taskColor = getTaskColor(task);
                          const childColorScheme = task.assignedTo[0] ? getChildColorScheme(task.assignedTo[0]) : CHILD_COLORS[0];

                          return (
                            <ListItem
                              key={item.id}
                              data-item-id={item.id}
                              sx={{
                                mb: 1,
                                mx: 1,
                                borderRadius: 2,
                                bgcolor: taskColor.light,
                                border: `1px solid ${childColorScheme.primary}`,
                                borderLeft: `4px solid ${childColorScheme.primary}`,
                                '&:hover': {
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)',
                                },
                                transition: 'all 0.2s ease'
                              }}
                              secondaryAction={
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  {/* Task action buttons */}
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
                                  
                                  {/* Complete/Uncomplete button */}
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
                                        <Tooltip title={!(dateFnIsPast(parseISO(task.dueDate)) || dateFnIsToday(parseISO(task.dueDate))) ? "Impossible de terminer une tâche future" : "Marquer comme terminé"}>
                                          <span>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleToggleTaskComplete(task)}
                                              disabled={!(dateFnIsPast(parseISO(task.dueDate)) || dateFnIsToday(parseISO(task.dueDate)))}
                                            >
                                              <Check fontSize="small" />
                                            </IconButton>
                                          </span>
                                        </Tooltip>
                                      )}
                                    </>
                                  )}
                                </Box>
                              }
                            >
                              <ListItemIcon>
                                {task.completed ? (
                                  <CheckCircle sx={{ color: taskColor.bg }} />
                                ) : (
                                  <Cancel sx={{ color: taskColor.bg }} />
                                )}
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography
                                      variant="body1"
                                      sx={{
                                        textDecoration: task.completed ? 'line-through' : 'none',
                                        fontWeight: 600,
                                        color: 'text.primary'
                                      }}
                                    >
                                      {task.title}
                                    </Typography>
                                    {/* Child indicator */}
                                    {authState.currentUser?.isParent && !selectedChild && (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                                            fontWeight: 600
                                          }}
                                        >
                                          {getFirstName(getUserName(task.assignedTo[0]))}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                }
                                secondary={task.description}
                              />
                            </ListItem>
                          );
                        } else if (item.type === 'violation') {
                          const violation = item.data as RuleViolation;
                          const violationColor = getViolationColor();
                          const childColorScheme = getChildColorScheme(violation.childId);

                          return (
                            <ListItem
                              key={item.id}
                              data-item-id={item.id}
                              sx={{
                                mb: 1,
                                mx: 1,
                                borderRadius: 2,
                                bgcolor: violationColor.light,
                                border: `1px solid ${childColorScheme.primary}`,
                                borderLeft: `4px solid ${childColorScheme.primary}`,
                                '&:hover': {
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.12)',
                                },
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <ListItemIcon>
                                <Warning sx={{ color: violationColor.bg }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography
                                      variant="body1"
                                      sx={{
                                        fontWeight: 600,
                                        color: 'text.primary'
                                      }}
                                    >
                                      {getRuleName(violation.ruleId)}
                                    </Typography>
                                    {/* Child indicator */}
                                    {authState.currentUser?.isParent && !selectedChild && (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                                            fontWeight: 600
                                          }}
                                        >
                                          {getFirstName(getUserName(violation.childId))}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Box>
                                }
                                secondary={violation.description}
                              />
                            </ListItem>
                          );
                        }
                        return null;
                      })}
                    </List>
                  </Box>
                );
              })}

            {/* Loading indicator for future data */}
            {loadingFuture && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <CircularProgress size={20} />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  Chargement des données futures...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>
      
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

export default Home;