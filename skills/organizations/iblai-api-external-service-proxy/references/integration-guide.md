# External Service Proxy — integration guide

> Doc-sourced explanatory material complementing the verified endpoints in
> [`/iblai-api-external-service-proxy`](../SKILL.md). Shows how to build dynamic
> integrations against the proxy — parsing path templates, handling each response
> mode, and a reusable client — preserved from the developer docs so nothing is lost.

This guide shows how to build dynamic integrations that work with any external
service in the proxy API. Learn how to parse path templates, handle different
response types, and create a reusable client.

## Understanding path templates

Each endpoint has a `path_template` that defines the upstream URL path. Placeholders
in curly braces `{param_name}` must be provided via the `path_params` field.

### Example: extracting required path parameters

Given an endpoint with:
```json
{
  "slug": "tts",
  "path_template": "/v1/text-to-speech/{voice_id}",
  "http_method": "POST"
}
```

The `{voice_id}` placeholder tells you that `path_params.voice_id` is required:

```javascript
// Request must include path_params with voice_id
{
  "path_params": {
    "voice_id": "21m00Tcm4TlvDq8ikWAM"  // Required - matches {voice_id} in template
  },
  "body": {
    "text": "Hello world"
  }
}
```

### Parsing path templates dynamically

```javascript
function extractPathParams(pathTemplate) {
  const regex = /\{(\w+)\}/g;
  const params = [];
  let match;
  while ((match = regex.exec(pathTemplate)) !== null) {
    params.push(match[1]);
  }
  return params;
}

// Usage
const template = "/v1/text-to-speech/{voice_id}";
const required = extractPathParams(template);
// Returns: ["voice_id"]

const template2 = "/v2/videos/{template_id}/generate";
const required2 = extractPathParams(template2);
// Returns: ["template_id"]
```

## Understanding response modes

Each endpoint specifies a `response_mode` that tells you how to handle the response:

| Response Mode | Description | Client Handling |
|---------------|-------------|-----------------|
| `json` | Response is JSON data | Use `response.json()` |
| `binary` | Response is binary data (audio, video, images) | Use `response.blob()` |
| `passthrough` | Response is passed through as-is (check Content-Type) | Check `Content-Type` header, use appropriate method |
| `stream` | Response is a stream (SSE or chunked) | Use streaming APIs |

### Handling different response types

```javascript
async function invokeEndpoint(service, action, payload, responseMode) {
  const response = await fetch(
    `https://api.iblai.app/dm/api/ai-proxy/orgs/${org}/services/${service}/${action}/`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Api-Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || error.error || 'Request failed');
  }

  // Handle based on response_mode from endpoint config
  switch (responseMode) {
    case 'json':
      return await response.json();

    case 'binary':
    case 'passthrough':
      // Check content type to determine handling
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      } else if (
        contentType.includes('audio/') ||
        contentType.includes('video/') ||
        contentType.includes('image/')
      ) {
        return await response.blob();
      }
      return await response.text();

    case 'stream':
      return response.body; // Returns ReadableStream

    default:
      return await response.json();
  }
}
```

## Complete dynamic integration example

This example shows how to build a fully dynamic integration that works with any
service:

```javascript
class ExternalProxyClient {
  constructor(org, apiKey) {
    this.org = org;
    this.apiKey = apiKey;
    this.baseUrl = `https://api.iblai.app/dm/api/ai-proxy/orgs/${org}`;
    this.servicesCache = null;
    this.serviceDetailsCache = {};
  }

  async getServices() {
    if (this.servicesCache) return this.servicesCache;

    const response = await fetch(`${this.baseUrl}/services/`, {
      headers: { 'Authorization': `Api-Token ${this.apiKey}` }
    });
    this.servicesCache = await response.json();
    return this.servicesCache;
  }

  async getServiceDetails(serviceSlug) {
    if (this.serviceDetailsCache[serviceSlug]) {
      return this.serviceDetailsCache[serviceSlug];
    }

    const response = await fetch(`${this.baseUrl}/services/${serviceSlug}/`, {
      headers: { 'Authorization': `Api-Token ${this.apiKey}` }
    });
    const details = await response.json();
    this.serviceDetailsCache[serviceSlug] = details;
    return details;
  }

  extractPathParams(pathTemplate) {
    const regex = /\{(\w+)\}/g;
    const params = [];
    let match;
    while ((match = regex.exec(pathTemplate)) !== null) {
      params.push(match[1]);
    }
    return params;
  }

  async invoke(serviceSlug, actionSlug, payload = {}) {
    // Get endpoint details to know response mode
    const service = await this.getServiceDetails(serviceSlug);
    const endpoint = service.endpoints.find(e => e.slug === actionSlug);

    if (!endpoint) {
      throw new Error(`Endpoint '${actionSlug}' not found in service '${serviceSlug}'`);
    }

    // Validate required path params
    const requiredParams = this.extractPathParams(endpoint.path_template);
    const providedParams = Object.keys(payload.path_params || {});
    const missingParams = requiredParams.filter(p => !providedParams.includes(p));

    if (missingParams.length > 0) {
      throw new Error(`Missing required path_params: ${missingParams.join(', ')}`);
    }

    // Make the request
    const response = await fetch(
      `${this.baseUrl}/services/${serviceSlug}/${actionSlug}/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Api-Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || error.error || `HTTP ${response.status}`);
    }

    // Handle response based on mode
    const contentType = response.headers.get('Content-Type') || '';

    if (endpoint.response_mode === 'binary' ||
        contentType.includes('audio/') ||
        contentType.includes('video/') ||
        contentType.includes('image/')) {
      return {
        type: 'binary',
        blob: await response.blob(),
        contentType: contentType
      };
    }

    return {
      type: 'json',
      data: await response.json()
    };
  }
}

// Usage Example
async function example() {
  const client = new ExternalProxyClient('my-org', 'my-api-key');

  // 1. Discover available services
  const services = await client.getServices();
  console.log('Available services:', services.map(s => s.display_name));

  // 2. Get details for a specific service
  const elevenlabs = await client.getServiceDetails('elevenlabs');
  console.log('ElevenLabs endpoints:', elevenlabs.endpoints.map(e => e.slug));

  // 3. Check what params an endpoint needs
  const ttsEndpoint = elevenlabs.endpoints.find(e => e.slug === 'tts');
  const requiredParams = client.extractPathParams(ttsEndpoint.path_template);
  console.log('TTS requires path_params:', requiredParams); // ["voice_id"]

  // 4. Invoke the endpoint
  const result = await client.invoke('elevenlabs', 'tts', {
    path_params: { voice_id: '21m00Tcm4TlvDq8ikWAM' },
    body: {
      text: 'Hello, world!',
      model_id: 'eleven_multilingual_v2'
    }
  });

  // 5. Handle the response based on type
  if (result.type === 'binary') {
    const audioUrl = URL.createObjectURL(result.blob);
    const audio = new Audio(audioUrl);
    audio.play();
  } else {
    console.log('Response:', result.data);
  }
}
```

## Upstream API documentation

For details on what `body` parameters each upstream API expects, refer to their
official documentation:

| Service | Documentation |
|---------|---------------|
| ElevenLabs | [ElevenLabs API Docs](https://elevenlabs.io/docs/api-reference) |
| HeyGen | [HeyGen API Docs](https://developers.heygen.com/) |

### Finding required body parameters

The `body` field in your request is passed directly to the upstream API. To know what
parameters are required:

1. **Use the discovery endpoints** to find the upstream `path_template`
2. **Check the upstream API documentation** for that endpoint's request body schema
3. **Use list endpoints first** (e.g., `list-voices`, `list-avatars`) to get valid IDs

### Example: building a TTS request

```javascript
// Step 1: Get available voices
const voices = await client.invoke('elevenlabs', 'list-voices', {});
const voiceId = voices.data.voices[0].voice_id;

// Step 2: Get available models
const models = await client.invoke('elevenlabs', 'list-models', {});
const modelId = models.data[0].model_id;

// Step 3: Make TTS request with discovered values
const audio = await client.invoke('elevenlabs', 'tts', {
  path_params: { voice_id: voiceId },
  body: {
    text: 'Hello, world!',
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5
    }
  }
});
```

### Example: generating a video (async job + polling)

`generate-*`, `translate-video`, and `create-dubbing` are **async**: the invoke
returns a job/video id, and you poll the matching status action (`video-status`,
`translation-status`, `get-dubbing`, `photo-avatar-train-status`) on a fixed
interval until it reaches a terminal state.

```javascript
// Uses the ExternalProxyClient above. HeyGen wraps every payload under `data`,
// and client.invoke() wraps *that* under `.data` — hence the double `.data.data`.
async function generateVideoAndWait(client, script, avatarId, voiceId) {
  const started = await client.invoke('heygen', 'generate-video', {
    body: {
      test: true,                          // test:true = no credits charged
      video_inputs: [{
        character: { type: 'avatar', avatar_id: avatarId, avatar_style: 'normal' },
        voice:     { type: 'text', input_text: script, voice_id: voiceId }
      }],
      dimension: { width: 1280, height: 720 }
    }
  });
  const videoId = started.data.data.video_id;

  // Poll video-status until completed/failed (60 attempts × 5s ≈ 5 min ceiling).
  for (let attempt = 0; attempt < 60; attempt++) {
    const res = await client.invoke('heygen', 'video-status', {
      query: { video_id: videoId }
    });
    const status = res.data.data?.status;
    if (status === 'completed') return res.data.data.video_url;
    if (status === 'failed') throw new Error(res.data.data.error || 'Video generation failed');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Video generation timed out');
}
```

## Related pages

- [Overview & service discovery](overview.md) — authentication and service discovery
- [ElevenLabs action catalog](elevenlabs.md) — text-to-speech endpoints
- [HeyGen action catalog](heygen.md) — video generation endpoints
- [Error handling & setup](errors.md) — error responses and credential setup
