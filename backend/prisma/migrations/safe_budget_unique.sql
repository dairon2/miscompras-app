-- Migration: Change Budget unique constraint from composite to title only
-- This migration is safe and won't delete any data

-- Step 1: Drop the old composite unique constraint
DROP INDEX IF EXISTS "Budget_projectId_areaId_categoryId_year_key";

-- Step 2: Add unique constraint on title only
CREATE UNIQUE INDEX "Budget_title_key" ON "Budget"("title");
