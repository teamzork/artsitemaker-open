import { useEffect } from 'react';
import { SecretsVaultManager } from './SecretsVaultManager';
import { VaultUIController } from './VaultUIController';

/**
 * Client-side initializer for SecretsVault component
 * Handles manager instantiation and UI controller setup
 */
export function SecretsVaultInitializer() {
  useEffect(() => {
    async function initializeVault() {
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
          window.secretsVaultManager = SecretsVaultManager.getInstance({
            onStateChange: (state) => {
              vaultRoots.forEach((root) => updateVaultUI(root, state));
            },
          });
        }

        const manager = window.secretsVaultManager;
        await manager.init();

        // Initialize UI controller
        vaultRoots.forEach((root) => {
          new VaultUIController(manager, root);
        });

        // Load secrets if unlocked
        const status = await manager.checkStatus();
        if (status.unlocked) {
          manager.loadSecrets().catch((e) => {
            console.error('Failed to load secrets:', e);
          });
        }
      } catch (error) {
        console.error('Failed to initialize SecretsVault:', error);
      }
    }

    initializeVault();

    // Cleanup on unmount
    return () => {
      if (window.secretsVaultManager) {
        window.secretsVaultManager.cleanup();
      }
    };
  }, []);

  return null; // No visual output, just initialization
}
