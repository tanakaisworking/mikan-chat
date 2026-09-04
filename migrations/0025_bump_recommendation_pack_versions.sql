UPDATE scenarios
SET pack_json = json_set(
  pack_json,
  '$.version',
  CASE json_extract(pack_json, '$.version')
    WHEN '1.0.0' THEN '1.0.1'
    WHEN '2.0.0' THEN '2.0.1'
    ELSE json_extract(pack_json, '$.version')
  END
), updated_at = unixepoch()
WHERE id IN (
  'aoi', 'mia', 'rin', 'koharu', 'minato-radio', 'satoru-ren', 'yu', 'ritsu',
  'shizuku-downer', 'lucien-contract', 'kohaku-midnight', 'tomoya-fake-date',
  'noah-voice-memory', 'cassian-rewind', 'sumiko-rules', 'vera-diner',
  'elias-dragons', 'shinkuro-road', 'lionel-shutdown', 'marta-socks',
  'seiji-memory', 'maho-last-bout', 'genmei-poison', 'natsu-final-live',
  'rei-blue-bird', 'naoto-two-weeks', 'ryo-alliance', 'mina-offline',
  'nagi-radio', 'shuji-last-train', 'fumie-family-tree', 'saku-unscripted',
  'akari-foldroad', 'gald-career', 'yayoi-extra-day', 'sena-mars-flower',
  'lucas-nightmare', 'julius-handover', 'someta-new-story', 'saya-forecast',
  'margot-awake', 'kiryu-future-letter', 'ritsuko-full-house', 'ian-final-word',
  'hiyori-moon-store', 'sota-dragon-bath', 'chifuyu-last-match', 'genta-cold-well',
  'agnes-unordered-dish', 'haruto-jellyfish', 'kei-imperfect-dish', 'takumi-repaired-chair',
  'hibiki-rain-sound', 'kaito-ex-wedding'
)
AND json_extract(pack_json, '$.extensions."mikan.recommendation"') IS NOT NULL;
