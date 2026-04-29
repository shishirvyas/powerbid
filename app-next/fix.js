require('dotenv').config({path: '.env.local'});
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL + '?sslmode=require');
sql`DELETE FROM subject_templates WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER(PARTITION BY name ORDER BY id) as rn FROM subject_templates) t WHERE t.rn > 1)`
  .then(() => sql.end());
