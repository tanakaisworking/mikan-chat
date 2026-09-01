export function resolveChatPackText(text: string, userName = "あなた") {
  const honorificName = userName === "あなた" ? userName : `${userName}さん`
  return text.replaceAll("{{user}}さん", honorificName).replaceAll("{{user}}", userName)
}
