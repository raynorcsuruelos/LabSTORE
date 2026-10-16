// True in the single-file offline copy (built with `vite build --mode standalone`).
// That copy runs from a downloaded file, so there is no sign-in or cloud sync — data stays in this browser's IndexedDB.
export const IS_STANDALONE = import.meta.env.MODE === 'standalone';

export const STANDALONE_FILE_NAME = 'kit-finder-standalone.html';
