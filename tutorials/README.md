# Tutorials

End-to-end walkthroughs that combine several `/iblai-api-*` skills into a working result.

Where a skill answers *"what is the endpoint for X?"*, a tutorial answers *"how do I build the whole thing?"* — the order of operations, the parts that aren't REST calls, and the failure modes worth knowing before you hit them.

| Tutorial | What you build | Skills used |
|---|---|---|
| **[voice-agent](voice-agent/)** | An agent running on your own server that can place outbound phone calls | `/iblai-api-login`, `/iblai-api-agent-create`, `/iblai-api-agent-sandbox` |

## Conventions in these tutorials

- **No real credentials.** Every key, token, and phone number is a placeholder. Shell variables (`$IBLAI_API_KEY`, `$TWILIO_AUTH_TOKEN`, …) mark the substitution points.
- **Base URL** is `https://api.iblai.app/dm`, and every request carries `Authorization: Api-Token $IBLAI_API_KEY`. See [`/iblai-api-login`](../skills/iblai-api-login/SKILL.md) for how to obtain the token.
- **Commands are copy-pasteable** once you export the variables listed at the top of each tutorial.
