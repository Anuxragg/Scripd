-- Enable Row Level Security (RLS) on all public tables to eliminate Supabase Security Advisor errors
ALTER TABLE IF EXISTS schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS books ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_action_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_comments ENABLE ROW LEVEL SECURITY;

-- Revoke Data API / PostgREST direct access for anon and authenticated roles.
-- Scripd uses its own Go backend API service with direct database pooling.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    END IF;
END $$;
