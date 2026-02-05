import { pool, closeDatabase } from './index';

async function checkJobs() {
  try {
    const result = await pool.query('SELECT id, site, status, format, webhook_url, created_at FROM jobs ORDER BY created_at DESC LIMIT 5');
    
    console.log('\n📋 Recent Jobs:');
    console.log('================');
    
    if (result.rows.length === 0) {
      console.log('No jobs found');
    } else {
      result.rows.forEach((job: any, index: number) => {
        console.log(`\n${index + 1}. Job ID: ${job.id}`);
        console.log(`   Site: ${job.site}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Format: ${job.format}`);
        console.log(`   Webhook: ${job.webhook_url || 'none'}`);
        console.log(`   Created: ${job.created_at}`);
      });
    }
    
    console.log(`\n✅ Total jobs: ${result.rows.length}`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await closeDatabase();
  }
}

checkJobs();
