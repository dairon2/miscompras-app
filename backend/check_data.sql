SELECT 'Users' as tabla, COUNT(*) as total FROM "User"
UNION ALL
SELECT 'Requirements', COUNT(*) FROM "Requirement"
UNION ALL
SELECT 'Budgets', COUNT(*) FROM "Budget"
UNION ALL  
SELECT 'Projects', COUNT(*) FROM "Project"
UNION ALL
SELECT 'Areas', COUNT(*) FROM "Area";
