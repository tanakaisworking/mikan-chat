-- 冬木千冬（おばあちゃん）と黒瀬凪（30代半ばの女性の外見）の声を女性に訂正する。
-- 0030の一括付与で male になっていた2件だけを上書きする。

UPDATE scenarios SET pack_json = json_set(pack_json, '$.plot.characters[0].voice.profile.gender', 'female'), updated_at = unixepoch()
WHERE id = 'chifuyu-last-match'
AND json_extract(pack_json, '$.plot.characters[0].id') = 'chifuyu'
AND json_extract(pack_json, '$.plot.characters[0].voice.profile') IS NOT NULL;

UPDATE scenarios SET pack_json = json_set(pack_json, '$.plot.characters[0].voice.profile.gender', 'female'), updated_at = unixepoch()
WHERE id = 'nagi-radio'
AND json_extract(pack_json, '$.plot.characters[0].id') = 'nagi'
AND json_extract(pack_json, '$.plot.characters[0].voice.profile') IS NOT NULL;
