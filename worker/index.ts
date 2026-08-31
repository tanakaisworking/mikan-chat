export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/api/health") {
      return Response.json(
        { status: "ok", service: "mikan-chat-web" },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json(
        { error: "Not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      )
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
