import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
const prisma = new PrismaClient();

// Function to initialize the database and resume incomplete jobs
export async function initializeDatabase() {
  try {
    // Find all running jobs that need to be resumed
    const runningJobs = await prisma.job.findMany({
      where: {
        isRunning: true
      },
      include: {
        urls: true
      }
    });

    console.log(`Found ${runningJobs.length} incomplete jobs to resume`);
    return runningJobs;
  } catch (error) {
    console.error('Database initialization error:', error);
    return [];
  }
}

// Export the Prisma client for use in other files
export default prisma;