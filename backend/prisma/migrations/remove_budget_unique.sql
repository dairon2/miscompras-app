-- Remove the unique constraint on Budget (project, area, category, year)
-- This allows the same category to be used multiple times in the same project/area/year
-- SAFE: Only drops an index, does NOT delete any data

DROP INDEX IF EXISTS "Budget_projectId_areaId_categoryId_year_key";
