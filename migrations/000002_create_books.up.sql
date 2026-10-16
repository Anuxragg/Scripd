CREATE TABLE books (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    open_library_key text,
    isbn13 char(13),
    title text NOT NULL,
    subtitle text,
    authors text[] NOT NULL DEFAULT '{}',
    cover_url text,
    published_year smallint,
    description text,
    raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata_synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT books_title_nonempty CHECK (length(trim(title)) > 0),
    CONSTRAINT books_isbn13_format CHECK (isbn13 IS NULL OR isbn13 ~ '^[0-9]{13}$'),
    CONSTRAINT books_published_year_range CHECK (published_year IS NULL OR published_year BETWEEN 0 AND 9999)
);

CREATE UNIQUE INDEX books_open_library_key_unique
    ON books (open_library_key)
    WHERE open_library_key IS NOT NULL;
CREATE UNIQUE INDEX books_isbn13_unique ON books (isbn13) WHERE isbn13 IS NOT NULL;
CREATE INDEX books_title_id_idx ON books (lower(title), id);
