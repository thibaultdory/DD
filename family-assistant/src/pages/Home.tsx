import React, { useEffect, useState } from 'react';
import { Typography, Grid, Paper, Box, Chip, Button, List, ListItem, ListItemText, ListItemIcon, Divider } from '@mui/material';
import { CheckCircle, Cancel, Assignment, EmojiEvents, Warning } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { Task, Privilege, RuleViolation } from '../types';
import { taskService, privilegeService, ruleViolationService } from '../services/api';
import Layout from '../components/Layout/Layout';

const Home: React.FC = () => {
  const { authState } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [violations, setViolations] = useState<RuleViolation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (authState.currentUser) {
          let userTasks: Task[] = [];
          let userPrivileges: Privilege[] = [];
          let userViolations: RuleViolation[] = [];

          if (authState.currentUser.isParent) {
            // Les parents voient toutes les tâches, privilèges et infractions
            userTasks = await taskService.getTasks();
            userPrivileges = await privilegeService.getPrivileges();
            userViolations = await ruleViolationService.getRuleViolations();
          } else {
            // Les enfants ne voient que leurs propres tâches, privilèges et infractions
            userTasks = await taskService.getUserTasks(authState.currentUser.id);
            userPrivileges = await privilegeService.getUserPrivileges(authState.currentUser.id);
            userViolations = await ruleViolationService.getChildRuleViolations(authState.currentUser.id);
          }

          setTasks(userTasks);
          setPrivileges(userPrivileges);
          setViolations(userViolations);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authState.currentUser]);

  const handleCompleteTask = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId);
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, completed: true } : task
      ));
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

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

      <Grid container spacing={3}>
        {/* Tâches */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                <Assignment sx={{ verticalAlign: 'middle', mr: 1 }} />
                Mes tâches
              </Typography>
              {authState.currentUser?.isParent && (
                <Button variant="outlined" size="small" href="/tasks/new">
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
                        !task.completed && !authState.currentUser?.isParent ? (
                          <Button 
                            variant="outlined" 
                            size="small"
                            onClick={() => handleCompleteTask(task.id)}
                          >
                            Terminer
                          </Button>
                        ) : null
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
                        secondary={task.description}
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
          </Paper>
        </Grid>

        {/* Privilèges */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                <EmojiEvents sx={{ verticalAlign: 'middle', mr: 1 }} />
                Privilèges
              </Typography>
              {authState.currentUser?.isParent && (
                <Button variant="outlined" size="small" href="/privileges/new">
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
                        secondary={privilege.description}
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
          </Paper>
        </Grid>

        {/* Infractions aux règles */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                <Warning sx={{ verticalAlign: 'middle', mr: 1 }} />
                Infractions aux règles
              </Typography>
              {authState.currentUser?.isParent && (
                <Button variant="outlined" size="small" href="/violations/new">
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
                        primary={`Règle enfreinte: ${violation.ruleId}`}
                        secondary={`${violation.date} - ${violation.description || 'Aucune description'}`}
                      />
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Layout>
  );
};

export default Home;