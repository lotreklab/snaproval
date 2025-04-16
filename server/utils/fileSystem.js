import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parentDir = path.dirname(__dirname);

// Define output directories
const outputDir = path.join(parentDir, 'output');

/**
 * Initialize the file system by creating necessary directories
 */
export function initializeFileSystem() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Create job-specific directories
 * @param {string} jobId - The job ID
 * @returns {Object} - Object containing paths to job directories
 */
export function createJobDirectories(jobId) {
  const jobDir = path.join(outputDir, jobId);
  const jobScreenshotDir = path.join(jobDir, 'screenshots');
  const jobPdfDir = path.join(jobDir, 'pdfs');
  
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }
  
  if (!fs.existsSync(jobScreenshotDir)) {
    fs.mkdirSync(jobScreenshotDir, { recursive: true });
  }
  
  if (!fs.existsSync(jobPdfDir)) {
    fs.mkdirSync(jobPdfDir, { recursive: true });
  }

  return {
    jobDir,
    jobScreenshotDir,
    jobPdfDir
  };
}

/**
 * Create a ZIP file from screenshots
 * @param {string} jobId - The job ID
 * @returns {Object} - Object containing the ZIP file path and name
 */
export function createScreenshotsZip(jobId) {
  const sourceDir = path.join(outputDir, jobId, 'screenshots');
  const zipFileName = `website-export-${jobId}.zip`;
  
  if (!fs.existsSync(sourceDir)) {
    throw new Error('No screenshots found for this job');
  }
  
  const zip = new AdmZip();
  
  // Add all screenshots to the zip
  const files = fs.readdirSync(sourceDir);
  files.forEach(file => {
    const filePath = path.join(sourceDir, file);
    zip.addLocalFile(filePath);
  });
  
  // Generate zip file
  const zipFilePath = path.join(outputDir, zipFileName);
  zip.writeZip(zipFilePath);
  
  return {
    zipFilePath,
    zipFileName
  };
}

/**
 * Get the list of files in a job's screenshot directory
 * @param {string} jobId - The job ID
 * @returns {Array} - Array of filenames
 */
export function getJobFiles(jobId) {
  const jobScreenshotDir = path.join(outputDir, jobId, 'screenshots');
  let files = [];
  
  if (fs.existsSync(jobScreenshotDir)) {
    files = fs.readdirSync(jobScreenshotDir);
  }
  
  return files;
}

// Export constants and paths
export { outputDir };