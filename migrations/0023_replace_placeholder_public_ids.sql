UPDATE scenarios
SET pack_json = json_set(pack_json, '$.id', 'b1aa0948-3062-4f41-90c5-7fa451dec95f'),
    updated_at = unixepoch()
WHERE id = 'mia'
  AND json_extract(pack_json, '$.id') = '22222222-2222-4222-8222-222222222222';

UPDATE scenarios
SET pack_json = json_set(pack_json, '$.id', '69ad7d2d-c129-4cfe-a4b2-692a17fdc9bf'),
    updated_at = unixepoch()
WHERE id = 'rin'
  AND json_extract(pack_json, '$.id') = '33333333-3333-4333-8333-333333333333';

UPDATE scenarios
SET pack_json = json_set(pack_json, '$.id', 'cc1374b1-3147-4790-9e51-a0a3b4d01019'),
    updated_at = unixepoch()
WHERE id = 'koharu'
  AND json_extract(pack_json, '$.id') = '44444444-4444-4444-8444-444444444444';
