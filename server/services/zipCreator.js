import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import prisma from '../db.js';
import { outputDir } from '../utils/fileSystem.js';

/**
 * Create a zip file for all screenshots in a job
 * @param {string} jobId - Job ID
 * @returns {Promise<string>} Path to the created zip file
 */
async function createJobZip(jobId) {
  return new Promise(async (resolve, reject) => {
    try {
      const jobDir = path.join(outputDir, jobId);
      const screenshotsDir = path.join(jobDir, 'screenshots');
      const zipPath = path.join(jobDir, `screenshots-${jobId}.zip`);
      const webAccessiblePath = `/api/screenshots/${jobId}/screenshots-${jobId}.zip`;
      
      // Check if screenshots directory exists
      if (!fs.existsSync(screenshotsDir)) {
        throw new Error(`Screenshots directory not found for job ${jobId}`);
      }
      
      console.log(`Creating zip file for job ${jobId}`);
      
      // Create a file to stream archive data to
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 6 } // Compromise between compression and speed
      });
      
      // Set up event listeners
      output.on('close', async () => {
        console.log(`Zip file created for job ${jobId}: ${zipPath} (${archive.pointer()} bytes)`);
        
        // Update job with zip file path
        await prisma.job.update({
          where: { jobId },
          data: { 
            zipPath: webAccessiblePath,
            zipSize: archive.pointer()
          }
        });
        
        resolve(zipPath);
      });
      
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn(`Warning while creating zip for job ${jobId}:`, err);
        } else {
          reject(err);
        }
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      // Pipe archive data to the output file
      archive.pipe(output);
      
      // Add all screenshot files to the archive
      // Use glob-style pattern to avoid loading file list in memory
      archive.directory(screenshotsDir, 'screenshots');
      
      // Finalize the archive (write footer and close streams)
      await archive.finalize();
    } catch (error) {
      console.error(`Error creating zip file for job ${jobId}:`, error);
      reject(error);
    }
  });
}

export { createJobZip }; 