import mariadb from 'mariadb';

const pool = mariadb.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'progress_planner',
  password: process.env.DB_PASSWORD ?? 'change_me',
  database: process.env.DB_NAME ?? 'progress_planner',
  connectionLimit: 10,
  bigIntAsNumber: true,
  dateStrings: true
});

export default pool;
