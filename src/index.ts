interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * what3words MCP — 3-word grid geocoding
 *
 * Every 3m × 3m square on earth has a unique 3-word address. Useful when
 * postal addresses don't exist (rural sites, parks, emergency response) or
 * when a free-text address is ambiguous.
 *
 * API: https://developer.what3words.com/public-api/docs
 * Auth: `?key=<api_key>` query. Free hobbyist tier with daily caps.
 *
 * Tools:
 * - coords_to_words:  lat/lon → "word.word.word"
 * - words_to_coords:  "word.word.word" → lat/lon + bounding box
 * - autosuggest:      partial 3-word input → ranked completions
 * - list_languages:   supported languages for word output
 */


const BASE_URL = 'https://api.what3words.com/v3';

const tools: McpToolExport['tools'] = [
  {
    name: 'coords_to_words',
    description:
      'Convert a lat/lon to a what3words 3-word address. Defaults to English; pass a 2-letter language code for other languages.',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: { type: 'number', description: 'Latitude' },
        longitude: { type: 'number', description: 'Longitude' },
        language: { type: 'string', description: '2-letter language code (default "en")' },
      },
      required: ['latitude', 'longitude'],
    },
  },
  {
    name: 'words_to_coords',
    description: 'Convert a 3-word address ("filled.count.soap") to a lat/lon centre + 3m×3m bounding box.',
    inputSchema: {
      type: 'object',
      properties: {
        words: { type: 'string', description: 'Three-word address (dot-separated)' },
      },
      required: ['words'],
    },
  },
  {
    name: 'autosuggest',
    description:
      'Given a partial / mistyped 3-word input, return ranked suggestions. Optional focus point biases results toward proximity.',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Partial three-word string' },
        n_results: { type: 'number', description: '1-100 (default 3)' },
        focus_latitude: { type: 'number', description: 'Bias toward this latitude' },
        focus_longitude: { type: 'number', description: 'Bias toward this longitude' },
        country: { type: 'string', description: 'Restrict to ISO country code(s), comma-separated' },
        language: { type: 'string', description: '2-letter language' },
      },
      required: ['input'],
    },
  },
  {
    name: 'list_languages',
    description: 'Supported languages for 3-word output (code + name).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = (args._apiKey as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error(
      'what3words requires an API key. Contact the operator about platform credentials, or BYO via ?_apiKey=<key> after registering at https://accounts.what3words.com/register (free hobbyist tier).',
    );
  }
  switch (name) {
    case 'coords_to_words':
      return coordsToWords(apiKey, args);
    case 'words_to_coords':
      return wordsToCoords(apiKey, reqStr(args, 'words', '"filled.count.soap"'));
    case 'autosuggest':
      return autosuggest(apiKey, args);
    case 'list_languages':
      return listLanguages(apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing or empty. Pass a string like ${example}.`);
  }
  return v;
}

async function w3wFetch<T>(apiKey: string, path: string, params: URLSearchParams): Promise<T> {
  params.set('key', apiKey);
  const url = `${BASE_URL}${path}?${params}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 401 || res.status === 403) throw new Error('what3words: unauthorized — check the API key');
  if (res.status === 429) throw new Error('what3words: rate-limit (HTTP 429)');
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`what3words error: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as Record<string, unknown> & { error?: { code?: string; message?: string } };
  if (data.error) {
    throw new Error(`what3words: ${data.error.message ?? data.error.code ?? 'unknown error'}`);
  }
  return data as T;
}

interface CoordResp {
  words?: string;
  language?: string;
  coordinates?: { lat: number; lng: number };
  square?: { southwest: { lat: number; lng: number }; northeast: { lat: number; lng: number } };
  country?: string;
  nearestPlace?: string;
  map?: string;
}

async function coordsToWords(apiKey: string, args: Record<string, unknown>) {
  const params = new URLSearchParams({
    coordinates: `${args.latitude},${args.longitude}`,
    language: (args.language as string) ?? 'en',
  });
  const data = await w3wFetch<CoordResp>(apiKey, '/convert-to-3wa', params);
  return {
    words: data.words ?? null,
    language: data.language ?? null,
    latitude: data.coordinates?.lat ?? null,
    longitude: data.coordinates?.lng ?? null,
    square_sw: data.square?.southwest ?? null,
    square_ne: data.square?.northeast ?? null,
    country: data.country ?? null,
    nearest_place: data.nearestPlace ?? null,
    map_url: data.map ?? null,
  };
}

async function wordsToCoords(apiKey: string, words: string) {
  const params = new URLSearchParams({ words });
  const data = await w3wFetch<CoordResp>(apiKey, '/convert-to-coordinates', params);
  return {
    words,
    latitude: data.coordinates?.lat ?? null,
    longitude: data.coordinates?.lng ?? null,
    square_sw: data.square?.southwest ?? null,
    square_ne: data.square?.northeast ?? null,
    country: data.country ?? null,
    nearest_place: data.nearestPlace ?? null,
    map_url: data.map ?? null,
  };
}

interface AutosuggestResp {
  suggestions?: {
    country?: string;
    nearestPlace?: string;
    words?: string;
    distanceToFocusKm?: number;
    rank?: number;
    language?: string;
  }[];
}

async function autosuggest(apiKey: string, args: Record<string, unknown>) {
  const params = new URLSearchParams({
    input: String(args.input),
    'n-results': String(Math.min(100, Math.max(1, (args.n_results as number) ?? 3))),
  });
  if (typeof args.focus_latitude === 'number' && typeof args.focus_longitude === 'number') {
    params.set('focus', `${args.focus_latitude},${args.focus_longitude}`);
  }
  if (args.country) params.set('clip-to-country', String(args.country));
  if (args.language) params.set('language', String(args.language));

  const data = await w3wFetch<AutosuggestResp>(apiKey, '/autosuggest', params);
  return {
    input: args.input,
    count: data.suggestions?.length ?? 0,
    suggestions: (data.suggestions ?? []).map((s) => ({
      words: s.words ?? null,
      country: s.country ?? null,
      nearest_place: s.nearestPlace ?? null,
      distance_to_focus_km: s.distanceToFocusKm ?? null,
      rank: s.rank ?? null,
      language: s.language ?? null,
    })),
  };
}

async function listLanguages(apiKey: string) {
  const data = await w3wFetch<{ languages?: { code?: string; name?: string; nativeName?: string }[] }>(
    apiKey,
    '/available-languages',
    new URLSearchParams(),
  );
  return {
    count: data.languages?.length ?? 0,
    languages: (data.languages ?? []).map((l) => ({
      code: l.code ?? null,
      name: l.name ?? null,
      native_name: l.nativeName ?? null,
    })),
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
