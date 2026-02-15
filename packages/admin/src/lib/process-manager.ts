import { spawn, exec, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ServiceConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  healthCheckUrl?: string;
}

export interface ServiceStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error' | 'starting';
  pid?: number;
  uptime?: number;
  port?: number;
  lastError?: string;
  healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
  logs: string[];
}

class ProcessManager extends EventEmitter {
  private processes = new Map<string, ChildProcess>();
  private statuses = new Map<string, ServiceStatus>();
  private startTimes = new Map<string, number>();
  private configs = new Map<string, ServiceConfig>();
  private logBuffers = new Map<string, string[]>();
  private readonly MAX_LOG_LINES = 100;
  private readonly EXTERNAL_PROBE_INTERVAL_MS = 15000;
  private lastExternalProbeAt = 0;
  private externalProbePromise: Promise<void> | null = null;

  constructor() {
    super();
  }

  registerService(config: ServiceConfig): void {
    this.configs.set(config.id, config);
    this.statuses.set(config.id, {
      id: config.id,
      name: config.name,
      status: 'stopped',
      port: config.port,
      healthStatus: 'unknown',
      logs: [],
    });
    this.logBuffers.set(config.id, []);
  }

  async start(serviceId: string): Promise<boolean> {
    const config = this.configs.get(serviceId);
    if (!config) {
      throw new Error(`Service ${serviceId} not registered`);
    }

    if (this.processes.has(serviceId)) {
      console.log(`Service ${serviceId} is already running`);
      return false;
    }

    this.updateStatus(serviceId, { status: 'starting' });

    try {
      const env = {
        ...process.env,
        ...config.env,
        FORCE_COLOR: '1',
      };

      const childProcess = spawn(config.command, config.args, {
        cwd: config.cwd || process.cwd(),
        env,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.processes.set(serviceId, childProcess);
      this.startTimes.set(serviceId, Date.now());

      // Handle stdout
      childProcess.stdout?.on('data', (data) => {
        const line = data.toString();
        this.addLog(serviceId, line);
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data) => {
        const line = data.toString();
        this.addLog(serviceId, line);
      });

      // Handle process exit
      childProcess.on('exit', (code, signal) => {
        this.processes.delete(serviceId);
        this.startTimes.delete(serviceId);

        const status = code === 0 ? 'stopped' : 'error';
        const lastError = code !== 0 ? `Exited with code ${code}` : undefined;

        this.updateStatus(serviceId, {
          status,
          pid: undefined,
          lastError,
        });

        this.emit('service-stopped', { serviceId, code, signal });
      });

      // Handle errors
      childProcess.on('error', (error) => {
        this.updateStatus(serviceId, {
          status: 'error',
          lastError: error.message,
        });
        this.emit('service-error', { serviceId, error });
      });

      // Update status to running
      this.updateStatus(serviceId, {
        status: 'running',
        pid: childProcess.pid,
      });

      this.emit('service-started', { serviceId });

      // Start health checks if configured
      if (config.healthCheckUrl) {
        this.startHealthChecks(serviceId);
      }

      return true;
    } catch (error) {
      this.updateStatus(serviceId, {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  async stop(serviceId: string): Promise<boolean> {
    const process = this.processes.get(serviceId);
    
    // If we have a tracked process, kill it gracefully
    if (process) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          process.kill('SIGKILL');
          resolve(true);
        }, 5000);

        process.on('exit', () => {
          clearTimeout(timeout);
          resolve(true);
        });

        process.kill('SIGTERM');
      });
    }

    // If no tracked process, try to find by port and kill
    const config = this.configs.get(serviceId);
    if (config?.port) {
      console.log(`Attempting to kill external process on port ${config.port}`);
      const killed = await this.killByPort(config.port);
      if (killed) {
        this.updateStatus(serviceId, { status: 'stopped', pid: undefined });
        return true;
      }
    }

    return false;
  }

  private async killByPort(port: number): Promise<boolean> {
    try {
      // Find PID using lsof: -t (terse), -i :port
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout.trim().split('\n').filter(Boolean);
        
        if (pids.length > 0) {
          // Kill all found PIDs
          await execAsync(`kill -9 ${pids.join(' ')}`);
          return true;
        }
      } catch (e) {
        // lsof returns 1 if no process found
        return false;
      }
      return false;
    } catch (error) {
      console.error(`Failed to kill process on port ${port}:`, error);
      return false;
    }
  }

  async restart(serviceId: string): Promise<boolean> {
    await this.stop(serviceId);
    // Wait a bit for cleanup (increased to 1000ms to ensure port release)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.start(serviceId);
  }

  getStatus(serviceId: string): ServiceStatus | undefined {
    const status = this.statuses.get(serviceId);
    if (!status) return undefined;

    // Calculate uptime
    const startTime = this.startTimes.get(serviceId);
    if (startTime && status.status === 'running') {
      status.uptime = Math.floor((Date.now() - startTime) / 1000);
    }

    return status;
  }

  getAllStatuses(): ServiceStatus[] {
    return Array.from(this.configs.keys()).map((id) => this.getStatus(id)!);
  }

  /**
   * Probe ports to detect externally started services
   * (e.g., when site is started via pnpm dev in root)
   */
  async probeExternalServices(): Promise<void> {
    const now = Date.now();
    if (this.externalProbePromise) {
      await this.externalProbePromise;
      return;
    }
    if (now - this.lastExternalProbeAt < this.EXTERNAL_PROBE_INTERVAL_MS) {
      return;
    }

    this.lastExternalProbeAt = now;
    this.externalProbePromise = (async () => {
      for (const [id, config] of this.configs) {
        // Skip if we already have a running process
        if (this.processes.has(id)) continue;

        // If there's a health check URL, try to probe it
        if (config.healthCheckUrl) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);

            const response = await fetch(config.healthCheckUrl, {
              method: 'HEAD',
              signal: controller.signal,
            });

            clearTimeout(timeout);

            if (response.ok) {
              // Service is running externally
              this.updateStatus(id, {
                status: 'running',
                healthStatus: 'healthy',
              });
            }
          } catch {
            // Service not reachable - leave as stopped
            const current = this.statuses.get(id);
            if (current && current.status !== 'running') {
              this.updateStatus(id, {
                status: 'stopped',
                healthStatus: 'unknown',
              });
            }
          }
        }
      }
    })().finally(() => {
      this.externalProbePromise = null;
    });

    await this.externalProbePromise;
  }

  getLogs(serviceId: string, lines: number = 50): string[] {
    const logs = this.logBuffers.get(serviceId) || [];
    return logs.slice(-lines);
  }

  private updateStatus(serviceId: string, updates: Partial<ServiceStatus>): void {
    const current = this.statuses.get(serviceId);
    if (current) {
      this.statuses.set(serviceId, { ...current, ...updates });
      this.emit('status-changed', { serviceId, status: this.statuses.get(serviceId) });
    }
  }

  private addLog(serviceId: string, line: string): void {
    const buffer = this.logBuffers.get(serviceId) || [];
    const lines = line.split('\n').filter((l) => l.trim());

    for (const logLine of lines) {
      buffer.push(logLine);
    }

    // Keep only last N lines
    if (buffer.length > this.MAX_LOG_LINES) {
      buffer.splice(0, buffer.length - this.MAX_LOG_LINES);
    }

    this.logBuffers.set(serviceId, buffer);

    // Update status with recent logs
    this.updateStatus(serviceId, {
      logs: buffer.slice(-10),
    });
  }

  private async startHealthChecks(serviceId: string): Promise<void> {
    const config = this.configs.get(serviceId);
    if (!config?.healthCheckUrl) return;

    const checkHealth = async () => {
      try {
        const response = await fetch(config.healthCheckUrl!, {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        });

        const healthy = response.ok;
        this.updateStatus(serviceId, {
          healthStatus: healthy ? 'healthy' : 'unhealthy',
        });
      } catch (error) {
        this.updateStatus(serviceId, {
          healthStatus: 'unhealthy',
        });
      }
    };

    // Check every 10 seconds
    const interval = setInterval(() => {
      const status = this.getStatus(serviceId);
      if (status?.status === 'running') {
        checkHealth();
      } else {
        clearInterval(interval);
      }
    }, 10000);

    // Initial check after 2 seconds
    setTimeout(checkHealth, 2000);
  }

  stopAll(): Promise<boolean[]> {
    return Promise.all(
      Array.from(this.processes.keys()).map((id) => this.stop(id))
    );
  }
}

// Singleton instance
export const processManager = new ProcessManager();

// Register default services
export function registerDefaultServices(): void {
  const repoRoot = process.cwd().includes('/packages/admin')
    ? '../..'
    : '.';

  // Site dev server
  processManager.registerService({
    id: 'site',
    name: 'Public Site',
    command: 'pnpm',
    args: ['--filter', '@artsitemaker/site', 'dev'],
    cwd: repoRoot,
    port: 4321,
    healthCheckUrl: 'http://localhost:4321',
  });

  // Image file server
  // Resolve files path from admin's path resolution
  let filesPath: string;
  try {
    // Use require for synchronous import since this function is not async
    const { getFilesPath } = require('./paths');
    filesPath = getFilesPath();
  } catch {
    filesPath = path.resolve(repoRoot, 'files');
  }

  processManager.registerService({
    id: 'images',
    name: 'Image Server',
    command: 'npx',
    args: ['serve', filesPath, '-p', '3001', '--cors'],
    port: 3001,
    healthCheckUrl: 'http://localhost:3001',
  });
}
