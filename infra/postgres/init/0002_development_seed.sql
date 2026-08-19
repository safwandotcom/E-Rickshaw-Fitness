-- Local development fixtures. The IDs are intentionally stable so a developer
-- can issue a development token and exercise an inspection flow after startup.
INSERT INTO districts (id, code, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'DHK', 'Dhaka')
ON CONFLICT (code) DO NOTHING;

INSERT INTO zones (id, district_id, code, name) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'DHK-N-04', 'Dhaka North Zone 04')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (id, external_subject, display_name, mfa_enabled) VALUES
  ('00000000-0000-0000-0000-000000000201', 'dev-inspector', 'Development Inspector', true)
ON CONFLICT (external_subject) DO NOTHING;

INSERT INTO user_roles (user_id, role_code) VALUES
  ('00000000-0000-0000-0000-000000000201', 'inspector')
ON CONFLICT DO NOTHING;

INSERT INTO user_geographies (user_id, district_id, zone_id) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101')
ON CONFLICT DO NOTHING;

INSERT INTO inspection_templates (id, version, vehicle_type, schema_json, effective_from) VALUES
  ('00000000-0000-0000-0000-000000000301', 'dev-v1', 'e-rickshaw',
   '{"required":["brakes","lights"],"properties":{"brakes":{"type":"boolean"},"lights":{"type":"boolean"},"notes":{"type":"string"}}}'::jsonb, now() - interval '1 day')
ON CONFLICT (version) DO NOTHING;
