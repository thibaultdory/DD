import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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
  refreshFamilyDataForDateRange: (startDate: string, endDate: string) => Promise<void>;
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
  const isRefreshingDateRangeRef = useRef(false);
  const lastFetchedRangeRef = useRef<string | null>(null);

  const refreshFamilyData = useCallback(async () => {
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
  }, [authState.currentUser]);

  const refreshFamilyDataForDateRange = useCallback(async (startDate: string, endDate: string) => {
    if (!authState.currentUser) return;
    
    const rangeKey = `${startDate}_${endDate}`;
    
    // Prevent fetching the same range multiple times in quick succession
    if (lastFetchedRangeRef.current === rangeKey && dataLoading) {
      console.log(`[DataCache] Skipping duplicate request for range: ${startDate} to ${endDate}`);
      return;
    }
    
    console.log(`[DataCache] Starting date range refresh: ${startDate} to ${endDate}`);
    
    try {
      setDataLoading(true);
      isRefreshingDateRangeRef.current = true;
      lastFetchedRangeRef.current = rangeKey;
      
      // Fetch data for the specific date range in parallel
      const [rulesResponse, tasksResponse, privilegesResponse, violationsResponse] = await Promise.all([
        ruleService.getRules(), // Rules don't change with date range
        taskService.getTasksForCalendarRange(startDate, endDate),
        privilegeService.getPrivilegesForCalendarRange(startDate, endDate),
        ruleViolationService.getRuleViolationsForCalendarRange(startDate, endDate)
      ]);

      setRules(rulesResponse);

      // Merge tasks, ensuring uniqueness and preferring newer items
      setFamilyTasks(prevFamilyTasks => {
        const newTasks = Array.isArray(tasksResponse) ? tasksResponse : [];
        if (!prevFamilyTasks) return newTasks;

        const taskMap = new Map<string, Task>();
        prevFamilyTasks.forEach(task => taskMap.set(task.id, task));
        newTasks.forEach(task => taskMap.set(task.id, task)); // New tasks overwrite old if IDs match
        return Array.from(taskMap.values());
      });

      // Merge privileges, ensuring uniqueness and preferring newer items
      setFamilyPrivileges(prevFamilyPrivileges => {
        const newPrivileges = Array.isArray(privilegesResponse) ? privilegesResponse : [];
        if (!prevFamilyPrivileges) return newPrivileges;

        const privilegeMap = new Map<string, Privilege>();
        prevFamilyPrivileges.forEach(privilege => privilegeMap.set(privilege.id, privilege));
        newPrivileges.forEach(privilege => privilegeMap.set(privilege.id, privilege)); // New privileges overwrite old
        return Array.from(privilegeMap.values());
      });

      // Merge violations, ensuring uniqueness and preferring newer items
      setFamilyViolations(prevFamilyViolations => {
        const newViolations = Array.isArray(violationsResponse) ? violationsResponse : [];
        if (!prevFamilyViolations) return newViolations;

        const violationMap = new Map<string, RuleViolation>();
        prevFamilyViolations.forEach(violation => violationMap.set(violation.id, violation));
        newViolations.forEach(violation => violationMap.set(violation.id, violation)); // New violations overwrite old
        return Array.from(violationMap.values());
      });
      
      console.log(`[DataCache] Date range refresh completed and data merged: ${startDate} to ${endDate}`);
    } catch (error) {
      console.error('Error refreshing family data for date range:', error);
    } finally {
      setDataLoading(false);
      isRefreshingDateRangeRef.current = false;
    }
  }, [authState.currentUser]);

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
      // Ignore subscription events during date range refresh to prevent cascading calls
      if (isRefreshingDateRangeRef.current) return;
      console.log('Task data changed, refreshing tasks...');
      refreshTasks();
    });

    // Subscribe to privilege changes
    const unsubscribePrivileges = privilegeService.subscribe(() => {
      // Ignore subscription events during date range refresh to prevent cascading calls
      if (isRefreshingDateRangeRef.current) return;
      console.log('Privilege data changed, refreshing privileges...');
      refreshPrivileges();
    });

    // Subscribe to violation changes
    const unsubscribeViolations = ruleViolationService.subscribe(() => {
      // Ignore subscription events during date range refresh to prevent cascading calls
      if (isRefreshingDateRangeRef.current) return;
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
    refreshFamilyDataForDateRange,
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