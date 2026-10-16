CREATE FUNCTION books_authors_search_text(authors text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
    SELECT string_agg(author, ' ' ORDER BY ord)
    FROM unnest(authors) WITH ORDINALITY AS author_list(author, ord)
$$;

CREATE INDEX books_search_fts_idx ON books USING GIN (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(subtitle, '') || ' ' || coalesce(books_authors_search_text(authors), ''))
);
