-- 0002_development_seed.sql inserts the dev-v1 template with
-- ON CONFLICT (version) DO NOTHING, so a local dev database that already
-- had that row from before the template schema moved to {"fields": [...]}
-- silently kept the old {"required", "properties"} shape. The API still
-- returns it as-is, and the PWA's activeFields = schema_json?.fields ?? []
-- resolves to an empty array, silently degrading the inspection form to
-- its generic free-text fallback with no error anywhere.
--
-- Backfill it forward. Development only, matching 0002's own guard
-- (never loaded in staging/production) — a no-op if the row is already
-- in the new shape, including on every fresh database.
UPDATE inspection_templates
SET schema_json = '{"fields":[
     {"key":"brakes","label":"Brakes","label_bn":"ব্রেক","type":"pass_fail_na"},
     {"key":"lights","label":"Lights","label_bn":"লাইট","type":"pass_fail_na"},
     {"key":"horn","label":"Horn","label_bn":"হর্ণ","type":"pass_fail_na"},
     {"key":"tyres","label":"Tyres","label_bn":"টায়ার","type":"pass_fail_na"},
     {"key":"notes","label":"Additional notes","label_bn":"অতিরিক্ত মন্তব্য","type":"text"}
   ]}'::jsonb
WHERE version = 'dev-v1' AND NOT (schema_json ? 'fields');
