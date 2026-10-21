---
name: iblai-vibe-chrome-extension
description: Use the ibl.ai Chrome extension, one of your organization's agents in a side panel beside any web page. It reads the page you are on and, with Cowork on, clicks and types on it for you. Covers adding it from the Chrome Web Store, signing in, picking an agent, Cowork's Approvals (Ask Me or Automatic), the bar Chrome shows while it works, what it never touches, and what to do when a run stops. Nothing to build. Use when the user mentions 'Chrome extension', 'side panel', 'use my agent on any website', 'browse for me', 'fill in this form for me', 'Cowork in Chrome', or 'the ibl.ai bar in Chrome'. For the desktop app's Code mode see /iblai-vibe-os-agent-code-mode; for letting an agent see the screen inside your own app see /iblai-vibe-agent-screenshare.
globs:
alwaysApply: false
metadata:
  kind: guide
---

# /iblai-vibe-chrome-extension

The **ibl.ai** Chrome extension puts one of your organization's agents in a
side panel beside any web page. The agent reads the page you are on and
answers about it; with **Cowork** on it also clicks, types, scrolls and moves
between pages for you, the way you would, and asks first if you tell it to.
There is nothing to build: add it to Chrome and sign in with your ibl.ai
account.

![The ibl.ai side panel beside a GitHub search with Cowork on: the agent has read the page and asks what the project is about, and Chrome's bar at the top says ibl.ai started debugging this browser](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-chrome-extension/iblai-vibe-chrome-extension-1-cowork-run.png)

## Using the extension

### 1. Add it to Chrome

Open the [Chrome Web Store listing](https://chromewebstore.google.com/detail/gppjhejgkdljdhnmlfghfbalfhgaepfd)
and click **Add to Chrome**. Chrome lists what the extension may do on the
pages you visit and asks you to allow it; reading a page and acting on it
needs all of that. Pin the ibl.ai icon to the toolbar so it stays in reach.

You need Chrome on a computer and an ibl.ai account, the one you use on
[os.ibl.ai](https://os.ibl.ai).

### 2. Open the panel and sign in

Click the ibl.ai icon: the side panel opens beside your tabs. The first time
it shows one button, **Sign in**. Sign in with your ibl.ai account and the
panel becomes your chat, the same one as on os.ibl.ai, with the agent you
last talked to.

To talk to another of your organization's agents, open the menu at the top
left and click **Agents**, then pick one. The same menu holds your
conversations, and the pencil icon at the top right starts a new chat.

### 3. Ask about the page

Even with Cowork off, the agent is handed the text of the tab you are on.
"Summarize this page", "what does this form want from me", "find the
cancellation policy on this page" all work on any ordinary web page.

Ordinary means a page whose address starts with `http` or `https`. Chrome's
own pages (settings, the new-tab page) and the Chrome Web Store cannot be
read by any extension; the panel says so: *I can’t read this page — the
browser doesn’t allow it.*

### 4. Let it act: Cowork

Cowork is on when the panel opens. Click the **Cowork** pill under the
message box to see its panel: the switch, a line on what Cowork does to the
tab, and **Approvals**.

Type what you want done ("find projects that can help me with my final
project at uni", "book the next free appointment", "fill in this form with
my details") and send it. The agent reads the page as a numbered list of
everything on it, plus a picture of the tab, decides one step, does it,
reads the page again, and goes on until it has an answer for you.

While it works, Chrome shows a bar at the top of the window:
*"ibl.ai" started debugging this browser*. That is how Chrome says an
extension is clicking and typing on a page for you. The bar stays for the
run and goes away when the run ends; **Cancel** on the bar ends the run.

Each step shows on the reply under **Used 1 tool**: open it to see what the
agent clicked, typed into or opened, and its own notes along the way. What
it typed is never shown. Those rows appear when **Enable Verbose Reasoning**
is on in the agent's Settings tab
([`/iblai-vibe-agent-setting`](../iblai-vibe-agent-setting/SKILL.md)).

![The same run after one more message: the agent searched GitHub for data science repositories and lists eight picks with their stars](https://raw.githubusercontent.com/iblai/vibe/refs/heads/main/skills/agents/iblai-vibe-chrome-extension/iblai-vibe-chrome-extension-2-reply.png)

**Approvals** decides whether it checks with you first:

- **Automatic** — the default. Cowork clicks, types and submits without
  asking. Use it only on sites you trust.
- **Ask Me** — before it submits a form, pays, sends or deletes anything, a
  card appears in the reply: **Allow** lets that one step through, **Deny**
  stops it.

Good to know:

- Stay on the tab while it works. It acts on the tab the run started on, and
  the picture it takes is of the tab in front.
- The stop button that replaces Send ends the run at any time. Closing the
  panel ends it too.
- One run at a time: a second message while one is running is answered
  with *A run is already in progress.*

### 5. When it stops

A run takes at most forty steps in one go. When it gets there, the reply
ends with *I stopped here: that’s as many steps as I take in one go. Send
“continue” and I’ll pick up where I left off, as long as this panel stays
open.* Send **continue**, or say what to do next: the conversation lasts as
long as the panel stays open.

### What it never does

- Type into a password or payment field. It refuses, says so in the reply,
  and asks you to type those yourself. Such a field's contents are never
  read, and no picture of the tab is taken while one is on the page.
- Act on anything but ordinary web pages. Chrome's own pages, the Web Store
  and other extensions are off limits.
- Carry on after you click **Cancel** on the bar or open Chrome's developer
  tools on that tab. The run ends with a message; start it again when you
  are ready.

### What leaves the browser

What the agent reads of the page (its text, the list of what is on it and a
picture of the visible part of the tab) goes to ibl.ai with your own
session, to decide the next step. Nothing else leaves the browser, and text
it typed for you never shows in the panel. Cowork runs on your
organization's models and credits, like a chat does: a model that reads
pictures (Claude, GPT, Gemini) gets the picture of the tab on every step;
ibl.ai Pro works from the text alone.

### When something's off

| The panel says | What to do |
|---|---|
| *Your session is no longer valid. Sign in again.* | Click **Sign in** in the panel. |
| *Not enough credits on this platform.* | Your organization is out of credits; an admin tops them up under Billing. |
| *… can’t be driven — only http and https pages can.* | Switch to an ordinary web page and send again. |
| *Real clicks can’t start while the developer tools are open on this tab.* | Close the developer tools on that tab, then send again. |
| *Real clicks were stopped from the bar on the tab or by the developer tools, so the run ended.* | Send again, and leave the bar alone until it finishes. |
| *The extension stopped responding, so the run ended.* | Send again. If it keeps happening, close and reopen the panel. |
| *No models are available on this platform.* | An admin turns a model on for your organization first. |
| *I stopped here: that’s as many steps as I take in one go.* | Send **continue**. |
| *I stopped here: that’s as much as I can read in one go.* | Send **continue** as well. |

## Good to know

- The agent answers in the first of Chrome's preferred languages
  (`chrome://settings/languages`) unless you write to it in another one.
- The panel is the same chat as os.ibl.ai: Canvas, voice and your
  conversations are all there.
- For developers: the extension is open source in the ibl.ai OS repository,
  [`extensions/chrome`](https://github.com/iblai/os/tree/main/extensions/chrome),
  where the panel can be pointed at another build of the app.

## Related skills

- [`/iblai-vibe-os-agent-code-mode`](../iblai-vibe-os-agent-code-mode/SKILL.md) — the desktop app's Code mode: the agent edits files and runs commands on your computer.
- [`/iblai-vibe-agent-screenshare`](../iblai-vibe-agent-screenshare/SKILL.md) — letting an agent see the screen from inside your own app.
- [`/iblai-vibe-agent-chat`](../iblai-vibe-agent-chat/SKILL.md) — the chat surface the panel shows.
- [`/iblai-vibe-agent-setting`](../iblai-vibe-agent-setting/SKILL.md) — the agent's Settings tab, where Verbose Reasoning lives.
