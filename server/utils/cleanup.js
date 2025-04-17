import fs from 'fs';
import path from 'path';
import { outputDir } from './fileSystem.js';
import prisma from '../db.js';

/**
 * Removes website exports older than the specified number of days
 * @param {number} days - Number of days to keep exports (default: 7)
 */
export async function cleanupOldExports(days = 7) {
  try {
    console.log(`Starting cleanup of exports older than ${days} days`);
    
    // Get current time
    const now = Date.now();
    const maxAge = days * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    
    // Check if output directory exists
    if (!fs.existsSync(outputDir)) {
      console.log('Output directory does not exist, nothing to clean up');
      return;
    }
    
    // Fetch jobs from the database with completedTime older than maxAge
    const oldJobs = await prisma.job.findMany({
      where: {
        completedTime: {
          not: null,
          lt: new Date(now - maxAge)
        }
      },
      select: {
        jobId: true,
        completedTime: true
      }
    });

    let removedCount = 0;
    for (const job of oldJobs) {
      const jobId = job.jobId;
      const jobDir = path.join(outputDir, jobId);
      const completedTime = job.completedTime;
      const age = now - new Date(completedTime).getTime();
      console.log(`Removing old export job: ${jobId} (completed ${(age / (24 * 60 * 60 * 1000)).toFixed(1)} days ago)`);

      // Remove from database first
      try {
        await prisma.url.deleteMany({ where: { jobId } });
        await prisma.job.delete({ where: { jobId } });
        console.log(`Removed database records for job: ${jobId}`);
      } catch (dbError) {
        console.error(`Error removing database records for job ${jobId}:`, dbError);
        // Continue with file deletion even if database deletion fails
      }

      // Remove files if directory exists
      if (fs.existsSync(jobDir) && fs.statSync(jobDir).isDirectory()) {
        fs.rmSync(jobDir, { recursive: true, force: true });
      }
      removedCount++;
    }

    // Remove directories without a corresponding job in the database
    const allJobs = await prisma.job.findMany({
      select: {
        jobId: true
      }
    });
    const jobIdsInDb = new Set(allJobs.map(job => job.jobId));
    const allDirs = fs.readdirSync(outputDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    const dirsWithoutJob = allDirs.filter(dir => !jobIdsInDb.has(dir) && dir.match(/^\d{13}$/));
    for (const dir of dirsWithoutJob) {
      const dirPath = path.join(outputDir, dir);
      console.log(`Removing directory without corresponding job: ${dirPath}`);
      fs.rmSync(dirPath, { recursive: true, force: true });
      removedCount++;
    }
    
    console.log(`Cleanup completed. Removed ${removedCount} old export jobs.`);
  } catch (error) {
    console.error('Error during cleanup of old exports:', error);
  }
}

/**
 * Schedule cleanup to run at specified interval
 * @param {number} intervalHours - Interval in hours between cleanup runs
 * @param {number} maxAgeDays - Maximum age in days before exports are removed
 */
export function scheduleCleanup(intervalHours = 24, maxAgeDays = 7) {
  // Run cleanup immediately on startup
  cleanupOldExports(maxAgeDays);
  
  // Schedule periodic cleanup
  const intervalMs = intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds
  setInterval(() => {
    cleanupOldExports(maxAgeDays);
  }, intervalMs);
  
  console.log(`Scheduled cleanup of exports older than ${maxAgeDays} days to run every ${intervalHours} hours`);
}