CREATE TABLE reads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES books (id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'reading',
    rating numeric(2,1),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reads_status_allowed CHECK (status IN ('reading', 'completed', 'abandoned', 'on_hold')),
    CONSTRAINT reads_rating_half_star CHECK (
        rating IS NULL OR (rating >= 0.5 AND rating <= 5.0 AND rating * 2 = trunc(rating * 2))
    ),
    CONSTRAINT reads_finished_after_started CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX reads_user_created_id_idx ON reads (user_id, created_at DESC, id DESC);
CREATE INDEX reads_book_created_id_idx ON reads (book_id, created_at DESC, id DESC);
CREATE INDEX reads_user_status_created_id_idx ON reads (user_id, status, created_at DESC, id DESC);
