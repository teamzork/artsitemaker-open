import type {
  VaultState,
  VaultStatus,
  SecretsData,
  SecretsVaultManagerOptions,
} from './types';

export class SecretsVaultManager {
  private static instance: SecretsVaultManager;
  private state: VaultState | null = null;
  private sessionTimer: number | null = null;
  private options: SecretsVaultManagerOptions;
  private isInitialized = false;

  private constructor(options?: SecretsVaultManagerOptions) {
    this.options = options || {};
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(options?: SecretsVaultManagerOptions): SecretsVaultManager {
    if (!SecretsVaultManager.instance) {
      SecretsVaultManager.instance = new SecretsVaultManager(options);
    }
    return SecretsVaultManager.instance;
  }

  /**
   * Initialize the manager and check initial status
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Check initial status
    await this.checkStatus();
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  /**
   * Get current vault state
   */
  getState(): VaultState | null {
    return this.state;
  }

  /**
   * Check vault status from server
   */
  async checkStatus(): Promise<VaultStatus> {
    try {
      const res = await fetch('/api/secrets/status');
      const status = (await res.json()) as VaultStatus;

      this.updateState(status);
      return status;
    } catch (e) {
      console.error('Failed to check secrets status:', e);
      throw e;
    }
  }

  /**
   * Update internal state and dispatch events
   */
  private updateState(status: VaultStatus): void {
    const previousState = this.state;

    if (!status.initialized) {
      this.state = 'not-initialized';
    } else if (!status.unlocked) {
      this.state = 'locked';
    } else {
      this.state = 'unlocked';
    }

    if (this.state !== previousState) {
      this.dispatchStateChangeEvent(previousState || undefined);
    }

    // Update session timer if unlocked
    if (status.unlocked && status.sessionTimeRemaining > 0) {
      this.startSessionTimer(status.sessionTimeRemaining);
    }
  }

  /**
   * Initialize vault with master password
   */
  async setup(password: string, confirm: string): Promise<void> {
    if (password !== confirm) {
      throw new Error('Passwords do not match');
    }

    if (!this.checkPasswordStrength(password)) {
      throw new Error('Password does not meet strength requirements');
    }

    try {
      const res = await fetch('/api/secrets/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterPassword: password, confirmPassword: confirm }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize vault');
      }

      await this.checkStatus();
    } catch (e) {
      throw e;
    }
  }

  /**
   * Unlock vault with master password
   */
  async unlock(password: string): Promise<void> {
    if (!password) {
      throw new Error('Please enter your master password');
    }

    try {
      const res = await fetch('/api/secrets/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = data.error || 'Invalid password';
        const showResetLink = res.status === 401;
        throw new Error(showResetLink ? `${message}|SHOW_RESET` : message);
      }

      await this.checkStatus();
      this.options.onUnlock?.();
    } catch (e) {
      throw e;
    }
  }

  /**
   * Lock the vault
   */
  async lock(): Promise<void> {
    try {
      await fetch('/api/secrets/lock', { method: 'POST' });
      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
        this.sessionTimer = null;
      }
      await this.checkStatus();
      this.options.onLock?.();
    } catch (e) {
      console.error('Failed to lock vault:', e);
      throw e;
    }
  }

  /**
   * Reset vault (delete all secrets, requires new password)
   */
  async reset(): Promise<void> {
    try {
      const res = await fetch('/api/secrets/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset vault');
      }

      await this.checkStatus();
    } catch (e) {
      throw e;
    }
  }

  /**
   * Load decrypted secrets
   */
  async loadSecrets(): Promise<SecretsData> {
    try {
      const res = await fetch('/api/secrets/data');
      const result = await res.json();

      if (!res.ok) {
        if (result.requiresUnlock) {
          await this.checkStatus();
        }
        throw new Error(result.error || 'Failed to load secrets');
      }

      const data = result.data as SecretsData;
      window.dispatchEvent(
        new CustomEvent('secrets-vault:data-loaded', {
          detail: { data },
        })
      );
      return data;
    } catch (e) {
      console.error('Failed to load secrets:', e);
      throw e;
    }
  }

  /**
   * Save encrypted secrets
   */
  async saveSecrets(data: SecretsData): Promise<void> {
    try {
      const res = await fetch('/api/secrets/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save secrets');
      }

      this.options.onSave?.();
    } catch (e) {
      throw e;
    }
  }

  /**
   * Test Cloudflare connection
   */
  async testCloudflareConnection(accountId: string, apiToken: string): Promise<{
    success: boolean;
    accountName?: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/cloudflare/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, apiToken }),
      });

      return await res.json();
    } catch (e) {
      console.error('Failed to test Cloudflare connection:', e);
      throw e;
    }
  }

  /**
   * Set session persistence
   */
  async setPersistence(enabled: boolean): Promise<void> {
    try {
      const res = await fetch('/api/secrets/persistence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) {
        throw new Error('Failed to update persistence');
      }
    } catch (e) {
      console.error('Failed to set persistence:', e);
      throw e;
    }
  }

  /**
   * Check password strength
   */
  checkPasswordStrength(password: string): boolean {
    const checks = [
      password.length >= 12,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ];

    return checks.every(c => c === true);
  }

  /**
   * Get password strength details
   */
  getPasswordStrengthDetails(password: string): Array<{ label: string; valid: boolean }> {
    return [
      { label: 'At least 12 characters', valid: password.length >= 12 },
      { label: 'Uppercase letter', valid: /[A-Z]/.test(password) },
      { label: 'Lowercase letter', valid: /[a-z]/.test(password) },
      { label: 'Number', valid: /[0-9]/.test(password) },
      { label: 'Special character', valid: /[^A-Za-z0-9]/.test(password) },
    ];
  }

  /**
   * Start session timer that counts down to auto-lock
   */
  private startSessionTimer(remainingMs: number): void {
    if (this.sessionTimer) clearInterval(this.sessionTimer);

    let remaining = remainingMs;

    const updateTimer = () => {
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      // Dispatch timer update event
      window.dispatchEvent(
        new CustomEvent('secrets-vault:timer-update', {
          detail: {
            minutes,
            seconds,
            remaining,
          },
        })
      );

      remaining -= 1000;

      if (remaining <= 0) {
        if (this.sessionTimer) clearInterval(this.sessionTimer);
        this.checkStatus();
      }
    };

    updateTimer();
    this.sessionTimer = setInterval(updateTimer, 1000) as unknown as number;
  }

  /**
   * Dispatch state change event
   */
  private dispatchStateChangeEvent(previousState?: VaultState): void {
    console.log('[SecretsVaultManager] Dispatching state change event:', {
      previousState,
      newState: this.state,
    });
    
    // Call the onStateChange callback if provided
    if (this.options.onStateChange && this.state !== null) {
      this.options.onStateChange(this.state);
    }
    
    window.dispatchEvent(
      new CustomEvent('secrets-vault:state-change', {
        detail: {
          state: this.state,
          previousState,
        },
      })
    );
  }
}

// Export singleton getter for convenience
export function getSecretsVaultManager(
  options?: SecretsVaultManagerOptions
): SecretsVaultManager {
  return SecretsVaultManager.getInstance(options);
}
