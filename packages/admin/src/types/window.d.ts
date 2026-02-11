import type { SecretsVaultManager } from '../components/SecretsVault/SecretsVaultManager';

declare global {
  interface Window {
    secretsVaultManager?: SecretsVaultManager;
    openSecretsVault?: () => void;
  }
}

export {};
