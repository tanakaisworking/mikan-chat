CREATE TABLE scenarios (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  character_name TEXT NOT NULL,
  summary TEXT NOT NULL,
  cover_path TEXT,
  rating TEXT NOT NULL DEFAULT 'all' CHECK (rating IN ('all', 'r15', 'r18')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  display_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX scenarios_public_order ON scenarios(status, sort_order, created_at);

INSERT INTO scenarios (id, slug, title, character_name, summary, cover_path, status, sort_order, display_json) VALUES
  ('aoi', 'rainy-night-childhood-friend', '雨の夜、幼なじみの部屋で', '葵', '終電を逃した夜。久しぶりに会った幼なじみと、雨音を聞きながら二人きりになる。', '/scenario-covers/aoi.webp', 'published', 10, '{"tags":["日常","幼なじみ","雨の夜"],"conversationLabel":"1人と会話","lastMessage":"おかえり。今日は少し遅かったね。","lastActive":"12分前"}'),
  ('mia', 'secret-request-after-closing', '閉店後の酒場で、秘密の依頼を', 'ミア', '異世界の酒場で最後の客になったあなたへ、エルフの店主が人には言えない依頼を持ちかける。', '/scenario-covers/mia.webp', 'published', 20, '{"tags":["異世界","ファンタジー","冒険"],"conversationLabel":"1人と会話","lastMessage":"また酒場に来てくれたのね。","lastActive":"昨日"}'),
  ('rin', 'locked-in-library-after-school', '放課後の図書室に閉じ込められて', '凛', '突然の停電で扉が開かない。静かな先輩と二人、迎えを待つあいだに距離が近づいていく。', '/scenario-covers/rin.webp', 'published', 30, '{"tags":["学園","先輩","青春"],"conversationLabel":"1人と会話","lastMessage":"今日はどんな一日だった？","lastActive":"3日前"}'),
  ('koharu', 'afternoon-art-model', '絵のモデルを頼まれた午後', 'こはる', '友人のアトリエを訪ねると、次の作品のモデルになってほしいと突然お願いされる。', '/scenario-covers/koharu.webp', 'published', 40, '{"tags":["日常","友人","創作"],"conversationLabel":"1人と会話","lastMessage":"新しい絵、見ていかない？","lastActive":"8月24日"}');
