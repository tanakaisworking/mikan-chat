WITH recommended_ages(id, min_age, max_age) AS (VALUES
  ('aoi', 20, 38), ('mia', 24, 42), ('rin', 24, 42), ('koharu', 20, 38),
  ('minato-radio', 25, 45), ('satoru-ren', 25, 45), ('yu', 22, 40), ('ritsu', 30, 55),
  ('shizuku-downer', 18, 27), ('lucien-contract', 20, 38), ('kohaku-midnight', 20, 38), ('tomoya-fake-date', 24, 42),
  ('noah-voice-memory', 24, 42), ('cassian-rewind', 20, 38), ('sumiko-rules', 20, 38), ('vera-diner', 24, 42),
  ('elias-dragons', 24, 42), ('shinkuro-road', 24, 42), ('lionel-shutdown', 24, 42), ('marta-socks', 28, 48),
  ('seiji-memory', 28, 48), ('maho-last-bout', 24, 42), ('genmei-poison', 24, 42), ('natsu-final-live', 24, 42),
  ('rei-blue-bird', 24, 42), ('naoto-two-weeks', 28, 48), ('ryo-alliance', 28, 48), ('mina-offline', 24, 42),
  ('nagi-radio', 32, 60), ('shuji-last-train', 32, 60), ('fumie-family-tree', 24, 42), ('saku-unscripted', 24, 42),
  ('akari-foldroad', 24, 42), ('gald-career', 28, 48), ('yayoi-extra-day', 24, 42), ('sena-mars-flower', 28, 48),
  ('lucas-nightmare', 32, 60), ('julius-handover', 24, 42), ('someta-new-story', 28, 48), ('saya-forecast', 28, 48),
  ('margot-awake', 32, 60), ('kiryu-future-letter', 28, 48), ('ritsuko-full-house', 28, 48), ('ian-final-word', 32, 60),
  ('hiyori-moon-store', 24, 42), ('sota-dragon-bath', 24, 42), ('chifuyu-last-match', 28, 48), ('genta-cold-well', 28, 48),
  ('agnes-unordered-dish', 32, 60), ('haruto-jellyfish', 24, 42), ('kei-imperfect-dish', 28, 48), ('takumi-repaired-chair', 28, 48),
  ('hibiki-rain-sound', 24, 42), ('kaito-ex-wedding', 24, 42)
)
UPDATE scenarios
SET pack_json = json_set(
  pack_json,
  '$.extensions."mikan.recommendation"',
  json_object(
    'targetAudiences', json_array(COALESCE(json_extract(pack_json, '$.extensions."mikan.demo".audience'), 'all')),
    'recommendedAge', json_object('min', recommended_ages.min_age, 'max', recommended_ages.max_age)
  )
), updated_at = unixepoch()
FROM recommended_ages
WHERE scenarios.id = recommended_ages.id
  AND json_valid(scenarios.pack_json)
  AND json_extract(scenarios.pack_json, '$.extensions."mikan.recommendation"') IS NULL;
