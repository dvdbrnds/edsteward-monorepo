-- Add hierarchy to all regulations that don't have it
-- Strategy: Use category field to group tasks under section headers

-- Step 1: For each regulation, create section headers for each unique category
-- Step 2: Update tasks to point to their category's section header

DO $$
DECLARE
    reg RECORD;
    cat RECORD;
    section_id INTEGER;
    section_count INTEGER := 0;
    task_count INTEGER := 0;
BEGIN
    -- Loop through regulations that have tasks but no hierarchy
    FOR reg IN 
        SELECT DISTINCT r.id as regulation_id, r.reg_key, r.name
        FROM regulations r
        JOIN regulation_tasks t ON r.id = t.regulation_id
        WHERE r.is_current = true 
          AND r.reg_key IS NOT NULL
          AND t.parent_task_id IS NULL
        GROUP BY r.id, r.reg_key, r.name
        HAVING COUNT(DISTINCT COALESCE(t.category, 'General')) > 0
           AND SUM(CASE WHEN t.parent_task_id IS NOT NULL THEN 1 ELSE 0 END) = 0
        ORDER BY r.reg_key
    LOOP
        -- Get unique categories for this regulation
        FOR cat IN
            SELECT DISTINCT COALESCE(category, 'General Compliance') as cat_name,
                   MIN(sort_order) as min_sort
            FROM regulation_tasks
            WHERE regulation_id = reg.regulation_id
              AND parent_task_id IS NULL
            GROUP BY COALESCE(category, 'General Compliance')
            ORDER BY MIN(sort_order)
        LOOP
            -- Create section header for this category
            INSERT INTO regulation_tasks (
                regulation_id, 
                task_id, 
                title, 
                description,
                category,
                priority, 
                requirement_type, 
                sort_order
            ) VALUES (
                reg.regulation_id,
                'SEC-' || reg.reg_key || '-' || REPLACE(UPPER(LEFT(cat.cat_name, 20)), ' ', '-'),
                cat.cat_name,
                'Section: ' || cat.cat_name || ' requirements for ' || reg.name,
                cat.cat_name,
                'high',
                'requirement',
                cat.min_sort - 1
            ) RETURNING id INTO section_id;
            
            section_count := section_count + 1;
            
            -- Update all tasks in this category to point to the section header
            UPDATE regulation_tasks
            SET parent_task_id = section_id
            WHERE regulation_id = reg.regulation_id
              AND COALESCE(category, 'General Compliance') = cat.cat_name
              AND parent_task_id IS NULL
              AND id != section_id;
            
            GET DIAGNOSTICS task_count = ROW_COUNT;
            
        END LOOP;
        
        RAISE NOTICE 'Processed %: % sections created', reg.reg_key, section_count;
        section_count := 0;
    END LOOP;
    
    RAISE NOTICE 'Hierarchy creation complete';
END $$;

-- Verify results
SELECT 
  r.reg_key,
  COUNT(t.id) as total_tasks,
  COUNT(t.parent_task_id) as with_parent,
  COUNT(t.id) - COUNT(t.parent_task_id) as sections
FROM regulations r
JOIN regulation_tasks t ON r.id = t.regulation_id
WHERE r.is_current = true AND r.reg_key IS NOT NULL
GROUP BY r.reg_key
HAVING COUNT(t.id) > 0
ORDER BY r.reg_key
LIMIT 20;
