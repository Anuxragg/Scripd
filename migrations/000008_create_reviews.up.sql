CREATE TABLE reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    read_id uuid NOT NULL UNIQUE REFERENCES reads (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    body text NOT NULL,
    contains_spoilers boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT reviews_body_nonempty CHECK (length(trim(body)) > 0),
    CONSTRAINT reviews_body_max_length CHECK (char_length(body) <= 10000)
);

CREATE INDEX reviews_book_created_id_idx ON reviews (book_id, created_at DESC, id DESC);
CREATE INDEX reviews_user_created_id_idx ON reviews (user_id, created_at DESC, id DESC);
