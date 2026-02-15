import { SecretsVaultManager } from '../components/SecretsVault/SecretsVaultManager';
import { VaultUIController } from '../components/SecretsVault/VaultUIController';

/**
 * Initialize the Secrets Vault component
 * This runs as a module script in the Astro component
 */
type VaultState = 'not-initialized' | 'locked' | 'unlocked';

function getVaultRoots(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-secrets-vault-root]')
  );
}

function updateVaultUI(root: HTMLElement, state: VaultState): void {
  const stateNotInit = root.querySelector('#state-not-initialized');
  const stateLocked = root.querySelector('#state-locked');
  const stateUnlocked = root.querySelector('#state-unlocked');
  const secretsEditor = root.querySelector('#secrets-editor');
  const indicator = root.querySelector('.status-indicator');
  const statusText = root.querySelector('.status-text');
  const modalFooter = document.getElementById('secrets-vault-footer');

  if (stateNotInit) stateNotInit.classList.add('hidden');
  if (stateLocked) stateLocked.classList.add('hidden');
  if (stateUnlocked) stateUnlocked.classList.add('hidden');
  if (secretsEditor) secretsEditor.classList.add('hidden');
  if (modalFooter) modalFooter.classList.add('hidden');

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
      if (modalFooter) modalFooter.classList.remove('hidden');
      if (indicator) {
        indicator.classList.remove('not-initialized', 'locked');
        indicator.classList.add('unlocked');
      }
      if (statusText) statusText.textContent = 'Unlocked';
      break;
  }
}

function updateAllRoots(state: VaultState): void {
  getVaultRoots().forEach((root) => updateVaultUI(root, state));
}

function loadSecretsIfNeeded(state: VaultState): void {
  const windowState = window as Window & {
    __secretsVaultLoadedForUnlock?: boolean;
  };

  if (state !== 'unlocked') {
    windowState.__secretsVaultLoadedForUnlock = false;
    return;
  }

  if (windowState.__secretsVaultLoadedForUnlock) return;
  windowState.__secretsVaultLoadedForUnlock = true;

  window.secretsVaultManager?.loadSecrets().catch((e) => {
    console.error('Failed to load secrets:', e);
  });
}

export async function initializeSecretsVault() {
  try {
    if (!window.secretsVaultManager) {
      window.secretsVaultManager = SecretsVaultManager.getInstance({
        onStateChange: (state) => {
          updateAllRoots(state);
          loadSecretsIfNeeded(state);
        },
      });
    }

    const manager = window.secretsVaultManager;

    // Initialize UI controller for any new roots only
    getVaultRoots().forEach((root) => {
      if (root.dataset.secretsVaultInitialized === 'true') return;
      root.dataset.secretsVaultInitialized = 'true';
      new VaultUIController(manager, root);
    });

    await manager.init();

    // Sync UI to current state without extra API calls
    const currentState = manager.getState();
    if (currentState) {
      updateAllRoots(currentState);
      loadSecretsIfNeeded(currentState);
    }

    const windowState = window as Window & {
      __secretsVaultCleanupBound?: boolean;
    };

    if (!windowState.__secretsVaultCleanupBound) {
      windowState.__secretsVaultCleanupBound = true;
      document.addEventListener('astro:before-swap', () => {
        manager.cleanup();
      });
    }
  } catch (error) {
    console.error('Failed to initialize SecretsVault:', error);
  }
}

// Auto-initialize when this module loads
initializeSecretsVault();
