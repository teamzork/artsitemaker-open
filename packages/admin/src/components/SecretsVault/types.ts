export type VaultState = 'not-initialized' | 'locked' | 'unlocked';

export interface SecretsData {
  encryption_version: string;
  auth?: {
    type: 'none' | 'password' | 'github';
    github_client_id?: string;
    github_client_secret?: string;
  };
  r2?: {
    account_id: string;
    access_key_id: string;
    secret_access_key: string;
  };
  deployment?: {
    type: 'static' | 'ftp' | 'sftp' | 'git';
    ftp_host?: string;
    ftp_user?: string;
    ftp_password?: string;
    github_token?: string;
    deploy_repo?: string;
  };
  cloudflare?: {
    account_id: string;
    api_token: string;
  };
}

export interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  sessionTimeRemaining: number;
  persistenceEnabled?: boolean;
}

export interface SecretsVaultManagerOptions {
  onStateChange?: (state: VaultState) => void;
  onSave?: () => Promise<void>;
  onUnlock?: () => void;
  onLock?: () => void;
}

export interface VaultStateChangeEvent extends CustomEvent {
  detail: {
    state: VaultState;
    previousState?: VaultState;
  };
}

export interface VaultSavedEvent extends CustomEvent {
  detail: {
    success: boolean;
    error?: string;
  };
}
