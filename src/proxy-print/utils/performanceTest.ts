// Performans testleri için yardımcı fonksiyonlar

export interface PerformanceMetrics {
  parseTime: number;
  resolveTime: number;
  renderTime: number;
  memoryUsage: number;
  totalTime: number;
}

export class PerformanceMonitor {
  private startTime: number = 0;
  private metrics: Partial<PerformanceMetrics> = {};

  start() {
    this.startTime = performance.now();
    this.metrics = {};
  }

  markParseComplete() {
    this.metrics.parseTime = performance.now() - this.startTime;
  }

  markResolveComplete() {
    this.metrics.resolveTime = performance.now() - this.startTime;
  }

  markRenderComplete() {
    this.metrics.renderTime = performance.now() - this.startTime;
  }

  end(): PerformanceMetrics {
    const totalTime = performance.now() - this.startTime;
    
    // Memory usage (if available)
    let memoryUsage = 0;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
    }

    return {
      parseTime: this.metrics.parseTime || 0,
      resolveTime: this.metrics.resolveTime || 0,
      renderTime: this.metrics.renderTime || 0,
      memoryUsage,
      totalTime
    };
  }

  logMetrics(operation: string) {
    const metrics = this.end();
    console.log(`🚀 Performance Metrics - ${operation}:`, {
      'Parse Time': `${metrics.parseTime.toFixed(2)}ms`,
      'Resolve Time': `${metrics.resolveTime.toFixed(2)}ms`,
      'Render Time': `${metrics.renderTime.toFixed(2)}ms`,
      'Memory Usage': `${metrics.memoryUsage.toFixed(2)}MB`,
      'Total Time': `${metrics.totalTime.toFixed(2)}ms`
    });
  }
}

// Benchmark fonksiyonu
export async function benchmark<T>(
  name: string,
  fn: () => Promise<T> | T,
  iterations: number = 1
): Promise<{ result: T; averageTime: number; totalTime: number }> {
  const times: number[] = [];
  let result: T;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = await fn();
    const end = performance.now();
    times.push(end - start);
  }

  const totalTime = times.reduce((sum, time) => sum + time, 0);
  const averageTime = totalTime / iterations;

  console.log(`📊 Benchmark - ${name}:`, {
    'Iterations': iterations,
    'Average Time': `${averageTime.toFixed(2)}ms`,
    'Total Time': `${totalTime.toFixed(2)}ms`,
    'Min Time': `${Math.min(...times).toFixed(2)}ms`,
    'Max Time': `${Math.max(...times).toFixed(2)}ms`
  });

  return { result: result!, averageTime, totalTime };
}

// Memory leak detection
export function detectMemoryLeaks() {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    const used = memory.usedJSHeapSize / 1024 / 1024;
    const total = memory.totalJSHeapSize / 1024 / 1024;
    const limit = memory.jsHeapSizeLimit / 1024 / 1024;

    console.log('🧠 Memory Status:', {
      'Used': `${used.toFixed(2)}MB`,
      'Total': `${total.toFixed(2)}MB`,
      'Limit': `${limit.toFixed(2)}MB`,
      'Usage %': `${((used / limit) * 100).toFixed(1)}%`
    });

    if (used / limit > 0.8) {
      console.warn('⚠️ High memory usage detected!');
    }
  }
}

// Network performance monitoring
export function monitorNetworkPerformance() {
  if ('getEntriesByType' in performance) {
    const navigationEntries = performance.getEntriesByType('navigation');
    if (navigationEntries.length > 0) {
      const nav = navigationEntries[0] as PerformanceNavigationTiming;
      
      console.log('🌐 Network Performance:', {
        'DNS Lookup': `${nav.domainLookupEnd - nav.domainLookupStart}ms`,
        'TCP Connect': `${nav.connectEnd - nav.connectStart}ms`,
        'First Byte': `${nav.responseStart - nav.requestStart}ms`,
        'DOM Content Loaded': `${nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart}ms`,
        'Load Complete': `${nav.loadEventEnd - nav.loadEventStart}ms`
      });
    }
  }
}

// Component render performance
export function measureRenderTime(componentName: string) {
  return {
    start: () => {
      const start = performance.now();
      return () => {
        const end = performance.now();
        console.log(`⚡ Render Time - ${componentName}: ${(end - start).toFixed(2)}ms`);
      };
    }
  };
}
