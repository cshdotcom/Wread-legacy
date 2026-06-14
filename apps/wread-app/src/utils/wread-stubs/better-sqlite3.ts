/**
 * Browser-safe stub for better-sqlite3
 * This file replaces the native better-sqlite3 module in the client-side bundle.
 * The real module is only used on the server (via serverExternalPackages).
 */

class Database {
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

export default Database;
export { Database };
