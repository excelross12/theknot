import { pool } from './index';
import type { JobLog } from '../types/database';

export async function createJobLog(
  log: Omit<JobLog, 'id' | 'created_at'>
): Promise<void> {
  if (!pool) {
    return;
  }
  
  await pool.query(
    `INSERT INTO job_logs (job_id, level, message, context)
     VALUES ($1, $2, $3, $4)`,
    [log.job_id, log.level, log.message, log.context ? JSON.stringify(log.context) : null]
  );
}

export async function getJobLogs(jobId: string): Promise<JobLog[]> {
  if (!pool) {
    return [];
  }
  
  const result = await pool.query(
    `SELECT * FROM job_logs WHERE job_id = $1 ORDER BY created_at ASC`,
    [jobId]
  );
  return result.rows;
}
