/**
 * Resource monitoring utilities for command execution
 * 
 * This module provides utilities for monitoring and limiting resource usage
 * of child processes. It helps prevent resource exhaustion by monitoring
 * memory and CPU usage of processes and terminating them if they exceed
 * specified limits.
 * 
 * Features:
 * - Memory usage monitoring
 * - CPU usage monitoring
 * - Process uptime tracking
 * - Configurable monitoring intervals
 * - Automatic process termination when limits are exceeded
 */
import { ChildProcess } from 'child_process';
import { logger } from './index';
import os from 'os';

/**
 * Process resource usage information
 */
export interface ProcessResourceUsage {
  /** Process ID */
  pid: number;
  /** CPU usage percentage (0-100) */
  cpuUsage: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Memory usage percentage (0-100) */
  memoryPercentage: number;
  /** Process uptime in milliseconds */
  uptime: number;
}

/**
 * Resource monitor for a child process
 */
export class ProcessResourceMonitor {
  private process: ChildProcess;
  private memoryLimit: number;
  private cpuLimit: number;
  private monitorInterval: NodeJS.Timeout | null = null;
  private startTime: number;
  private onLimitExceeded: (reason: string) => void;
  private checkIntervalMs: number;
  private lastCpuUsage: { user: number; system: number } | null = null;
  private lastCpuTime: number = 0;
  private cpuUsageHistory: number[] = [];
  private cpuUsageHistoryMaxLength: number = 5; // Track last 5 readings for average

  /**
   * Constructor
   * @param process Child process to monitor
   * @param memoryLimit Memory limit in MB
   * @param cpuLimit CPU usage limit percentage (0-100)
   * @param onLimitExceeded Callback to execute when resource limits are exceeded
   * @param checkIntervalMs Interval in milliseconds to check resource usage
   */
  constructor(
    process: ChildProcess,
    memoryLimit: number,
    cpuLimit: number = 0, // 0 means no CPU limit
    onLimitExceeded: (reason: string) => void,
    checkIntervalMs: number = 1000
  ) {
    this.process = process;
    this.memoryLimit = memoryLimit;
    this.cpuLimit = cpuLimit;
    this.onLimitExceeded = onLimitExceeded;
    this.checkIntervalMs = checkIntervalMs;
    this.startTime = Date.now();
  }

  /**
   * Start monitoring resources
   */
  public start(): void {
    if (this.process.pid) {
      logger.debug({ pid: this.process.pid, memoryLimit: this.memoryLimit }, 'Starting resource monitoring');
      
      this.monitorInterval = setInterval(() => {
        this.checkResourceUsage();
      }, this.checkIntervalMs);
    }
  }

  /**
   * Stop monitoring resources
   */
  public stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.debug({ pid: this.process.pid }, 'Stopped resource monitoring');
    }
  }

  /**
   * Check resource usage of the process
   */
  private async checkResourceUsage(): Promise<void> {
    if (!this.process.pid) {
      this.stop();
      return;
    }

    try {
      const usage = await this.getProcessResourceUsage(this.process.pid);
      
      if (!usage) {
        return;
      }
      
      // Check if memory limit is exceeded
      if (this.memoryLimit > 0) {
        const memoryLimitBytes = this.memoryLimit * 1024 * 1024;
        
        if (usage.memoryUsage > memoryLimitBytes) {
          logger.warn({
            pid: this.process.pid,
            memoryUsage: usage.memoryUsage,
            memoryLimit: memoryLimitBytes,
          }, 'Process exceeded memory limit');
          
          this.stop();
          this.onLimitExceeded('memory');
          return;
        }
      }
      
      // Check if CPU limit is exceeded
      if (this.cpuLimit > 0) {
        // Add current CPU usage to history
        this.cpuUsageHistory.push(usage.cpuUsage);
        
        // Keep history at max length
        if (this.cpuUsageHistory.length > this.cpuUsageHistoryMaxLength) {
          this.cpuUsageHistory.shift();
        }
        
        // Calculate average CPU usage over history
        const avgCpuUsage = this.cpuUsageHistory.reduce((sum, val) => sum + val, 0) / 
                           this.cpuUsageHistory.length;
        
        // Only consider CPU limit exceeded if we have enough history (to avoid false positives)
        if (this.cpuUsageHistory.length >= 3 && avgCpuUsage > this.cpuLimit) {
          logger.warn({
            pid: this.process.pid,
            cpuUsage: avgCpuUsage,
            cpuLimit: this.cpuLimit,
          }, 'Process exceeded CPU limit');
          
          this.stop();
          this.onLimitExceeded('cpu');
          return;
        }
      }
      
      // Log resource usage periodically
      if (Math.random() < 0.05) { // Log approximately every 20 checks (5% chance)
        logger.debug({
          pid: this.process.pid,
          memoryUsage: Math.round(usage.memoryUsage / (1024 * 1024)) + 'MB',
          memoryPercentage: usage.memoryPercentage.toFixed(1) + '%',
          cpuUsage: usage.cpuUsage.toFixed(1) + '%',
          uptime: Math.round(usage.uptime / 1000) + 's'
        }, 'Process resource usage');
      }
    } catch (error) {
      // Process might have exited
      logger.debug({ 
        pid: this.process.pid, 
        error: error instanceof Error ? error.message : String(error) 
      }, 'Error checking resource usage');
      
      this.stop();
    }
  }

  /**
   * Get resource usage for a process
   * @param pid Process ID
   * @returns Process resource usage information or null if not available
   */
  private async getProcessResourceUsage(pid: number): Promise<ProcessResourceUsage | null> {
    // This is a simplified implementation that works on most platforms
    // For production use, consider using a more robust solution like node-ps-list
    
    try {
      // Get process info using process.cpuUsage() for the current process
      // For child processes, we'd need to use platform-specific commands
      const currentCpuUsage = process.cpuUsage();
      const currentTime = Date.now();
      let cpuPercentage = 0;
      
      if (this.lastCpuUsage && this.lastCpuTime) {
        const userDiff = currentCpuUsage.user - this.lastCpuUsage.user;
        const systemDiff = currentCpuUsage.system - this.lastCpuUsage.system;
        const timeDiff = currentTime - this.lastCpuTime;
        
        if (timeDiff > 0) {
          // Calculate CPU percentage (very approximate for child processes)
          // Normalize by number of CPU cores to get a percentage between 0-100
          const numCpus = os.cpus().length;
          cpuPercentage = ((userDiff + systemDiff) / 1000) / timeDiff * 100 / numCpus;
          
          // Cap at 100% for sanity
          cpuPercentage = Math.min(cpuPercentage, 100);
        }
      }
      
      this.lastCpuUsage = currentCpuUsage;
      this.lastCpuTime = currentTime;
      
      // Get memory info
      const totalMemory = os.totalmem();
      
      // For real processes, we should use platform-specific commands
      // For now, we'll use the current process's memory usage as an approximation
      // In a production environment, this should be replaced with a more accurate method
      let memoryUsage = process.memoryUsage().rss;
      
      // On Unix-like systems, try to get more accurate memory usage
      if (process.platform !== 'win32') {
        try {
          // This is a simplified approach - in production, use a proper process monitoring library
          const { exec } = require('child_process');
          const { promisify } = require('util');
          const execAsync = promisify(exec);
          
          // Use ps command to get memory usage
          const { stdout } = await execAsync(`ps -p ${pid} -o rss=`);
          if (stdout) {
            // ps returns RSS in KB, convert to bytes
            memoryUsage = parseInt(stdout.trim(), 10) * 1024;
          }
        } catch (err) {
          // Fall back to the approximation if ps command fails
          logger.debug({ pid }, 'Failed to get accurate memory usage, using approximation');
        }
      }
      
      return {
        pid,
        cpuUsage: cpuPercentage,
        memoryUsage,
        memoryPercentage: (memoryUsage / totalMemory) * 100,
        uptime: Date.now() - this.startTime,
      };
    } catch (error) {
      logger.debug({ 
        pid, 
        error: error instanceof Error ? error.message : String(error) 
      }, 'Error getting process resource usage');
      
      return null;
    }
  }
}

/**
 * Get resource usage for a process (simplified implementation)
 * @param pid Process ID
 * @returns Process resource usage information or null if not available
 */
export async function getProcessResourceUsage(pid: number): Promise<ProcessResourceUsage | null> {
  try {
    // This is a simplified implementation
    // For production use, consider using a more robust solution like node-ps-list
    
    const currentCpuUsage = process.cpuUsage();
    const totalMemory = os.totalmem();
    const currentMemory = process.memoryUsage();
    
    return {
      pid,
      cpuUsage: 0, // Simplified - would need platform-specific implementation
      memoryUsage: currentMemory.rss,
      memoryPercentage: (currentMemory.rss / totalMemory) * 100,
      uptime: process.uptime() * 1000, // Convert to milliseconds
    };
  } catch (error) {
    return null;
  }
}

/**
 * Create a resource monitor for a child process
 * @param process Child process to monitor
 * @param memoryLimit Memory limit in MB
 * @param cpuLimit CPU usage limit percentage (0-100), 0 means no limit
 * @param onLimitExceeded Callback to execute when resource limits are exceeded
 * @returns Resource monitor instance
 */
export function createResourceMonitor(
  process: ChildProcess,
  memoryLimit: number,
  cpuLimit: number = 0,
  onLimitExceeded: (reason: string) => void
): ProcessResourceMonitor {
  const monitor = new ProcessResourceMonitor(
    process, 
    memoryLimit, 
    cpuLimit,
    onLimitExceeded
  );
  monitor.start();
  return monitor;
}