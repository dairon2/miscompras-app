-- Migration: Remove ALL unique constraints from Budget
-- This migration is safe and won't delete any data

-- Drop the composite unique constraint if exists
DROP INDEX IF EXISTS "Budget_projectId_areaId_categoryId_year_key";

-- Drop the title unique constraint if exists  
DROP INDEX IF EXISTS "Budget_title_key";

-- NO NEW UNIQUE CONSTRAINTS ADDED
-- Budgets can now have repeated: project, area, category, year, AND title
