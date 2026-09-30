# Harsh Chaudhary portfolio

This is a dependency-free static portfolio site with a local-first AI chat workspace.

## Chat configuration

The chat works immediately in **Demo mode** without a network request. Open **Settings** to select an OpenAI-compatible provider, Anthropic, or Google Gemini. A provider can be configured in two ways:

- **Server-side proxy (recommended):** enter a proxy URL that accepts the selected provider's request shape and returns an OpenAI-compatible response or SSE stream. Keep the provider secret on the server; the browser does not forward the locally entered key when a proxy URL is present.
- **Direct browser connection:** enter a key for a personal/local device. The key is held in memory by default and can optionally be kept in `sessionStorage` for the current browser session. It is never committed to this repository or written to `localStorage`.

The client keeps conversation history and settings in `localStorage` (excluding API keys), compacts older context before sending, supports streaming, and renders basic markdown/code safely after escaping HTML. For a shared deployment, use a server-side proxy with authentication, rate limiting, origin checks, request size limits, and provider-specific secret management.

## Local preview

Because this site has no build step, serve the repository with any static web server:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.
