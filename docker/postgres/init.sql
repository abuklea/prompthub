-- Extensions required by GoTrue (Supabase Auth)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- GoTrue manages the auth schema; create it so the search_path resolves on connect
CREATE SCHEMA IF NOT EXISTS auth;
