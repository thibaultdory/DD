-- Data Migration for Recurring Task Refactor
-- Run this once, then deploy new schema, then remove old fields from ORM.

-- Ensure new tables (task_series, task_series_assignees, task_occurrences) are created by Alembic first.

BEGIN;

-- 1. Create series rows from existing parent tasks
-- Note: Assumes `tasks.id` for parent tasks will be the `task_series.id`.
-- Assumes `tasks.created_by` is the `creator_id` for the series.
-- Builds RRULE based on distinct weekdays found in child instances of a recurring task.
-- This is an approximation; original rrule might have been more complex.
INSERT INTO task_series (id, title, description, creator_id,
                         start_date, until_date, rrule, timezone, created_at, updated_at)
SELECT 
    t_parent.id, 
    t_parent.title, 
    t_parent.description, 
    t_parent.created_by, 
    MIN(t_child.due_date) as start_date, -- Earliest due_date of its children as start_date
    MAX(t_child.due_date) as until_date, -- Latest due_date of its children as until_date (approx)
    -- build BYDAY list from DISTINCT iso-weekdays (1-7 Mon-Sun) found in children
    'FREQ=WEEKLY;BYDAY=' || string_agg(DISTINCT 
        CASE EXTRACT(ISODOW FROM t_child.due_date)
            WHEN 1 THEN 'MO' WHEN 2 THEN 'TU' WHEN 3 THEN 'WE' WHEN 4 THEN 'TH' 
            WHEN 5 THEN 'FR' WHEN 6 THEN 'SA' WHEN 7 THEN 'SU'
        END, ',') WITHIN GROUP (ORDER BY EXTRACT(ISODOW FROM t_child.due_date)),
    'Europe/Brussels', -- Default timezone from plan
    t_parent.created_at, -- Preserve original creation time
    NOW() -- Set updated_at to now
FROM tasks t_parent
JOIN tasks t_child ON t_child.parent_task_id = t_parent.id
WHERE t_parent.is_recurring = TRUE AND t_parent.parent_task_id IS NULL
GROUP BY t_parent.id, t_parent.title, t_parent.description, t_parent.created_by, t_parent.created_at
ON CONFLICT (id) DO NOTHING; -- In case a parent task had no children, skip it or handle differently.
                               -- The JOIN t_child already filters out parents with no children.

-- 2. Move assignees from parent tasks to task_series_assignees
-- Assumes task_assignments links users to the parent recurring task.
INSERT INTO task_series_assignees (series_id, user_id)
SELECT 
    ts.id, -- series_id from the newly created task_series table
    ta.user_id
FROM task_series ts
JOIN tasks t_parent ON ts.id = t_parent.id -- Join on original parent task ID
JOIN task_assignments ta ON ta.task_id = t_parent.id
WHERE t_parent.is_recurring = TRUE AND t_parent.parent_task_id IS NULL
ON CONFLICT (series_id, user_id) DO NOTHING;

-- 3. Copy done/not-done status from child tasks into task_occurrences
-- This creates occurrences based on the old child tasks.
INSERT INTO task_occurrences (series_id, due_date, completed, created_at, cancelled)
SELECT 
    t_child.parent_task_id, -- This is the series_id
    t_child.due_date, 
    t_child.completed,
    t_child.created_at, -- Preserve original child task creation time if relevant
    FALSE -- Assuming old child tasks were not "cancelled" in the new sense
FROM tasks t_child
WHERE t_child.parent_task_id IS NOT NULL 
  AND EXISTS (SELECT 1 FROM task_series ts WHERE ts.id = t_child.parent_task_id) -- Ensure parent series exists
ON CONFLICT (series_id, due_date) DO NOTHING; -- Avoid duplicates if script is run multiple times or if data is messy

-- 4. Clean up legacy Task table (after verification)
-- DELETE FROM task_assignments WHERE task_id IN (SELECT id FROM tasks WHERE parent_task_id IS NOT NULL);
-- DELETE FROM tasks WHERE parent_task_id IS NOT NULL; -- Delete old child rows
-- UPDATE tasks SET 
--    is_recurring = FALSE, 
--    weekdays = NULL,
--    parent_task_id = NULL -- Should already be NULL for parents, but good to be sure
-- WHERE parent_task_id IS NULL AND id IN (SELECT id FROM task_series); -- Update old parent tasks that became series

-- The cleanup (step 4) should be done carefully after verifying the migration.
-- For now, commenting it out. It will be part of the ORM cleanup later.

COMMIT;
