-- Add Microsoft as an OAuth provider type for existing databases
DO $$ BEGIN
  ALTER TYPE oauth_provider_type ADD VALUE IF NOT EXISTS 'microsoft';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
