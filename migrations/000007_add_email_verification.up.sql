ALTER TABLE users
    ADD COLUMN email_verified_at timestamptz;

CREATE TABLE auth_action_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose text NOT NULL,
    token_hash bytea NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT auth_action_tokens_purpose_allowed CHECK (purpose IN ('email_verification')),
    CONSTRAINT auth_action_tokens_hash_length CHECK (octet_length(token_hash) = 32)
);

CREATE UNIQUE INDEX auth_action_tokens_user_purpose_active_unique
    ON auth_action_tokens (user_id, purpose)
    WHERE consumed_at IS NULL;
CREATE INDEX auth_action_tokens_expires_at_idx ON auth_action_tokens (expires_at);
CREATE INDEX auth_action_tokens_user_purpose_created_at_idx
    ON auth_action_tokens (user_id, purpose, created_at DESC);
