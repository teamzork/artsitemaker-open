import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { getDb, schema } from '../src/lib/db';
import { eq } from 'drizzle-orm';

async function makeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: pnpm make-admin <email>');
    console.error('Example: pnpm make-admin user@example.com');
    process.exit(1);
  }

  try {
    const db = getDb();

    // Check if user exists
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()));

    if (!user) {
      console.error(`Error: User with email "${email}" not found`);
      process.exit(1);
    }

    if (user.role === 'admin') {
      console.log(`User "${email}" is already an admin`);
      process.exit(0);
    }

    // Update user role to admin
    await db
      .update(schema.users)
      .set({ role: 'admin', updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    console.log(`✓ User "${email}" is now an admin`);
    process.exit(0);
  } catch (error) {
    console.error('Error updating user role:', error);
    process.exit(1);
  }
}

makeAdmin();
