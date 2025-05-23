import React, { useState, useEffect } from 'react';
import {
  Typography,
  Tabs,
  Tab,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Pagination,
  Button,
  Avatar,
  Tooltip,
  Divider,
  Stack,
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
  EmojiEvents,
  Warning,
  Undo,
  Check,
  Edit,
  Delete
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDataCache } from '../contexts/DataCacheContext';
import { Task, Privilege, RuleViolation } from '../types';
import { taskService } from '../services/api';
import Layout from '../components/Layout/Layout';
import { isPast, isToday, parseISO } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const Home: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const {
    getAllTasks,
    getAllPrivileges,
    getAllViolations,
    getUserTasks,
    getUserPrivileges,
    getUserViolations,
    subscribeToDataChanges,
    rules,
    initialLoading
  } = useDataCache();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalPrivileges, setTotalPrivileges] = useState(0);
  const [totalViolations, setTotalViolations] = useState(0);
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const limit = 5; // Nombre d'éléments par page
  const children = authState.family.filter(user => !user.isParent);

  useEffect(() => {
    // Si l'utilisateur est un parent et qu'il y a des enfants, sélectionner le premier enfant par défaut
    if (authState.currentUser?.isParent && children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [authState.currentUser, children, selectedChild]);

  useEffect(() => {
    const fetchData = async () => {
      if (!authState.currentUser || initialLoading) return;
      
      setViewLoading(true);
      try {
        let tasksData: Task[] = [];
        let privilegesData: Privilege[] = [];
        let violationsData: RuleViolation[] = [];
        let tasksTotal = 0;
        let privilegesTotal = 0;
        let violationsTotal = 0;

        // Fetch data based on current view and tab
        if (tabValue === 0) { // Tasks tab
          if (authState.currentUser.isParent && selectedChild) {
            // Parent viewing specific child's tasks
            const result = await getUserTasks(selectedChild, page, limit);
            tasksData = result.tasks;
            tasksTotal = result.total;
          } else if (authState.currentUser.isParent && !selectedChild) {
            // Parent viewing all family tasks
            const result = await getAllTasks(page, limit);
            tasksData = result.tasks;
            tasksTotal = result.total;
          } else {
            // Child viewing their own tasks
            const result = await getUserTasks(authState.currentUser.id, page, limit);
            tasksData = result.tasks;
            tasksTotal = result.total;
          }
        } else if (tabValue === 1) { // Privileges tab
          if (authState.currentUser.isParent && selectedChild) {
            const result = await getUserPrivileges(selectedChild, page, limit);
            privilegesData = result.privileges;
            privilegesTotal = result.total;
          } else if (authState.currentUser.isParent && !selectedChild) {
            const result = await getAllPrivileges(page, limit);
            privilegesData = result.privileges;
            privilegesTotal = result.total;
          } else {
            const result = await getUserPrivileges(authState.currentUser.id, page, limit);
            privilegesData = result.privileges;
            privilegesTotal = result.total;
          }
        } else if (tabValue === 2) { // Violations tab
          if (authState.currentUser.isParent && selectedChild) {
            const result = await getUserViolations(selectedChild, page, limit);
            violationsData = result.violations;
            violationsTotal = result.total;
          } else if (authState.currentUser.isParent && !selectedChild) {
            const result = await getAllViolations(page, limit);
            violationsData = result.violations;
            violationsTotal = result.total;
          } else {
            const result = await getUserViolations(authState.currentUser.id, page, limit);
            violationsData = result.violations;
            violationsTotal = result.total;
          }
        }

        setTasks(tasksData);
        setTotalTasks(tasksTotal);
        setPrivileges(privilegesData);
        setTotalPrivileges(privilegesTotal);
        setViolations(violationsData);
        setTotalViolations(violationsTotal);
      } finally {
        setViewLoading(false);
      }
    };

    fetchData();
  }, [
    authState.currentUser, 
    selectedChild, 
    page, 
    tabValue, 
    initialLoading,
    refreshTrigger,
    getAllTasks,
    getAllPrivileges,
    getAllViolations,
    getUserTasks,
    getUserPrivileges,
    getUserViolations
  ]);

  // Subscribe to data changes and refresh only the current tab
  useEffect(() => {
    const unsubscribe = subscribeToDataChanges((dataType) => {
      // Only refresh if the changed data type matches the current tab
      if (
        (dataType === 'tasks' && tabValue === 0) ||
        (dataType === 'privileges' && tabValue === 1) ||
        (dataType === 'violations' && tabValue === 2)
      ) {
        console.log(`${dataType} changed, refreshing current tab...`);
        // Trigger a re-fetch of current tab data by updating a state that's in the dependency array
        setRefreshTrigger(prevTrigger => prevTrigger + 1); // This will trigger the fetchData useEffect
      }
    });

    return unsubscribe;
  }, [tabValue, subscribeToDataChanges]);

  const handleToggleTaskComplete = async (task: Task) => {
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

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setPage(1); // Réinitialiser la page lors du changement d'onglet
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const handleChildSelect = (childId: string) => {
    setSelectedChild(childId);
  };

  // Fonction pour obtenir le nom de la règle à partir de son ID
  const getRuleName = (ruleId: string): string => {
    const rule = rules?.find(r => r.id === ruleId);
    return rule ? rule.description : ruleId;
  };

  // Fonction pour obtenir le nom de l'utilisateur à partir de son ID
  const getUserName = (userId: string): string => {
    const user = authState.family.find(u => u.id === userId);
    return user ? user.name : 'Inconnu';
  };

  console.log('Tasks to display:', tasks);

  if (initialLoading) {
    return (
      <Layout>
        <Typography>Chargement...</Typography>
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
            {children.map(child => (
              <Tooltip key={child.id} title={child.name}>
                <Avatar
                  src={child.profilePicture}
                  alt={child.name}
                  sx={{ 
                    width: 40, 
                    height: 40, 
                    cursor: viewLoading ? 'default' : 'pointer',
                    border: selectedChild === child.id ? '2px solid #1976d2' : 'none',
                    opacity: viewLoading ? 0.5 : (selectedChild === child.id ? 1 : 0.6)
                  }}
                  onClick={viewLoading ? undefined : () => handleChildSelect(child.id)}
                />
              </Tooltip>
            ))}
          </Box>
          {viewLoading && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
              Mise à jour...
            </Typography>
          )}
        </Box>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="basic tabs example"
        >
          <Tab 
            label="Tâches" 
            icon={<Assignment />} 
            iconPosition="start" 
            disabled={viewLoading}
          />
          <Tab 
            label="Privilèges" 
            icon={<EmojiEvents />} 
            iconPosition="start" 
            disabled={viewLoading}
          />
          <Tab 
            label="Infractions" 
            icon={<Warning />} 
            iconPosition="start" 
            disabled={viewLoading}
          />
        </Tabs>
      </Box>

      {/* Onglet des tâches */}
      <TabPanel value={tabValue} index={0}>
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              <Assignment sx={{ verticalAlign: 'middle', mr: 1 }} />
              {authState.currentUser?.isParent && selectedChild 
                ? `Tâches de ${getUserName(selectedChild)}` 
                : 'Mes tâches'}
            </Typography>
            {authState.currentUser?.isParent && (
              <Button 
                variant="outlined" 
                size="small" 
                onClick={() => navigate('/tasks/new')}
              >
                Ajouter
              </Button>
            )}
          </Box>
          

          {tasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune tâche à afficher
            </Typography>
          ) : (
            <List>
              {tasks.map((task) => (
                <React.Fragment key={task.id}>
                  <ListItem
                    secondaryAction={
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {/* Edit and Delete buttons for parents */}
                        {authState.currentUser?.isParent && task.createdBy === authState.currentUser.id && (
                          <>
                            <Tooltip title="Modifier la tâche">
                              <IconButton
                                edge="end"
                                aria-label="edit"
                                onClick={() => handleEditTask(task)}
                                size="small"
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Supprimer la tâche">
                              <IconButton
                                edge="end"
                                aria-label="delete"
                                onClick={() => handleDeleteTask(task)}
                                size="small"
                              >
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        
                        {/* Complete/Uncomplete button */}
                        {task.completed ? (
                          <Tooltip title="Marquer comme non terminé">
                            <IconButton
                              edge="end"
                              aria-label="uncomplete"
                              onClick={() => handleToggleTaskComplete(task)}
                            >
                              <Undo />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title={!(isPast(parseISO(task.dueDate)) || isToday(parseISO(task.dueDate))) ? "Impossible de terminer une tâche future" : "Marquer comme terminé"}>
                            <span> {/* IconButton disabled state needs a span wrapper for Tooltip to work */} 
                              <IconButton
                                edge="end"
                                aria-label="complete"
                                onClick={() => handleToggleTaskComplete(task)}
                                disabled={!(isPast(parseISO(task.dueDate)) || isToday(parseISO(task.dueDate)))}
                              >
                                <Check />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </Box>
                    }
                  >
                    <ListItemIcon>
                      {task.completed ? (
                        <CheckCircle color="success" />
                      ) : (
                        <Cancel color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={task.title}
                      secondary={
                        <>
                          {task.description && <span>{task.description}<br /></span>}
                          <span>Échéance: {task.dueDate}</span>
                          {authState.currentUser?.isParent && !selectedChild && (
                            <>
                              <br />
                              <span>Assigné à: {task.assignedTo.map(id => getUserName(id)).join(', ')}</span>
                            </>
                          )}
                        </>
                      }
                      primaryTypographyProps={{
                        style: { 
                          textDecoration: task.completed ? 'line-through' : 'none',
                          color: task.completed ? 'text.secondary' : 'text.primary'
                        }
                      }}
                    />
                  </ListItem>
                  <Divider variant="inset" component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
          {tasks.length > 0 && (
            <Stack spacing={2} alignItems="center" sx={{ mt: 2 }}>
              <Pagination
                count={Math.ceil(totalTasks / limit)}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Stack>
          )}
        </Paper>
      </TabPanel>

      {/* Onglet des privilèges */}
      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              <EmojiEvents sx={{ verticalAlign: 'middle', mr: 1 }} />
              {authState.currentUser?.isParent && selectedChild 
                ? `Privilèges de ${getUserName(selectedChild)}` 
                : 'Mes privilèges'}
            </Typography>
            {authState.currentUser?.isParent && (
              <Button 
                variant="outlined" 
                size="small" 
                onClick={() => navigate('/privileges/new')}
              >
                Ajouter
              </Button>
            )}
          </Box>
          
          {privileges.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucun privilège à afficher
            </Typography>
          ) : (
            <List>
              {privileges.map((privilege) => (
                <React.Fragment key={privilege.id}>
                  <ListItem>
                    <ListItemIcon>
                      {privilege.earned ? (
                        <CheckCircle color="success" />
                      ) : (
                        <Cancel color="error" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={privilege.title}
                      secondary={
                        <>
                          {privilege.description && <span>{privilege.description}<br /></span>}
                          <span>Date: {privilege.date}</span>
                          {authState.currentUser?.isParent && !selectedChild && (
                            <>
                              <br />
                              <span>Assigné à: {getUserName(privilege.assignedTo)}</span>
                            </>
                          )}
                        </>
                      }
                    />
                    <Chip 
                      label={privilege.earned ? "Mérité" : "Non mérité"} 
                      color={privilege.earned ? "success" : "error"} 
                      size="small" 
                    />
                  </ListItem>
                  <Divider variant="inset" component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
          {privileges.length > 0 && (
            <Stack spacing={2} alignItems="center" sx={{ mt: 2 }}>
              <Pagination
                count={Math.ceil(totalPrivileges / limit)}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Stack>
          )}
        </Paper>
      </TabPanel>

      {/* Onglet des infractions */}
      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              <Warning sx={{ verticalAlign: 'middle', mr: 1 }} />
              {authState.currentUser?.isParent && selectedChild 
                ? `Infractions de ${getUserName(selectedChild)}` 
                : 'Mes infractions'}
            </Typography>
            {authState.currentUser?.isParent && (
              <Button 
                variant="outlined" 
                size="small" 
                onClick={() => navigate('/violations/new')}
              >
                Ajouter
              </Button>
            )}
          </Box>
          
          {violations.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune infraction à afficher
            </Typography>
          ) : (
            <List>
              {violations.map((violation) => (
                <React.Fragment key={violation.id}>
                  <ListItem>
                    <ListItemIcon>
                      <Warning color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`Règle enfreinte: ${getRuleName(violation.ruleId)}`}
                      secondary={
                        <>
                          <span>Date: {violation.date}</span>
                          {violation.description && (
                            <>
                              <br />
                              <span>Description: {violation.description}</span>
                            </>
                          )}
                          {authState.currentUser?.isParent && !selectedChild && (
                            <>
                              <br />
                              <span>Enfant: {getUserName(violation.childId)}</span>
                            </>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                  <Divider variant="inset" component="li" />
                </React.Fragment>
              ))}
            </List>
          )}
          {violations.length > 0 && (
            <Stack spacing={2} alignItems="center" sx={{ mt: 2 }}>
              <Pagination
                count={Math.ceil(totalViolations / limit)}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Stack>
          )}
        </Paper>
      </TabPanel>
      
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