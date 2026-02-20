import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { getDbWithSchema, schema } from './db';
import { hashPassword, verifyPassword } from './auth';
import type { User, Session } from './schema';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSION_ID_BYTES = 32;

export interface DbUser {
  id: number;
  email: string;
  username: string | null;
  role: string;
}

export interface DbSession {
  id: string;
  userId: number;
  expiresAt: Date;
}

export async function createUser(
  email: string,
  password: string,
  username?: string
): Promise<{ success: true; user: DbUser } | { success: false; error: string }> {
  try {
    const db = await getDbWithSchema();
    const passwordHash = await hashPassword(password);

    const [user] = await db.insert(schema.users).values({
      email: email.toLowerCase().trim(),
      passwordHash,
      username: username?.trim() || null,
    }).returning({
      id: schema.users.id,
      email: schema.users.email,
      username: schema.users.username,
      role: schema.users.role,
    });

    return { success: true, user };
  } catch (err: any) {
    if (err.code === '23505') {
      return { success: false, error: 'An account with this email already exists' };
    }
    console.error('Error creating user:', err);
    return { success: false, error: 'Failed to create account. Please try again.' };
  }
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<{ success: true; user: DbUser } | { success: false; error: string }> {
  try {
    const db = await getDbWithSchema();
    const [user] = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      username: schema.users.username,
      passwordHash: schema.users.passwordHash,
      role: schema.users.role,
    }).from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim()));

    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    };
  } catch (err) {
    console.error('Error authenticating user:', err);
    return { success: false, error: 'Authentication failed. Please try again.' };
  }
}

export async function createSession(userId: number): Promise<DbSession> {
  const db = await getDbWithSchema();
  const sessionId = crypto.randomBytes(SESSION_ID_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const [session] = await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  }).returning();

  return session;
}

export async function validateSession(sessionId: string): Promise<{ valid: true; user: DbUser } | { valid: false }> {
  try {
    const db = await getDbWithSchema();
    const [session] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));

    if (!session) {
      return { valid: false };
    }

    if (new Date() > session.expiresAt) {
      await deleteSession(sessionId);
      return { valid: false };
    }

    const [user] = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      username: schema.users.username,
      role: schema.users.role,
    }).from(schema.users).where(eq(schema.users.id, session.userId));

    if (!user) {
      await deleteSession(sessionId);
      return { valid: false };
    }

    return { valid: true, user };
  } catch (err) {
    console.error('Error validating session:', err);
    return { valid: false };
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const db = await getDbWithSchema();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
  } catch (err) {
    console.error('Error deleting session:', err);
  }
}

export async function deleteAllUserSessions(userId: number): Promise<void> {
  try {
    const db = await getDbWithSchema();
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  } catch (err) {
    console.error('Error deleting user sessions:', err);
  }
}

export async function getUserById(userId: number): Promise<DbUser | null> {
  try {
    const db = await getDbWithSchema();
    const [user] = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      username: schema.users.username,
      role: schema.users.role,
    }).from(schema.users).where(eq(schema.users.id, userId));

    return user || null;
  } catch {
    return null;
  }
}

export async function updateUserPassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  try {
    const db = await getDbWithSchema();
    
    // Get current user with password hash
    const [user] = await db.select({
      id: schema.users.id,
      passwordHash: schema.users.passwordHash,
    }).from(schema.users).where(eq(schema.users.id, userId));

    if (!user) {
      return false;
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return false;
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await db.update(schema.users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(schema.users.id, userId));

    return true;
  } catch (err) {
    console.error('Error updating password:', err);
    return false;
  }
}

export async function isEmailAuthConfigured(): Promise<boolean> {
  try {
    const url = import.meta.env.DATABASE_URL || process.env.DATABASE_URL;
    return Boolean(url);
  } catch {
    return false;
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return { valid: errors.length === 0, errors };
}
