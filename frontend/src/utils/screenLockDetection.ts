// Screen lock detection utilities

export interface ScreenLockOptions {
  onScreenLock?: () => void;
  onScreenUnlock?: () => void;
  debounceMs?: number;
}

export class ScreenLockDetector {
  private static instance: ScreenLockDetector | null = null;
  private isListening = false;
  private lastVisibilityChange = Date.now();
  private debounceTimer: number | null = null;
  private options: ScreenLockOptions = {};

  private constructor() {}

  static getInstance(): ScreenLockDetector {
    if (!this.instance) {
      this.instance = new ScreenLockDetector();
    }
    return this.instance;
  }

  /**
   * Start listening for screen lock events
   */
  startListening(options: ScreenLockOptions = {}): void {
    if (this.isListening) {
      return;
    }

    this.options = { debounceMs: 1000, ...options };
    this.isListening = true;

    // Listen for visibility change events
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    // Listen for page focus/blur events (backup method)
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);

    // Listen for page hide/show events (for mobile)
    window.addEventListener('pagehide', this.handlePageHide);
    window.addEventListener('pageshow', this.handlePageShow);
  }

  /**
   * Stop listening for screen lock events
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    window.removeEventListener('pagehide', this.handlePageHide);
    window.removeEventListener('pageshow', this.handlePageShow);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.triggerScreenLock();
    } else {
      this.triggerScreenUnlock();
    }
  };

  private handleWindowBlur = (): void => {
    this.triggerScreenLock();
  };

  private handleWindowFocus = (): void => {
    this.triggerScreenUnlock();
  };

  private handlePageHide = (): void => {
    this.triggerScreenLock();
  };

  private handlePageShow = (): void => {
    this.triggerScreenUnlock();
  };

  private triggerScreenLock(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const timeSinceLastChange = Date.now() - this.lastVisibilityChange;
      
      // Only trigger if enough time has passed to avoid false positives
      if (timeSinceLastChange > (this.options.debounceMs || 1000)) {
        this.options.onScreenLock?.();
      }
      
      this.lastVisibilityChange = Date.now();
    }, this.options.debounceMs || 1000);
  }

  private triggerScreenUnlock(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.lastVisibilityChange = Date.now();
    this.options.onScreenUnlock?.();
  }

  /**
   * Check if the screen is currently locked/hidden
   */
  isScreenLocked(): boolean {
    return document.hidden;
  }

  /**
   * Get the time since the last visibility change
   */
  getTimeSinceLastChange(): number {
    return Date.now() - this.lastVisibilityChange;
  }
} 