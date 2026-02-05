import { pool } from './index';
import { memoryStore } from './memory-store';
import type { Job } from '../types/database';

export async function createJob(job: Omit<Job, 'created_at'>): Promise<Job> {
  if (!pool) {
    // Use in-memory store when database is not configured
    console.log('⚠️  Using in-memory job store (no database)');
    return memoryStore.createJob(job);
  }
  
  const result = await pool.query(
    `INSERT INTO jobs (
      id, site, status, parameters, format, headless, webhook_url, job_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      job.id,
      job.site,
      job.status,
      JSON.stringify(job.parameters),
      job.format,
      job.headless ?? true,
      job.webhook_url || null,
      job.job_type || 'scrape',
    ]
  );

  return result.rows[0];
}

export async function getJob(id: string): Promise<Job | null> {
  if (!pool) {
    return memoryStore.getJob(id);
  }
  
  const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function updateJobStatus(
  id: string,
  status: Job['status'],
  updates?: Partial<Job>
): Promise<void> {
  if (!pool) {
    memoryStore.updateJob(id, { status, ...updates });
    return;
  }
  
  const fields: string[] = ['status = $2'];
  const values: any[] = [id, status];
  let paramIndex = 3;

  if (updates) {
    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ${paramIndex}`);
      values.push(value);
      paramIndex++;
    });
  }

  await pool.query(`UPDATE jobs SET ${fields.join(', ')} WHERE id = $1`, values);
}

export async function listJobs(filters?: {
  site?: string;
  status?: Job['status'];
  limit?: number;
  offset?: number;
}): Promise<Job[]> {
  if (!pool) {
    return memoryStore.listJobs(filters);
  }
  
  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.site) {
    query += ` AND site = ${paramIndex}`;
    params.push(filters.site);
    paramIndex++;
  }

  if (filters?.status) {
    query += ` AND status = ${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  query += ' ORDER BY created_at DESC';

  if (filters?.limit) {
    query += ` LIMIT ${paramIndex}`;
    params.push(filters.limit);
    paramIndex++;

    if (filters?.offset) {
      query += ` OFFSET ${paramIndex}`;
      params.push(filters.offset);
    }
  }

  const result = await pool.query(query, params);
  return result.rows;
}
