import { describe, expect, it, vi } from "vitest"

import { createScenarioVoiceId, getScenarioVoiceDesign, getScenarioVoiceDesigns, hasScenarioReferenceAudio, isScenarioVoiceConfirmed, recoverScenarioVoice, resolveScenarioVoice, scenarioVersion } from "@/lib/scenario-voice"

describe("resolveScenarioVoice", () => {
  it("Irodoriの推奨値と参照音声をキャラクターから解決する", () => {
    const voice = resolveScenarioVoice({
      id: "scenario",
      name: "葵",
      description: "test",
      lastMessage: "test",
      lastActive: "test",
      assets: { "assets/aoi.wav": "data:audio/wav;base64,UklGRg==" },
      pack: { id: "5e17395e-79b0-4b46-8e55-4ddac9a8e787", version: "1.2.0", plot: { characters: [{
        id: "aoi",
        name: "葵",
        profile: "test",
        voice: {
          profile: { description: "落ち着いた若い女性の声" },
          referenceAudio: { asset: "assets/aoi.wav" },
          preferred: [{ provider: "irodori", voiceId: "aoi-soft", parameters: { caption: "穏やかに話す", seed: 42 } }],
        },
      }] } },
    }, "葵")

    expect(voice).toEqual({
      caption: "穏やかに話す",
      seed: 42,
      referenceAudio: { source: "data:audio/wav;base64,UklGRg==", voiceId: "mikan-5e17395e-79b0-4b46-8e55-4ddac9a8e787-aoi-soft-1-2-0", fileName: "aoi.wav" },
    })
  })

  it("参照音声がなくても抽象プロフィールをIrodoriのcaption候補にする", () => {
    const voice = resolveScenarioVoice({
      id: "scenario",
      name: "葵",
      description: "test",
      lastMessage: "test",
      lastActive: "test",
      pack: { plot: { characters: [{ id: "aoi", name: "葵", profile: "test", voice: { profile: { description: "低く静かな声" } } }] } },
    })

    expect(voice).toEqual({ caption: "低く静かな声", seed: undefined })
  })

  it("保存した確定音声をシナリオ推奨より優先する", () => {
    const character = {
      id: "scenario",
      name: "葵",
      description: "test",
      lastMessage: "test",
      lastActive: "test",
      pack: { id: "pack", version: "2.0.0", plot: { characters: [{ id: "aoi", name: "葵", profile: "test", voice: { profile: { description: "低い声" } } }] } },
    }
    const selection = { characterId: "aoi", voiceId: "saved-aoi", caption: "選んだ声", seed: 9, scenarioVersion: "2.0.0" }

    expect(resolveScenarioVoice(character, undefined, selection)).toEqual({ voiceId: "saved-aoi", caption: "選んだ声", seed: 9 })
    expect(createScenarioVoiceId(character, "aoi")).toBe("mikan-user-pack-aoi")
    expect(getScenarioVoiceDesign(character)).toMatchObject({ caption: "低い声", characterId: "aoi" })
  })

  it("保存した参照音声がIrodoriに残っている場合だけ確定済みとみなす", async () => {
    const character = {
      id: "scenario",
      name: "葵",
      description: "test",
      lastMessage: "test",
      lastActive: "test",
      pack: { id: "pack", version: "2.0.0", plot: { characters: [{ id: "aoi", name: "葵", profile: "test" }] } },
    }
    const selection = { characterId: "aoi", voiceId: createScenarioVoiceId(character, "aoi"), caption: "選んだ声", seed: 9, scenarioVersion: scenarioVersion(character) }

    expect(await isScenarioVoiceConfirmed(character, selection, async () => true)).toBe(true)
    expect(await isScenarioVoiceConfirmed(character, selection, async () => false)).toBe(false)
  })

  it("パック更新後もユーザーが確定した声を維持する", async () => {
    const character = {
      id: "scenario",
      name: "葵",
      description: "test",
      lastMessage: "test",
      lastActive: "test",
      pack: { id: "pack", version: "2.0.0", plot: { characters: [{ id: "aoi", name: "葵", profile: "test" }] } },
    }
    const selection = { characterId: "aoi", voiceId: "mikan-user-pack-aoi-1-0-0", caption: "選んだ声", seed: 9, scenarioVersion: "1.0.0" }
    const hasReference = vi.fn().mockResolvedValue(true)

    expect(resolveScenarioVoice(character, "葵", selection)).toEqual({ voiceId: selection.voiceId, caption: "選んだ声", seed: 9 })
    await expect(isScenarioVoiceConfirmed(character, selection, hasReference)).resolves.toBe(true)
    expect(hasReference).toHaveBeenCalledWith(selection.voiceId)
  })

  it("Irodoriに登録済みの旧IDから声の設定を復元する", async () => {
    const character = {
      id: "scenario",
      name: "しずく",
      description: "test",
      lastMessage: "test",
      lastActive: "test",
      pack: { id: "pack", version: "1.0.2", plot: { characters: [{ id: "shizuku", name: "しずく", profile: "test" }] } },
    }
    const design = getScenarioVoiceDesigns(character)[0]
    const findReference = vi.fn(async (prefix: string) => prefix === "mikan-user-pack-shizuku" ? "mikan-user-pack-shizuku-1-0-1" : null)

    await expect(recoverScenarioVoice(character, design, findReference)).resolves.toMatchObject({
      characterId: "shizuku",
      voiceId: "mikan-user-pack-shizuku-1-0-1",
    })
    await expect(recoverScenarioVoice(character, design, async () => null)).resolves.toBeNull()
  })

  it("複数の登場人物ごとに音声設計と保存済み音声を解決する", () => {
    const character = {
      id: "observatory",
      name: "観測所の二人",
      description: "test",
      lastMessage: "test",
      lastActive: "test",
      assets: { "voices/haruna.wav": "data:audio/wav;base64,UklGRg==" },
      pack: { id: "pack", version: "1", plot: { characters: [
        { id: "haruna", name: "榛名", profile: "技師", voice: { profile: { traits: ["低い", "冷静"] }, referenceAudio: { asset: "voices/haruna.wav" } } },
        { id: "chiaki", name: "千秋", profile: "ガイド", voice: { profile: { traits: ["明るい", "素直"] } } },
      ] } },
    }
    const selections = [{ characterId: "chiaki", voiceId: "saved-chiaki", caption: "明るい声", seed: 7, scenarioVersion: "1" }]

    expect(getScenarioVoiceDesigns(character)).toEqual([
      expect.objectContaining({ characterId: "haruna", characterName: "榛名", caption: "声の特徴: 低い、冷静" }),
      expect.objectContaining({ characterId: "chiaki", characterName: "千秋", caption: "声の特徴: 明るい、素直" }),
    ])
    expect(hasScenarioReferenceAudio(character, "haruna")).toBe(true)
    expect(hasScenarioReferenceAudio(character, "chiaki")).toBe(false)
    expect(resolveScenarioVoice(character, "千秋", selections)).toEqual({ voiceId: "saved-chiaki", caption: "明るい声", seed: 7 })
  })

  it("保存ファイル名と候補音声がIPC上限を超えない", () => {
    const character = {
      id: "scenario",
      name: "長い設定",
      description: "test",
      lastMessage: "test",
      lastActive: "test",
      pack: {
        id: "a".repeat(120),
        version: "1.0.0-" + "b".repeat(90),
        plot: {
          characters: [{ id: "c".repeat(64), name: "話者", profile: "test" }],
          opening: [{ type: "dialogue", speaker: "c".repeat(64), text: "長".repeat(500) }],
        },
      },
    }

    expect(`${createScenarioVoiceId(character, "c".repeat(64))}.wav`).toHaveLength(200)
    expect(getScenarioVoiceDesign(character)?.sampleText).toHaveLength(200)
  })
})
