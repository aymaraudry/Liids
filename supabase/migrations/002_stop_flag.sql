-- Add stop flag to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS pipeline_stop_requested boolean DEFAULT false;

-- Add manually_added flag to companies  
ALTER TABLE companies ADD COLUMN IF NOT EXISTS manually_added boolean DEFAULT false;
