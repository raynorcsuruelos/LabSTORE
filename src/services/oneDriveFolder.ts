import { getSetting, setSetting, db } from '../db/dexieDb';
import { OneDriveCloudSnapshot } from '../types/inventory';

// Syncs through the OneDrive desktop client: the app reads/writes the JSON snapshot
// inside a locally synced OneDrive folder, and OneDrive uploads it to the cloud.
// Uses the File System Access API (desktop Chrome / Edge only).

type PermissionMode = { mode: 'read' | 'readwrite' };

interface FolderHandle extends FileSystemDirectoryHandle {
  queryPermission(desc: PermissionMode): Promise<PermissionState>;
  requestPermission(desc: PermissionMode): Promise<PermissionState>;
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

export type FolderPermission = 'granted' | 'prompt' | 'denied' | 'none' | 'unsupported';

const HANDLE_KEY = 'oneDriveFolderHandle';
const LAST_BACKUP_KEY = 'oneDriveLastBackupDate';

export function isFolderSyncSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function getLinkedFolder(): Promise<FolderHandle | null> {
  return getSetting<FolderHandle | null>(HANDLE_KEY, null);
}

export async function getFolderPermission(request = false): Promise<FolderPermission> {
  if (!isFolderSyncSupported()) return 'unsupported';
  const handle = await getLinkedFolder();
  if (!handle) return 'none';
  let state = await handle.queryPermission({ mode: 'readwrite' });
  // requestPermission must be called from a user gesture (button click)
  if (state === 'prompt' && request) {
    state = await handle.requestPermission({ mode: 'readwrite' });
  }
  return state;
}

// Opens the native folder picker. Must be called from a click handler.
export async function pickOneDriveFolder(): Promise<string> {
  const picker = (window as any).showDirectoryPicker as (opts: any) => Promise<FolderHandle>;
  const handle = await picker({ id: 'wllab-onedrive', mode: 'readwrite', startIn: 'documents' });
  await setSetting(HANDLE_KEY, handle);
  return handle.name;
}

export async function unlinkOneDriveFolder(): Promise<void> {
  await db.settings.delete(HANDLE_KEY);
}

async function requireFolder(): Promise<FolderHandle> {
  const handle = await getLinkedFolder();
  if (!handle) throw new Error('No OneDrive folder linked. Open Sync Center → Configuration → Link OneDrive Folder.');
  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    throw new Error('Folder access needs re-approval. Open Sync Center and click "Reconnect Folder".');
  }
  return handle;
}

export async function readFolderSnapshot(
  fileName: string
): Promise<{ snapshot: OneDriveCloudSnapshot; lastModified: string } | null> {
  const dir = await requireFolder();
  let fileHandle: FileSystemFileHandle;
  try {
    fileHandle = await dir.getFileHandle(fileName);
  } catch (err: any) {
    if (err?.name === 'NotFoundError') return null;
    throw err;
  }
  const file = await fileHandle.getFile();
  const text = await file.text();
  if (!text.trim()) return null;
  try {
    return { snapshot: JSON.parse(text), lastModified: new Date(file.lastModified).toISOString() };
  } catch {
    throw new Error(`${fileName} is not valid JSON (it may still be downloading from OneDrive). Will retry.`);
  }
}

async function writeJson(dir: FileSystemDirectoryHandle, fileName: string, data: unknown) {
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

export async function writeFolderSnapshot(fileName: string, snapshot: OneDriveCloudSnapshot): Promise<void> {
  const dir = await requireFolder();
  await writeJson(dir, fileName, snapshot);
}

// Keeps one snapshot copy per day in backups/ (written once per day per terminal)
export async function writeDailyBackup(fileName: string, snapshot: OneDriveCloudSnapshot): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const last = await getSetting<string | null>(LAST_BACKUP_KEY, null);
  if (last === today) return false;
  const dir = await requireFolder();
  const backups = await dir.getDirectoryHandle('backups', { create: true });
  const base = fileName.replace(/\.json$/i, '');
  await writeJson(backups, `${base}_${today}.json`, snapshot);
  await setSetting(LAST_BACKUP_KEY, today);
  return true;
}

// OneDrive creates copies like "inventory_sync-LABPC01.json" when two PCs edit at once
export async function readConflictCopies(
  fileName: string
): Promise<{ name: string; snapshot: OneDriveCloudSnapshot }[]> {
  const dir = await requireFolder();
  const base = fileName.replace(/\.json$/i, '');
  const copies: { name: string; snapshot: OneDriveCloudSnapshot }[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file') continue;
    const name = entry.name;
    if (name === fileName || !name.toLowerCase().endsWith('.json')) continue;
    if (!name.startsWith(`${base}-`) && !name.startsWith(`${base} (`)) continue;
    try {
      const file = await (entry as FileSystemFileHandle).getFile();
      copies.push({ name, snapshot: JSON.parse(await file.text()) });
    } catch {
      // skip unreadable copies
    }
  }
  return copies;
}
