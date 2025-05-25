import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Button,
  Avatar,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio
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
import { isPast as dateFnIsPast, isToday as dateFnIsToday, parseISO, format, addDays, subDays, isSameDay, startOfDay } from 'date-fns';
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
  const lastDataLoadRef = useRef<{ past: number, future: number }>({ past: 0, future: 0 });
  
  // Refs for scroll position preservation
  const beforeScrollTopRef = useRef(0);
  const beforeScrollHeightRef = useRef(0);
  const loadTypeRef = useRef<'past' | 'future' | null>(null);

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
  const [deleteChoice, setDeleteChoice] = useState<'single' | 'series'>('single');
  const [initialTimelineLoaded, setInitialTimelineLoaded] = useState(false);
  
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

  // Create timeline items from tasks and violations for a specific date range
  const createTimelineItemsForRange = useCallback((tasks: Task[], violations: RuleViolation[], startDate: Date, endDate: Date): TimelineItem[] => {
    console.log('[Timeline] Creating timeline items for range:', { 
      tasksCount: tasks.length, 
      violationsCount: violations.length,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    });

    // Log all incoming task due dates for this specific call
    if (tasks.length > 0) {
      console.log('[TimelineDebug] Incoming task dueDates for this range creation:', tasks.map(t => t.dueDate));
    }
    
    const items: TimelineItem[] = [];
    // Normalize range dates to the start of the day for accurate comparison
    const rangeStart = startOfDay(startDate);
    // To make the endDate inclusive, we check if the item is < start of the NEXT day
    const exclusiveRangeEnd = startOfDay(addDays(endDate, 1));
    
    // Filter tasks for this date range
    const filteredTasks = tasks.filter(task => {
      // Normalize task due date to the start of the day
      const taskDate = startOfDay(parseISO(task.dueDate));
      
      const isAfterOrOnStart = taskDate.getTime() >= rangeStart.getTime();
      const isStrictlyBeforeExclusiveEnd = taskDate.getTime() < exclusiveRangeEnd.getTime();

      // Detailed logging for tasks
      if (true) { // Easy to toggle logging
        console.log('[TimelineDebug] Task Check:', {
          id: task.id,
          title: task.title,
          originalDueDate: task.dueDate,
          normalizedTaskDateMs: taskDate.getTime(),
          normalizedTaskDateISO: taskDate.toISOString(),
          rangeStartMs: rangeStart.getTime(),
          rangeStartISO: rangeStart.toISOString(),
          exclusiveRangeEndMs: exclusiveRangeEnd.getTime(),
          exclusiveRangeEndISO: exclusiveRangeEnd.toISOString(),
          isAfterOrOnStart,
          isStrictlyBeforeExclusiveEnd,
          isInRange: isAfterOrOnStart && isStrictlyBeforeExclusiveEnd
        });
      }
      return isAfterOrOnStart && isStrictlyBeforeExclusiveEnd;
    });
    
    // Filter violations for this date range
    const filteredViolations = violations.filter(violation => {
      // Normalize violation date to the start of the day
      const violationDate = startOfDay(parseISO(violation.date));
      
      const isAfterOrOnStart = violationDate.getTime() >= rangeStart.getTime();
      const isStrictlyBeforeExclusiveEnd = violationDate.getTime() < exclusiveRangeEnd.getTime();
      
      // Detailed logging for violations
      if (true) { // Easy to toggle logging
        console.log('[TimelineDebug] Violation Check:', {
          id: violation.id,
          originalDate: violation.date,
          normalizedViolationDateMs: violationDate.getTime(),
          normalizedViolationDateISO: violationDate.toISOString(),
          rangeStartMs: rangeStart.getTime(),
          rangeStartISO: rangeStart.toISOString(),
          exclusiveRangeEndMs: exclusiveRangeEnd.getTime(),
          exclusiveRangeEndISO: exclusiveRangeEnd.toISOString(),
          isAfterOrOnStart,
          isStrictlyBeforeExclusiveEnd,
          isInRange: isAfterOrOnStart && isStrictlyBeforeExclusiveEnd
        });
      }
      return isAfterOrOnStart && isStrictlyBeforeExclusiveEnd;
    });
    
    console.log('[Timeline] Filtered for date range (using startOfDay):', {
      tasksInRange: filteredTasks.length,
      violationsInRange: filteredViolations.length
    });
    
    // Add tasks
    filteredTasks.forEach(task => {
      items.push({
        id: `task-${task.id}`,
        type: 'task',
        date: task.dueDate, // Use original dueDate for display and sorting consistency
        data: task
      });
    });
    
    // Add violations
    filteredViolations.forEach(violation => {
      items.push({
        id: `violation-${violation.id}`,
        type: 'violation',
        date: violation.date, // Use original date for display and sorting consistency
        data: violation
      });
    });
    
    // Sort by date (oldest first for chronological timeline)
    const sortedItems = items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    console.log('[Timeline] Created items for range:', {
      totalItems: sortedItems.length,
      itemIds: sortedItems.map(item => item.id)
    });
    
    return sortedItems;
  }, []);

  // Filter data based on selected child
  const getFilteredData = useCallback(() => {
    console.log('[Timeline] Filtering data for child:', selectedChild);
    
    if (!familyTasks || !familyViolations) {
      console.log('[Timeline] No family data available yet');
      return { tasks: [], violations: [] };
    }
    
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
    
    console.log('[Timeline] Filtered data:', {
      tasks: filteredTasks.length,
      violations: filteredViolations.length
    });
    
    return { tasks: filteredTasks, violations: filteredViolations };
  }, [familyTasks, familyViolations, selectedChild, authState.currentUser, getCalendarTasks]);

  // Load initial data and setup timeline - ONLY ONCE
  useEffect(() => {
    if (!authState.currentUser || initialLoading || initialTimelineLoaded) return;
    
    console.log('[Timeline] Loading initial data');
    
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const initialStart = subDays(new Date(), 7);
        const initialEnd = addDays(new Date(), 14);
        const startDateStr = format(initialStart, 'yyyy-MM-dd');
        const endDateStr = format(initialEnd, 'yyyy-MM-dd');
        
        console.log('[Timeline] Initial data range:', { startDateStr, endDateStr });
        
        await refreshFamilyDataForDateRange(startDateStr, endDateStr);
        
        // Set the date range after successful load
        setDateRange({ start: initialStart, end: initialEnd });
        setInitialTimelineLoaded(true);
        
        console.log('[Timeline] Initial data load completed');
      } catch (error) {
        console.error('[Timeline] Error loading initial timeline data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [authState.currentUser, initialLoading, initialTimelineLoaded, refreshFamilyDataForDateRange]);

  // Create initial timeline ONLY when initial data is loaded for the first time
  useEffect(() => {
    if (!initialTimelineLoaded || !familyTasks || !familyViolations) return;
    
    // Only create initial timeline if we don't have any items yet
    if (timelineItems.length === 0) {
      console.log('[Timeline] Creating initial timeline');
      
      const { tasks, violations } = getFilteredData();
      const items = createTimelineItemsForRange(tasks, violations, dateRange.start, dateRange.end);
      
      console.log('[Timeline] Setting initial timeline items:', items.length);
      setTimelineItems(items);
    }
  }, [initialTimelineLoaded, familyTasks, familyViolations, timelineItems.length, getFilteredData, createTimelineItemsForRange, dateRange]);

  // Handle child filter changes - recreate timeline only when child selection changes
  useEffect(() => {
    if (!initialTimelineLoaded) return;
    
    console.log('[Timeline] Child selection changed, recreating timeline for new filter');
    
    const { tasks, violations } = getFilteredData();
    const items = createTimelineItemsForRange(tasks, violations, dateRange.start, dateRange.end);
    
    console.log('[Timeline] Setting filtered timeline items:', items.length);
    setTimelineItems(items);
  }, [selectedChild]); // Only depend on selectedChild, not all the data

  // useLayoutEffect for scroll stabilization after timelineItems change
  useLayoutEffect(() => {
    if (!scrollContainerRef.current || !loadTypeRef.current) {
      // If no specific load type is set, or container not ready, do nothing.
      // This ensures this effect only acts on our specific past/future loads.
      return;
    }
    const scrollContainer = scrollContainerRef.current;

    if (loadTypeRef.current === 'past') {
      const currentScrollHeight = scrollContainer.scrollHeight;
      const previousScrollHeight = beforeScrollHeightRef.current;
      const previousScrollTop = beforeScrollTopRef.current;
      
      const heightDifference = currentScrollHeight - previousScrollHeight;

      // Only adjust if scrollHeight has actually increased and was previously non-zero
      if (heightDifference > 0 && previousScrollHeight > 0) {
        scrollContainer.scrollTop = previousScrollTop + heightDifference;
        console.log('[Timeline] Adjusted scroll for PAST load:', { previousScrollTop, previousScrollHeight, currentScrollHeight, heightDifference, newScrollTop: scrollContainer.scrollTop });
      } else {
        // If no height change (e.g., no unique items added) or unexpected scrollHeight, maintain previous scrollTop
        scrollContainer.scrollTop = previousScrollTop;
        console.log('[Timeline] Maintained scroll for PAST load (no height change or unexpected height):', { previousScrollTop, currentScrollHeight });
      }
    } else if (loadTypeRef.current === 'future') {
      // For future loads, content is appended, so we want to maintain the current scroll position.
      scrollContainer.scrollTop = beforeScrollTopRef.current;
      console.log('[Timeline] Maintained scroll for FUTURE load at:', beforeScrollTopRef.current);
    }

    loadTypeRef.current = null; // Reset the load type ref after handling
  }, [timelineItems]); // This effect depends on timelineItems changing

  // Auto-scroll to today's items on initial load (only once)
  useEffect(() => {
    if (timelineItems.length > 0 && !loading && !initialLoading && !hasAutoScrolled.current) {
      console.log('[Timeline] Auto-scrolling to today');
      
      const timer = setTimeout(() => {
        const todayItem = timelineItems.find(item => 
          isSameDay(parseISO(item.date), new Date())
        );
        
        if (todayItem && scrollContainerRef.current) {
          console.log('[Timeline] Found today item, scrolling to it:', todayItem.id);
          const itemElement = scrollContainerRef.current.querySelector(`[data-item-id="${todayItem.id}"]`);
          if (itemElement) {
            itemElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' // Changed to 'start' for better positioning in chronological view
            });
          }
        } else {
          // If no today item found, scroll to approximately where today would be
          const scrollContainer = scrollContainerRef.current;
          if (scrollContainer) {
            console.log('[Timeline] No today item found, calculating scroll position');
            const today = new Date();
            const containerHeight = scrollContainer.scrollHeight;
            const containerClientHeight = scrollContainer.clientHeight;
            
            // Find the relative position of today in the date range
            const startTime = dateRange.start.getTime();
            const endTime = dateRange.end.getTime();
            const todayTime = today.getTime();
            
            if (todayTime >= startTime && todayTime <= endTime) {
              const relativePosition = (todayTime - startTime) / (endTime - startTime);
              const scrollPosition = Math.max(0, (containerHeight - containerClientHeight) * relativePosition);
              
              console.log('[Timeline] Scrolling to calculated position:', scrollPosition);
              scrollContainer.scrollTo({
                top: scrollPosition,
                behavior: 'smooth'
              });
            }
          }
        }
      }, 1000); // Increased timeout to ensure data is fully rendered
      
      hasAutoScrolled.current = true;
      
      return () => clearTimeout(timer);
    }
  }, [timelineItems, loading, initialLoading, dateRange]); // Added dateRange to dependencies

  // Load more data in past direction - PREPEND new items to beginning
  const loadPastData = useCallback(async () => {
    if (loadingPast || loadingFuture || !initialTimelineLoaded) {
      console.log('[Timeline] Already loading data or timeline not ready, skipping past data load');
      return;
    }
    
    const now = Date.now();
    if (now - lastDataLoadRef.current.past < 2000) {
      console.log('[Timeline] Past data load too recent, skipping');
      return;
    }
    
    console.log('[Timeline] Loading past data');
    setLoadingPast(true);
    lastDataLoadRef.current.past = now;
    
    try {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      
      // Store scroll position *before* any data fetching or state changes
      beforeScrollTopRef.current = scrollContainer.scrollTop;
      beforeScrollHeightRef.current = scrollContainer.scrollHeight;
      loadTypeRef.current = 'past'; // Indicate that a 'past' load is about to happen

      // const beforeScrollTop = scrollContainer.scrollTop; // No longer needed here
      // const beforeScrollHeight = scrollContainer.scrollHeight; // No longer needed here
      
      console.log('[Timeline] Before past load - Stored scroll:', beforeScrollTopRef.current, 'Stored height:', beforeScrollHeightRef.current);
      
      const newStart = subDays(dateRange.start, 7);
      // Corrected endDate for fetching: it should be the day *before* the current dateRange.start
      const fetchEndDate = subDays(dateRange.start, 1);
      
      const startDateStr = format(newStart, 'yyyy-MM-dd');
      const endDateStr = format(fetchEndDate, 'yyyy-MM-dd');
      
      console.log('[Timeline] Loading past data range:', { startDateStr, endDateStr });
      
      await refreshFamilyDataForDateRange(startDateStr, endDateStr);
      
      // Directly use familyTasks and familyViolations from the hook's scope.
      // These should be the updated values if DataCacheProvider updates them and causes re-render/callback recreation.
      console.log('[Timeline] After refresh, context familyTasks count:', familyTasks?.length, 'familyViolations count:', familyViolations?.length);
      const itemsToProcessTasks = familyTasks || [];
      const itemsToProcessViolations = familyViolations || [];

      // Create new items ONLY for the new date range (newStart to fetchEndDate)
      // Pass the potentially updated familyTasks/Violations from context here.
      const newItems = createTimelineItemsForRange(itemsToProcessTasks, itemsToProcessViolations, newStart, fetchEndDate);
      
      console.log('[Timeline] New past items to process:', newItems.length);
      
      setTimelineItems(prevItems => {
        const existingItemIds = new Set(prevItems.map(item => item.id));
        const uniqueNewItems = newItems.filter(item => !existingItemIds.has(item.id));
        
        console.log('[Timeline] Unique new past items to prepend:', uniqueNewItems.length);
        
        if (uniqueNewItems.length === 0) {
          console.log('[Timeline] No unique new past items to add.');
          return prevItems;
        }

        // Combine and re-sort to ensure chronological order
        const combinedItems = [...uniqueNewItems, ...prevItems];
        const sortedItems = combinedItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        console.log('[Timeline] Timeline after prepending and sorting past items:', {
          oldCount: prevItems.length,
          addedCount: uniqueNewItems.length,
          totalCount: sortedItems.length
        });
        return sortedItems;
      });
      
      // Update date range only after items are set
      setDateRange(prev => ({ ...prev, start: newStart }));
      
      console.log('[Timeline] Past data load completed');
      
      // REMOVE OLD setTimeout for scroll adjustment
      // setTimeout(() => { ... }, 250);
      
    } catch (error) {
      console.error('[Timeline] Error loading past data:', error);
    } finally {
      setLoadingPast(false);
    }
  }, [loadingPast, loadingFuture, initialTimelineLoaded, dateRange.start, refreshFamilyDataForDateRange, getFilteredData, createTimelineItemsForRange, familyTasks, familyViolations]);

  // Load more data in future direction - APPEND new items to end
  const loadFutureData = useCallback(async () => {
    if (loadingPast || loadingFuture || !initialTimelineLoaded) {
      console.log('[Timeline] Already loading data or timeline not ready, skipping future data load');
      return;
    }
    
    const now = Date.now();
    if (now - lastDataLoadRef.current.future < 2000) {
      console.log('[Timeline] Future data load too recent, skipping');
      return;
    }
    
    console.log('[Timeline] Loading future data');
    setLoadingFuture(true);
    lastDataLoadRef.current.future = now;
    
    try {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;
      
      // Store scroll position *before* any data fetching or state changes
      beforeScrollTopRef.current = scrollContainer.scrollTop;
      // beforeScrollHeightRef is not strictly needed for future loads but good practice if logic changes
      // beforeScrollHeightRef.current = scrollContainer.scrollHeight; 
      loadTypeRef.current = 'future'; // Indicate that a 'future' load is about to happen

      // const beforeScrollTop = scrollContainer.scrollTop; // No longer needed here
      
      console.log('[Timeline] Before future load - Stored scroll:', beforeScrollTopRef.current);
      
      const newEnd = addDays(dateRange.end, 7);
      // Corrected startDate for fetching: it should be the day *after* the current dateRange.end
      const fetchStartDate = addDays(dateRange.end, 1);

      const startDateStr = format(fetchStartDate, 'yyyy-MM-dd');
      const endDateStr = format(newEnd, 'yyyy-MM-dd');
      
      console.log('[Timeline] Loading future data range:', { startDateStr, endDateStr });
      
      await refreshFamilyDataForDateRange(startDateStr, endDateStr);
      
      // Directly use familyTasks and familyViolations from the hook's scope.
      console.log('[Timeline] After refresh, context familyTasks count:', familyTasks?.length, 'familyViolations count:', familyViolations?.length);
      const itemsToProcessTasksFuture = familyTasks || [];
      const itemsToProcessViolationsFuture = familyViolations || [];

      // Create new items ONLY for the new date range (fetchStartDate to newEnd)
      // Pass the potentially updated familyTasks/Violations from context here.
      const newItems = createTimelineItemsForRange(itemsToProcessTasksFuture, itemsToProcessViolationsFuture, fetchStartDate, newEnd);
      
      console.log('[Timeline] New future items to process:', newItems.length);
      
      setTimelineItems(prevItems => {
        const existingItemIds = new Set(prevItems.map(item => item.id));
        const uniqueNewItems = newItems.filter(item => !existingItemIds.has(item.id));

        console.log('[Timeline] Unique new future items to append:', uniqueNewItems.length);

        if (uniqueNewItems.length === 0) {
          console.log('[Timeline] No unique new future items to add.');
          return prevItems;
        }

        // Combine and re-sort to ensure chronological order
        const combinedItems = [...prevItems, ...uniqueNewItems];
        const sortedItems = combinedItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        console.log('[Timeline] Timeline after appending and sorting future items:', {
          oldCount: prevItems.length,
          addedCount: uniqueNewItems.length,
          totalCount: sortedItems.length
        });
        return sortedItems;
      });
      
      // Update date range only after items are set
      setDateRange(prev => ({ ...prev, end: newEnd }));
      
      console.log('[Timeline] Future data load completed');
      
      // REMOVE OLD setTimeout for scroll adjustment
      // setTimeout(() => { ... }, 250);
      
    } catch (error) {
      console.error('[Timeline] Error loading future data:', error);
    } finally {
      setLoadingFuture(false);
    }
  }, [loadingPast, loadingFuture, initialTimelineLoaded, dateRange.end, refreshFamilyDataForDateRange, getFilteredData, createTimelineItemsForRange, familyTasks, familyViolations]);

  // Improved scroll event handler for infinite scroll with extensive logging
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const scrollThreshold = 10; // Trigger loading when 10px from edge
    
    // Only log every 10th scroll event to avoid spam
    if (Math.random() < 0.1) {
      console.log('[Timeline] Scroll event:', { 
        scrollTop, 
        scrollHeight, 
        clientHeight, 
        nearTop: scrollTop < 300,
        nearBottom: scrollHeight - scrollTop - clientHeight < 300,
        loadingPast,
        loadingFuture
      });
    }
    
    // Near top - load past data (chronological: older events)
    if (scrollTop < scrollThreshold && !loadingPast && !loadingFuture && initialTimelineLoaded) {
      console.log('[Timeline] Triggering past data load from scroll (scrollTop < threshold)');
      loadPastData();
    }
    
    // Near bottom - load future data (chronological: newer events)
    if (scrollHeight - scrollTop - clientHeight < scrollThreshold && !loadingFuture && !loadingPast && initialTimelineLoaded) {
      console.log('[Timeline] Triggering future data load from scroll (bottom < threshold)');
      loadFutureData();
    }
  }, [loadingPast, loadingFuture, loadPastData, loadFutureData, initialTimelineLoaded]);

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
      
      // Refresh the timeline data to reflect the changes
      const startDateStr = format(dateRange.start, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.end, 'yyyy-MM-dd');
      await refreshFamilyDataForDateRange(startDateStr, endDateStr);
      
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  };

  const handleEditTask = (task: Task) => {
    navigate(`/tasks/edit/${task.id}`);
  };

  const handleDeleteTask = (task: Task) => {
    setTaskToDelete(task);
    setDeleteChoice('single'); // Default to single instance
    setDeleteDialogOpen(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      // Determine if we should delete future instances based on user choice
      let deleteFuture = false;
      
      if (taskToDelete.isRecurring || taskToDelete.parentTaskId) {
        // For any recurring task (parent or instance), respect user's choice
        deleteFuture = deleteChoice === 'series';
      }
      
      await taskService.deleteTask(taskToDelete.id, deleteFuture);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      
      // Refresh the timeline data to reflect the changes
      const startDateStr = format(dateRange.start, 'yyyy-MM-dd');
      const endDateStr = format(dateRange.end, 'yyyy-MM-dd');
      await refreshFamilyDataForDateRange(startDateStr, endDateStr);
      
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
              .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
              .map(date => {
                const dayItems = groupedItems[date];
                const isToday = isSameDay(parseISO(date), new Date());
                const parsedDate = parseISO(date);

                return (
                  <Box key={date} sx={{ mb: 2 }}>
                    {/* Date Header */}
                    <Box sx={{ 
                      p: 2, 
                      borderTop: '1px solid',
                      borderBottom: '1px solid',
                      borderColor: isToday ? 'primary.light' : 'grey.300',
                      borderLeft: isToday ? '2px solid' : 'none',
                      borderRight: isToday ? '2px solid' : 'none',
                      borderWidth: isToday ? '2px' : '1px',
                      borderTopColor: isToday ? 'primary.light' : 'grey.300',
                      borderBottomColor: isToday ? 'primary.light' : 'grey.300',
                      borderLeftColor: isToday ? 'primary.light' : 'transparent',
                      borderRightColor: isToday ? 'primary.light' : 'transparent',
                      borderLeftWidth: isToday ? '2px' : '0px',
                      borderRightWidth: isToday ? '2px' : '0px',
                      borderTopWidth: '1px',
                      borderStyle: 'solid',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                      backgroundColor: 'background.paper'
                    }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          color: isToday ? 'primary.main' : 'text.primary',
                          fontWeight: isToday ? 'bold' : '600'
                        }}
                      >
                        {isToday ? 'Aujourd\'hui' : format(parsedDate, 'EEEE d MMMM yyyy', { locale: fr })}
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
                                          {task.assignedTo.length > 1 
                                            ? `${getFirstName(getUserName(task.assignedTo[0]))} +${task.assignedTo.length - 1}`
                                            : getFirstName(getUserName(task.assignedTo[0]))
                                          }
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
                
                {(taskToDelete.isRecurring || taskToDelete.parentTaskId) && (
                  <>
                    <br /><br />
                    <strong>Options de suppression :</strong>
                    <Box sx={{ mt: 2 }}>
                      <FormControl component="fieldset">
                        <RadioGroup
                          value={deleteChoice}
                          onChange={(e) => setDeleteChoice(e.target.value as 'single' | 'series')}
                        >
                          <FormControlLabel
                            value="single"
                            control={<Radio />}
                            label={
                              taskToDelete.parentTaskId 
                                ? "Supprimer uniquement cette occurrence" 
                                : "Supprimer uniquement cette occurrence (garder les futures)"
                            }
                          />
                          <FormControlLabel
                            value="series"
                            control={<Radio />}
                            label={
                              taskToDelete.parentTaskId
                                ? "Supprimer toute la série de tâches récurrentes"
                                : "Supprimer cette tâche et toutes les occurrences futures"
                            }
                          />
                        </RadioGroup>
                      </FormControl>
                    </Box>
                  </>
                )}
                
                {!taskToDelete.isRecurring && !taskToDelete.parentTaskId && (
                  <><br /><br />
                  <strong>Note :</strong> Cette tâche sera définitivement supprimée.
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