CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username varchar(30) NOT NULL UNIQUE,
    email text NOT NULL,
    password_hash text NOT NULL,
    display_name varchar(80),
    bio varchar(500),
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_username_format CHECK (username ~ '^[A-Za-z0-9_]{3,30}$'),
    CONSTRAINT users_email_nonempty CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));
CREATE INDEX users_created_at_id_idx ON users (created_at DESC, id DESC);
