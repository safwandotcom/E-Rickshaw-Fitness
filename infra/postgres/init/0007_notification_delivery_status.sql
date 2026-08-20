ALTER TABLE notification_jobs DROP CONSTRAINT IF EXISTS notification_jobs_status_check;
ALTER TABLE notification_jobs ADD CONSTRAINT notification_jobs_status_check CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'dead_letter'));
