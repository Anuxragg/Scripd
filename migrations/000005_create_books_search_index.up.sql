CREATE INDEX books_search_fts_idx ON books USING GIN (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || array_to_string(authors, ' '))
);
