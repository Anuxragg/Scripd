CREATE TABLE review_likes (
    review_id uuid NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (review_id, user_id)
);

CREATE INDEX review_likes_user_created_idx ON review_likes (user_id, created_at DESC);

CREATE TABLE review_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id uuid NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT review_comments_body_nonempty CHECK (length(trim(body)) > 0),
    CONSTRAINT review_comments_body_max_length CHECK (char_length(body) <= 2000)
);

CREATE INDEX review_comments_review_created_id_idx ON review_comments (review_id, created_at ASC, id ASC);
CREATE INDEX review_comments_user_created_id_idx ON review_comments (user_id, created_at DESC, id DESC);
