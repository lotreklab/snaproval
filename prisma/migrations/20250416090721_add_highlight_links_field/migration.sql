-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sitemapUrl" TEXT NOT NULL,
    "totalUrls" INTEGER NOT NULL,
    "processedUrls" INTEGER NOT NULL DEFAULT 0,
    "isRunning" BOOLEAN NOT NULL DEFAULT true,
    "highlightLinks" BOOLEAN NOT NULL DEFAULT true,
    "startTime" DATETIME NOT NULL,
    "completedTime" DATETIME
);
INSERT INTO "new_jobs" ("completedTime", "id", "isRunning", "jobId", "processedUrls", "sitemapUrl", "startTime", "totalUrls") SELECT "completedTime", "id", "isRunning", "jobId", "processedUrls", "sitemapUrl", "startTime", "totalUrls" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "new_jobs" RENAME TO "jobs";
CREATE UNIQUE INDEX "jobs_jobId_key" ON "jobs"("jobId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
