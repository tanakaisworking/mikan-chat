import { EventEmitter } from "node:events"
import { mkdtemp, mkdir, readdir, rm, utimes, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PassThrough } from "node:stream"
import { afterEach, describe, expect, it, vi } from "vitest"

import { IrodoriRuntimeManager } from "./irodori-runtime"
import { audioCacheKey } from "./irodori-runtime"

const directories: string[] = []

afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("IrodoriRuntimeManager", () => {
  it("1回のセットアップで実行環境を導入してサーバーを起動する", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    const send = vi.fn()
    const run = vi.fn(async (command: string, args: string[], _options: { env: NodeJS.ProcessEnv }) => {
      void _options
      if (command === "/usr/bin/tar" && args.includes("uv-aarch64-apple-darwin/uv")) {
        const uvPath = path.join(root, "bin", "uv")
        await mkdir(path.dirname(uvPath), { recursive: true })
        await writeFile(uvPath, "uv")
      }
    })
    const download = vi.fn(async (_url: string, destination: string) => writeFile(destination, "archive"))
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit("exit", 0))
      return true
    })
    const spawnServer = vi.fn((_command: string, _args: string[], _options: { env: NodeJS.ProcessEnv }) => {
      void _command
      void _args
      void _options
      return child
    })
    const verifyModels = vi.fn(async () => undefined)
    vi.stubEnv("OPENROUTER_API_KEY", "must-not-reach-child")
    const manager = new IrodoriRuntimeManager(root, fakeWindow(send), {
      platform: "darwin",
      arch: "arm64",
      download: download as never,
      run: run as never,
      spawnServer: spawnServer as never,
      getFreePort: vi.fn(async () => 39123),
      fetcher: vi.fn(async () => new Response("ok")) as never,
      verifyModels: verifyModels as never,
    })

    await manager.install()

    await expect(manager.status()).resolves.toMatchObject({ state: "running", progress: 100 })
    expect(download).toHaveBeenCalledTimes(2)
    expect(download).toHaveBeenCalledWith(
      expect.stringContaining("uv-aarch64-apple-darwin.tar.gz"),
      expect.any(String),
      "d75e3d2bfc203d17388edaabd3aa37958edbcbfc36219e3ee0d31bb080b4baa2",
      expect.any(Function),
      expect.any(AbortSignal),
      expect.any(Function),
    )
    expect(run).toHaveBeenCalledWith(expect.stringContaining("/bin/uv"), ["python", "install", "3.10"], expect.anything())
    expect(run).toHaveBeenCalledWith(expect.stringContaining("/bin/uv"), ["sync", "--locked", "--python", "3.10", "--no-dev"], expect.anything())
    expect(run).toHaveBeenCalledWith(expect.stringContaining("/bin/uv"), expect.arrayContaining(["4c92c7ee2bb15c19a97cf4e86d24fd6bf33b0135", "47376ee24834d7a05a48ebabfe3cde29b3c5e214"]), expect.anything())
    expect(verifyModels).toHaveBeenCalledOnce()
    expect(spawnServer.mock.calls[0]?.[2]?.env.IRODORI_CODEC_REPO).toBe(path.join(root, "models", "codec", "weights.pth"))
    expect(spawnServer.mock.calls[0]?.[2]?.env).not.toHaveProperty("OPENROUTER_API_KEY")
    for (const call of run.mock.calls) expect(call[2]?.env).not.toHaveProperty("OPENROUTER_API_KEY")
    expect(send).toHaveBeenCalledWith("irodori:status", expect.objectContaining({ state: "installing" }))
    await manager.delete()
    expect(child.kill).toHaveBeenCalledWith("SIGTERM")
    await expect(manager.status()).resolves.toMatchObject({ state: "missing" })
  })

  it("Apple Silicon Mac以外ではセットアップを開始しない", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    const manager = new IrodoriRuntimeManager(root, fakeWindow(), { platform: "win32", arch: "x64" })

    await expect(manager.status()).resolves.toMatchObject({ state: "unsupported", supported: false })
    await expect(manager.install()).rejects.toThrow("Apple Silicon Mac")
  })

  it("セットアップ中の音声生成を拒否する", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    let finishPython: (() => void) | undefined
    const pythonReady = new Promise<void>((resolve) => { finishPython = resolve })
    const run = vi.fn(async (command: string, args: string[]) => {
      if (command === "/usr/bin/tar" && args.includes("uv-aarch64-apple-darwin/uv")) {
        const uvPath = path.join(root, "bin", "uv")
        await mkdir(path.dirname(uvPath), { recursive: true })
        await writeFile(uvPath, "uv")
      }
      if (args[0] === "python" && args[1] === "install") {
        await pythonReady
      }
    })
    const spawnServer = vi.fn()
    const manager = new IrodoriRuntimeManager(root, fakeWindow(), {
      platform: "darwin",
      arch: "arm64",
      download: vi.fn(async (_url: string, destination: string) => writeFile(destination, "archive")) as never,
      run: run as never,
      spawnServer: spawnServer as never,
      verifyModels: vi.fn(async () => undefined) as never,
    })

    const installing = manager.install()
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith(expect.stringContaining("/bin/uv"), ["python", "install", "3.10"], expect.anything()))
    await expect(manager.synthesize({ requestId: "11111111-1111-4111-8111-111111111111", endpoint: "http://127.0.0.1:8088/v1", model: "irodori-tts", voice: "none", apiKey: "", text: "テスト" }))
      .rejects.toThrow("先にセットアップ")
    await manager.stop()
    finishPython?.()
    await installing
    expect(spawnServer).not.toHaveBeenCalled()
    await expect(manager.status()).resolves.toMatchObject({ state: "ready" })
    await manager.delete()
  })

  it("起動処理が失敗したら再試行できるエラー状態にする", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn()
    const getFreePort = vi.fn<() => Promise<number>>().mockResolvedValueOnce(39123).mockRejectedValueOnce(new Error("ポートを確保できません"))
    const run = vi.fn(async (command: string, args: string[]) => {
      if (command === "/usr/bin/tar" && args.includes("uv-aarch64-apple-darwin/uv")) {
        const uvPath = path.join(root, "bin", "uv")
        await mkdir(path.dirname(uvPath), { recursive: true })
        await writeFile(uvPath, "uv")
      }
    })
    const manager = new IrodoriRuntimeManager(root, fakeWindow(), {
      platform: "darwin",
      arch: "arm64",
      download: vi.fn(async (_url: string, destination: string) => writeFile(destination, "archive")) as never,
      run: run as never,
      spawnServer: vi.fn(() => child) as never,
      getFreePort,
      fetcher: vi.fn(async () => new Response("ok")) as never,
      verifyModels: vi.fn(async () => undefined) as never,
    })
    await manager.install()
    child.emit("exit", 1)

    await expect(manager.start()).rejects.toThrow("ポートを確保できません")
    await expect(manager.status()).resolves.toMatchObject({ state: "error", stage: "Irodori TTSを起動できませんでした", error: "ポートを確保できません" })
  })

  it("health確認直後にサーバーが終了したらrunningにしない", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn(() => true)
    const run = vi.fn(async (command: string, args: string[]) => {
      if (command === "/usr/bin/tar" && args.includes("uv-aarch64-apple-darwin/uv")) {
        const uvPath = path.join(root, "bin", "uv")
        await mkdir(path.dirname(uvPath), { recursive: true })
        await writeFile(uvPath, "uv")
      }
    })
    const manager = new IrodoriRuntimeManager(root, fakeWindow(), {
      platform: "darwin",
      arch: "arm64",
      download: vi.fn(async (_url: string, destination: string) => writeFile(destination, "archive")) as never,
      run: run as never,
      spawnServer: vi.fn(() => child) as never,
      getFreePort: vi.fn(async () => 39123),
      fetcher: vi.fn(async () => {
        setImmediate(() => child.emit("exit", 1))
        return new Response("ok")
      }) as never,
      verifyModels: vi.fn(async () => undefined) as never,
    })

    await expect(manager.install()).rejects.toThrow("起動直後に停止")
    await expect(manager.status()).resolves.toMatchObject({ state: "error" })
  })

  it("通常終了しないサーバーを強制終了してから停止を完了する", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    await writeFile(path.join(root, "installed.json"), JSON.stringify({
      uvVersion: "0.11.33",
      serverRevision: "841fb7c6ec57729c56b9b75c0ef2562249b13a10",
      modelRevision: "4c92c7ee2bb15c19a97cf4e86d24fd6bf33b0135",
      codecRevision: "47376ee24834d7a05a48ebabfe3cde29b3c5e214",
    }))
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn((signal: NodeJS.Signals) => {
      if (signal === "SIGKILL") queueMicrotask(() => child.emit("exit", null, signal))
      return true
    })
    const spawnServer = vi.fn(() => child)
    const manager = new IrodoriRuntimeManager(root, fakeWindow(), {
      platform: "darwin",
      arch: "arm64",
      spawnServer: spawnServer as never,
      getFreePort: vi.fn(async () => 39123),
      fetcher: vi.fn(async () => new Response("ok")) as never,
    })
    await manager.start()
    vi.useFakeTimers()

    const stopping = manager.stop()
    const restarting = manager.start()
    expect(spawnServer).toHaveBeenCalledOnce()
    // 実 fs の server.pid 削除はフェイクタイマーの外で完了するため、
    // SIGTERM 送信（＝graceful タイマー登録済み）を先に確定させる。
    await vi.waitFor(() => expect(child.kill).toHaveBeenCalledWith("SIGTERM"))
    await vi.advanceTimersByTimeAsync(5_000)
    await stopping
    await vi.waitFor(() => expect(spawnServer).toHaveBeenCalledTimes(2))
    await vi.runAllTimersAsync()
    await restarting

    expect(child.kill).toHaveBeenNthCalledWith(1, "SIGTERM")
    expect(child.kill).toHaveBeenNthCalledWith(2, "SIGKILL")
    expect(spawnServer).toHaveBeenCalledTimes(2)
    await expect(manager.status()).resolves.toMatchObject({ state: "running" })
  })

  it("起動中に停止と再起動が重なっても読み込み中に残らない", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    await writeFile(path.join(root, "installed.json"), JSON.stringify({
      uvVersion: "0.11.33",
      serverRevision: "841fb7c6ec57729c56b9b75c0ef2562249b13a10",
      modelRevision: "4c92c7ee2bb15c19a97cf4e86d24fd6bf33b0135",
      codecRevision: "47376ee24834d7a05a48ebabfe3cde29b3c5e214",
    }))
    let releasePort!: () => void
    const firstPort = new Promise<void>((resolve) => { releasePort = resolve })
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit("exit", 0))
      return true
    })
    const spawnServer = vi.fn(() => child)
    const getFreePort = vi.fn()
      .mockImplementationOnce(async () => { await firstPort; return 39123 })
      .mockResolvedValueOnce(39124)
    const manager = new IrodoriRuntimeManager(root, fakeWindow(), {
      platform: "darwin",
      arch: "arm64",
      spawnServer: spawnServer as never,
      getFreePort,
      fetcher: vi.fn(async () => new Response("ok")) as never,
    })

    const firstStart = manager.start()
    await vi.waitFor(() => expect(getFreePort).toHaveBeenCalledOnce())
    await expect(manager.status()).resolves.toMatchObject({ state: "starting" })
    await manager.stop()
    const restart = manager.start()
    releasePort()

    await expect(firstStart).rejects.toMatchObject({ name: "AbortError" })
    await restart
    expect(spawnServer).toHaveBeenCalledOnce()
    await expect(manager.status()).resolves.toMatchObject({ state: "running", progress: 100 })
    await manager.delete()
  })

  it("前回起動の残骸があっても起動できる", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    await writeFile(path.join(root, "installed.json"), JSON.stringify({
      uvVersion: "0.11.33",
      serverRevision: "841fb7c6ec57729c56b9b75c0ef2562249b13a10",
      modelRevision: "4c92c7ee2bb15c19a97cf4e86d24fd6bf33b0135",
      codecRevision: "47376ee24834d7a05a48ebabfe3cde29b3c5e214",
    }))
    await writeFile(path.join(root, "server.pid"), "4194304")
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit("exit", 0))
      return true
    })
    const spawnServer = vi.fn(() => child)
    const manager = new IrodoriRuntimeManager(root, fakeWindow(), {
      platform: "darwin",
      arch: "arm64",
      spawnServer: spawnServer as never,
      getFreePort: vi.fn(async () => 39123),
      fetcher: vi.fn(async () => new Response("ok")) as never,
    })
    await manager.start()

    expect(spawnServer).toHaveBeenCalledOnce()
    await expect(manager.status()).resolves.toMatchObject({ state: "running" })
    await manager.delete()
  })

  it("生成音声を再利用し、最終利用から30日を過ぎたら再生成する", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    await writeFile(path.join(root, "installed.json"), JSON.stringify({
      uvVersion: "0.11.33",
      serverRevision: "841fb7c6ec57729c56b9b75c0ef2562249b13a10",
      modelRevision: "4c92c7ee2bb15c19a97cf4e86d24fd6bf33b0135",
      codecRevision: "47376ee24834d7a05a48ebabfe3cde29b3c5e214",
    }))
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> }
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit("exit", 0))
      return true
    })
    let generations = 0
    const manager = new IrodoriRuntimeManager(root, fakeWindow(), {
      platform: "darwin",
      arch: "arm64",
      spawnServer: vi.fn(() => child) as never,
      getFreePort: vi.fn(async () => 39123),
      fetcher: vi.fn(async (input) => {
        if (String(input).endsWith("/audio/speech")) generations += 1
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
      }) as never,
    })
    const request = {
      requestId: "11111111-1111-4111-8111-111111111111",
      endpoint: "http://127.0.0.1:8088/v1",
      model: "irodori-tts",
      voice: "voice-a",
      apiKey: "",
      text: "同じ文章です。",
    }

    expect(new Uint8Array(await manager.synthesize(request))).toEqual(new Uint8Array([1, 2, 3]))
    expect(new Uint8Array(await manager.synthesize({ ...request, requestId: "22222222-2222-4222-8222-222222222222" }))).toEqual(new Uint8Array([1, 2, 3]))
    expect(generations).toBe(1)

    await manager.synthesize({ ...request, requestId: "33333333-3333-4333-8333-333333333333", numSteps: 24 })
    expect(generations).toBe(2)

    const cachedFiles = await readdir(path.join(root, "cache", "audio"))
    const expired = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    await Promise.all(cachedFiles.map((file) => utimes(path.join(root, "cache", "audio", file), expired, expired)))
    await manager.synthesize({ ...request, requestId: "44444444-4444-4444-8444-444444444444" })
    expect(generations).toBe(3)
    await manager.delete()
  })

  it("hasCachedAudioはモデルを起動せずキャッシュの有無だけを返す", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "mikan-irodori-"))
    directories.push(root)
    await writeFile(path.join(root, "installed.json"), JSON.stringify({
      uvVersion: "0.11.33",
      serverRevision: "841fb7c6ec57729c56b9b75c0ef2562249b13a10",
      modelRevision: "4c92c7ee2bb15c19a97cf4e86d24fd6bf33b0135",
      codecRevision: "47376ee24834d7a05a48ebabfe3cde29b3c5e214",
    }))
    const spawnServer = vi.fn(() => { throw new Error("モデル起動してはいけない") })
    const manager = new IrodoriRuntimeManager(root, fakeWindow(), {
      platform: "darwin",
      arch: "arm64",
      spawnServer: spawnServer as never,
    })
    const request = {
      requestId: "55555555-5555-4555-8555-555555555555",
      endpoint: "http://127.0.0.1:8088/v1",
      model: "irodori-tts",
      voice: "voice-a",
      apiKey: "",
      text: "キャッシュ確認です。",
    }

    expect(await manager.hasCachedAudio(request)).toBe(false)

    const cachePath = path.join(root, "cache", "audio", `${audioCacheKey(request)}.wav`)
    await mkdir(path.dirname(cachePath), { recursive: true })
    await writeFile(cachePath, "wav")
    expect(await manager.hasCachedAudio(request)).toBe(true)

    const expired = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    await utimes(cachePath, expired, expired)
    expect(await manager.hasCachedAudio(request)).toBe(false)
    expect(spawnServer).not.toHaveBeenCalled()
  })
})

function fakeWindow(send = vi.fn()) {
  return { isDestroyed: () => false, webContents: { send } } as never
}
