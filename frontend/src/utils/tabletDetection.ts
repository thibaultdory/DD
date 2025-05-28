// Tablet detection utilities

export interface TabletDetectionOptions {
  method: 'userAgent' | 'screenSize' | 'touchAndSize' | 'localStorage' | 'urlParam';
  customKey?: string; // For localStorage method
  paramName?: string; // For URL parameter method
}

export class TabletDetector {
  private static readonly TABLET_MIN_WIDTH = 768;
  private static readonly TABLET_MIN_HEIGHT = 1024;

  /**
   * Detect if device is a tablet using User Agent
   */
  static detectByUserAgent(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const tabletPatterns = [
      /ipad/,
      /android.*tablet/,
      /kindle/,
      /silk/,
      /playbook/,
      /bb10/,
      /rim.*tablet/,
      /surface/
    ];
    
    return tabletPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Detect if device is a tablet using screen dimensions
   */
  static detectByScreenSize(): boolean {
    const { width, height } = screen;
    const minDimension = Math.min(width, height);
    const maxDimension = Math.max(width, height);
    
    return (
      minDimension >= this.TABLET_MIN_WIDTH &&
      maxDimension >= this.TABLET_MIN_HEIGHT &&
      maxDimension <= 1366 // Exclude large desktop screens
    );
  }

  /**
   * Detect if device is a tablet using touch capability and screen size
   */
  static detectByTouchAndSize(): boolean {
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isTabletSize = this.detectByScreenSize();
    
    return hasTouchScreen && isTabletSize;
  }

  /**
   * Check if tablet mode is manually enabled via localStorage
   */
  static detectByLocalStorage(key: string = 'dd_tablet_mode'): boolean {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Check if tablet mode is enabled via URL parameter
   */
  static detectByUrlParam(paramName: string = 'tablet'): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(paramName) === 'true';
  }

  /**
   * Main detection method that combines multiple strategies
   */
  static isTablet(options: TabletDetectionOptions): boolean {
    switch (options.method) {
      case 'userAgent':
        return this.detectByUserAgent();
      case 'screenSize':
        return this.detectByScreenSize();
      case 'touchAndSize':
        return this.detectByTouchAndSize();
      case 'localStorage':
        return this.detectByLocalStorage(options.customKey);
      case 'urlParam':
        return this.detectByUrlParam(options.paramName);
      default:
        return false;
    }
  }

  /**
   * Enable tablet mode manually
   */
  static enableTabletMode(key: string = 'dd_tablet_mode'): void {
    try {
      localStorage.setItem(key, 'true');
    } catch (error) {
      console.warn('Could not save tablet mode to localStorage:', error);
    }
  }

  /**
   * Disable tablet mode manually
   */
  static disableTabletMode(key: string = 'dd_tablet_mode'): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Could not remove tablet mode from localStorage:', error);
    }
  }

  /**
   * Get all detection results for debugging
   */
  static getDetectionResults(): Record<string, boolean> {
    return {
      userAgent: this.detectByUserAgent(),
      screenSize: this.detectByScreenSize(),
      touchAndSize: this.detectByTouchAndSize(),
      localStorage: this.detectByLocalStorage(),
      urlParam: this.detectByUrlParam()
    };
  }
} 