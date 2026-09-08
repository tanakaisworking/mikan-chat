import { createHash, randomBytes } from "node:crypto"
import { createReadStream } from "node:fs"
import { chmod, link, mkdir, open, readFile, readdir, readlink, rename, rm, stat, statfs, utimes, writeFile } from "node:fs/promises"
import net from "node:net"
import path from "node:path"
import { spawn, type ChildProcess } from "node:child_process"


import type { BrowserWindow } from "electron"

import type { IrodoriRuntimeStatus, LocalTtsReference, LocalTtsSynthesisRequest } from "../shared/local-tts"
import { registerLocalTtsReference, synthesizeLocalTts } from "./local-tts"

const UV_VERSION = "0.11.33"
const UV_ARCHIVE_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-aarch64-apple-darwin.tar.gz`
const UV_ARCHIVE_SHA256 = "d75e3d2bfc203d17388edaabd3aa37958edbcbfc36219e3ee0d31bb080b4baa2"
const SERVER_REVISION = "841fb7c6ec57729c56b9b75c0ef2562249b13a10"
const SERVER_ARCHIVE_URL = `https://github.com/Aratako/Irodori-TTS-Server/archive/${SERVER_REVISION}.tar.gz`
const SERVER_ARCHIVE_SHA256 = "0f9f8e69b0f0e55e7c11be95568af4d981722073bdfaa1a840fe71fe728a55be"
const MODEL_REPOSITORY = "Aratako/Irodori-TTS-v4-Small"
const MODEL_REVISION = "4c92c7ee2bb15c19a97cf4e86d24fd6bf33b0135"
const MODEL_SHA256 = "5863c986345d9f6d20b7d8748fee1af02079c5161cf0c9e52557da0a0c378593"
const CODEC_REPOSITORY = "Aratako/Semantic-DACVAE-Japanese-32dim"
const CODEC_REVISION = "47376ee24834d7a05a48ebabfe3cde29b3c5e214"
const CODEC_SHA256 = "db120339c5ee7eca1912cdf29bc612b947a0808e69c3cebfb4936b45a762c1d5"
const REQUIRED_FREE_BYTES = 6 * 1024 * 1024 * 1024
const START_TIMEOUT_MS = 20 * 60 * 1000
const HEALTH_REQUEST_TIMEOUT_MS = 5 * 1000
const STOP_TIMEOUT_MS = 5 * 1000
const KILL_TIMEOUT_MS = 2 * 1000
const AUDIO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const AUDIO_CACHE_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

export function audioCacheKey(request: LocalTtsSynthesisRequest) {
  const hash = createHash("sha256")
  hash.update(JSON.stringify({
    modelRevision: MODEL_REVISION,
    model: request.model,
    voice: request.referenceAudio?.voiceId ?? request.voice,
    text: request.text,
    caption: request.caption ?? null,
    seed: request.seed ?? null,
    numSteps: request.numSteps ?? null,
    referenceFile: request.referenceAudio?.fileName ?? null,
    referenceType: request.referenceAudio?.mimeType ?? null,
  }))
  if (request.referenceAudio) hash.update(new Uint8Array(request.referenceAudio.data))
  return hash.digest("hex")
}

type RuntimeDependencies = {
  platform: NodeJS.Platform
  arch: string
  fetcher: typeof fetch
  download: typeof downloadVerified
  run: typeof runCommand
  spawnServer: typeof spawn
  getFreePort: typeof getFreePort
  verifyModels: typeof verifyModels
}

export class IrodoriRuntimeManager {
  private statusValue: IrodoriRuntimeStatus
  private installController: AbortController | null = null
  private installTask: Promise<void> | null = null
  private startTask: Promise<void> | null = null
  private startController: AbortController | null = null
  private shouldRun = false
  private server: ChildProcess | null = null
  private stopTask: Promise<void> | null = null
  private endpoint: string | null = null
  private token: string | null = null
  private stopping = false
  private serverOutput = ""
  private readonly synthesisControllers = new Map<string, AbortController>()
  private lastAudioCacheCleanup = 0
  private readonly dependencies: RuntimeDependencies

  constructor(
    private readonly root: string,
    private readonly window: BrowserWindow,
    dependencies: Partial<RuntimeDependencies> = {},
  ) {
    this.dependencies = {
      platform: process.platform,
      arch: process.arch,
      fetcher: fetch,
      download: downloadVerified,
      run: runCommand,
      spawnServer: spawn,
      getFreePort,
      verifyModels,
      ...dependencies,
    }
    this.statusValue = this.supported
      ? status("missing", 0, "セットアップが必要です")
      : { ...status("unsupported", 0, "Apple Silicon Macで利用できます"), supported: false }
    void this.cleanupAudioCache(true).catch(() => undefined)
  }

  private get supported() {
    return this.dependencies.platform === "darwin" && this.dependencies.arch === "arm64"
  }

  private get uvPath() { return path.join(this.root, "bin", "uv") }
  private get serverDirectory() { return path.join(this.root, "server") }
  private get modelDirectory() { return path.join(this.root, "models", "irodori") }
  private get codecDirectory() { return path.join(this.root, "models", "codec") }
  private get markerPath() { return path.join(this.root, "installed.json") }
  private get serverPidPath() { return path.join(this.root, "server.pid") }
  private get audioCacheDirectory() { return path.join(this.root, "cache", "audio") }

  async status() {
    if (!this.supported || ["installing", "starting", "running", "error"].includes(this.statusValue.state)) return this.statusValue
    try {
      const marker = JSON.parse(await readFile(this.markerPath, "utf8")) as { uvVersion?: string; serverRevision?: string; modelRevision?: string; codecRevision?: string }
      this.statusValue = marker.uvVersion === UV_VERSION
        && marker.serverRevision === SERVER_REVISION
        && marker.modelRevision === MODEL_REVISION
        && marker.codecRevision === CODEC_REVISION
        ? status("ready", 100, "セットアップ済み")
        : status("missing", 0, "更新が必要です")
    } catch {
      this.statusValue = status("missing", 0, "セットアップが必要です")
    }
    return this.statusValue
  }

  install() {
    this.shouldRun = true
    if (this.installTask) return this.installTask
    this.installTask = this.performInstall().finally(() => {
      this.installTask = null
      this.installController = null
    })
    return this.installTask
  }

  private async performInstall() {
    if (!this.supported) throw new Error("Irodori TTSの自動セットアップはApple Silicon Macで利用できます。")
    await this.stopServer()
    const controller = new AbortController()
    this.installController = controller
    try {
      await mkdir(this.root, { recursive: true })
      await mkdir(path.join(this.root, "home"), { recursive: true })
      await rm(this.markerPath, { force: true })
      const disk = await statfs(this.root)
      if (disk.bavail * disk.bsize < REQUIRED_FREE_BYTES) throw new Error("Irodori TTSのセットアップには6GB以上の空き容量が必要です。")
      await this.ensureUv(controller.signal)
      this.publish(status("installing", 18, "Irodoriを準備しています"))
      await this.installServerSource(controller.signal)
      this.publish(status("installing", 28, "Pythonを準備しています"))
      await this.dependencies.run(this.uvPath, ["python", "install", "3.10"], {
        cwd: this.root,
        env: this.runtimeEnvironment(),
        signal: controller.signal,
      })
      this.publish(status("installing", 48, "音声ライブラリを導入しています"))
      await this.dependencies.run(this.uvPath, ["sync", "--locked", "--python", "3.10", "--no-dev"], {
        cwd: this.serverDirectory,
        env: this.runtimeEnvironment(),
        signal: controller.signal,
      })
      this.publish({ ...status("installing", 62, "音声モデルをダウンロードしています"), indeterminate: true })
      await this.installModels(controller.signal)
      await writeFile(this.markerPath, JSON.stringify({ uvVersion: UV_VERSION, serverRevision: SERVER_REVISION, modelRevision: MODEL_REVISION, codecRevision: CODEC_REVISION }))
      this.publish(status("ready", 90, "音声モデルを準備します"))
      if (this.shouldRun) {
        try {
          await this.start(controller.signal)
        } catch (error) {
          if (this.shouldRun) throw error
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        this.publish(status("missing", 0, "セットアップを中止しました"))
        return
      }
      const message = error instanceof Error ? error.message : "Irodori TTSをセットアップできませんでした。"
      this.publish({ ...status("error", this.statusValue.progress, "セットアップに失敗しました"), error: message })
      throw error
    }
  }

  start(signal?: AbortSignal): Promise<void> {
    this.shouldRun = true
    if (this.startTask) {
      if (!this.startController?.signal.aborted) return this.startTask
      return this.startTask.catch(() => undefined).then(() => {
        if (this.shouldRun) return this.start(signal)
      })
    }
    const controller = new AbortController()
    this.startController = controller
    const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    this.startTask = this.performStart(combinedSignal).finally(() => {
      this.startTask = null
      if (this.startController === controller) this.startController = null
    })
    return this.startTask
  }

  private async performStart(signal?: AbortSignal) {
    if (!this.supported) throw new Error("Irodori TTSはApple Silicon Macで利用できます。")
    try {
      await this.stopTask
      signal?.throwIfAborted()
      if (this.server && this.endpoint && this.token) return
      if ((await this.status()).state === "missing") return
      signal?.throwIfAborted()
      this.publish(status("starting", Math.max(this.statusValue.progress, 70), "音声モデルを読み込んでいます"))
      // Detached servers outlive the app, so a previous run may still hold model memory.
      await this.killStaleServer()
      const port = await this.dependencies.getFreePort()
      signal?.throwIfAborted()
      const token = randomBytes(24).toString("base64url")
      const endpoint = `http://127.0.0.1:${port}/v1`
      this.stopping = false
      this.serverOutput = ""
      // Activity Monitor では p_comm（実行ファイル名）が表示されるため、
      // 実体 python へのハードリンク「Mikan Voice Helper」を exec する。
      // シンボリックリンクでは p_comm が python3.10 に戻ってしまうことを実機確認済み。
      const binDir = path.join(this.root, "server", ".venv", "bin")
      const helperPath = path.join(binDir, "Mikan Voice Helper")
      const pythonEntry = await this.prepareVoiceHelper(binDir, helperPath).catch(() => "python")
      const child = this.dependencies.spawnServer(this.uvPath, ["run", "--no-sync", pythonEntry, "-m", "irodori_openai_tts", "--host", "127.0.0.1", "--port", String(port)], {
        cwd: this.serverDirectory,
        env: {
          ...this.runtimeEnvironment(),
          IRODORI_API_KEY: token,
          IRODORI_PRELOAD: "true",
          IRODORI_DEFAULT_RESPONSE_FORMAT: "wav",
          IRODORI_CHECKPOINT: path.join(this.modelDirectory, "model.safetensors"),
          IRODORI_CODEC_REPO: path.join(this.codecDirectory, "weights.pth"),
          HF_HUB_OFFLINE: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      })
      this.server = child
      this.endpoint = endpoint
      this.token = token
      if (child.pid) await writeFile(this.serverPidPath, String(child.pid)).catch(() => undefined)
      const capture = (chunk: unknown) => {
        this.serverOutput = `${this.serverOutput}${String(chunk)}`.slice(-4000)
      }
      child.stdout?.on("data", capture)
      child.stderr?.on("data", capture)
      child.once("error", (error) => {
        if (this.server !== child) return
        this.serverOutput = error.message
        this.server = null
        this.endpoint = null
        this.token = null
      })
      child.once("exit", (code) => {
        if (this.server !== child) return
        this.server = null
        this.endpoint = null
        this.token = null
        if (!this.stopping) this.publish({ ...status("error", 65, "Irodori TTSが停止しました"), error: this.serverOutput.trim() || `終了コード: ${code ?? "不明"}` })
      })
      await this.waitForHealth(endpoint, signal)
      await new Promise<void>((resolve) => setImmediate(resolve))
      if (this.server !== child || this.endpoint !== endpoint || this.token !== token || child.exitCode != null || child.signalCode != null) {
        throw new Error(this.serverOutput.trim() || "Irodori TTSが起動直後に停止しました。")
      }
      this.publish(status("running", 100, "Irodori TTSを利用できます"))
    } catch (error) {
      await this.stopServer()
      if (signal?.aborted) {
        this.publish(status("ready", 100, "セットアップ済み"))
      } else {
        const message = error instanceof Error ? error.message : "Irodori TTSを起動できませんでした。"
        this.publish({ ...status("error", this.statusValue.progress, "Irodori TTSを起動できませんでした"), error: message })
      }
      throw error
    }
  }

  private async prepareVoiceHelper(binDir: string, helperPath: string): Promise<string> {
    // 毎回作り直す。uv の python 差し替えで実体パスが変わっても追従できる。
    await rm(helperPath, { force: true })
    const pythonPath = path.join(binDir, "python3.10")
    const target = await readlink(pythonPath)
      .then((linkTarget) => path.resolve(binDir, linkTarget))
      .catch(() => pythonPath)
    await link(target, helperPath)
    return "Mikan Voice Helper"
  }

  async synthesize(request: LocalTtsSynthesisRequest) {
    await this.cleanupAudioCache()
    const cachePath = path.join(this.audioCacheDirectory, `${audioCacheKey(request)}.wav`)
    const cached = await this.readCachedAudio(cachePath)
    if (cached) return cached
    await this.ensureRunning()
    const controller = new AbortController()
    this.synthesisControllers.set(request.requestId, controller)
    try {
      const audio = await synthesizeLocalTts({ ...request, endpoint: this.endpoint!, apiKey: this.token! }, this.dependencies.fetcher, controller.signal)
      const temporaryPath = `${cachePath}.${request.requestId}.tmp`
      try {
        await mkdir(this.audioCacheDirectory, { recursive: true })
        await writeFile(temporaryPath, Buffer.from(audio))
        await rename(temporaryPath, cachePath)
      } catch {
        // Cache failures must not prevent the generated audio from playing.
        await rm(temporaryPath, { force: true }).catch(() => undefined)
      }
      return audio
    } finally {
      this.synthesisControllers.delete(request.requestId)
    }
  }

  async hasCachedAudio(request: LocalTtsSynthesisRequest) {
    // Lightweight cache check: must not start the server or load the model.
    try {
      const file = await stat(path.join(this.audioCacheDirectory, `${audioCacheKey(request)}.wav`))
      return Date.now() - file.mtimeMs < AUDIO_CACHE_TTL_MS
    } catch {
      return false
    }
  }

  async readCachedAudioOnly(request: LocalTtsSynthesisRequest) {
    // 生成済み音声の再生用。サーバー起動やモデルロードはしない。
    const cachePath = path.join(this.audioCacheDirectory, `${audioCacheKey(request)}.wav`)
    return this.readCachedAudio(cachePath)
  }

  async hasVoice(voiceId: string) {
    await this.ensureRunning()
    const response = await this.dependencies.fetcher(`${this.endpoint}/audio/voices/${encodeURIComponent(voiceId)}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      redirect: "error",
    })
    if (response.status === 404) return false
    if (!response.ok) throw new Error(`Irodori TTSの参照音声を確認できませんでした（${response.status}）`)
    return true
  }

  async findVoice(prefix: string) {
    await this.ensureRunning()
    try {
      const names = await readdir(path.join(this.serverDirectory, "voices"))
      const match = names.filter((name) => name.endsWith(".wav") && name.slice(0, -4).startsWith(prefix)).sort().at(-1)
      return match ? match.slice(0, -4) : null
    } catch {
      return null
    }
  }

  async deleteVoice(prefix: string) {
    const voicesDirectory = path.join(this.serverDirectory, "voices")
    try {
      const names = await readdir(voicesDirectory)
      for (const name of names.filter((item) => item.endsWith(".wav") && item.slice(0, -4).startsWith(prefix))) {
        await rm(path.join(voicesDirectory, name), { force: true })
      }
    } catch {
      // No voices directory means nothing to delete.
    }
    await rm(this.audioCacheDirectory, { recursive: true, force: true })
  }

  async registerVoice(reference: LocalTtsReference) {
    await this.ensureRunning()
    await registerLocalTtsReference(this.endpoint!, this.token!, reference, this.dependencies.fetcher, undefined, true)
    await rm(this.audioCacheDirectory, { recursive: true, force: true })
  }

  private async readCachedAudio(filePath: string) {
    try {
      const file = await stat(filePath)
      if (Date.now() - file.mtimeMs >= AUDIO_CACHE_TTL_MS) {
        await rm(filePath, { force: true })
        return null
      }
      const audio = await readFile(filePath)
      const now = new Date()
      await utimes(filePath, now, now)
      return audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength)
    } catch {
      return null
    }
  }

  private async cleanupAudioCache(force = false) {
    const now = Date.now()
    if (!force && now - this.lastAudioCacheCleanup < AUDIO_CACHE_CLEANUP_INTERVAL_MS) return
    this.lastAudioCacheCleanup = now
    let files: string[]
    try {
      files = await readdir(this.audioCacheDirectory)
    } catch {
      return
    }
    await Promise.all(files.filter((file) => file.endsWith(".wav")).map(async (file) => {
      const filePath = path.join(this.audioCacheDirectory, file)
      try {
        if (now - (await stat(filePath)).mtimeMs >= AUDIO_CACHE_TTL_MS) await rm(filePath, { force: true })
      } catch {
        // Another cleanup may already have removed it.
      }
    }))
  }

  private async ensureRunning() {
    const current = await this.status()
    if (current.state === "ready") await this.start()
    else if (current.state === "starting" && this.startTask) await this.startTask
    else if (current.state !== "running") throw new Error("Irodori TTSを先にセットアップしてください。")
    if (!this.endpoint || !this.token) throw new Error("Irodori TTSを起動できませんでした。")
  }

  async cancelSynthesis(requestId: string) {
    const controller = this.synthesisControllers.get(requestId)
    if (!controller) return
    controller.abort()
    try {
      await this.stopServer()
      this.publish(status("ready", 100, "セットアップ済み"))
    } catch {
      // stopServer publishes the actionable runtime error.
    }
  }

  async delete() {
    this.shouldRun = false
    this.installController?.abort()
    this.startController?.abort()
    await this.installTask?.catch(() => undefined)
    await this.stopServer()
    await this.startTask?.catch(() => undefined)
    await rm(this.root, { recursive: true, force: true })
    this.publish(status("missing", 0, "セットアップが必要です"))
  }

  async dispose() {
    this.shouldRun = false
    this.installController?.abort()
    this.startController?.abort()
    await this.stopServer().catch(() => undefined)
    await this.startTask?.catch(() => undefined)
  }

  async stop() {
    this.shouldRun = false
    this.startController?.abort()
    const wasActive = Boolean(this.server)
    await this.stopServer()
    if (wasActive || this.statusValue.state === "starting") this.publish(status("ready", 100, "セットアップ済み"))
  }

  private stopServer() {
    if (this.stopTask) return this.stopTask
    this.stopTask = this.performStopServer().finally(() => { this.stopTask = null })
    return this.stopTask
  }

  private async performStopServer() {
    this.stopping = true
    this.synthesisControllers.forEach((controller) => controller.abort())
    this.synthesisControllers.clear()
    const child = this.server
    this.endpoint = null
    this.token = null
    await rm(this.serverPidPath, { force: true }).catch(() => undefined)
    if (!child) return
    if (child.exitCode != null || child.signalCode != null) {
      if (this.server === child) this.server = null
      return
    }
    const gracefulExit = waitForChildExit(child, STOP_TIMEOUT_MS)
    signalChild(child, "SIGTERM")
    if (!await gracefulExit) {
      const forcedExit = waitForChildExit(child, KILL_TIMEOUT_MS)
      signalChild(child, "SIGKILL")
      if (!await forcedExit) {
        const error = "Irodori TTSのプロセスを終了できませんでした。"
        this.publish({ ...status("error", this.statusValue.progress, "Irodori TTSを終了できませんでした"), error })
        throw new Error(error)
      }
    }
    if (this.server === child) this.server = null
  }

  // ponytail: best-effort SIGTERM only; a fresh free port is used, so no exit wait.
  private async killStaleServer() {
    let pid = 0
    try {
      pid = Number.parseInt(await readFile(this.serverPidPath, "utf8"), 10)
    } catch {
      return
    }
    await rm(this.serverPidPath, { force: true }).catch(() => undefined)
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    try {
      process.kill(-pid, "SIGTERM")
    } catch {
      try {
        process.kill(pid, "SIGTERM")
      } catch {
        // Already gone; the pidfile is removed above.
      }
    }
  }

  private async ensureUv(signal: AbortSignal) {
    this.publish(status("installing", 2, "実行環境をダウンロードしています"))
    await rm(this.uvPath, { force: true })
    const archive = path.join(this.root, "uv.tar.gz")
    await this.dependencies.download(UV_ARCHIVE_URL, archive, UV_ARCHIVE_SHA256, this.dependencies.fetcher, signal, (ratio) => {
      this.publish(status("installing", 2 + Math.round(ratio * 10), "実行環境をダウンロードしています"))
    })
    await mkdir(path.dirname(this.uvPath), { recursive: true })
    await this.dependencies.run("/usr/bin/tar", ["-xzf", archive, "-C", path.dirname(this.uvPath), "--strip-components=1", "uv-aarch64-apple-darwin/uv"], { cwd: this.root, env: this.runtimeEnvironment(), signal })
    await chmod(this.uvPath, 0o755)
    await rm(archive, { force: true })
  }

  private async installServerSource(signal: AbortSignal) {
    const archive = path.join(this.root, "irodori-server.tar.gz")
    await this.dependencies.download(SERVER_ARCHIVE_URL, archive, SERVER_ARCHIVE_SHA256, this.dependencies.fetcher, signal, () => undefined)
    await rm(this.serverDirectory, { recursive: true, force: true })
    await mkdir(this.serverDirectory, { recursive: true })
    await this.dependencies.run("/usr/bin/tar", ["-xzf", archive, "-C", this.serverDirectory, "--strip-components=1"], { cwd: this.root, env: this.runtimeEnvironment(), signal })
    await rm(archive, { force: true })
  }

  private async installModels(signal: AbortSignal) {
    await rm(path.dirname(this.modelDirectory), { recursive: true, force: true })
    await mkdir(this.modelDirectory, { recursive: true })
    await mkdir(this.codecDirectory, { recursive: true })
    const script = [
      "from huggingface_hub import snapshot_download",
      "import sys",
      "snapshot_download(repo_id=sys.argv[1], revision=sys.argv[2], local_dir=sys.argv[3])",
      "snapshot_download(repo_id=sys.argv[4], revision=sys.argv[5], local_dir=sys.argv[6])",
    ].join("; ")
    await this.dependencies.run(this.uvPath, [
      "run", "--no-sync", "python", "-c", script,
      MODEL_REPOSITORY, MODEL_REVISION, this.modelDirectory,
      CODEC_REPOSITORY, CODEC_REVISION, this.codecDirectory,
    ], { cwd: this.serverDirectory, env: this.runtimeEnvironment(), signal })
    await this.dependencies.verifyModels(path.join(this.modelDirectory, "model.safetensors"), path.join(this.codecDirectory, "weights.pth"))
  }

  private runtimeEnvironment() {
    const environment: NodeJS.ProcessEnv = {
      PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      HOME: path.join(this.root, "home"),
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      LANG: process.env.LANG ?? "en_US.UTF-8",
      UV_CACHE_DIR: path.join(this.root, "cache", "uv"),
      UV_PYTHON_INSTALL_DIR: path.join(this.root, "python"),
      UV_PYTHON_INSTALL_BIN: "0",
      UV_NO_MODIFY_PATH: "1",
      HF_HOME: path.join(this.root, "cache", "huggingface"),
      PYTHONUNBUFFERED: "1",
    }
    for (const key of ["SSL_CERT_FILE", "SSL_CERT_DIR"] as const) {
      if (process.env[key]) environment[key] = process.env[key]
    }
    return environment
  }

  private async waitForHealth(endpoint: string, signal?: AbortSignal) {
    const deadline = Date.now() + START_TIMEOUT_MS
    const healthUrl = `${endpoint.replace(/\/v1$/, "")}/health`
    while (Date.now() < deadline) {
      signal?.throwIfAborted()
      if (!this.server) throw new Error(this.serverOutput.trim() || "Irodori TTSが起動前に終了しました。")
      try {
        const timeout = AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS)
        const response = await this.dependencies.fetcher(healthUrl, { redirect: "error", signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
        if (response.ok) return
      } catch (error) {
        if (signal?.aborted) throw error
      }
      await wait(1000, signal)
    }
    throw new Error("Irodori TTSの起動に時間がかかりすぎています。再試行してください。")
  }

  private publish(next: IrodoriRuntimeStatus) {
    this.statusValue = next
    if (!this.window.isDestroyed()) this.window.webContents.send("irodori:status", next)
  }
}

function status(state: IrodoriRuntimeStatus["state"], progress: number, stage: string): IrodoriRuntimeStatus {
  return { supported: true, state, progress, stage }
}

async function verifyModels(modelPath: string, codecPath: string) {
  if (await hashFile(modelPath) !== MODEL_SHA256 || await hashFile(codecPath) !== CODEC_SHA256) {
    throw new Error("ダウンロードした音声モデルを検証できませんでした。")
  }
}

async function hashFile(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256")
    const stream = createReadStream(filePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.once("error", reject)
    stream.once("end", () => resolve(hash.digest("hex")))
  })
}

async function downloadVerified(url: string, destination: string, expectedSha256: string, fetcher: typeof fetch, signal: AbortSignal, onProgress: (ratio: number) => void) {
  const response = await fetcher(url, { signal, redirect: "follow" })
  if (!response.ok || !response.body) throw new Error(`必要なファイルをダウンロードできませんでした（${response.status}）`)
  const temporary = `${destination}.part`
  const file = await open(temporary, "w")
  const reader = response.body.getReader()
  const hash = createHash("sha256")
  const total = Number(response.headers.get("content-length") ?? 0)
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await file.write(value)
      hash.update(value)
      received += value.byteLength
      onProgress(total > 0 ? received / total : 0)
    }
  } finally {
    await file.close()
  }
  if (hash.digest("hex") !== expectedSha256) {
    await rm(temporary, { force: true })
    throw new Error("ダウンロードしたファイルを検証できませんでした。")
  }
  await rename(temporary, destination)
}

async function runCommand(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; signal: AbortSignal }) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ["ignore", "ignore", "pipe"] })
    let errorOutput = ""
    child.stderr.on("data", (chunk) => { errorOutput = `${errorOutput}${String(chunk)}`.slice(-4000) })
    const abort = () => child.kill()
    options.signal.addEventListener("abort", abort, { once: true })
    child.once("error", reject)
    child.once("exit", (code) => {
      options.signal.removeEventListener("abort", abort)
      if (options.signal.aborted) reject(options.signal.reason)
      else if (code === 0) resolve()
      else reject(new Error(errorOutput.trim() || `${path.basename(command)}を実行できませんでした（終了コード: ${code ?? "不明"}）`))
    })
  })
}

async function getFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      server.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

function wait(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      reject(signal.reason)
    }, { once: true })
  })
}

function waitForChildExit(child: ChildProcess, timeout: number) {
  if (child.exitCode != null || child.signalCode != null) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    const done = (exited: boolean) => {
      clearTimeout(timer)
      child.off("exit", onExit)
      child.off("close", onExit)
      resolve(exited)
    }
    const onExit = () => done(true)
    const timer = setTimeout(() => done(false), timeout)
    child.once("exit", onExit)
    child.once("close", onExit)
  })
}

function signalChild(child: ChildProcess, signal: NodeJS.Signals) {
  try {
    if (child.pid) process.kill(-child.pid, signal)
    else child.kill(signal)
  } catch {
    child.kill(signal)
  }
}
