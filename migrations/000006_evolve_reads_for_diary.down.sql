DROP INDEX IF EXISTS reads_user_book_active_unique;
DROP INDEX IF EXISTS reads_user_book_created_id_idx;

ALTER TABLE reads
    DROP CONSTRAINT IF EXISTS reads_status_fields_consistent,
    DROP CONSTRAINT IF EXISTS reads_notes_length,
    DROP CONSTRAINT reads_status_allowed;

UPDATE reads
SET status = CASE
    WHEN status = 'want_to_read' THEN 'on_hold'
    WHEN status = 'read' THEN 'completed'
    WHEN status = 'did_not_finish' THEN 'abandoned'
    ELSE status
END;

UPDATE reads
SET started_at = COALESCE(started_at, created_at),
    updated_at = now();

ALTER TABLE reads
    DROP COLUMN notes,
    ALTER COLUMN status SET DEFAULT 'reading',
    ALTER COLUMN started_at SET DEFAULT now(),
    ALTER COLUMN started_at SET NOT NULL,
    ADD CONSTRAINT reads_status_allowed CHECK (status IN ('reading', 'completed', 'abandoned', 'on_hold'));
