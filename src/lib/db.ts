import postgres from "postgres";

// Reuse one connection across dev hot-reloads instead of opening a new one each time.
const globalForDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };

export const sql =
  globalForDb.sql ?? postgres(process.env.DATABASE_URL!, { max: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
