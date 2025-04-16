import prisma from './db.js';
import { fileURLToPath } from 'url';

async function emptyDatabase() {
  try {
    console.log('Starting database cleanup...');
    
    // Delete all URL records first (child records)
    const deletedUrls = await prisma.url.deleteMany();
    console.log(`Deleted ${deletedUrls.count} URL records`);
    
    // Delete all Job records (parent records)
    const deletedJobs = await prisma.job.deleteMany();
    console.log(`Deleted ${deletedJobs.count} Job records`);
    
    console.log('Database has been emptied successfully.');
  } catch (error) {
    console.error('Error emptying database:', error);
  } finally {
    // Close the Prisma client connection
    await prisma.$disconnect();
  }
}

// Execute the function if this script is run directly
if (import.meta.url && process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Running database cleanup script...');
  emptyDatabase()
    .then(() => console.log('Database cleanup completed.'))
    .catch((error) => console.error('Database cleanup failed:', error));
}

export default emptyDatabase;