ALTER TABLE reads DROP CONSTRAINT reads_status_allowed;

UPDATE reads
SET status = CASE
        WHEN status = 'completed' THEN 'read'
        WHEN status = 'abandoned' THEN 'did_not_finish'
        WHEN status = 'on_hold' AND (finished_at IS NOT NULL OR rating IS NOT NULL) THEN 'read'
        WHEN status = 'on_hold' THEN 'reading'
        WHEN status = 'reading' AND (finished_at IS NOT NULL OR rating IS NOT NULL) THEN 'read'
        ELSE status
    END,
    finished_at = CASE
        WHEN status IN ('completed', 'abandoned') THEN COALESCE(finished_at, GREATEST(created_at, started_at))
        WHEN status IN ('on_hold', 'reading') AND (finished_at IS NOT NULL OR rating IS NOT NULL)
            THEN COALESCE(finished_at, GREATEST(created_at, started_at))
        ELSE finished_at
    END,
    updated_at = now();

ALTER TABLE reads
    ALTER COLUMN status SET DEFAULT 'want_to_read',
    ALTER COLUMN started_at DROP NOT NULL,
    ALTER COLUMN started_at DROP DEFAULT,
    ADD COLUMN notes text,
    ADD CONSTRAINT reads_status_allowed CHECK (status IN ('want_to_read', 'reading', 'read', 'did_not_finish')),
    ADD CONSTRAINT reads_status_fields_consistent CHECK (
        (status = 'want_to_read' AND started_at IS NULL AND finished_at IS NULL AND rating IS NULL)
        OR (status = 'reading' AND started_at IS NOT NULL AND finished_at IS NULL AND rating IS NULL)
        OR (status = 'read' AND finished_at IS NOT NULL)
        OR (status = 'did_not_finish' AND finished_at IS NOT NULL)
    ),
    ADD CONSTRAINT reads_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000);

CREATE UNIQUE INDEX reads_user_book_active_unique
    ON reads (user_id, book_id)
    WHERE status IN ('want_to_read', 'reading');

CREATE INDEX reads_user_book_created_id_idx
    ON reads (user_id, book_id, created_at DESC, id DESC);
