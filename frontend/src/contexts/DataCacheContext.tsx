import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Task, Privilege, RuleViolation, Rule } from '../types';
import { taskService, privilegeService, ruleViolationService, ruleService } from '../services/api';
import { useAuth } from './AuthContext';

// Event system for notifying components about data changes
type DataChangeListener = (dataType: 'tasks' | 'privileges' | 'violations') => void;
const dataChangeListeners: DataChangeListener[] = [];

const notifyDataChange = (dataType: 'tasks' | 'privileges' | 'violations') => {
  dataChangeListeners.forEach(listener => listener(dataType));
};

interface DataCache {
  // Family-wide data (all tasks, privileges, violations with permissions) - only for calendar view
  familyTasks: Task[] | null;
  familyPrivileges: Privilege[] | null;
  familyViolations: RuleViolation[] | null;
  rules: Rule[] | null;
  
  // Loading states
  initialLoading: boolean;
  dataLoading: boolean;
  
  // Cache management
  refreshFamilyData: () => Promise<void>;
  refreshUserData: (userId: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshPrivileges: () => Promise<void>;
  refreshViolations: () => Promise<void>;
  
  // Event subscription for components
  subscribeToDataChanges: (listener: DataChangeListener) => () => void;
  
  // Paginated data getters - these now use backend pagination
  getUserTasks: (userId: string, page?: number, limit?: number) => Promise<{ tasks: Task[], total: number }>;
  getUserPrivileges: (userId: string, page?: number, limit?: number) => Promise<{ privileges: Privilege[], total: number }>;
  getUserViolations: (userId: string, page?: number, limit?: number) => Promise<{ violations: RuleViolation[], total: number }>;
  
  // Paginated data getters for home view
  getAllTasks: (page?: number, limit?: number) => Promise<{ tasks: Task[], total: number }>;
  getAllPrivileges: (page?: number, limit?: number) => Promise<{ privileges: Privilege[], total: number }>;
  getAllViolations: (page?: number, limit?: number) => Promise<{ violations: RuleViolation[], total: number }>;
  
  // Calendar-specific getters that return all data filtered by user
  getCalendarTasks: (userId?: string) => Task[];
}

const DataCacheContext = createContext<DataCache | undefined>(undefined);

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
};

interface DataCacheProviderProps {
  children: ReactNode;
}

export const DataCacheProvider: React.FC<DataCacheProviderProps> = ({ children }) => {
  const { authState } = useAuth();
  const [familyTasks, setFamilyTasks] = useState<Task[] | null>(null);
  const [familyPrivileges, setFamilyPrivileges] = useState<Privilege[] | null>(null);
  const [familyViolations, setFamilyViolations] = useState<RuleViolation[] | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const refreshFamilyData = async () => {
    if (!authState.currentUser) return;
    
    try {
      setInitialLoading(true);
      
      // Fetch all data in parallel
      const [rulesResponse, tasksResponse, privilegesResponse, violationsResponse] = await Promise.all([
        ruleService.getRules(),
        taskService.getTasksForCalendar(),
        privilegeService.getPrivilegesForCalendar(),
        ruleViolationService.getRuleViolationsForCalendar()
      ]);

      setRules(rulesResponse);
      setFamilyTasks(Array.isArray(tasksResponse) ? tasksResponse : []);
      setFamilyPrivileges(Array.isArray(privilegesResponse) ? privilegesResponse : []);
      setFamilyViolations(Array.isArray(violationsResponse) ? violationsResponse : []);
    } catch (error) {
      console.error('Error refreshing family data:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const refreshTasks = async () => {
    if (!authState.currentUser) return;
    
    try {
      setDataLoading(true);
      const tasksResponse = await taskService.getTasksForCalendar();
      setFamilyTasks(Array.isArray(tasksResponse) ? tasksResponse : []);
      notifyDataChange('tasks');
    } catch (error) {
      console.error('Error refreshing tasks:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const refreshPrivileges = async () => {
    if (!authState.currentUser) return;
    
    try {
      setDataLoading(true);
      const privilegesResponse = await privilegeService.getPrivilegesForCalendar();
      setFamilyPrivileges(Array.isArray(privilegesResponse) ? privilegesResponse : []);
      notifyDataChange('privileges');
    } catch (error) {
      console.error('Error refreshing privileges:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const refreshViolations = async () => {
    if (!authState.currentUser) return;
    
    try {
      setDataLoading(true);
      const violationsResponse = await ruleViolationService.getRuleViolationsForCalendar();
      setFamilyViolations(Array.isArray(violationsResponse) ? violationsResponse : []);
      notifyDataChange('violations');
    } catch (error) {
      console.error('Error refreshing violations:', error);
    } finally {
      setDataLoading(false);
    }
  };

  // Initialize cache when user logs in
  useEffect(() => {
    if (authState.currentUser) {
      refreshFamilyData();
    } else {
      // Clear cache when user logs out
      setFamilyTasks(null);
      setFamilyPrivileges(null);
      setFamilyViolations(null);
      setRules(null);
      setInitialLoading(true);
    }
  }, [authState.currentUser]);

  // Subscribe to data changes from API services
  useEffect(() => {
    if (!authState.currentUser) return;

    // Subscribe to task changes
    const unsubscribeTasks = taskService.subscribe(() => {
      console.log('Task data changed, refreshing tasks...');
      refreshTasks();
    });

    // Subscribe to privilege changes
    const unsubscribePrivileges = privilegeService.subscribe(() => {
      console.log('Privilege data changed, refreshing privileges...');
      refreshPrivileges();
    });

    // Subscribe to violation changes
    const unsubscribeViolations = ruleViolationService.subscribe(() => {
      console.log('Violation data changed, refreshing violations...');
      refreshViolations();
    });

    // Cleanup subscriptions on unmount or user change
    return () => {
      unsubscribeTasks();
      unsubscribePrivileges();
      unsubscribeViolations();
    };
  }, [authState.currentUser]);

  const refreshUserData = async (userId: string) => {
    setDataLoading(true);
    try {
      // Only refresh user-specific data (privileges and violations)
      // Tasks are filtered from family data
      await Promise.all([
        privilegeService.getUserPrivileges(userId),
        ruleViolationService.getChildRuleViolations(userId)
      ]);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const getUserTasks = async (userId: string, page = 1, limit = 10) => {
    try {
      const response = await taskService.getUserTasks(userId, page, limit);
      return {
        tasks: Array.isArray(response) ? response : (response.tasks || []),
        total: Array.isArray(response) ? response.length : (response.total || 0)
      };
    } catch (error) {
      console.error('Error fetching user tasks:', error);
      return { tasks: [], total: 0 };
    }
  };

  const getUserPrivileges = async (userId: string, page = 1, limit = 10) => {
    try {
      const response = await privilegeService.getUserPrivileges(userId, page, limit);
      return {
        privileges: Array.isArray(response) ? response : (response.privileges || []),
        total: Array.isArray(response) ? response.length : (response.total || 0)
      };
    } catch (error) {
      console.error('Error fetching user privileges:', error);
      return { privileges: [], total: 0 };
    }
  };

  const getUserViolations = async (userId: string, page = 1, limit = 10) => {
    try {
      const response = await ruleViolationService.getChildRuleViolations(userId, page, limit);
      return {
        violations: Array.isArray(response) ? response : (response.violations || []),
        total: Array.isArray(response) ? response.length : (response.total || 0)
      };
    } catch (error) {
      console.error('Error fetching user violations:', error);
      return { violations: [], total: 0 };
    }
  };

  const getAllTasks = async (page = 1, limit = 10) => {
    try {
      const response = await taskService.getTasks(page, limit);
      return {
        tasks: Array.isArray(response) ? response : (response.tasks || []),
        total: Array.isArray(response) ? response.length : (response.total || 0)
      };
    } catch (error) {
      console.error('Error fetching all tasks:', error);
      return { tasks: [], total: 0 };
    }
  };

  const getAllPrivileges = async (page = 1, limit = 10) => {
    try {
      const response = await privilegeService.getPrivileges(page, limit);
      return {
        privileges: Array.isArray(response) ? response : (response.privileges || []),
        total: Array.isArray(response) ? response.length : (response.total || 0)
      };
    } catch (error) {
      console.error('Error fetching all privileges:', error);
      return { privileges: [], total: 0 };
    }
  };

  const getAllViolations = async (page = 1, limit = 10) => {
    try {
      const response = await ruleViolationService.getRuleViolations(page, limit);
      return {
        violations: Array.isArray(response) ? response : (response.violations || []),
        total: Array.isArray(response) ? response.length : (response.total || 0)
      };
    } catch (error) {
      console.error('Error fetching all violations:', error);
      return { violations: [], total: 0 };
    }
  };

  const getCalendarTasks = (userId?: string) => {
    if (!familyTasks) return [];
    return familyTasks.filter(task => task.assignedTo.includes(userId || ''));
  };

  const subscribeToDataChanges = (listener: DataChangeListener) => {
    dataChangeListeners.push(listener);
    return () => {
      const index = dataChangeListeners.indexOf(listener);
      if (index > -1) {
        dataChangeListeners.splice(index, 1);
      }
    };
  };

  const contextValue: DataCache = {
    familyTasks,
    familyPrivileges,
    familyViolations,
    rules,
    initialLoading,
    dataLoading,
    refreshFamilyData,
    refreshUserData,
    refreshTasks,
    refreshPrivileges,
    refreshViolations,
    subscribeToDataChanges,
    getUserTasks,
    getUserPrivileges,
    getUserViolations,
    getAllTasks,
    getAllPrivileges,
    getAllViolations,
    getCalendarTasks
  };

  return (
    <DataCacheContext.Provider value={contextValue}>
      {children}
    </DataCacheContext.Provider>
  );
}; 