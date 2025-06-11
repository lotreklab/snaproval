import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import prisma from '../db.js';
import { outputDir } from '../utils/fileSystem.js';
import sharp from 'sharp';

/**
 * Create a PDF file containing all screenshots for a job
 * @param {string} jobId - Job ID
 * @returns {Promise<string>} Path to the created PDF file
 */
async function createJobPdf(jobId) {
  return new Promise(async (resolve, reject) => {
    try {
      const jobDir = path.join(outputDir, jobId);
      const screenshotsDir = path.join(jobDir, 'screenshots');
      const pdfPath = path.join(jobDir, `screenshots-${jobId}.pdf`);
      const webAccessiblePath = `/api/screenshots/${jobId}/screenshots-${jobId}.pdf`;
      
      // Check if screenshots directory exists
      if (!fs.existsSync(screenshotsDir)) {
        throw new Error(`Screenshots directory not found for job ${jobId}`);
      }
      
      console.log(`Creating PDF file for job ${jobId}`);
      
      // Get all screenshots
      const screenshots = fs.readdirSync(screenshotsDir);
      
      if (screenshots.length === 0) {
        throw new Error(`No screenshots found for job ${jobId}`);
      }
      
      // Get URL mapping from database
      const job = await prisma.job.findUnique({
        where: { jobId },
        include: { urls: true }
      });
      
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }
      
      // Create a map of screenshot paths to their URLs
      const screenshotUrlMap = {};
      job.urls.forEach(url => {
        if (url.imagePath) {
          // The imagePath stored in the database is a web URL like '/api/screenshots/jobId/screenshots/filename.png'
          // Extract just the filename
          const parts = url.imagePath.split('/');
          const filename = parts[parts.length - 1];
          screenshotUrlMap[filename] = url.url;
          // For debugging
          console.log(`Mapped screenshot ${filename} to URL ${url.url}`);
        }
      });
      
      // Create a new PDF document (A4 size)
      const doc = new PDFDocument({
        size: 'A4', // A4 size
        margin: 50,
        info: {
          Title: `Website Screenshots - Job ${jobId}`,
          Author: 'Website Exporter',
          Subject: 'Website Screenshots',
          Creator: 'Website Exporter'
        },
        bufferPages: true
      });
      
      // Pipe the PDF output to a file
      doc.pipe(fs.createWriteStream(pdfPath));
      
      // Define A4 page dimensions with margins
      const pageWidth = 595.28 - 100; // A4 width in points with margins
      const pageHeight = 841.89 - 150; // A4 height in points with margins
      
      // Process each screenshot
      for (let i = 0; i < screenshots.length; i++) {
        const screenshotFilename = screenshots[i];
        const screenshotPath = path.join(screenshotsDir, screenshotFilename);
        
        // Try to get URL from the mapping
        let url = screenshotUrlMap[screenshotFilename];
        
        // If not found, try to extract URL from the filename
        if (!url) {
          console.log(`Warning: No URL found for screenshot ${screenshotFilename}`);
          
          // The filename format is: page-{index}-{url}.png
          // Try to extract the URL part
          const filenameMatch = screenshotFilename.match(/^page-\d+-(.*?)\.png$/);
          if (filenameMatch && filenameMatch[1]) {
            // Convert the filename back to a URL-like format by replacing underscores
            const extractedUrlPart = filenameMatch[1].replace(/_/g, '/');
            url = extractedUrlPart;
            console.log(`Extracted URL from filename: ${url}`);
          } else {
            url = 'Unknown URL';
          }
        }
        
        // Start a new page for each screenshot except the first one
        if (i > 0) {
          doc.addPage();
        }
        
        // Add URL as header
        doc.fontSize(12);
        doc.font('Helvetica-Bold');
        doc.text(url, {
          width: doc.page.width - 100,
          align: 'center'
        });
        doc.moveDown(0.5);
        
        try {
          // Get image metadata
          const metadata = await sharp(screenshotPath).metadata();
          
          // Calculate scaling to fit width
          const scale = Math.min(pageWidth / metadata.width, 1);
          const scaledWidth = metadata.width * scale;
          const scaledHeight = metadata.height * scale;
          
          console.log(`Image ${screenshotFilename}: ${metadata.width}x${metadata.height}, scaled: ${scaledWidth}x${scaledHeight}`);
          
          // If image is short enough to fit on one page, just add it directly
          if (scaledHeight <= pageHeight) {
            doc.image(screenshotPath, {
              x: (doc.page.width - scaledWidth) / 2, // Center horizontally
              width: scaledWidth
            });
          } else {
            // For long screenshots, we'll slice them into parts
            console.log(`Long screenshot: ${screenshotFilename}, will split into multiple pages`);
            
            // How many pixels of the original image to show per page
            const pixelsPerPage = Math.floor(pageHeight / scale);
            
            // Define overlap to prevent text from being split between pages (50px)
            const overlapPixels = 100;
            
            // How many pages we'll need, accounting for overlap
            const pagesNeeded = Math.ceil((metadata.height - overlapPixels) / (pixelsPerPage - overlapPixels));
            console.log(`Will split into ${pagesNeeded} pages, ${pixelsPerPage} source pixels per page with ${overlapPixels}px overlap`);
            
            // Create a temp directory for the image slices if it doesn't exist
            const tempSliceDir = path.join(jobDir, 'temp-slices');
            if (!fs.existsSync(tempSliceDir)) {
              fs.mkdirSync(tempSliceDir, { recursive: true });
            }
            
            // Process each slice
            for (let slice = 0; slice < pagesNeeded; slice++) {
              // If not the first slice, add a new page
              if (slice > 0) {
                doc.addPage();
                
                // Add URL as header on continuation pages
                doc.fontSize(12);
                doc.font('Helvetica-Bold');
                doc.text(`${url} (continued ${slice+1}/${pagesNeeded})`, {
                  width: doc.page.width - 100,
                  align: 'center'
                });
                doc.moveDown(0.5);
              }
              
              // Calculate the part of the image to extract, with overlap
              // For all slices except the first, start 'overlapPixels' pixels earlier
              const top = slice === 0 ? 0 : slice * (pixelsPerPage - overlapPixels);
              const height = Math.min(pixelsPerPage, metadata.height - top);
              
              // Create a filename for this slice
              const sliceFileName = `slice-${i}-${slice}.png`;
              const sliceFilePath = path.join(tempSliceDir, sliceFileName);
              
              // Extract and save the slice
              await sharp(screenshotPath)
                .extract({ left: 0, top, width: metadata.width, height })
                .toFile(sliceFilePath);
              
              // Add the slice to the PDF
              doc.image(sliceFilePath, {
                x: (doc.page.width - scaledWidth) / 2, // Center horizontally
                width: scaledWidth
              });
              
              // Clean up the slice file after adding it to the PDF
              // We can't delete immediately because PDFKit might still be processing
              // We'll clean up the whole temp directory at the end
            }
          }
        } catch (err) {
          console.error(`Error processing image ${screenshotFilename}:`, err);
          // Fallback: just add the image and let PDFKit handle it
          doc.image(screenshotPath, {
            x: (doc.page.width - pageWidth) / 2, // Center horizontally
            width: pageWidth
          });
        }
      }

      // let pages = doc.bufferedPageRange();
      // for (let i = 0; i < pages.count; i++) {
      //   doc.switchToPage(i);

      //   //Footer: Add page number
      //   let oldBottomMargin = doc.page.margins.bottom;
      //   doc.page.margins.bottom = 0 //Dumb: Have to remove bottom margin in order to write into it
      //   doc
      //     .text(
      //       `${i + 1} / ${pages.count}`,
      //       0,
      //       doc.page.height - (oldBottomMargin/2), // Centered vertically in bottom margin
      //       { align: 'center' }
      //     );
      //   doc.page.margins.bottom = oldBottomMargin; // ReProtect bottom margin
      // }
      
      // Finalize the PDF
      doc.end();
      
      // Wait for PDF writing to complete
      doc.on('end', async () => {
        console.log(`PDF file created for job ${jobId}: ${pdfPath}`);
        
        // Clean up temp directory
        const tempSliceDir = path.join(jobDir, 'temp-slices');
        if (fs.existsSync(tempSliceDir)) {
          try {
            for (const file of fs.readdirSync(tempSliceDir)) {
              fs.unlinkSync(path.join(tempSliceDir, file));
            }
            fs.rmdirSync(tempSliceDir);
            console.log(`Removed temporary slice directory for job ${jobId}`);
          } catch (err) {
            console.error(`Error cleaning up temp directory:`, err);
          }
        }
        
        // Update job with PDF file path
        await prisma.job.update({
          where: { jobId },
          data: { 
            pdfPath: webAccessiblePath
          }
        });
        
        resolve(pdfPath);
      });
    } catch (error) {
      console.error(`Error creating PDF file for job ${jobId}:`, error);
      reject(error);
    }
  });
}

export { createJobPdf };