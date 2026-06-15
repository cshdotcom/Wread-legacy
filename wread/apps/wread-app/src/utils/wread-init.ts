/**
 * WRead Initialization Module
 * Called once at server startup to initialize the database and admin user.
 */
import { getDb, findUserByEmail, updateUser } from './wread-db';
import { ensureAdminUser } from './wread-auth';

let initialized = false;

export function initializeWRead(): void {
  if (initialized) return;
  initialized = true;

  try {
    // Ensure database is initialized
    getDb();
    console.log('[WRead] SQLite database initialized');

    // Ensure admin user exists
    ensureAdminUser();

    // Set default storage quota to 10GB for self-hosted
    const adminEmail = process.env['WREAD_ADMIN_EMAIL'] || 'admin@wread.local';
    const admin = findUserByEmail(adminEmail);
    if (admin && admin.plan === 'free') {
      updateUser(admin.id, { plan: 'pro' });
      console.log('[WRead] Admin user upgraded to pro plan');
    }

    console.log('[WRead] Initialization complete');
  } catch (error) {
    console.error('[WRead] Initialization failed:', error);
  }
}

// Auto-initialize when this module is imported on the server side
if (typeof window === 'undefined') {
  initializeWRead();
}
