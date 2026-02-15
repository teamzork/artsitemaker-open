import type { SecretsVaultManager } from '../components/SecretsVault/SecretsVaultManager';

declare global {
  interface Window {
    secretsVaultManager?: SecretsVaultManager;
    openSecretsVault?: () => void;
    __secretsVaultLoadedForUnlock?: boolean;
    __secretsVaultCleanupBound?: boolean;
  }
}

export {};
