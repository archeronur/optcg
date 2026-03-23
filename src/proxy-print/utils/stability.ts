// Stabilite ve memory leak önleme için yardımcı fonksiyonlar

// Memory usage monitoring
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private memoryThreshold = 100 * 1024 * 1024; // 100MB
  private checkInterval: NodeJS.Timeout | null = null;

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  startMonitoring(intervalMs: number = 5000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private checkMemoryUsage(): void {
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      const usedMemory = memoryInfo.usedJSHeapSize;
      const totalMemory = memoryInfo.totalJSHeapSize;
      const memoryLimit = memoryInfo.jsHeapSizeLimit;

      console.log(`Memory usage: ${this.formatBytes(usedMemory)} / ${this.formatBytes(totalMemory)} (limit: ${this.formatBytes(memoryLimit)})`);

      if (usedMemory > this.memoryThreshold) {
        console.warn('High memory usage detected, triggering garbage collection');
        this.triggerGarbageCollection();
      }
    }
  }

  private triggerGarbageCollection(): void {
    // Force garbage collection if available
    if ('gc' in window) {
      try {
        (window as any).gc();
        console.log('Garbage collection triggered');
      } catch (error) {
        console.log('Garbage collection failed:', error);
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Error boundary için error tracking
export class ErrorTracker {
  private static errors: Array<{ error: Error; timestamp: number; context: string }> = [];
  private static maxErrors = 100;

  static trackError(error: Error, context: string = 'unknown'): void {
    this.errors.push({
      error,
      timestamp: Date.now(),
      context
    });

    // Eski hataları temizle
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Console'a log
    console.error(`Error tracked in ${context}:`, error);

    // Critical error threshold kontrolü
    if (this.errors.length > 50) {
      console.warn('High error rate detected, application may be unstable');
    }
  }

  static getRecentErrors(minutes: number = 5): Array<{ error: Error; timestamp: number; context: string }> {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.errors.filter(error => error.timestamp > cutoff);
  }

  static clearErrors(): void {
    this.errors = [];
  }

  static getErrorCount(): number {
    return this.errors.length;
  }
}

// Network stability monitoring
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private connection: any;
  private listeners: Array<() => void> = [];

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  constructor() {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      this.connection = (navigator as any).connection;
      this.setupNetworkListeners();
    }
  }

  private setupNetworkListeners(): void {
    if (this.connection) {
      this.connection.addEventListener('change', () => {
        this.handleNetworkChange();
      });
    }

    if (typeof window !== 'undefined') {
      // Online/offline events
      window.addEventListener('online', () => {
        this.handleNetworkChange();
      });

      window.addEventListener('offline', () => {
        this.handleNetworkChange();
      });
    }
  }

  private handleNetworkChange(): void {
    const isOnline = navigator.onLine;
    const effectiveType = this.connection?.effectiveType || 'unknown';
    const downlink = this.connection?.downlink || 'unknown';

    console.log(`Network status: ${isOnline ? 'online' : 'offline'}, type: ${effectiveType}, speed: ${downlink}Mbps`);

    // Network değişikliklerini dinleyenlere bildir
    this.listeners.forEach(listener => listener());
  }

  addNetworkChangeListener(listener: () => void): void {
    this.listeners.push(listener);
  }

  removeNetworkChangeListener(listener: () => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  isOnline(): boolean {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine;
  }

  getNetworkInfo(): { isOnline: boolean; effectiveType: string; downlink: number | string } {
    if (typeof navigator === 'undefined') {
      return { isOnline: false, effectiveType: 'unknown', downlink: 'unknown' };
    }
    return {
      isOnline: navigator.onLine,
      effectiveType: this.connection?.effectiveType || 'unknown',
      downlink: this.connection?.downlink || 'unknown'
    };
  }
}

// Application health checker
export class HealthChecker {
  private static instance: HealthChecker;
  private healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  private checks: Array<() => Promise<boolean>> = [];

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  addHealthCheck(check: () => Promise<boolean>): void {
    this.checks.push(check);
  }

  async runHealthChecks(): Promise<{ status: string; details: Array<{ name: string; passed: boolean; error?: string }> }> {
    const results = await Promise.allSettled(
      this.checks.map(async (check, index) => {
        try {
          const passed = await check();
          return { name: `Check ${index + 1}`, passed, error: undefined };
        } catch (error: any) {
          return { name: `Check ${index + 1}`, passed: false, error: error.message };
        }
      })
    );

    const details = results.map(result => 
      result.status === 'fulfilled' ? result.value : { name: 'Unknown', passed: false, error: 'Check failed' }
    );

    const passedChecks = details.filter(detail => detail.passed).length;
    const totalChecks = details.length;

    if (passedChecks === totalChecks) {
      this.healthStatus = 'healthy';
    } else if (passedChecks >= totalChecks * 0.7) {
      this.healthStatus = 'warning';
    } else {
      this.healthStatus = 'critical';
    }

    return {
      status: this.healthStatus,
      details
    };
  }

  getHealthStatus(): string {
    return this.healthStatus;
  }
}

// Resource cleanup manager
export class ResourceManager {
  private static resources: Array<{ name: string; cleanup: () => void }> = [];

  static registerResource(name: string, cleanup: () => void): void {
    this.resources.push({ name, cleanup });
  }

  static cleanupResource(name: string): void {
    const resource = this.resources.find(r => r.name === name);
    if (resource) {
      try {
        resource.cleanup();
        this.resources = this.resources.filter(r => r.name !== name);
        console.log(`Resource cleaned up: ${name}`);
      } catch (error) {
        console.error(`Failed to cleanup resource ${name}:`, error);
      }
    }
  }

  static cleanupAll(): void {
    console.log(`Cleaning up ${this.resources.length} resources...`);
    
    this.resources.forEach(({ name, cleanup }) => {
      try {
        cleanup();
        console.log(`Resource cleaned up: ${name}`);
      } catch (error) {
        console.error(`Failed to cleanup resource ${name}:`, error);
      }
    });

    this.resources = [];
    console.log('All resources cleaned up');
  }

  static getResourceCount(): number {
    return this.resources.length;
  }
}

// Performance monitoring
export class PerformanceTracker {
  private static marks: Map<string, number> = new Map();
  private static measures: Map<string, number> = new Map();

  static mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  static measure(name: string, startMark: string, endMark?: string): void {
    const start = this.marks.get(startMark);
    if (!start) {
      console.warn(`Start mark '${startMark}' not found`);
      return;
    }

    const end = endMark ? this.marks.get(endMark) : performance.now();
    if (!end) {
      console.warn(`End mark '${endMark}' not found`);
      return;
    }

    const duration = end - start;
    this.measures.set(name, duration);
    console.log(`Performance measure '${name}': ${duration.toFixed(2)}ms`);
  }

  static getMeasure(name: string): number | undefined {
    return this.measures.get(name);
  }

  static getAllMeasures(): Record<string, number> {
    const result: Record<string, number> = {};
    this.measures.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  static clear(): void {
    this.marks.clear();
    this.measures.clear();
  }
}

// Export singleton instances
export const memoryMonitor = MemoryMonitor.getInstance();
export const networkMonitor = NetworkMonitor.getInstance();
export const healthChecker = HealthChecker.getInstance();
export const resourceManager = ResourceManager;
export const performanceTracker = PerformanceTracker;
export const errorTracker = ErrorTracker;
