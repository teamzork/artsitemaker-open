import { SecretsVaultManager } from '../components/SecretsVault/SecretsVaultManager';
import { VaultUIController } from '../components/SecretsVault/VaultUIController';

/**
 * Initialize the Secrets Vault component
 * This runs as a module script in the Astro component
 */
export async function initializeSecretsVault() {
  console.log('[SecretsVault] Initializing...');
  try {
    const vaultRoots = Array.from(
      document.querySelectorAll<HTMLElement>('[data-secrets-vault-root]')
    );

    const updateVaultUI = (root: HTMLElement, state: 'not-initialized' | 'locked' | 'unlocked') => {
      const stateNotInit = root.querySelector('#state-not-initialized');
      const stateLocked = root.querySelector('#state-locked');
      const stateUnlocked = root.querySelector('#state-unlocked');
      const secretsEditor = root.querySelector('#secrets-editor');
      const indicator = root.querySelector('.status-indicator');
      const statusText = root.querySelector('.status-text');

      if (stateNotInit) stateNotInit.classList.add('hidden');
      if (stateLocked) stateLocked.classList.add('hidden');
      if (stateUnlocked) stateUnlocked.classList.add('hidden');
      if (secretsEditor) secretsEditor.classList.add('hidden');

      switch (state) {
        case 'not-initialized':
          if (stateNotInit) stateNotInit.classList.remove('hidden');
          if (indicator) {
            indicator.classList.remove('locked', 'unlocked');
            indicator.classList.add('not-initialized');
          }
          if (statusText) statusText.textContent = 'Not Set Up';
          break;
        case 'locked':
          if (stateLocked) stateLocked.classList.remove('hidden');
          if (indicator) {
            indicator.classList.remove('not-initialized', 'unlocked');
            indicator.classList.add('locked');
          }
          if (statusText) statusText.textContent = 'Locked';
          break;
        case 'unlocked':
          if (stateUnlocked) stateUnlocked.classList.remove('hidden');
          if (secretsEditor) secretsEditor.classList.remove('hidden');
          if (indicator) {
            indicator.classList.remove('not-initialized', 'locked');
            indicator.classList.add('unlocked');
          }
          if (statusText) statusText.textContent = 'Unlocked';

          // Load secrets when unlocked
          if (window.secretsVaultManager) {
            window.secretsVaultManager.loadSecrets().catch((e) => {
              console.error('Failed to load secrets:', e);
            });
          }
          break;
      }
    };

    // Get or create singleton manager
    if (!window.secretsVaultManager) {
      console.log('[SecretsVault] Creating new manager instance');
      window.secretsVaultManager = SecretsVaultManager.getInstance({
        onStateChange: (state) => {
          console.log('[SecretsVault] State changed to:', state);
          vaultRoots.forEach((root) => updateVaultUI(root, state));
        },
      });
    }

    const manager = window.secretsVaultManager;
    console.log('[SecretsVault] Manager:', manager);
    await manager.init();
    console.log('[SecretsVault] Manager initialized');

    // Initialize UI controller
    vaultRoots.forEach((root) => {
      new VaultUIController(manager, root);
    });
    console.log('[SecretsVault] UI controller initialized');

    // Load secrets if unlocked
    console.log('[SecretsVault] Checking status...');
    const status = await manager.checkStatus();
    console.log('[SecretsVault] Status:', status);
    if (status.unlocked) {
      manager.loadSecrets().catch((e) => {
        console.error('Failed to load secrets:', e);
      });
    }

    // Cleanup on navigation
    document.addEventListener('astro:before-swap', () => {
      manager.cleanup();
    });
  } catch (error) {
    console.error('Failed to initialize SecretsVault:', error);
  }
}

// Auto-initialize when this module loads
initializeSecretsVault();
