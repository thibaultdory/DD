import React, { useEffect, useState } from 'react';

import { 
  Typography, 
  Paper, 
  Box, 
  Chip, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemIcon, 
  Divider,
  Tabs,
  Tab,
  Pagination,
  Stack,
  Avatar,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  CheckCircle, 
  Cancel, 
  Assignment, 
  EmojiEvents, 
  Warning,
  Check,
  Undo
} from '@mui/icons-material';
import { parseISO, isPast, isToday } from 'date-fns';
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // États pour la pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalTasks, setTotalTasks] = useState(0);
  const [totalPrivileges, setTotalPrivileges] = useState(0);
  const [totalViolations, setTotalViolations] = useState(0);

  // Récupérer les enfants de la famille
  const children = authState.family.filter(user => !user.isParent);

  useEffect(() => {
    // Si l'utilisateur est un parent et qu'il y a des enfants, sélectionner le premier enfant par défaut
    if (authState.currentUser?.isParent && children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [authState.currentUser, children, selectedChild]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (authState.currentUser) {
          // Récupérer les règles (communes à tous)
          const fetchedRules = await ruleService.getRules();
          setRules(fetchedRules);

          let tasksData: Task[] = [];
          let privilegesData: Privilege[] = [];
          let violationsData: RuleViolation[] = [];
          let tasksTotal = 0;
          let privilegesTotal = 0;
          let violationsTotal = 0;

          if (authState.currentUser.isParent) {
            if (selectedChild) {
              // Les parents voient les tâches, privilèges et infractions de l'enfant sélectionné
              const tasksResponse = await taskService.getUserTasks(selectedChild, page, limit);
              const privilegesResponse = await privilegeService.getUserPrivileges(selectedChild, page, limit);
              const violationsResponse = await ruleViolationService.getChildRuleViolations(selectedChild, page, limit);
              
              tasksData = tasksResponse.tasks || [];
              tasksTotal = tasksResponse.total || 0;
              privilegesData = privilegesResponse.privileges || [];
              privilegesTotal = privilegesResponse.total || 0;
              violationsData = violationsResponse.violations || [];
              violationsTotal = violationsResponse.total || 0;
            } else {
              // Si aucun enfant n'est sélectionné, afficher toutes les tâches
              const tasksResponse = await taskService.getTasks(page, limit);
              const privilegesResponse = await privilegeService.getPrivileges(page, limit);
              const violationsResponse = await ruleViolationService.getRuleViolations(page, limit);
              
              tasksData = tasksResponse.tasks || [];
              tasksTotal = tasksResponse.total || 0;
              privilegesData = privilegesResponse.privileges || [];
              privilegesTotal = privilegesResponse.total || 0;
              violationsData = violationsResponse.violations || [];
              violationsTotal = violationsResponse.total || 0;
            }
          } else {
            // Les enfants ne voient que leurs propres tâches, privilèges et infractions
            const tasksResponse = await taskService.getUserTasks(authState.currentUser.id, page, limit);
            const privilegesResponse = await privilegeService.getUserPrivileges(authState.currentUser.id, page, limit);
            const violationsResponse = await ruleViolationService.getChildRuleViolations(authState.currentUser.id, page, limit);
            
            tasksData = tasksResponse.tasks || [];
            tasksTotal = tasksResponse.total || 0;
            privilegesData = privilegesResponse.privileges || [];
            privilegesTotal = privilegesResponse.total || 0;
            violationsData = violationsResponse.violations || [];
            violationsTotal = violationsResponse.total || 0;
          }

          setTasks(tasksData);
          setTotalTasks(tasksTotal);
          setPrivileges(privilegesData);
          setTotalPrivileges(privilegesTotal);
          setViolations(violationsData);
          setTotalViolations(violationsTotal);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // S'abonner aux changements de données
    const unsubscribeTasks = taskService.subscribe(() => {
      if (authState.currentUser) {
        if (authState.currentUser.isParent && selectedChild) {
          taskService.getUserTasks(selectedChild, page, limit).then(response => {
            setTasks(response.tasks || []);
            setTotalTasks(response.total || 0);
          });
        } else if (!authState.currentUser.isParent) {
          taskService.getUserTasks(authState.currentUser.id, page, limit).then(response => {
            setTasks(response.tasks || []);
            setTotalTasks(response.total || 0);
          });
        } else {
          taskService.getTasks(page, limit).then(response => {
            setTasks(response.tasks || []);
            setTotalTasks(response.total || 0);
          });
        }
      }
    });

    const unsubscribePrivileges = privilegeService.subscribe(() => {
      if (authState.currentUser) {
        if (authState.currentUser.isParent && selectedChild) {
          privilegeService.getUserPrivileges(selectedChild, page, limit).then(response => {
            setPrivileges(response.privileges || []);
            setTotalPrivileges(response.total || 0);
          });
        } else if (!authState.currentUser.isParent) {
          privilegeService.getUserPrivileges(authState.currentUser.id, page, limit).then(response => {
            setPrivileges(response.privileges || []);
            setTotalPrivileges(response.total || 0);
          });
        } else {
          privilegeService.getPrivileges(page, limit).then(response => {
            setPrivileges(response.privileges || []);
            setTotalPrivileges(response.total || 0);
          });
        }
      }
    });

    const unsubscribeViolations = ruleViolationService.subscribe(() => {
      if (authState.currentUser) {
        if (authState.currentUser.isParent && selectedChild) {
          ruleViolationService.getChildRuleViolations(selectedChild, page, limit).then(response => {
            setViolations(response.violations || []);
            setTotalViolations(response.total || 0);
          });
        } else if (!authState.currentUser.isParent) {
          ruleViolationService.getChildRuleViolations(authState.currentUser.id, page, limit).then(response => {
            setViolations(response.violations || []);
            setTotalViolations(response.total || 0);
          });
        } else {
          ruleViolationService.getRuleViolations(page, limit).then(response => {
            setViolations(response.violations || []);
            setTotalViolations(response.total || 0);
          });
        }
      }
    });

    return () => {
      unsubscribeTasks();
      unsubscribePrivileges();
      unsubscribeViolations();
    };
  }, [authState.currentUser, selectedChild, page]);

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
    const rule = rules.find(r => r.id === ruleId);
    return rule ? rule.description : ruleId;
  };

  // Fonction pour obtenir le nom de l'utilisateur à partir de son ID
  const getUserName = (userId: string): string => {
    const user = authState.family.find(u => u.id === userId);
    return user ? user.name : 'Inconnu';
  };

  console.log('Tasks to display:', tasks);

  if (loading) {
    return <Typography>Chargement...</Typography>;
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

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="basic tabs example">
          <Tab label="Tâches" icon={<Assignment />} iconPosition="start" />
          <Tab label="Privilèges" icon={<EmojiEvents />} iconPosition="start" />
          <Tab label="Infractions" icon={<Warning />} iconPosition="start" />
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
                      task.completed ? (
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
                      )
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
    </Layout>
  );
};

export default Home;