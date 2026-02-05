import type { Job } from '../types/database';

// In-memory job store for when database is not configured
class MemoryJobStore {
  private jobs: Map<string, Job> = new Map();

  createJob(job: Omit<Job, 'created_at'>): Job {
    const fullJob: Job = {
      ...job,
      created_at: new Date(),
    };
    this.jobs.set(job.id, fullJob);
    return fullJob;
  }

  getJob(id: string): Job | null {
    return this.jobs.get(id) || null;
  }

  updateJob(id: string, updates: Partial<Job>): void {
    const job = this.jobs.get(id);
    if (job) {
      Object.assign(job, updates);
    }
  }

  listJobs(filters?: {
    site?: string;
    status?: Job['status'];
    limit?: number;
    offset?: number;
  }): Job[] {
    let jobs = Array.from(this.jobs.values());

    if (filters?.site) {
      jobs = jobs.filter((j) => j.site === filters.site);
    }

    if (filters?.status) {
      jobs = jobs.filter((j) => j.status === filters.status);
    }

    // Sort by created_at descending
    jobs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    if (filters?.offset) {
      jobs = jobs.slice(filters.offset);
    }

    if (filters?.limit) {
      jobs = jobs.slice(0, filters.limit);
    }

    return jobs;
  }

  clear(): void {
    this.jobs.clear();
  }

  size(): number {
    return this.jobs.size;
  }
}

export const memoryStore = new MemoryJobStore();
