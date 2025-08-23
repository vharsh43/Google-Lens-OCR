import { writeFile, unlink, access, readFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface LockOptions {
  timeout?: number;
  retryInterval?: number;
  lockDir?: string;
}

export class ProcessLock {
  private lockId: string;
  private lockPath: string;
  private lockDir: string;
  private acquired: boolean = false;
  private timeoutHandle?: NodeJS.Timeout;

  constructor(lockId: string, options: LockOptions = {}) {
    this.lockId = lockId;
    this.lockDir = options.lockDir || join(process.cwd(), '.locks');
    this.lockPath = join(this.lockDir, `${lockId}.lock`);
  }

  /**
   * Acquire a lock for the given ID
   */
  async acquire(options: LockOptions = {}): Promise<boolean> {
    const { timeout = 30000, retryInterval = 100 } = options;
    
    // Ensure lock directory exists
    await mkdir(this.lockDir, { recursive: true });

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Check if lock already exists
        await access(this.lockPath);
        
        // Lock exists, check if it's stale
        const isStale = await this.isLockStale();
        if (isStale) {
          console.log(`Removing stale lock for ${this.lockId}`);
          await this.forceRelease();
        } else {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, retryInterval));
          continue;
        }
      } catch (error) {
        // Lock doesn't exist, try to create it
      }

      try {
        // Create lock file with process info
        const lockData = {
          pid: process.pid,
          timestamp: Date.now(),
          lockId: this.lockId,
          hostname: require('os').hostname()
        };

        await writeFile(this.lockPath, JSON.stringify(lockData, null, 2));
        this.acquired = true;
        
        console.log(`✅ Acquired lock for ${this.lockId}`);
        
        // Set up automatic timeout release
        if (timeout > 0) {
          this.timeoutHandle = setTimeout(() => {
            console.warn(`⚠️ Lock for ${this.lockId} timed out, auto-releasing`);
            this.release().catch(console.error);
          }, timeout);
        }
        
        return true;
      } catch (error) {
        // Another process might have created the lock between our check and creation
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }

    console.warn(`❌ Failed to acquire lock for ${this.lockId} within ${timeout}ms`);
    return false;
  }

  /**
   * Release the lock
   */
  async release(): Promise<void> {
    if (!this.acquired) {
      return;
    }

    try {
      await unlink(this.lockPath);
      this.acquired = false;
      
      if (this.timeoutHandle) {
        clearTimeout(this.timeoutHandle);
        this.timeoutHandle = undefined;
      }
      
      console.log(`✅ Released lock for ${this.lockId}`);
    } catch (error) {
      console.warn(`⚠️ Failed to release lock for ${this.lockId}:`, error);
    }
  }

  /**
   * Force release a lock (use with caution)
   */
  async forceRelease(): Promise<void> {
    try {
      await unlink(this.lockPath);
      console.log(`🔧 Force released lock for ${this.lockId}`);
    } catch (error) {
      // Lock might not exist, which is fine
    }
  }

  /**
   * Check if a lock is stale (process no longer exists or too old)
   */
  private async isLockStale(): Promise<boolean> {
    try {
      const lockContent = await readFile(this.lockPath, 'utf8');
      const lockData = JSON.parse(lockContent);
      
      // Check if lock is older than 5 minutes (stale)
      const lockAge = Date.now() - lockData.timestamp;
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      if (lockAge > maxAge) {
        return true;
      }

      // Check if the process still exists (Unix/Linux/macOS only)
      if (process.platform !== 'win32') {
        try {
          process.kill(lockData.pid, 0); // Signal 0 checks if process exists
          return false; // Process exists, lock is not stale
        } catch (error) {
          return true; // Process doesn't exist, lock is stale
        }
      }

      return false;
    } catch (error) {
      // If we can't read the lock file, consider it stale
      return true;
    }
  }

  /**
   * Check if a lock exists for the given ID
   */
  async exists(): Promise<boolean> {
    try {
      await access(this.lockPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get lock information
   */
  async getLockInfo(): Promise<any | null> {
    try {
      const lockContent = await readFile(this.lockPath, 'utf8');
      return JSON.parse(lockContent);
    } catch (error) {
      return null;
    }
  }

  /**
   * Utility method to run a function with a lock
   */
  static async withLock<T>(
    lockId: string, 
    fn: () => Promise<T>, 
    options: LockOptions = {}
  ): Promise<T> {
    const lock = new ProcessLock(lockId, options);
    
    const acquired = await lock.acquire(options);
    if (!acquired) {
      throw new Error(`Failed to acquire lock for ${lockId}`);
    }

    try {
      return await fn();
    } finally {
      await lock.release();
    }
  }
}

/**
 * Create a lock manager for OCR jobs
 */
export class OCRJobLockManager {
  private static locks = new Map<string, ProcessLock>();

  static async acquireJobLock(jobId: string): Promise<boolean> {
    const lock = new ProcessLock(`ocr-job-${jobId}`, {
      timeout: 60000, // 1 minute timeout
      lockDir: join(process.cwd(), '.locks', 'jobs')
    });

    const acquired = await lock.acquire();
    if (acquired) {
      this.locks.set(jobId, lock);
    }
    
    return acquired;
  }

  static async releaseJobLock(jobId: string): Promise<void> {
    const lock = this.locks.get(jobId);
    if (lock) {
      await lock.release();
      this.locks.delete(jobId);
    }
  }

  static async forceReleaseJobLock(jobId: string): Promise<void> {
    const lock = this.locks.get(jobId);
    if (lock) {
      await lock.forceRelease();
      this.locks.delete(jobId);
    } else {
      // Create a temporary lock instance to force release
      const tempLock = new ProcessLock(`ocr-job-${jobId}`, {
        lockDir: join(process.cwd(), '.locks', 'jobs')
      });
      await tempLock.forceRelease();
    }
  }

  static async isJobLocked(jobId: string): Promise<boolean> {
    const lock = new ProcessLock(`ocr-job-${jobId}`, {
      lockDir: join(process.cwd(), '.locks', 'jobs')
    });
    return await lock.exists();
  }

  static async getJobLockInfo(jobId: string): Promise<any | null> {
    const lock = new ProcessLock(`ocr-job-${jobId}`, {
      lockDir: join(process.cwd(), '.locks', 'jobs')
    });
    return await lock.getLockInfo();
  }

  /**
   * Clean up all locks for this manager (call on shutdown)
   */
  static async cleanup(): Promise<void> {
    const releasePromises = Array.from(this.locks.entries()).map(async ([jobId, lock]) => {
      console.log(`Cleaning up lock for job ${jobId}`);
      await lock.release();
    });

    await Promise.all(releasePromises);
    this.locks.clear();
  }
}