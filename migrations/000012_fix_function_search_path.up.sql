-- Fix Supabase Security Advisor: Function Search Path Mutable
-- Pin search_path to pg_catalog, public to prevent search path hijacking
CREATE OR REPLACE FUNCTION public.books_authors_search_text(authors text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
SET search_path = pg_catalog, public
AS $$
    SELECT string_agg(author, ' ' ORDER BY ord)
    FROM unnest(authors) WITH ORDINALITY AS author_list(author, ord)
$$;
