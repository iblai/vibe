# External Service Proxy — overview & service discovery

> Doc-sourced explanatory material complementing the verified endpoints in
> [`/iblai-api-external-service-proxy`](../SKILL.md). The endpoints and per-provider
> action catalogs are the skill's `SKILL.md` + `references/elevenlabs.md` /
> `references/heygen.md`; this file preserves the proxy concept, discovery response
> shapes, and worked client examples so nothing from the developer docs is lost.

## Purpose

The External Service Proxy API provides a unified interface for integrating
third-party services like ElevenLabs and HeyGen into your application. This proxy
layer handles authentication, request routing, and response formatting, allowing you
to interact with multiple external services through a consistent API.

## Authentication

All requests authenticate with the org's platform admin token in the `Authorization`
header:

```
Authorization: Api-Token <your-api-key>
```

Use `IBLAI_API_KEY` for the token and `IBLAI_ORG` for `{org}`; run
`/iblai-api-login` first to populate them. The token must belong to a **platform
admin** — every proxy endpoint is platform-admin gated.

## Service discovery

Before making API calls, use the discovery endpoints to find available services and
their configurations.

### List all services

Get all available external proxy services.

**Endpoint:**
```
GET https://api.iblai.app/dm/api/ai-proxy/orgs/{org}/services/
```

**Response:**
```json
[
  {
    "slug": "elevenlabs",
    "display_name": "ElevenLabs",
    "service_type": "tts",
    "is_enabled": true,
    "supports_async_jobs": false,
    "supports_streaming": true,
    "credential_name": "elevenlabs",
    "endpoint_count": 3
  },
  {
    "slug": "heygen",
    "display_name": "HeyGen",
    "service_type": "video",
    "is_enabled": true,
    "supports_async_jobs": true,
    "supports_streaming": false,
    "credential_name": "heygen",
    "endpoint_count": 6
  }
]
```

### Get service details

Get detailed information about a specific service including all available endpoints.

**Endpoint:**
```
GET https://api.iblai.app/dm/api/ai-proxy/orgs/{org}/services/{service}/
```

**Response:**
```json
{
  "slug": "elevenlabs",
  "display_name": "ElevenLabs",
  "base_url": "https://api.elevenlabs.io",
  "service_type": "tts",
  "auth_mode": "header",
  "is_enabled": true,
  "supports_async_jobs": false,
  "supports_streaming": true,
  "default_timeout_seconds": 60,
  "credential_name": "elevenlabs",
  "credential_policy": {
    "allow_tenant_key": true,
    "allow_platform_key": true,
    "default_source": "tenant",
    "fallback_to_platform_key": true
  },
  "credential_schema": {
    "key": "string"
  },
  "endpoints": [
    {
      "slug": "list-voices",
      "path_template": "/v1/voices",
      "http_method": "GET",
      "request_mode": "json",
      "response_mode": "json",
      "supports_streaming": false,
      "callback_mode": "none",
      "is_enabled": true
    },
    {
      "slug": "list-models",
      "path_template": "/v1/models",
      "http_method": "GET",
      "request_mode": "json",
      "response_mode": "json",
      "supports_streaming": false,
      "callback_mode": "none",
      "is_enabled": true
    },
    {
      "slug": "tts",
      "path_template": "/v1/text-to-speech/{voice_id}",
      "http_method": "POST",
      "request_mode": "json",
      "response_mode": "binary",
      "supports_streaming": true,
      "callback_mode": "none",
      "is_enabled": true
    }
  ]
}
```

**Client example (JavaScript):**
```javascript
async function discoverServices() {
  const response = await fetch(
    `https://api.iblai.app/dm/api/ai-proxy/orgs/${org}/services/`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Api-Token ${apiKey}`,
      }
    }
  );
  return response.json();
}

async function getServiceDetails(serviceSlug) {
  const response = await fetch(
    `https://api.iblai.app/dm/api/ai-proxy/orgs/${org}/services/${serviceSlug}/`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Api-Token ${apiKey}`,
      }
    }
  );
  return response.json();
}

// Usage
const services = await discoverServices();
for (const service of services) {
  console.log(`Service: ${service.display_name}`);
  const details = await getServiceDetails(service.slug);
  console.log(`  Endpoints: ${details.endpoints.map(e => e.slug).join(', ')}`);
}
```

## Invoking service endpoints

Once you know the available services and endpoints, use the gateway endpoint to make
API calls.

### Base URL

```
POST https://api.iblai.app/dm/api/ai-proxy/orgs/{org}/services/{service}/{action}/
```

**Parameters:**

| Parameter | Description |
|-----------|-------------|
| `org` | Your org key |
| `service` | Service provider slug (from discovery) |
| `action` | Action/endpoint slug (from service details) |

### Request format

All endpoints accept a JSON body with the following optional fields:

```json
{
  "body": {},           // JSON body to send to upstream API
  "query": {},          // Query parameters
  "headers": {},        // Additional headers
  "path_params": {},    // Path template parameters (for URLs like /v1/text-to-speech/{voice_id})
  "files": {}           // For multipart uploads
}
```

> The verified skill documents **no `files` key** — for `multipart` / `binary`
> endpoints, send a real multipart request (JSON-string form fields + attached
> file(s), read from `request.FILES` server-side) rather than a `files` JSON key.
> See the skill's **Concepts** section.

## Quick reference

| Concept | Description |
|---------|-------------|
| **Service Discovery** | Use `/services/` endpoints to find available services and endpoints |
| **Gateway Endpoint** | `https://api.iblai.app/dm/api/ai-proxy/orgs/{org}/services/{service}/{action}/` |
| **Path Parameters** | Extract from `path_template` (e.g., `{voice_id}` in `/v1/text-to-speech/{voice_id}`) |
| **Response Modes** | `json`, `binary`, `passthrough`, `stream` |
| **Authentication** | Platform admin `Api-Token` in the `Authorization` header |
| **Credentials** | Must be configured per service by a platform admin (see `errors.md`) |

## Related pages

- [Integration guide](integration-guide.md) — path templates, response modes, dynamic client
- [ElevenLabs action catalog](elevenlabs.md) — text-to-speech endpoints
- [HeyGen action catalog](heygen.md) — video generation endpoints
- [Error handling & setup](errors.md) — error responses and credential setup
