import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PinProfile, PinAuthState, TabletConfig } from '../types';
import { TabletDetector, TabletDetectionOptions } from '../utils/tabletDetection';
import { ScreenLockDetector } from '../utils/screenLockDetection';

// Default tablet configuration
const defaultTabletConfig: TabletConfig = {
  enabled: false,
  autoLogoutOnScreenOff: true,
  profiles: []
};

// Default PIN auth state
const defaultPinAuthState: PinAuthState = {
  isTabletMode: false,
  isPinAuthenticated: false,
  currentPinProfile: null,
  availableProfiles: []
};

// PIN Context interface
interface PinContextType {
  pinAuthState: PinAuthState;
  tabletConfig: TabletConfig;
  authenticateWithPin: (profileId: string, pin: string) => Promise<boolean>;
  logoutPin: () => void;
  setupTabletMode: (profiles: PinProfile[]) => void;
  addProfile: (profile: Omit<PinProfile, 'id'>) => void;
  updateProfile: (profileId: string, updates: Partial<PinProfile>) => void;
  removeProfile: (profileId: string) => void;
  enableTabletMode: () => void;
  disableTabletMode: () => void;
  isTabletModeAvailable: () => boolean;
  getTabletDetectionResults: () => Record<string, boolean>;
}

// Create context
const PinContext = createContext<PinContextType | undefined>(undefined);

// Hook to use PIN context
export const usePin = (): PinContextType => {
  const context = useContext(PinContext);
  if (!context) {
    throw new Error('usePin must be used within a PinProvider');
  }
  return context;
};

// PIN Provider props
interface PinProviderProps {
  children: ReactNode;
  tabletDetectionOptions?: TabletDetectionOptions;
}

// PIN Provider component
export const PinProvider: React.FC<PinProviderProps> = ({ 
  children, 
  tabletDetectionOptions = { method: 'localStorage' }
}) => {
  const [pinAuthState, setPinAuthState] = useState<PinAuthState>(defaultPinAuthState);
  const [tabletConfig, setTabletConfig] = useState<TabletConfig>(defaultTabletConfig);
  const [screenLockDetector] = useState(() => ScreenLockDetector.getInstance());

  // Load saved configuration on mount
  useEffect(() => {
    loadSavedConfig();
    checkTabletMode();
    setupScreenLockDetection();

    return () => {
      screenLockDetector.stopListening();
    };
  }, []);

  // Load configuration from localStorage
  const loadSavedConfig = (): void => {
    try {
      const savedConfig = localStorage.getItem('dd_tablet_config');
      if (savedConfig) {
        const config: TabletConfig = JSON.parse(savedConfig);
        setTabletConfig(config);
        setPinAuthState(prev => ({
          ...prev,
          availableProfiles: config.profiles
        }));
      }
    } catch (error) {
      console.warn('Failed to load tablet config:', error);
    }
  };

  // Save configuration to localStorage
  const saveConfig = (config: TabletConfig): void => {
    try {
      localStorage.setItem('dd_tablet_config', JSON.stringify(config));
    } catch (error) {
      console.warn('Failed to save tablet config:', error);
    }
  };

  // Check if tablet mode should be enabled
  const checkTabletMode = (): void => {
    const isTablet = TabletDetector.isTablet(tabletDetectionOptions);
    setPinAuthState(prev => ({
      ...prev,
      isTabletMode: isTablet
    }));
  };

  // Setup screen lock detection
  const setupScreenLockDetection = (): void => {
    screenLockDetector.startListening({
      onScreenLock: () => {
        if (tabletConfig.enabled && tabletConfig.autoLogoutOnScreenOff) {
          logoutPin();
        }
      },
      debounceMs: 2000 // 2 second delay to avoid false positives
    });
  };

  // Authenticate with PIN
  const authenticateWithPin = async (profileId: string, pin: string): Promise<boolean> => {
    const profile = tabletConfig.profiles.find(p => p.id === profileId);
    
    if (!profile || profile.pin !== pin) {
      return false;
    }

    setPinAuthState(prev => ({
      ...prev,
      isPinAuthenticated: true,
      currentPinProfile: profile
    }));

    return true;
  };

  // Logout from PIN authentication
  const logoutPin = (): void => {
    setPinAuthState(prev => ({
      ...prev,
      isPinAuthenticated: false,
      currentPinProfile: null
    }));
  };

  // Setup tablet mode with profiles
  const setupTabletMode = (profiles: PinProfile[]): void => {
    const newConfig: TabletConfig = {
      ...tabletConfig,
      enabled: true,
      profiles
    };
    
    setTabletConfig(newConfig);
    setPinAuthState(prev => ({
      ...prev,
      availableProfiles: profiles
    }));
    
    saveConfig(newConfig);
  };

  // Add a new profile
  const addProfile = (profileData: Omit<PinProfile, 'id'>): void => {
    const newProfile: PinProfile = {
      ...profileData,
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const updatedProfiles = [...tabletConfig.profiles, newProfile];
    const newConfig = { ...tabletConfig, profiles: updatedProfiles };
    
    setTabletConfig(newConfig);
    setPinAuthState(prev => ({
      ...prev,
      availableProfiles: updatedProfiles
    }));
    
    saveConfig(newConfig);
  };

  // Update an existing profile
  const updateProfile = (profileId: string, updates: Partial<PinProfile>): void => {
    const updatedProfiles = tabletConfig.profiles.map(profile =>
      profile.id === profileId ? { ...profile, ...updates } : profile
    );

    const newConfig = { ...tabletConfig, profiles: updatedProfiles };
    
    setTabletConfig(newConfig);
    setPinAuthState(prev => ({
      ...prev,
      availableProfiles: updatedProfiles,
      currentPinProfile: prev.currentPinProfile?.id === profileId 
        ? { ...prev.currentPinProfile, ...updates }
        : prev.currentPinProfile
    }));
    
    saveConfig(newConfig);
  };

  // Remove a profile
  const removeProfile = (profileId: string): void => {
    const updatedProfiles = tabletConfig.profiles.filter(profile => profile.id !== profileId);
    const newConfig = { ...tabletConfig, profiles: updatedProfiles };
    
    setTabletConfig(newConfig);
    setPinAuthState(prev => ({
      ...prev,
      availableProfiles: updatedProfiles,
      currentPinProfile: prev.currentPinProfile?.id === profileId ? null : prev.currentPinProfile,
      isPinAuthenticated: prev.currentPinProfile?.id === profileId ? false : prev.isPinAuthenticated
    }));
    
    saveConfig(newConfig);
  };

  // Enable tablet mode
  const enableTabletMode = (): void => {
    TabletDetector.enableTabletMode();
    const newConfig = { ...tabletConfig, enabled: true };
    setTabletConfig(newConfig);
    setPinAuthState(prev => ({ ...prev, isTabletMode: true }));
    saveConfig(newConfig);
  };

  // Disable tablet mode
  const disableTabletMode = (): void => {
    TabletDetector.disableTabletMode();
    const newConfig = { ...tabletConfig, enabled: false };
    setTabletConfig(newConfig);
    setPinAuthState(prev => ({ 
      ...prev, 
      isTabletMode: false,
      isPinAuthenticated: false,
      currentPinProfile: null
    }));
    saveConfig(newConfig);
  };

  // Check if tablet mode is available
  const isTabletModeAvailable = (): boolean => {
    return TabletDetector.isTablet(tabletDetectionOptions);
  };

  // Get tablet detection results for debugging
  const getTabletDetectionResults = (): Record<string, boolean> => {
    return TabletDetector.getDetectionResults();
  };

  const value: PinContextType = {
    pinAuthState,
    tabletConfig,
    authenticateWithPin,
    logoutPin,
    setupTabletMode,
    addProfile,
    updateProfile,
    removeProfile,
    enableTabletMode,
    disableTabletMode,
    isTabletModeAvailable,
    getTabletDetectionResults
  };

  return (
    <PinContext.Provider value={value}>
      {children}
    </PinContext.Provider>
  );
}; 