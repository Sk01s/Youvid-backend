import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: true,
});

export default pool;
