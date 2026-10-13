# Microsoft OneDrive & IndexedDB Real-Time Cloud Synchronization

A production-grade cloud synchronization system enabling WL Lab Inventory's local Dexie.js database to operate online and offline, synchronizing all sub-stores (Sonde Lab, E-Lab, WHE) with Microsoft OneDrive via Microsoft Graph API and one-click Microsoft 365 corporate single sign-on.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following choices were confirmed in Phase 1 and govern the sync implementation. Please review the architecture and approve to proceed with execution.

- **Confirmed Account Type**: Corporate Microsoft 365 Work or School Account (`common` or organization tenant, e.g. SLB / corporate Entra ID).
- **Confirmed Authentication Flow**: One-click Microsoft sign-in popup using MSAL Browser (`@azure/msal-browser` / Microsoft Graph REST) with standard corporate scopes (`Files.ReadWrite`, `User.Read`), storing refreshed tokens securely in memory and session state.
- **Confirmed Synchronization Strategy**: Full two-way automatic sync across devices. Dexie IndexedDB captures instant local operations offline and online, pushes changes via a mutation queue to OneDrive (`/me/drive/root:/WLLabInventory/inventory_sync.json:/content`), and pulls remote updates on configurable intervals with last-write-wins timestamp resolution.
- **Recommended Cloud Storage Path**: OneDrive root folder `WLLabInventory/` with canonical store state file `inventory_sync.json` and change log manifest `sync_manifest.json`.

---

## 1. Overview & Core Concept

- **What It Does**: Bridges the ultra-responsive, zero-latency local IndexedDB (Dexie.js) storage with Microsoft OneDrive cloud storage. Users can sign in with their Microsoft 365 corporate credentials via a secure browser popup. The application automatically detects network state, uploads pending store mutations, polls for updates made by colleagues on other lab terminals, and reconciles stock values per sub-store without interrupting offline laboratory operations.
- **Target Audience / Persona**: Wireline laboratory technicians, sub-store administrators (Sonde Lab, E-Lab, WHE), and materials managers who need instant barcode/stock operations on lab floor terminals while maintaining centralized inventory records in the company's OneDrive cloud.
- **Key Value**: Eliminates data silos between multiple lab computers, prevents inventory loss, provides true offline-first durability with background cloud convergence, and leverages existing Microsoft 365 enterprise infrastructure without requiring custom database servers.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **One-Click Microsoft 365 Sign-In**:
   - The user clicks the Cloud Sync indicator in the top header or the "Connect OneDrive" button in the Sync Manager modal.
   - A standard Microsoft Authentication Library (MSAL) popup opens, prompting the technician to authenticate with their corporate work/school account.
   - Upon consent, the user's corporate profile (name, email, avatar/initials) appears in the Cloud status bar, and initial cloud discovery is executed.

2. **Automated Two-Way Synchronization**:
   - Every local action (adjusting quantity, adding parts, modifying thresholds, logging withdrawals) is committed instantly to IndexedDB and enqueued in `syncQueue`.
   - The background sync engine executes in cycles (e.g. every 30 seconds or immediately upon mutation) without blocking the user interface.
   - The sync badge in the top bar provides clean, real-time visual feedback: `Synced` (emerald), `Syncing` (amber spinning icon), `Offline` (slate muted icon), or `Pending Updates` (blue count badge).

3. **Multi-Device Conflict Resolution**:
   - When pulling changes from OneDrive, remote timestamps and item version vectors are compared against local records.
   - Remote changes to other parts or stores merge cleanly into Dexie.
   - If the same part was updated simultaneously on another machine, the latest timestamp takes precedence, and an entry is logged in the History Audit Log.

4. **Sync Configuration & Tenant Management**:
   - A dedicated "OneDrive & Cloud Sync" panel inside the Admin modal allows configuring Client ID, Tenant ID, target folder path, sync frequency, and manual "Force Upload" / "Force Download" reconciliation.

### Visual Identity & Theme (SaaS Dashboard Guidelines)

- **Aesthetic Direction**: Utilitarian, precision industrial laboratory dashboard following clean SaaS guidelines.
- **Color Palette & Discipline**:
  - Dominant Neutral Canvas (60%): Clean white (`#FFFFFF`) with cool neutral background (`#F8FAFC`).
  - Structural Surfaces (30%): Bordered containers with 1px hairline dividers (`#E2E8F0`), flat single-elevation cards.
  - Accent Budget (10%): SLB Wireline Blue (`#002B49` / `#0284C7`) for primary actions, Emerald (`#16A34A`) for verified sync state, Amber (`#D97706`) for syncing/warning.
- **Typography & Tabular Discipline**:
  - Display & Headings: `Plus Jakarta Sans` / clean geometric sans with balanced headlines.
  - Data, Quantities & Timestamps: Enforced `font-mono tabular-nums` for all part quantities, min thresholds, and ISO timestamps to guarantee vertical alignment.
  - Zero-Pill Rule: Unboxed metadata tags separated by clean typographic dots (`·`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Microsoft Graph API with MSAL Browser vs. Third-Party Proxy**
  - *Chosen Approach*: Direct client-side MSAL authentication (`@azure/msal-browser`) calling Microsoft Graph REST endpoints directly from the browser with PKCE authorization code flow.
  - *Why*: Eliminates intermediary server storage, complies with enterprise zero-trust security (tokens never touch third-party servers), and works seamlessly in static web/PWA deployments.
  - *Fallback / Prototyping Mode*: Retains a built-in "Simulated Cloud" toggle with realistic delay and cloud inspector so users can test full sync flows even without Azure AD administrator consent.

- **Decision 2: Delta Sync & Storage Strategy in OneDrive**
  - *Chosen Approach*: Store a structured multi-store snapshot file (`inventory_sync.json`) containing store registries, items, and changelog hashes in OneDrive app folder `/me/drive/root:/WLLabInventory/inventory_sync.json`.
  - *Why*: Simple to inspect and backup directly inside the user's regular OneDrive folder, compatible with Excel/JSON automation, and resilient against cloud format locking.

- **Decision 3: Conflict Resolution & Multi-Store Isolation**
  - *Chosen Approach*: Per-store scoped keys (`${storeId}:${partNumber}`) with last-write-wins timestamp comparisons and atomic Dexie transactions.
  - *Why*: Changes made in Sonde Lab never block or corrupt WHE items. Technicians in separate labs work independently with zero friction.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WL Lab Inventory Client                         │
│                                                                        │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │   React UI & Views    │              │    Sync Manager Modal     │  │
│  │ (Header, Stores, Table│              │ (MSAL Sign-in, Status,    │  │
│  │  Low-Stock, Admin)    │              │  Cloud Inspector, Logs)   │  │
│  └───────────┬───────────┘              └─────────────┬─────────────┘  │
│              │ Live Queries (useLiveQuery)            │                │
│              ▼                                        ▼                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │               Dexie.js IndexedDB Local Engine                    │  │
│  │  • stores        • inventory (storeId:partNumber)                │  │
│  │  • history       • syncQueue (pending mutations)                 │  │
│  │  • settings      • authSession                                   │  │
│  └──────────────────┬─────────────────────────▲─────────────────────┘  │
│                     │                         │ Local Reconcile        │
│      Enqueue Action │                         │                        │
│                     ▼                         │                        │
│  ┌────────────────────────────────────────────┴─────────────────────┐  │
│  │              OneDrive Background Sync Engine                     │  │
│  │  • Queue processor    • Offline/Online listener                  │  │
│  │  • Interval timer     • Conflict resolver (timestamp LWW)        │  │
│  └──────────────────┬─────────────────────────▲─────────────────────┘  │
└─────────────────────┼─────────────────────────┼────────────────────────┘
                      │                         │
                      │ Bearer Token / Graph    │ Remote Delta Pull
                      ▼                         │
┌────────────────────────────────────────────────────────────────────────┐
│                   Microsoft 365 / OneDrive Cloud                       │
│                                                                        │
│  ┌───────────────────────┐            ┌─────────────────────────────┐  │
│  │ Microsoft Entra ID    │            │ Microsoft Graph API v1.0    │  │
│  │ (MSAL OAuth2 + PKCE)  │            │ /me/drive/root:/WLLab...    │  │
│  └───────────────────────┘            └─────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Synchronization Lifecycle

```
[Local Stock Change]
       │
       ▼
1. Commit atomic write to Dexie IndexedDB (0ms user latency)
2. Add mutation entry to `syncQueue` (action, payload, timestamp)
3. Background Sync checks: Network online? Token valid?
       │
  ┌────┴────────────────────────┐
  ▼                             ▼
[Online & Authenticated]   [Offline / Unauthenticated]
  │                             │
  ├─► Upload to OneDrive        └─► Retain in `syncQueue`
  │   PUT /content                  (retry on network reconnect)
  ├─► Pull remote updates
  ├─► Resolve timestamp deltas
  └─► Clear `syncQueue`
```

---

## Execution Steps Following Approval

1. **Package Installation**: Install `@azure/msal-browser` for Microsoft 365 popup single sign-on.
2. **Auth Service**: Implement `src/services/msalAuth.ts` supporting standard corporate client credentials, interactive popup login, silent token acquisition, and tenant configuration.
3. **Enhanced Sync Engine**: Expand `src/services/oneDriveSync.ts` to seamlessly integrate MSAL tokens, execute two-way push/pull with Microsoft Graph `/me/drive/root:/WLLabInventory/`, and reconcile multi-store IndexedDB records.
4. **Sync UI & Controls**: Update `SyncStatusModal.tsx` and `Header.tsx` to display one-click Microsoft Sign-In, connected user profile, live sync logs, and multi-device cloud status.
5. **Verification**: Run complete TypeScript typechecking and compilation build verification.
