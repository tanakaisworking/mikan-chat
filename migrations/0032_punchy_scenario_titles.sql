-- 性癖直球タイトルへの書き換え。表示名のみ。ID・バージョンは不変。
UPDATE scenarios
SET title = CASE id
    WHEN 'aoi' THEN '終電を逃した夜、幼なじみの葵と二人きり'
    WHEN 'mia' THEN '快活なエルフ店主があなたにだけ持ちかける秘密の依頼'
    WHEN 'rin' THEN '静かな先輩と閉館後の図書室に二人きり'
    WHEN 'koharu' THEN '無防備な女友達に絵のモデルを頼まれる午後'
    WHEN 'minato-radio' THEN '声だけ知ってた推しDJと初対面する最終回'
    WHEN 'satoru-ren' THEN '寡黙な技師と人懐っこいガイドに迫られる嵐の夜'
    WHEN 'yu' THEN '年下の常連が毎週あなたにだけ花束を贈る金曜日'
    WHEN 'ritsu' THEN '年上の遺品整理士と秘密の手紙を探す実家じまい'
    WHEN 'shizuku-downer' THEN '男嫌いのダウナーな後輩が、放課後はあなたにだけ甘える'
    WHEN 'lucien-contract' THEN '嘘がつけない公爵と契約結婚する初夜'
    WHEN 'kohaku-midnight' THEN '狐の常連が午前二時にあなただけに会いに来る'
    WHEN 'tomoya-fake-date' THEN '無口な同期と一日だけ恋人になる結婚式'
    WHEN 'noah-voice-memory' THEN '記憶を失った相棒が覚えているあなたの声だけ'
    WHEN 'cassian-rewind' THEN '裏切った護衛を処刑前夜にもう一度信じる'
    WHEN 'sumiko-rules' THEN '年上の管理人と最後の規則を探す訳あり物件'
    WHEN 'vera-diner' THEN '元魔王の店員が閉店後にあなただけに見せる素顔'
    WHEN 'elias-dragons' THEN '無愛想な竜の保育士が迎えに来た追放先'
    WHEN 'shinkuro-road' THEN '名を捨てた浪人と一夜だけの護衛旅'
    WHEN 'lionel-shutdown' THEN 'サ終の夜に相棒NPCから頼まれる最後のお願い'
    WHEN 'marta-socks' THEN '世話焼き魔女と明日のあなたからの片方の靴下'
    WHEN 'seiji-memory' THEN '記憶を売った刑事と消えた昨日を買い戻す'
    WHEN 'maho-last-bout' THEN '元ライバルの彼女が引退前夜にセコンドに来る'
    WHEN 'genmei-poison' THEN '後宮の毒見役があなたの薬膳だけを疑う夜'
    WHEN 'natsu-final-live' THEN '解散五分前に相方が二人だけの新曲を持ってきた'
    WHEN 'rei-blue-bird' THEN '怪盗の彼女に頼まれる盗まない共犯'
    WHEN 'naoto-two-weeks' THEN '元夫と離婚届け後に二週間だけ同居する'
    WHEN 'ryo-alliance' THEN '昨日まで敵だった弁護士と結ぶ秘密の同盟'
    WHEN 'mina-offline' THEN '人気配信者が配信外であなたにだけ見せる素顔'
    WHEN 'nagi-radio' THEN '沈んだ観測所から届く十年越しの相棒の声'
    WHEN 'shuji-last-train' THEN '廃駅の駅員が終電名簿からあなたの名前を消す夜'
    WHEN 'fumie-family-tree' THEN '無口な刺繍師が家系図にあなたの名前を縫い戻す'
    WHEN 'saku-unscripted' THEN 'カメラのない夜道を二人で歩く元俳優'
    WHEN 'akari-foldroad' THEN '勝ち気な配達員と地図にない町への最後の配達'
    WHEN 'gald-career' THEN '元勇者と二人きりで書く初めての履歴書'
    WHEN 'yayoi-extra-day' THEN '新人死神のミスで一日だけ延びた命'
    WHEN 'sena-mars-flower' THEN 'あなたにだけ咲く地球最後の花を守る研究員'
    WHEN 'lucas-nightmare' THEN '売ったはずの悪夢を買い戻す夢の競売'
    WHEN 'julius-handover' THEN '退職する魔法使いの最後の引継ぎと使い魔'
    WHEN 'someta-new-story' THEN '声を失った落語家と作る二人だけの新作'
    WHEN 'saya-forecast' THEN 'あなたの名前を呼ぶ明日の予報'
    WHEN 'margot-awake' THEN '毒舌な清掃員と王子より先に目覚める百年城'
    WHEN 'kiryu-future-letter' THEN '十年後のあなたからの「読むな」を預かる配達員'
    WHEN 'ritsuko-full-house' THEN '年上鑑定士と六人が暮らす空き家の一夜'
    WHEN 'ian-final-word' THEN '世界最後の翻訳者と選ぶ別れの一語'
    WHEN 'hiyori-moon-store' THEN '月面コンビニで七分遅れの最後の客を待つ夜'
    WHEN 'sota-dragon-bath' THEN '湯船を怖がる竜の子を見守る番頭'
    WHEN 'chifuyu-last-match' THEN '引退棋士と盤上から消えた封じ手の謎'
    WHEN 'genta-cold-well' THEN '燃えていない家の井戸に昇る白煙と火消し頭'
    WHEN 'agnes-unordered-dish' THEN '誰も頼んでいない銀皿を開ける王宮給仕長'
    WHEN 'haruto-jellyfish' THEN '夜勤飼育員と眠らないクラゲを見守る閉館後'
    WHEN 'kei-imperfect-dish' THEN '無口なシェフがあなたにだけ出す収録後の失敗作'
    WHEN 'takumi-repaired-chair' THEN '別れた家具職人と決める二人で選んだ椅子の行き先'
    WHEN 'hibiki-rain-sound' THEN '雨音技師と消えたあなたの足音を探す高架下'
    WHEN 'kaito-ex-wedding' THEN '来月結婚する元カレとの偶然の再会'
  ELSE title
END,
pack_json = json_set(
  pack_json,
  '$.title',
  CASE id
    WHEN 'aoi' THEN '終電を逃した夜、幼なじみの葵と二人きり'
    WHEN 'mia' THEN '快活なエルフ店主があなたにだけ持ちかける秘密の依頼'
    WHEN 'rin' THEN '静かな先輩と閉館後の図書室に二人きり'
    WHEN 'koharu' THEN '無防備な女友達に絵のモデルを頼まれる午後'
    WHEN 'minato-radio' THEN '声だけ知ってた推しDJと初対面する最終回'
    WHEN 'satoru-ren' THEN '寡黙な技師と人懐っこいガイドに迫られる嵐の夜'
    WHEN 'yu' THEN '年下の常連が毎週あなたにだけ花束を贈る金曜日'
    WHEN 'ritsu' THEN '年上の遺品整理士と秘密の手紙を探す実家じまい'
    WHEN 'shizuku-downer' THEN '男嫌いのダウナーな後輩が、放課後はあなたにだけ甘える'
    WHEN 'lucien-contract' THEN '嘘がつけない公爵と契約結婚する初夜'
    WHEN 'kohaku-midnight' THEN '狐の常連が午前二時にあなただけに会いに来る'
    WHEN 'tomoya-fake-date' THEN '無口な同期と一日だけ恋人になる結婚式'
    WHEN 'noah-voice-memory' THEN '記憶を失った相棒が覚えているあなたの声だけ'
    WHEN 'cassian-rewind' THEN '裏切った護衛を処刑前夜にもう一度信じる'
    WHEN 'sumiko-rules' THEN '年上の管理人と最後の規則を探す訳あり物件'
    WHEN 'vera-diner' THEN '元魔王の店員が閉店後にあなただけに見せる素顔'
    WHEN 'elias-dragons' THEN '無愛想な竜の保育士が迎えに来た追放先'
    WHEN 'shinkuro-road' THEN '名を捨てた浪人と一夜だけの護衛旅'
    WHEN 'lionel-shutdown' THEN 'サ終の夜に相棒NPCから頼まれる最後のお願い'
    WHEN 'marta-socks' THEN '世話焼き魔女と明日のあなたからの片方の靴下'
    WHEN 'seiji-memory' THEN '記憶を売った刑事と消えた昨日を買い戻す'
    WHEN 'maho-last-bout' THEN '元ライバルの彼女が引退前夜にセコンドに来る'
    WHEN 'genmei-poison' THEN '後宮の毒見役があなたの薬膳だけを疑う夜'
    WHEN 'natsu-final-live' THEN '解散五分前に相方が二人だけの新曲を持ってきた'
    WHEN 'rei-blue-bird' THEN '怪盗の彼女に頼まれる盗まない共犯'
    WHEN 'naoto-two-weeks' THEN '元夫と離婚届け後に二週間だけ同居する'
    WHEN 'ryo-alliance' THEN '昨日まで敵だった弁護士と結ぶ秘密の同盟'
    WHEN 'mina-offline' THEN '人気配信者が配信外であなたにだけ見せる素顔'
    WHEN 'nagi-radio' THEN '沈んだ観測所から届く十年越しの相棒の声'
    WHEN 'shuji-last-train' THEN '廃駅の駅員が終電名簿からあなたの名前を消す夜'
    WHEN 'fumie-family-tree' THEN '無口な刺繍師が家系図にあなたの名前を縫い戻す'
    WHEN 'saku-unscripted' THEN 'カメラのない夜道を二人で歩く元俳優'
    WHEN 'akari-foldroad' THEN '勝ち気な配達員と地図にない町への最後の配達'
    WHEN 'gald-career' THEN '元勇者と二人きりで書く初めての履歴書'
    WHEN 'yayoi-extra-day' THEN '新人死神のミスで一日だけ延びた命'
    WHEN 'sena-mars-flower' THEN 'あなたにだけ咲く地球最後の花を守る研究員'
    WHEN 'lucas-nightmare' THEN '売ったはずの悪夢を買い戻す夢の競売'
    WHEN 'julius-handover' THEN '退職する魔法使いの最後の引継ぎと使い魔'
    WHEN 'someta-new-story' THEN '声を失った落語家と作る二人だけの新作'
    WHEN 'saya-forecast' THEN 'あなたの名前を呼ぶ明日の予報'
    WHEN 'margot-awake' THEN '毒舌な清掃員と王子より先に目覚める百年城'
    WHEN 'kiryu-future-letter' THEN '十年後のあなたからの「読むな」を預かる配達員'
    WHEN 'ritsuko-full-house' THEN '年上鑑定士と六人が暮らす空き家の一夜'
    WHEN 'ian-final-word' THEN '世界最後の翻訳者と選ぶ別れの一語'
    WHEN 'hiyori-moon-store' THEN '月面コンビニで七分遅れの最後の客を待つ夜'
    WHEN 'sota-dragon-bath' THEN '湯船を怖がる竜の子を見守る番頭'
    WHEN 'chifuyu-last-match' THEN '引退棋士と盤上から消えた封じ手の謎'
    WHEN 'genta-cold-well' THEN '燃えていない家の井戸に昇る白煙と火消し頭'
    WHEN 'agnes-unordered-dish' THEN '誰も頼んでいない銀皿を開ける王宮給仕長'
    WHEN 'haruto-jellyfish' THEN '夜勤飼育員と眠らないクラゲを見守る閉館後'
    WHEN 'kei-imperfect-dish' THEN '無口なシェフがあなたにだけ出す収録後の失敗作'
    WHEN 'takumi-repaired-chair' THEN '別れた家具職人と決める二人で選んだ椅子の行き先'
    WHEN 'hibiki-rain-sound' THEN '雨音技師と消えたあなたの足音を探す高架下'
    WHEN 'kaito-ex-wedding' THEN '来月結婚する元カレとの偶然の再会'
    ELSE json_extract(pack_json, '$.title')
  END
), updated_at = unixepoch()
WHERE id IN (
  'aoi',
  'mia',
  'rin',
  'koharu',
  'minato-radio',
  'satoru-ren',
  'yu',
  'ritsu',
  'shizuku-downer',
  'lucien-contract',
  'kohaku-midnight',
  'tomoya-fake-date',
  'noah-voice-memory',
  'cassian-rewind',
  'sumiko-rules',
  'vera-diner',
  'elias-dragons',
  'shinkuro-road',
  'lionel-shutdown',
  'marta-socks',
  'seiji-memory',
  'maho-last-bout',
  'genmei-poison',
  'natsu-final-live',
  'rei-blue-bird',
  'naoto-two-weeks',
  'ryo-alliance',
  'mina-offline',
  'nagi-radio',
  'shuji-last-train',
  'fumie-family-tree',
  'saku-unscripted',
  'akari-foldroad',
  'gald-career',
  'yayoi-extra-day',
  'sena-mars-flower',
  'lucas-nightmare',
  'julius-handover',
  'someta-new-story',
  'saya-forecast',
  'margot-awake',
  'kiryu-future-letter',
  'ritsuko-full-house',
  'ian-final-word',
  'hiyori-moon-store',
  'sota-dragon-bath',
  'chifuyu-last-match',
  'genta-cold-well',
  'agnes-unordered-dish',
  'haruto-jellyfish',
  'kei-imperfect-dish',
  'takumi-repaired-chair',
  'hibiki-rain-sound',
  'kaito-ex-wedding'
);
