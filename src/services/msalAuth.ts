import { PublicClientApplication, Configuration, AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';
import { getSetting, setSetting } from '../db/dexieDb';

// Standard Microsoft Graph scopes for accessing the user's OneDrive files
export const ONEDRIVE_SCOPES = ['User.Read', 'Files.ReadWrite'];

// Default Client ID fallback or organization ID
export const DEFAULT_MSAL_CLIENT_ID = '9b6d8719-7fd0-4b2e-a57e-61e88f572457'; // Common multi-tenant test app ID
export const DEFAULT_MSAL_TENANT_ID = 'common'; // 'common' supports Work/School + Microsoft accounts

class MsalAuthService {
  private msalInstance: PublicClientApplication | null = null;
  private currentAccount: AccountInfo | null = null;
  private isInitialized = false;

  private async getMsalConfig(): Promise<Configuration> {
    const config = await getSetting<{ msalClientId?: string; msalTenantId?: string }>('oneDriveConfig', {});
    const clientId = config.msalClientId?.trim() || DEFAULT_MSAL_CLIENT_ID;
    const tenantId = config.msalTenantId?.trim() || DEFAULT_MSAL_TENANT_ID;

    const redirectUri = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    return {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri,
        postLogoutRedirectUri: redirectUri,
      },
      cache: {
        cacheLocation: 'sessionStorage',
      }
    };
  }

  public async initialize(): Promise<PublicClientApplication> {
    if (this.msalInstance && this.isInitialized) {
      return this.msalInstance;
    }

    const config = await this.getMsalConfig();
    this.msalInstance = new PublicClientApplication(config);
    await this.msalInstance.initialize();
    this.isInitialized = true;

    // Check existing accounts
    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      this.currentAccount = accounts[0];
      this.msalInstance.setActiveAccount(this.currentAccount);
    }

    return this.msalInstance;
  }

  public async reconfigure(clientId?: string, tenantId?: string) {
    this.isInitialized = false;
    this.msalInstance = null;
    this.currentAccount = null;
    await this.initialize();
  }

  public getAccount(): AccountInfo | null {
    if (this.currentAccount) return this.currentAccount;
    if (this.msalInstance) {
      const active = this.msalInstance.getActiveAccount();
      if (active) {
        this.currentAccount = active;
        return active;
      }
      const accounts = this.msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        this.currentAccount = accounts[0];
        return accounts[0];
      }
    }
    return null;
  }

  public async loginPopup(): Promise<{ success: boolean; account?: AccountInfo; token?: string; error?: string }> {
    try {
      const msal = await this.initialize();
      const loginResponse = await msal.loginPopup({
        scopes: ONEDRIVE_SCOPES,
        prompt: 'select_account',
      });

      if (loginResponse.account) {
        this.currentAccount = loginResponse.account;
        msal.setActiveAccount(loginResponse.account);

        return {
          success: true,
          account: loginResponse.account,
          token: loginResponse.accessToken,
        };
      }
      return { success: false, error: 'No account returned from Microsoft sign-in' };
    } catch (err: any) {
      console.warn('MSAL popup sign-in notice:', err);
      return {
        success: false,
        error: err.errorMessage || err.message || 'Microsoft popup sign-in failed or was cancelled.',
      };
    }
  }

  public async getAccessToken(): Promise<string | null> {
    try {
      const msal = await this.initialize();
      const account = this.getAccount();
      if (!account) return null;

      try {
        const silentResponse = await msal.acquireTokenSilent({
          scopes: ONEDRIVE_SCOPES,
          account,
        });
        return silentResponse.accessToken;
      } catch (silentErr) {
        if (silentErr instanceof InteractionRequiredAuthError) {
          // Token expired and requires interactive prompt
          const popupResponse = await msal.acquireTokenPopup({
            scopes: ONEDRIVE_SCOPES,
            account,
          });
          return popupResponse.accessToken;
        }
        throw silentErr;
      }
    } catch (err) {
      console.warn('Could not acquire MSAL access token:', err);
      return null;
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.msalInstance) {
        const account = this.getAccount();
        if (account) {
          await this.msalInstance.logoutPopup({ account });
        }
      }
    } catch (err) {
      console.warn('MSAL logout error:', err);
    } finally {
      this.currentAccount = null;
    }
  }
}

export const msalAuth = new MsalAuthService();
