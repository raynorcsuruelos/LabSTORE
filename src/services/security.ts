import { getSetting, setSetting, db } from '../db/dexieDb';

const DEFAULT_SALT = 'WL_LAB_INVENTORY_SECURITY_SALT_2025';
const DEFAULT_INITIAL_PASS = 'WLAdmin2025';

// Web Crypto SHA-256 Secure Hashing
export async function hashPassword(password: string, salt: string = DEFAULT_SALT): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ':' + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface StoredPasswordRecord {
  hash: string;
  salt: string;
  lastUpdated: string;
}

// In-memory rate limiting against brute force attempts
let failedAttempts = 0;
let lockoutUntil: number = 0;

export async function verifyAdminPassword(inputPassword: string): Promise<{
  success: boolean;
  message?: string;
  lockoutSeconds?: number;
}> {
  const now = Date.now();
  if (lockoutUntil > now) {
    const remaining = Math.ceil((lockoutUntil - now) / 1000);
    return {
      success: false,
      message: `Too many failed attempts. Security lockout active for ${remaining}s.`,
      lockoutSeconds: remaining
    };
  }

  // Retrieve stored hash
  const storedRecord = await getSetting<StoredPasswordRecord | null>('adminPassHash', null);

  if (!storedRecord) {
    // Check if legacy plaintext password exists to migrate
    const legacyPass = await getSetting<string | null>('adminPass', null);
    const expectedPass = legacyPass || DEFAULT_INITIAL_PASS;

    if (inputPassword === expectedPass) {
      // Migrate immediately to salted SHA-256 hash
      await setAdminPasswordSecure(inputPassword);
      failedAttempts = 0;
      return { success: true };
    } else {
      failedAttempts++;
      if (failedAttempts >= 5) {
        lockoutUntil = Date.now() + 30000; // 30 second lockout
      }
      return { success: false, message: 'Incorrect administrator password.' };
    }
  }

  // Verify against secure hash
  const computedHash = await hashPassword(inputPassword, storedRecord.salt);
  if (computedHash === storedRecord.hash) {
    failedAttempts = 0;
    return { success: true };
  } else {
    failedAttempts++;
    if (failedAttempts >= 5) {
      lockoutUntil = Date.now() + 30000;
      return {
        success: false,
        message: 'Security lockout: 5 failed attempts reached. Please wait 30 seconds.',
        lockoutSeconds: 30
      };
    }
    const remainingTries = 5 - failedAttempts;
    return {
      success: false,
      message: `Incorrect administrator password. (${remainingTries} attempts remaining before temporary lockout)`
    };
  }
}

export async function setAdminPasswordSecure(newPassword: string): Promise<void> {
  const salt = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);

  const hash = await hashPassword(newPassword, salt);
  const record: StoredPasswordRecord = {
    hash,
    salt,
    lastUpdated: new Date().toISOString()
  };

  await setSetting('adminPassHash', record);
  // Clean up legacy plaintext setting if present
  try {
    await db.settings.delete('adminPass');
    localStorage.removeItem('wllab_adminpass');
  } catch {
    // ignore
  }
}

export async function initializeSecurity() {
  const record = await getSetting<StoredPasswordRecord | null>('adminPassHash', null);
  if (!record) {
    const legacyPass = await getSetting<string | null>('adminPass', null);
    await setAdminPasswordSecure(legacyPass || DEFAULT_INITIAL_PASS);
  }
}
