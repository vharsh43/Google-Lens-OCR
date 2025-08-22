import { spawn } from 'child_process';

export interface PythonInfo {
  command: string;
  version: string;
  path: string;
}

export class PythonDetector {
  private static cachedPython: PythonInfo | null = null;

  /**
   * Detect available Python installation
   * Tries python3, python, py in order
   */
  static async detectPython(): Promise<PythonInfo> {
    // Return cached result if available
    if (this.cachedPython) {
      return this.cachedPython;
    }

    const candidates = ['python3', 'python', 'py'];
    
    for (const command of candidates) {
      try {
        const info = await this.testPythonCommand(command);
        if (info) {
          this.cachedPython = info;
          return info;
        }
      } catch (error) {
        // Continue to next candidate
        continue;
      }
    }

    throw new Error('No compatible Python installation found. Please install Python 3.8+ and ensure it\'s in your PATH.');
  }

  /**
   * Test a specific Python command
   */
  private static async testPythonCommand(command: string): Promise<PythonInfo | null> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, ['--version'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          // Python version is typically in stdout or stderr
          const versionOutput = output || errorOutput;
          const versionMatch = versionOutput.match(/Python (\d+\.\d+\.\d+)/);
          
          if (versionMatch) {
            const version = versionMatch[1];
            const majorMinor = version.split('.').slice(0, 2).join('.');
            
            // Check if version is 3.8 or higher
            if (this.isCompatibleVersion(majorMinor)) {
              resolve({
                command,
                version,
                path: command // For now, we'll use the command name as path
              });
              return;
            }
          }
        }
        resolve(null);
      });

      process.on('error', (error) => {
        resolve(null);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(null);
      }, 5000);
    });
  }

  /**
   * Check if Python version is compatible (3.8+)
   */
  private static isCompatibleVersion(version: string): boolean {
    const [major, minor] = version.split('.').map(Number);
    return major === 3 && minor >= 8;
  }

  /**
   * Get Python command with fallback to environment variable
   */
  static async getPythonCommand(): Promise<string> {
    // Check if PYTHON_PATH is explicitly set
    const envPython = process.env.PYTHON_PATH;
    if (envPython && envPython.trim() !== '') {
      // Validate the provided Python path
      try {
        const info = await this.testPythonCommand(envPython);
        if (info) {
          return envPython;
        } else {
          console.warn(`Warning: PYTHON_PATH "${envPython}" is not a valid Python installation. Falling back to auto-detection.`);
        }
      } catch (error) {
        console.warn(`Warning: Cannot validate PYTHON_PATH "${envPython}". Falling back to auto-detection.`);
      }
    }

    // Auto-detect Python
    const pythonInfo = await this.detectPython();
    return pythonInfo.command;
  }

  /**
   * Validate Python installation and log information
   */
  static async validateAndLog(): Promise<PythonInfo> {
    try {
      const pythonInfo = await this.detectPython();
      console.log(`✅ Python detected: ${pythonInfo.command} (version ${pythonInfo.version})`);
      return pythonInfo;
    } catch (error) {
      console.error(`❌ Python detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('💡 Please ensure Python 3.8+ is installed and available in your PATH');
      console.error('💡 You can also set PYTHON_PATH environment variable to specify the Python executable');
      throw error;
    }
  }

  /**
   * Clear cached Python info (useful for testing)
   */
  static clearCache(): void {
    this.cachedPython = null;
  }
}