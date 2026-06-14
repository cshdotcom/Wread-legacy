/**
 * Stub for Node.js-only modules that should never be bundled for the browser.
 * When imported from client-side code, these return no-op implementations.
 * This file serves as a browser-safe replacement for:
 *   - better-sqlite3 (default export = Database class)
 *   - wread-auth exports (validateUserAndToken, etc.)
 */

// Stub for `import Database from 'better-sqlite3'`
class DatabaseStub {
  pragma() {}
  exec() {}
  prepare() {
    return {
      get: () => undefined,
      all: () => [],
      run: () => ({ changes: 0 }),
    };
  }
  close() {}
}

export default DatabaseStub;

// Stub for wread-auth exports (used by access.ts dynamic import fallback)
export const validateUserAndToken = async (_authHeader: string | null | undefined) => {
  return {};
};

export const loginWithEmail = async () => null;
export const registerUser = async () => null;
export const ensureAdminUser = () => {};
