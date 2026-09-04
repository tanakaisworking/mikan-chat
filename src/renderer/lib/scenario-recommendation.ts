export type TargetAudience = "men" | "women" | "all"

export type ScenarioRecommendation = {
  targetAudiences: TargetAudience[]
  recommendedAge?: { min: number; max: number }
}

type RecommendableScenario = {
  tags?: string[]
  recommendation?: ScenarioRecommendation
}

type RecommendationProfile = {
  gender: "woman" | "man" | "nonbinary" | "prefer-not-to-say"
  birthYear: number
  favoriteGenres: string[]
}

export function readScenarioRecommendation(pack: Record<string, unknown>): ScenarioRecommendation | undefined {
  const extensions = asRecord(pack.extensions)
  const recommendation = asRecord(extensions?.["mikan.recommendation"])
  const targetAudiences = recommendation?.targetAudiences
  const recommendedAge = asRecord(recommendation?.recommendedAge)

  if (!Array.isArray(targetAudiences) || !targetAudiences.every(isTargetAudience) || targetAudiences.length === 0) return undefined

  const min = recommendedAge?.min
  const max = recommendedAge?.max
  return {
    targetAudiences: [...new Set(targetAudiences)],
    recommendedAge: Number.isInteger(min) && Number.isInteger(max) && (min as number) >= 0 && (min as number) <= (max as number)
      ? { min: min as number, max: max as number }
      : undefined,
  }
}

export function rankScenarios<T extends RecommendableScenario>(scenarios: T[], profile: RecommendationProfile, currentYear = new Date().getFullYear()): T[] {
  const favoriteGenres = new Set(profile.favoriteGenres.map(normalize).filter(Boolean))
  const age = currentYear - profile.birthYear

  return scenarios
    .map((scenario, index) => ({ scenario, index, score: scoreScenario(scenario, profile.gender, favoriteGenres, age) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ scenario }) => scenario)
}

function scoreScenario(scenario: RecommendableScenario, gender: RecommendationProfile["gender"], favoriteGenres: Set<string>, age: number) {
  const matchingGenres = new Set(scenario.tags?.map(normalize).filter((tag) => favoriteGenres.has(tag))).size
  const genreScore = matchingGenres > 0 ? 55 + Math.min(matchingGenres - 1, 2) * 5 : 0
  const audienceScore = scoreAudience(scenario.recommendation?.targetAudiences, gender) * 25
  const ageScore = scoreAge(scenario.recommendation?.recommendedAge, age) * 20
  return genreScore + audienceScore + ageScore
}

function scoreAudience(targets: TargetAudience[] | undefined, gender: RecommendationProfile["gender"]) {
  if (!targets) return 0.5
  if (targets.includes("all")) return 0.65
  if (gender === "man") return targets.includes("men") ? 1 : 0.1
  if (gender === "woman") return targets.includes("women") ? 1 : 0.1
  return 0.5
}

function scoreAge(range: ScenarioRecommendation["recommendedAge"], age: number) {
  if (!range || !Number.isFinite(age)) return 0.5
  if (age >= range.min && age <= range.max) return 1
  const distance = age < range.min ? range.min - age : age - range.max
  return Math.max(0.2, 1 - distance / 15)
}

function isTargetAudience(value: unknown): value is TargetAudience {
  return value === "men" || value === "women" || value === "all"
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ja")
}
