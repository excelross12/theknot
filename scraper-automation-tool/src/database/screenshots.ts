import { pool } from './index';
import type { Screenshot } from '../types/database';

export async function createScreenshot(
  screenshot: Omit<Screenshot, 'id' | 'created_at'>
): Promise<void> {
  if (!pool) {
    return;
  }
  
  await pool.query(
    `INSERT INTO screenshots (job_id, file_path, context) VALUES ($1, $2, $3)`,
    [screenshot.job_id, screenshot.file_path, screenshot.context]
  );
}

export async function getJobScreenshots(jobId: string): Promise<Screenshot[]> {
  if (!pool) {
    return [];
  }
  
  const result = await pool.query(
    `SELECT * FROM screenshots WHERE job_id = $1 ORDER BY created_at ASC`,
    [jobId]
  );
  return result.rows;
}
