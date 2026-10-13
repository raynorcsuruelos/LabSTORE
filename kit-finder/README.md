# WL Kit Finder

Find wireline maintenance kit part numbers and BOMs by family, asset, maintenance type and level.
Data lives in Netlify Database (kits and BOM lines stored as JSONB); sign-in uses Netlify Identity.

## Deploy as its own Netlify project

1. Netlify → **Add new project → Import an existing project → GitHub → `LabSTORE`**.
2. Set **Base directory** to `kit-finder` (build command and publish directory come from `netlify.toml`).
3. After the first deploy: **Project configuration → Identity → Enable Identity**, then set **Registration** to **Invite only**.
4. **Identity** tab → invite users. For admins, open the user and add the role `admin`.

The database is created automatically on first deploy, and the migrations load the 111 default kits.

## Roles

- Any invited, signed-in user can find kits, view and export BOMs and search by part number.
- Users with the `admin` role can add, edit and delete kits. The `/api/kits` function enforces this on the server.

## Local development

```bash
npm install
netlify dev   # run from this folder after `netlify link` to the WL Kit Finder project
```
