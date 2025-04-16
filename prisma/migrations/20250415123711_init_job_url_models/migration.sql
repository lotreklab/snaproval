-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "sitemapUrl" TEXT NOT NULL,
    "totalUrls" INTEGER NOT NULL,
    "processedUrls" INTEGER NOT NULL DEFAULT 0,
    "isRunning" BOOLEAN NOT NULL DEFAULT true,
    "startTime" DATETIME NOT NULL,
    "completedTime" DATETIME
);

-- CreateTable
CREATE TABLE "urls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'to_do',
    "imagePath" TEXT,
    "jobId" TEXT NOT NULL,
    "processedAt" DATETIME,
    CONSTRAINT "urls_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("jobId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_jobId_key" ON "jobs"("jobId");
