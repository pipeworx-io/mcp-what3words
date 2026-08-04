# @pipeworx/what3words

what3words MCP — 3-word grid geocoding.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

- `coords_to_words(latitude, longitude, language?)`
- `words_to_coords(words)`
- `autosuggest(input, n_results?, focus_latitude?, focus_longitude?, country?, language?)`
- `list_languages()`

## Auth

- **Platform key:** gateway env `PLATFORM_WHAT3WORDS_KEY`.
- **BYO:** `?_apiKey=<key>` after registering at https://accounts.what3words.com/register.

## Data source

`https://api.what3words.com/v3/` — `?key=` query param.

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "what3words": {
      "url": "https://gateway.pipeworx.io/what3words/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about What3words data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
