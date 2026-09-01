# mikan chat project instructions

## TTS architecture

- TTSの共通入口は`src/renderer/lib/tts.ts`の`TtsDriver`と`createTtsDriver()`です。
- `screens/`と`components/`から`speechSynthesis`、`SpeechSynthesisUtterance`、将来のElectron IPCを直接呼び出さないでください。
- Web標準TTS、Irodori TTS、今後追加するTTSは、すべて`TtsDriver`の`label`、`supported`、`unavailableReason`、`speak()`、`stop()`を実装して同じ経路へ接続します。
- UIはTTSの種類や`window.mikan`で処理を分岐せず、ドライバーが返す能力と表示情報だけを使います。
- 文章の解析と話者分離は`lib/ai-chat.ts`、読み上げ対象の選択と再生状態はUI、音声生成・再生・停止はTTSドライバーの責務です。
- 自動読み上げではストリーミング中の断片を繰り返し再生せず、確定したキャラクター発話をTTSへ渡します。
- 新しいTTSドライバーには、利用可否、再生、停止、終了通知を確認する最小テストを追加してください。
- Irodori TTSのIPC契約は実装時に定義します。接続方式が未確定の段階でpreload APIや設定項目を先行追加しないでください。
