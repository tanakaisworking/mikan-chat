export function resolveChatPackText(text: string) {
  return text.replaceAll("{{user}}さん", "あなた").replaceAll("{{user}}", "あなた")
}
