CREATE UNIQUE INDEX IF NOT EXISTS scenarios_pack_public_id_unique
ON scenarios (json_extract(pack_json, '$.id'))
WHERE json_valid(pack_json);
