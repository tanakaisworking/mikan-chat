import { afterEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_HAYAMIMI_WS_URL, registerSpeechHandlers, resolveHayamimiUrl, type SpeechSocket } from "./speech"

const SESSION_A = "11111111-1111-4111-8111-111111111111"
const SESSION_B = "22222222-2222-4222-8222-222222222222"

class FakeSocket {
  onopen: SpeechSocket["onopen"] = null
  onmessage: SpeechSocket["onmessage"] = null
  onerror: SpeechSocket["onerror"] = null
  onclose: SpeechSocket["onclose"] = null
  readyState = 0
  sent: Array<string | ArrayBuffer> = []
  closed = false
  send = vi.fn((data: string | ArrayBuffer) => {
    this.sent.push(data)
  })
  close = vi.fn(() => {
    this.closed = true
  })
  open() {
    this.readyState = 1
    this.onopen?.(new Event("open"))
  }
  receiveText(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }))
  }
  fail() {
    this.onerror?.(new Event("error"))
  }
  serverClose() {
    this.onclose?.(new CloseEvent("close"))
  }
}

function setup(url: string | null = DEFAULT_HAYAMIMI_WS_URL) {
  const handlers = new Map<string, (event: { sender: unknown }, ...args: unknown[]) => unknown>()
  const listeners = new Map<string, (event: { sender: unknown }, ...args: unknown[]) => void>()
  const sent: Array<{ channel: string; args: unknown[] }> = []
  const sockets: FakeSocket[] = []
  const webContents = {
    send: vi.fn((channel: string, ...args: unknown[]) => {
      sent.push({ channel, args })
    }),
  }
  const closedListeners: Array<() => void> = []
  registerSpeechHandlers({
    ipc: {
      removeHandler: (channel) => {
        handlers.delete(channel)
      },
      handle: (channel, listener) => {
        handlers.set(channel, listener)
      },
      on: (channel, listener) => {
        listeners.set(channel, listener)
      },
      removeAllListeners: (channel) => {
        listeners.delete(channel)
      },
    },
    window: { webContents },
    onClosed: (listener) => {
      closedListeners.push(listener)
    },
    hayamimiUrl: url,
    openReadyState: 1,
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
  })
  const event = { sender: webContents }
  return {
    handlers,
    listeners,
    sent,
    sockets,
    webContents,
    closedListeners,
    event,
    invoke: (channel: string, invokeEvent: { sender: unknown }, ...args: unknown[]) =>
      // ElectronのipcMain.handleは同期throwをinvokeの拒否へ変える。
      (async () => handlers.get(channel)?.(invokeEvent, ...args))(),
    start: (sessionId: string, sampleRate = 48000) =>
      (async () => handlers.get("speech:start")?.(event, sessionId, sampleRate) as Promise<void>)(),
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe("resolveHayamimiUrl", () => {
  it("未設定なら既定のローカル接続先を返す", () => {
    expect(resolveHayamimiUrl(undefined)).toBe("ws://127.0.0.1:8766/ingest")
  })

  it("ループバックのwsだけ許可する", () => {
    expect(resolveHayamimiUrl("ws://localhost:8766/ingest")).toBe("ws://localhost:8766/ingest")
    expect(resolveHayamimiUrl("ws://192.168.1.2:8766/ingest")).toBeNull()
    expect(resolveHayamimiUrl("wss://127.0.0.1:8766/ingest")).toBeNull()
    expect(resolveHayamimiUrl("http://127.0.0.1:8766/ingest")).toBeNull()
    expect(resolveHayamimiUrl("not a url")).toBeNull()
  })

  it("末尾スラッシュを落とす（Hayamimiはパス完全一致）", () => {
    expect(resolveHayamimiUrl("ws://127.0.0.1:8766/ingest/")).toBe("ws://127.0.0.1:8766/ingest")
  })
})

describe("registerSpeechHandlers", () => {
  it("接続後にハンドシェイクJSONを送る", async () => {
    const { start, sockets } = setup()
    const pending = start(SESSION_A, 48000)
    expect(sockets).toHaveLength(1)
    sockets[0].open()
    await expect(pending).resolves.toBeUndefined()
    expect(sockets[0].sent).toEqual([JSON.stringify({ sr: 48000, format: "pcm_s16le", channels: 1 })])
  })

  it("別ウィンドウや不正セッションの開始を拒否する", async () => {
    const { invoke, webContents, event } = setup()
    await expect(invoke("speech:start", { sender: {} }, SESSION_A, 48000)).rejects.toThrow("音声入力を開始できません")
    expect(webContents.send).not.toHaveBeenCalled()
    await expect(invoke("speech:start", event, "bad-id", 48000)).rejects.toThrow("音声セッションが不正")
  })

  it("接続先が不正なら開始を拒否する", async () => {
    const { start } = setup(null)
    await expect(start(SESSION_A)).rejects.toThrow("接続先が不正")
  })

  it("接続失敗時は起動手順を示す", async () => {
    const { start, sockets } = setup()
    const pending = start(SESSION_A)
    sockets[0].fail()
    await expect(pending).rejects.toThrow("--input ws")
  })

  it("タイムアウト時はタイムアウト理由で失敗する", async () => {
    vi.useFakeTimers()
    const { start, sockets } = setup()
    const pending = start(SESSION_A)
    expect(sockets).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(5_000)
    await expect(pending).rejects.toThrow("タイムアウト")
    expect(sockets[0].closed).toBe(true)
  })

  it("テキストの文字起こしだけを転送する", async () => {
    const { start, sockets, sent } = setup()
    const pending = start(SESSION_A)
    sockets[0].open()
    await pending
    sockets[0].receiveText(JSON.stringify({ type: "final", text: "こんにちは", lang: "ja" }))
    expect(sent).toContainEqual({ channel: "speech:event", args: [SESSION_A, JSON.stringify({ type: "final", text: "こんにちは", lang: "ja" })] })
  })

  it("有効なセッションの音声だけを開通時に送る", async () => {
    const { start, sockets, listeners, event } = setup()
    const pending = start(SESSION_A)
    const audio = new ArrayBuffer(8)
    listeners.get("speech:audio")?.(event, SESSION_A, audio)
    expect(sockets[0].send).not.toHaveBeenCalledWith(audio)
    sockets[0].open()
    await pending
    listeners.get("speech:audio")?.(event, SESSION_A, audio)
    expect(sockets[0].send).toHaveBeenCalledWith(audio)
    listeners.get("speech:audio")?.(event, SESSION_B, audio)
    expect(sockets[0].send).toHaveBeenCalledTimes(2)
  })

  it("新しい開始で古いセッションを閉じる", async () => {
    const { start, sockets, sent } = setup()
    const first = start(SESSION_A)
    sockets[0].open()
    await first
    const second = start(SESSION_B)
    sockets[1].open()
    await second
    expect(sent).toContainEqual({ channel: "speech:event", args: [SESSION_A, JSON.stringify({ type: "closed" })] })
    expect(sockets[0].closed).toBe(true)
  })

  it("サーバー切断をclosedで通知し、破棄されたセッションの音声を送らない", async () => {
    const { start, sockets, listeners, sent, event } = setup()
    const pending = start(SESSION_A)
    sockets[0].open()
    await pending
    sockets[0].serverClose()
    expect(sent).toContainEqual({ channel: "speech:event", args: [SESSION_A, JSON.stringify({ type: "closed" })] })
    const audio = new ArrayBuffer(8)
    listeners.get("speech:audio")?.(event, SESSION_A, audio)
    expect(sockets[0].send).not.toHaveBeenCalledWith(audio)
  })

  it("ウィンドウを閉じたら接続を閉じる", async () => {
    const { start, sockets, closedListeners } = setup()
    const pending = start(SESSION_A)
    sockets[0].open()
    await pending
    closedListeners.forEach((listener) => listener())
    expect(sockets[0].closed).toBe(true)
  })
})
