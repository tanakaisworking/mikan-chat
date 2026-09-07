-- Shizuku scenario bundles its own BGM asset (kamatamago, commercial use allowed).

UPDATE scenarios
SET pack_json = json_set(pack_json, '$.version', '1.0.3', '$.extensions."mikan.bgm"', json('{"audio":"assets/bgm.m4a","loop":true}')), updated_at = unixepoch()
WHERE json_extract(pack_json, '$.id') = 'f0b4e40f-6596-4e14-bef5-fa5707faabac';
