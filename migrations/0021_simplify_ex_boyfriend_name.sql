UPDATE scenarios
SET character_name = 'タクマ',
    summary = replace(replace(summary, '水瀬 海斗', 'タクマ'), '海斗', 'タクマ'),
    pack_json = replace(replace(pack_json, '水瀬 海斗', 'タクマ'), '海斗', 'タクマ'),
    updated_at = unixepoch()
WHERE id = 'kaito-ex-wedding';
