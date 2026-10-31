ALTER TABLE auth_action_tokens
    DROP CONSTRAINT IF EXISTS auth_action_tokens_purpose_allowed;

ALTER TABLE auth_action_tokens
    ADD CONSTRAINT auth_action_tokens_purpose_allowed
    CHECK (purpose IN ('email_verification'));

