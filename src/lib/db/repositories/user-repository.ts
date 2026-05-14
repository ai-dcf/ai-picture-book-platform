import { eq } from 'drizzle-orm';
import { getDrizzleDb } from '@/lib/db';
import { users, type User, type NewUser } from '../schema-drizzle';
import { v4 as uuidv4 } from 'uuid';

export const UserRepository = {
  async createUser(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const db = getDrizzleDb();
    const now = new Date();
    const id = uuidv4();
    
    const newUser: NewUser = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await db.insert(users).values(newUser).returning();
    return result[0];
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const db = getDrizzleDb();
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  },

  async getUserById(id: string): Promise<User | null> {
    const db = getDrizzleDb();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  },

  async updateUser(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User | null> {
    const db = getDrizzleDb();
    const now = new Date();
    
    const result = await db
      .update(users)
      .set({ ...data, updatedAt: now })
      .where(eq(users.id, id))
      .returning();
    
    return result[0] || null;
  },

  async emailExists(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    return user !== null;
  },
};
