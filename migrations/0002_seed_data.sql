-- Seed data for HeySalad QC demo
-- Creates 5 sample stations with detection rules

-- Sample Station 1: Packing Station 1
INSERT INTO stations (id, name, type, location, description, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Packing Station 1',
  'packing',
  'Kitchen Area A',
  'Main packing station for delivery orders. Handles salads and bowls.',
  datetime('now'),
  datetime('now')
);

INSERT INTO detection_rules (id, station_id, expected_items, confidence_threshold, alert_config, created_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440001',
  '[{"label":"lettuce","required":true},{"label":"tomato","required":true},{"label":"container","required":true},{"label":"lid","required":false}]',
  0.75,
  '{"enabled":true,"triggers":["missing_item"]}',
  datetime('now')
);

-- Sample Station 2: Prep Station A
INSERT INTO stations (id, name, type, location, description, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'Prep Station A',
  'prep',
  'Kitchen Area B',
  'Vegetable preparation station. Handles cutting and washing.',
  datetime('now'),
  datetime('now')
);

INSERT INTO detection_rules (id, station_id, expected_items, confidence_threshold, alert_config, created_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440002',
  '[{"label":"cutting_board","required":true},{"label":"knife","required":true},{"label":"gloves","required":true}]',
  0.80,
  '{"enabled":true,"triggers":["missing_item","low_confidence"]}',
  datetime('now')
);

-- Sample Station 3: Cold Storage Check
INSERT INTO stations (id, name, type, location, description, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  'Cold Storage Check',
  'storage',
  'Walk-in Cooler',
  'Temperature-controlled storage area for fresh ingredients.',
  datetime('now'),
  datetime('now')
);

INSERT INTO detection_rules (id, station_id, expected_items, confidence_threshold, alert_config, created_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440003',
  '[{"label":"temperature_display","required":true},{"label":"sealed_containers","required":true}]',
  0.70,
  '{"enabled":false,"triggers":[]}',
  datetime('now')
);

-- Sample Station 4: Receiving Dock
INSERT INTO stations (id, name, type, location, description, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440004',
  'Receiving Dock',
  'receiving',
  'Back Entrance',
  'Delivery receiving area. Inspects incoming produce shipments.',
  datetime('now'),
  datetime('now')
);

INSERT INTO detection_rules (id, station_id, expected_items, confidence_threshold, alert_config, created_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440004',
  '[{"label":"delivery_box","required":true},{"label":"invoice","required":true},{"label":"thermometer","required":false}]',
  0.75,
  '{"enabled":true,"triggers":["all_failures"]}',
  datetime('now')
);

-- Sample Station 5: Packing Station 2
INSERT INTO stations (id, name, type, location, description, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440005',
  'Packing Station 2',
  'packing',
  'Kitchen Area A',
  'Secondary packing station for high-volume periods.',
  datetime('now'),
  datetime('now')
);

INSERT INTO detection_rules (id, station_id, expected_items, confidence_threshold, alert_config, created_at)
VALUES (
  '660e8400-e29b-41d4-a716-446655440005',
  '550e8400-e29b-41d4-a716-446655440005',
  '[{"label":"lettuce","required":true},{"label":"protein","required":true},{"label":"dressing","required":false},{"label":"container","required":true}]',
  0.75,
  '{"enabled":false,"triggers":[]}',
  datetime('now')
);
