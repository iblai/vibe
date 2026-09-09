# External Service Proxy — error handling & setup

> Doc-sourced explanatory material complementing the verified endpoints in
> [`/iblai-api-external-service-proxy`](../SKILL.md). Preserves the full error
> surface (every status, causes + solutions), credential setup and policy
> resolution, troubleshooting, and best-practice client code from the developer docs.

This guide covers error responses, credential configuration, and troubleshooting for
the External Service Proxy API.

## Error responses

The External Service Proxy API returns standard HTTP status codes with JSON error
details. The body is keyed by `detail` (DRF) **or** `error` (credential-policy) — read
`detail || error`.

### 404 Not Found

**Service or endpoint not found:**

```json
{
  "detail": "External proxy service 'unknown' not found or disabled."
}
```

**Causes:**
- The service slug is incorrect or the service is not enabled
- The endpoint/action slug is invalid
- The service has been disabled in the platform configuration

**Solution:**
- Use the [service discovery](overview.md#service-discovery) endpoints to get valid service and endpoint slugs
- Verify the service is enabled in your organization settings
- Check for typos in service or action names

**Credentials not configured:**

```json
{
  "detail": "No allowed credentials found for external proxy service 'elevenlabs'."
}
```

**Causes:**
- No credentials have been configured for the service
- Credentials exist but are not accessible due to policy restrictions

**Solution:**
- Configure credentials for the service (see [Setting up credentials](#setting-up-credentials))
- Verify credential policy allows your organization to use the credentials
- Check that credentials are properly saved and active

### 400 Bad Request

**Invalid request or credential policy error:**

```json
{
  "error": "Credential policy does not allow any credential source."
}
```

**Causes:**
- The credential policy configuration is invalid
- Required path parameters are missing
- Request body format is incorrect

**Solution:**
- Verify all required `path_params` are provided (extract from `path_template`)
- Ensure request body matches the expected format
- Check the credential policy configuration in admin settings

**Missing path parameters:**

```json
{
  "error": "Missing required path parameter: voice_id"
}
```

**Causes:**
- Required path parameters from the `path_template` were not provided in `path_params`

**Solution:**
- Parse the endpoint's `path_template` to identify required parameters
- Include all parameters in the `path_params` field
- See [Understanding path templates](integration-guide.md#understanding-path-templates) for details

### 401 Unauthorized

**Authentication failed:**

```json
{
  "detail": "Authentication credentials were not provided."
}
```

```json
{
  "detail": "Invalid token."
}
```

**Causes:**
- Missing `Authorization` header
- Invalid API key or token
- Expired token

**Solution:**
- Include the `Authorization` header in your request
- Verify your API key or token is correct
- Generate a new API key if needed
- Check token expiration and refresh if necessary

### 403 Forbidden

**Permission denied:**

```json
{
  "detail": "You do not have permission to perform this action."
}
```

**Causes:**
- Token lacks necessary permissions (not a platform admin)
- Organization does not have access to the service
- Feature not enabled for your plan

**Solution:**
- Verify the token belongs to a platform admin with the required permissions
- Contact your administrator to enable the service
- Check your organization's plan and feature access

### 502 Bad Gateway

**Upstream service error:**

```json
{
  "detail": "The upstream external service request failed."
}
```

**Causes:**
- The external service (ElevenLabs, HeyGen, etc.) returned an error
- Network issues connecting to the external service
- Invalid credentials provided to the upstream service
- Rate limiting or quota exceeded on the external service

**Solution:**
- Check the external service's status page for outages
- Verify your credentials are valid and have sufficient quota
- Review the request payload for errors in the `body` field
- Check if you've exceeded the external service's rate limits
- Wait and retry the request (implement exponential backoff)

## Setting up credentials

Credentials must be configured for each service before you can use the External
Service Proxy API. This is done out-of-band by a platform administrator (via
`/iblai-api-integration` / the admin panel) — it is not part of this API.

### Credential configuration table

| Service | Credential Name | Schema | Where to Get |
|---------|-----------------|--------|--------------|
| ElevenLabs | `elevenlabs` | `{"key": "your-api-key"}` | [ElevenLabs Profile Settings](https://elevenlabs.io/app/settings/api-keys) |
| HeyGen | `heygen` | `{"key": "your-api-key"}` | [HeyGen API Keys](https://app.heygen.com/settings/api-keys) |

### Configuration steps

1. **Obtain API credentials from the external service:**
   - Log in to the external service's platform
   - Navigate to API settings or developer settings
   - Generate a new API key if needed
   - Copy the API key securely

2. **Configure credentials in the platform:**
   - Log in to the admin panel
   - Navigate to External Service settings
   - Select the service (e.g., ElevenLabs, HeyGen)
   - Enter the credential information in the required format
   - Save the configuration

3. **Test the credentials:**
   - Use a simple list endpoint to verify connectivity
   - Example: Call `list-voices` for ElevenLabs or `list-avatars` for HeyGen
   - If successful, the credentials are properly configured

### Credential policy

Each service has a credential policy that determines how credentials are resolved:

| Policy Setting | Description |
|----------------|-------------|
| `allow_tenant_key` | Allow using organization-specific credentials |
| `allow_platform_key` | Allow using platform-wide credentials |
| `default_source` | Default credential source (`tenant` or `platform`) |
| `fallback_to_platform_key` | Fall back to platform credentials if org credentials not found |

**Example credential policy:**
```json
{
  "allow_tenant_key": true,
  "allow_platform_key": true,
  "default_source": "tenant",
  "fallback_to_platform_key": true
}
```

This policy means:
1. Try to use the org's own credentials first (the `tenant` source)
2. If org credentials are not found, fall back to platform credentials
3. Both credential sources are allowed

> The seeded default for both ElevenLabs and HeyGen is **tenant-key-only**
> (`allow_platform_key: false`, no fallback) — the org must hold its own provider
> key. No allowed source → `400`; source allowed but key absent → `404`.

## Troubleshooting

### Issue: "Service not found or disabled"

**Symptoms:**
- 404 error when calling any endpoint for a service
- Service doesn't appear in the discovery list

**Solutions:**
1. Check if the service is enabled in platform settings
2. Verify you're using the correct service slug
3. Use the List Services endpoint to see available services
4. Contact administrator to enable the service

### Issue: "No credentials found"

**Symptoms:**
- 404 error mentioning credentials
- Service appears in discovery but endpoints fail

**Solutions:**
1. Configure credentials for the service (see [Setting up credentials](#setting-up-credentials))
2. Verify credential policy allows your organization
3. Check that credentials are active and not expired
4. Test credentials directly with the external service

### Issue: "Upstream request failed"

**Symptoms:**
- 502 Bad Gateway errors
- Intermittent failures

**Solutions:**
1. Check external service status page for outages
2. Verify your credentials with the external service directly
3. Check if you've hit rate limits or quota
4. Review request payload for errors
5. Implement retry logic with exponential backoff
6. Contact external service support if issues persist

### Issue: "Missing path parameter"

**Symptoms:**
- 400 error mentioning missing parameters
- Requests fail with path parameter errors

**Solutions:**
1. Parse the endpoint's `path_template` to identify required params
2. Include all parameters in the `path_params` field
3. Use the [dynamic client](integration-guide.md#complete-dynamic-integration-example) which validates parameters automatically
4. Check the [endpoint documentation](elevenlabs.md) for parameter requirements

### Issue: "Rate limiting"

**Symptoms:**
- 429 Too Many Requests errors
- Requests failing after many successful calls

**Solutions:**
1. Implement rate limiting on your side
2. Add retry logic with exponential backoff
3. Check your external service plan limits
4. Upgrade your external service plan if needed
5. Cache responses when possible to reduce API calls

### Issue: "Response type mismatch"

**Symptoms:**
- Error parsing JSON when expecting audio/video
- Blob when expecting JSON

**Solutions:**
1. Check the endpoint's `response_mode` in service details
2. Use appropriate response handling based on mode
3. Implement [response mode handling](integration-guide.md#understanding-response-modes)
4. Check Content-Type header in the response
5. Use the dynamic client which handles response types automatically

## Best practices

### 1. Error handling

Always implement proper error handling:

```javascript
async function safeInvoke(client, service, action, payload) {
  try {
    return await client.invoke(service, action, payload);
  } catch (error) {
    if (error.message.includes('404')) {
      console.error('Service or endpoint not found:', service, action);
      // Handle missing service/endpoint
    } else if (error.message.includes('502')) {
      console.error('Upstream service failed, retrying...');
      // Implement retry logic
    } else if (error.message.includes('credentials')) {
      console.error('Credentials not configured');
      // Alert administrator
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}
```

### 2. Retry logic

Implement exponential backoff for transient failures:

```javascript
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 3. Credential validation

Test credentials before production use:

```javascript
async function validateCredentials(client, service) {
  try {
    // Try a simple list endpoint
    if (service === 'elevenlabs') {
      await client.invoke('elevenlabs', 'list-voices', {});
    } else if (service === 'heygen') {
      await client.invoke('heygen', 'list-avatars', {});
    }
    console.log(`${service} credentials valid`);
    return true;
  } catch (error) {
    console.error(`${service} credentials invalid:`, error);
    return false;
  }
}
```

### 4. Logging

Log important events for debugging:

```javascript
class LoggingProxyClient extends ExternalProxyClient {
  async invoke(serviceSlug, actionSlug, payload = {}) {
    console.log(`[ProxyAPI] Invoking ${serviceSlug}/${actionSlug}`);
    const startTime = Date.now();

    try {
      const result = await super.invoke(serviceSlug, actionSlug, payload);
      const duration = Date.now() - startTime;
      console.log(`[ProxyAPI] Success in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[ProxyAPI] Failed after ${duration}ms:`, error.message);
      throw error;
    }
  }
}
```

## Related pages

- [Overview & service discovery](overview.md) — authentication and service discovery
- [Integration guide](integration-guide.md) — path templates and dynamic client
- [ElevenLabs action catalog](elevenlabs.md) — text-to-speech endpoints
- [HeyGen action catalog](heygen.md) — video generation endpoints
