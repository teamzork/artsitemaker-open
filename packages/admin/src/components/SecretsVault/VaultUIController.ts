import type { SecretsVaultManager } from './SecretsVaultManager';
import type { SecretsData } from './types';

/**
 * Handles UI interactions for the Secrets Vault component
 * Bridges between the DOM and the SecretsVaultManager
 */
export class VaultUIController {
  private manager: SecretsVaultManager;
  private root: HTMLElement;

  constructor(manager: SecretsVaultManager, root: HTMLElement) {
    this.manager = manager;
    this.root = root;
    this.init();
  }

  private init(): void {
    this.setupStateHandlers();
    this.setupFormHandlers();
    this.setupVisibilityToggles();
    this.setupDeployTypeToggle();
    this.setupCloudflareTest();
    this.setupSessionTimerListener();
    this.setupDataListener();
  }

  /**
   * Setup handlers for vault state changes
   */
  private setupStateHandlers(): void {
    // Setup Button
    const setupBtn = this.getElement('#setup-btn');
    const setupModal = this.getElement('#setup-modal') as any;
    const setupPassword = this.getElement('#setup-password') as HTMLInputElement;
    const setupConfirm = this.getElement('#setup-confirm') as HTMLInputElement;
    const setupError = this.getElement('#setup-error');
    const passwordStrength = this.getElement('#password-strength');

    setupBtn?.addEventListener('click', () => {
      setupModal?.open();
      setupPassword?.focus();
    });

    // Password strength check
    setupPassword?.addEventListener('input', () => {
      this.updatePasswordStrength(setupPassword.value, passwordStrength);
    });

    // Setup modal confirm
    setupModal?.addEventListener('confirm', async () => {
      const password = setupPassword?.value;
      const confirm = setupConfirm?.value;

      if (!password || !confirm) {
        this.showError(setupError, 'Please fill in both fields');
        return;
      }

      if (password !== confirm) {
        this.showError(setupError, 'Passwords do not match');
        return;
      }

      if (!this.manager.checkPasswordStrength(password)) {
        this.showError(setupError, 'Password does not meet requirements');
        return;
      }

      try {
        await this.manager.setup(password, confirm);
        setupModal?.close();
      } catch (e) {
        this.showError(setupError, e instanceof Error ? e.message : 'Setup failed');
      }
    });

    // Unlock Form
    const unlockForm = this.getElement('#unlock-form');
    const unlockPassword = this.getElement('#unlock-password') as HTMLInputElement;
    const unlockError = this.getElement('#unlock-error');
    const unlockErrorText = this.getElement('#unlock-error-text');
    const unlockResetLink = this.getElement('#unlock-reset-link');
    const resetVaultModal = this.getElement('#reset-vault-modal') as any;
    const resetError = this.getElement('#reset-error');

    unlockForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.hideError(unlockError, unlockErrorText, unlockResetLink);

      const password = unlockPassword?.value;
      if (!password) {
        this.showUnlockError('Please enter your master password', unlockError, unlockErrorText);
        return;
      }

      try {
        await this.manager.unlock(password);
        unlockPassword.value = '';
        this.hideError(unlockError, unlockErrorText, unlockResetLink);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to unlock';
        const showReset = message.includes('|SHOW_RESET');
        const displayMessage = message.replace('|SHOW_RESET', '');
        this.showUnlockError(displayMessage, unlockError, unlockErrorText, showReset, unlockResetLink);
      }
    });

    unlockPassword?.addEventListener('input', () => {
      this.hideError(unlockError, unlockErrorText, unlockResetLink);
    });

    unlockResetLink?.addEventListener('click', () => {
      this.hideError(resetError);
      resetVaultModal?.open();
    });

    // Reset Modal
    resetVaultModal?.addEventListener('confirm', async () => {
      const confirmBtn = resetVaultModal?.querySelector('.confirm-modal') as HTMLButtonElement | null;
      const closeBtn = resetVaultModal?.querySelector('.close-modal') as HTMLButtonElement | null;

      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = '⏳ Resetting...';
      }
      if (closeBtn) closeBtn.disabled = true;

      this.hideError(resetError);

      try {
        await this.manager.reset();
        resetVaultModal?.close();
        window.dispatchEvent(
          new CustomEvent('artsitemaker:toast', {
            detail: {
              title: 'Secrets vault reset',
              description: 'Set up a new master password to continue.',
              variant: 'success',
            },
          })
        );
      } catch (e) {
        this.showError(resetError, e instanceof Error ? e.message : 'Reset failed');
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Reset Vault';
        }
        if (closeBtn) closeBtn.disabled = false;
      }
    });

    // Lock Button
    const lockBtn = this.getElement('#lock-btn');
    lockBtn?.addEventListener('click', async () => {
      try {
        await this.manager.lock();
      } catch (e) {
        console.error('Failed to lock:', e);
      }
    });

    // Persistence toggle
    const persistSessionToggle = this.getElement('#persist-session-toggle');
    const persistSessionInput = persistSessionToggle?.querySelector(
      'input[name="persistSession"]'
    ) as HTMLInputElement | null;

    let ignorePersistenceChange = false;

    persistSessionInput?.addEventListener('change', async () => {
      if (ignorePersistenceChange) {
        ignorePersistenceChange = false;
        return;
      }

      const enabled = (persistSessionToggle as any)?.pressed ?? false;
      try {
        await this.manager.setPersistence(enabled);
      } catch (e) {
        ignorePersistenceChange = true;
        const btn = persistSessionToggle?.querySelector('.toggle-root') as HTMLButtonElement | null;
        btn?.click();
        console.error('Failed to update persistence:', e);
      }
    });
  }

  /**
   * Setup save secrets form handler
   */
  private setupFormHandlers(): void {
    const saveBtn = this.getElement('#save-secrets-btn') as HTMLButtonElement;

    saveBtn?.addEventListener('click', async () => {
      const originalText = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Saving...';

      try {
        // Collect form data
        const secretsData: SecretsData = {
          encryption_version: '1.0',
        };

        // R2 Secrets
        const r2AccountId = (this.getElement('#r2-account-id') as HTMLInputElement)?.value;
        const r2AccessKeyId = (this.getElement('#r2-access-key-id') as HTMLInputElement)?.value;
        const r2SecretKey = (this.getElement('#r2-secret-access-key') as HTMLInputElement)?.value;

        if (r2AccountId || r2AccessKeyId || r2SecretKey) {
          secretsData.r2 = {
            account_id: r2AccountId || '',
            access_key_id: r2AccessKeyId || '',
            secret_access_key: r2SecretKey || '',
          };
        }

        // GitHub OAuth
        const githubClientId = (this.getElement('#github-client-id') as HTMLInputElement)?.value;
        const githubClientSecret = (this.getElement('#github-client-secret') as HTMLInputElement)?.value;

        if (githubClientId || githubClientSecret) {
          secretsData.auth = {
            type: 'github',
            github_client_id: githubClientId || '',
            github_client_secret: githubClientSecret || '',
          };
        }

        // Cloudflare
        const cfAccountId = (this.getElement('#cf-account-id') as HTMLInputElement)?.value;
        const cfApiToken = (this.getElement('#cf-api-token') as HTMLInputElement)?.value;

        if (cfAccountId || cfApiToken) {
          secretsData.cloudflare = {
            account_id: cfAccountId || '',
            api_token: cfApiToken || '',
          };
        }

        // Deployment
        const deployTypeEl = this.getElement('#deploy-type') as HTMLSelectElement;
        const deployType = deployTypeEl?.value as 'ftp' | 'git' | '';

        if (deployType) {
          if (deployType === 'ftp') {
            secretsData.deployment = {
              type: 'ftp',
              ftp_host: (this.getElement('#ftp-host') as HTMLInputElement)?.value || '',
              ftp_user: (this.getElement('#ftp-user') as HTMLInputElement)?.value || '',
              ftp_password: (this.getElement('#ftp-password') as HTMLInputElement)?.value || '',
            };
          } else if (deployType === 'git') {
            secretsData.deployment = {
              type: 'git',
              github_token: (this.getElement('#github-token') as HTMLInputElement)?.value || '',
              deploy_repo: (this.getElement('#deploy-repo') as HTMLInputElement)?.value || '',
            };
          }
        }

        // Save to vault
        await this.manager.saveSecrets(secretsData);

        // Show success and dispatch event for modal auto-close
        window.dispatchEvent(
          new CustomEvent('artsitemaker:toast', {
            detail: {
              title: 'Secrets saved successfully',
              variant: 'success',
            },
          })
        );

        window.dispatchEvent(new CustomEvent('secrets-vault:saved', { detail: { success: true } }));
      } catch (e) {
        window.dispatchEvent(
          new CustomEvent('artsitemaker:toast', {
            detail: {
              title: e instanceof Error ? e.message : 'Failed to save secrets',
              variant: 'destructive',
            },
          })
        );
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    });
  }

  /**
   * Setup password visibility toggles
   */
  private setupVisibilityToggles(): void {
    this.root.querySelectorAll('.toggle-visibility').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        if (!targetId) return;

        const input = this.getElement(`#${targetId}`) as HTMLInputElement;
        if (!input) return;

        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🙈';
        } else {
          input.type = 'password';
          btn.textContent = '👁';
        }
      });
    });
  }

  /**
   * Setup deployment type toggle
   */
  private setupDeployTypeToggle(): void {
    const deployType = this.getElement('#deploy-type') as HTMLSelectElement;
    const ftpFields = this.getElement('#ftp-fields');
    const gitFields = this.getElement('#git-fields');

    const updateFields = () => {
      const type = deployType?.value;
      ftpFields?.classList.add('hidden');
      gitFields?.classList.add('hidden');

      if (type === 'ftp') {
        ftpFields?.classList.remove('hidden');
      } else if (type === 'git') {
        gitFields?.classList.remove('hidden');
      }
    };

    deployType?.addEventListener('change', updateFields);
    updateFields();
  }

  /**
   * Setup Cloudflare connection test
   */
  private setupCloudflareTest(): void {
    const testBtn = this.getElement('#test-cf-btn') as HTMLButtonElement;
    const statusEl = this.getElement('#cf-test-status');

    testBtn?.addEventListener('click', async () => {
      testBtn.disabled = true;
      testBtn.textContent = '⏳ Testing...';

      if (statusEl) {
        statusEl.innerHTML = '<span class="text-admin-muted">Checking credentials...</span>';
      }

      try {
        const accountId = (this.getElement('#cf-account-id') as HTMLInputElement)?.value?.trim() || '';
        const apiToken = (this.getElement('#cf-api-token') as HTMLInputElement)?.value?.trim() || '';

        if (!accountId || !apiToken) {
          if (statusEl) {
            statusEl.innerHTML =
              '<span class="text-yellow-400">⚠️ Enter your Account ID and API Token to test the connection</span>';
          }
          return;
        }

        const result = await this.manager.testCloudflareConnection(accountId, apiToken);

        if (result.success) {
          const accountLabel = result.accountName ? ` (Account: ${result.accountName})` : '';
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-green-500">✓ Connection successful${accountLabel}</span>`;
          }
        } else {
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-red-400">✗ ${result.error || 'Connection failed'}</span>`;
          }
        }
      } catch (e) {
        if (statusEl) {
          statusEl.innerHTML = '<span class="text-red-400">✗ Test failed</span>';
        }
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = '🔗 Test Connection';
      }
    });
  }

  /**
   * Setup session timer listener
   */
  private setupSessionTimerListener(): void {
    const sessionTimer = this.getElement('#session-timer');

    window.addEventListener('secrets-vault:timer-update', (e) => {
      const { minutes, seconds } = (e as CustomEvent).detail;
      if (sessionTimer) {
        sessionTimer.textContent = `Session expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    });
  }

  /**
   * Setup listener for loaded secrets data
   */
  private setupDataListener(): void {
    window.addEventListener('secrets-vault:data-loaded', (e) => {
      const { data } = (e as CustomEvent).detail as { data?: SecretsData };
      if (data) {
        this.populateSecretsForm(data);
      }
    });
  }

  /**
   * Populate form fields from secrets data
   */
  private populateSecretsForm(data: SecretsData): void {
    const r2AccountId = this.getElement('#r2-account-id') as HTMLInputElement | null;
    const r2AccessKeyId = this.getElement('#r2-access-key-id') as HTMLInputElement | null;
    const r2SecretKey = this.getElement('#r2-secret-access-key') as HTMLInputElement | null;

    if (r2AccountId) r2AccountId.value = data.r2?.account_id ?? '';
    if (r2AccessKeyId) r2AccessKeyId.value = data.r2?.access_key_id ?? '';
    if (r2SecretKey) r2SecretKey.value = data.r2?.secret_access_key ?? '';

    const githubClientId = this.getElement('#github-client-id') as HTMLInputElement | null;
    const githubClientSecret = this.getElement('#github-client-secret') as HTMLInputElement | null;

    if (githubClientId) githubClientId.value = data.auth?.github_client_id ?? '';
    if (githubClientSecret) githubClientSecret.value = data.auth?.github_client_secret ?? '';

    const cfAccountId = this.getElement('#cf-account-id') as HTMLInputElement | null;
    const cfApiToken = this.getElement('#cf-api-token') as HTMLInputElement | null;

    if (cfAccountId) cfAccountId.value = data.cloudflare?.account_id ?? '';
    if (cfApiToken) cfApiToken.value = data.cloudflare?.api_token ?? '';

    const deployTypeEl = this.getElement('#deploy-type') as HTMLSelectElement | null;
    const ftpHost = this.getElement('#ftp-host') as HTMLInputElement | null;
    const ftpUser = this.getElement('#ftp-user') as HTMLInputElement | null;
    const ftpPassword = this.getElement('#ftp-password') as HTMLInputElement | null;
    const githubToken = this.getElement('#github-token') as HTMLInputElement | null;
    const deployRepo = this.getElement('#deploy-repo') as HTMLInputElement | null;

    const deploymentType =
      data.deployment?.type === 'ftp' || data.deployment?.type === 'git'
        ? data.deployment.type
        : '';

    if (deployTypeEl) {
      deployTypeEl.value = deploymentType;
      deployTypeEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (deploymentType === 'ftp') {
      if (ftpHost) ftpHost.value = data.deployment?.ftp_host ?? '';
      if (ftpUser) ftpUser.value = data.deployment?.ftp_user ?? '';
      if (ftpPassword) ftpPassword.value = data.deployment?.ftp_password ?? '';
      if (githubToken) githubToken.value = '';
      if (deployRepo) deployRepo.value = '';
    } else if (deploymentType === 'git') {
      if (githubToken) githubToken.value = data.deployment?.github_token ?? '';
      if (deployRepo) deployRepo.value = data.deployment?.deploy_repo ?? '';
      if (ftpHost) ftpHost.value = '';
      if (ftpUser) ftpUser.value = '';
      if (ftpPassword) ftpPassword.value = '';
    } else {
      if (ftpHost) ftpHost.value = '';
      if (ftpUser) ftpUser.value = '';
      if (ftpPassword) ftpPassword.value = '';
      if (githubToken) githubToken.value = '';
      if (deployRepo) deployRepo.value = '';
    }
  }

  /**
   * Update password strength indicator
   */
  private updatePasswordStrength(password: string, container: HTMLElement | null): void {
    if (!container) return;

    const checks = this.manager.getPasswordStrengthDetails(password);

    container.innerHTML = checks
      .map(
        (c) => `
        <div class="flex items-center gap-2 text-xs ${c.valid ? 'text-green-400' : 'text-admin-muted'}">
          <span>${c.valid ? '✓' : '○'}</span>
          <span>${c.label}</span>
        </div>
      `
      )
      .join('');
  }

  /**
   * Utility methods
   */
  private getElement(selector: string): HTMLElement | null {
    return this.root.querySelector(selector);
  }

  private showError(el: HTMLElement | null, msg: string): void {
    if (el) {
      el.textContent = msg;
      el.classList.remove('hidden');
    }
  }

  private hideError(
    el: HTMLElement | null,
    textEl?: HTMLElement | null,
    linkEl?: HTMLElement | null
  ): void {
    if (el) el.classList.add('hidden');
    if (textEl) textEl.textContent = '';
    if (linkEl) linkEl.classList.add('hidden');
  }

  private showUnlockError(
    message: string,
    errorEl: HTMLElement | null,
    textEl: HTMLElement | null,
    showResetLink = false,
    linkEl?: HTMLElement | null
  ): void {
    if (errorEl) errorEl.classList.remove('hidden');
    if (textEl) textEl.textContent = message;
    if (linkEl) linkEl.classList.toggle('hidden', !showResetLink);
  }
}
