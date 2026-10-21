CREATE OR REPLACE FUNCTION public.books_authors_search_text(authors text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
AS $$
    SELECT string_agg(author, ' ' ORDER BY ord)
    FROM unnest(authors) WITH ORDINALITY AS author_list(author, ord)
$$;
