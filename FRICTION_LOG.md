# Friction log

Notes taken while building Agent Arena against `@composio/core@0.22.0`, `@composio/google@0.12.0` and `@google/genai@1.52.0`. Each entry says what happened, why it cost time, and a concrete suggestion.

## 1. `npm install` quietly picked SDK versions from months ago

**What happened.** Following the `@composio/google` README (`npm install @composio/core @composio/google @google/genai`) installed `@composio/core@0.17.0` and `@composio/google@0.10.2`, even though `0.22.0` and `0.12.0` were current. The reason: `@composio/google` declares `peerDependencies: { "@google/genai": "^1.1.0" }`, but the latest `@google/genai` is `2.x`. npm worked around the conflict by downgrading instead of failing. I only noticed because a later install failed on an unrelated peer conflict.

**Suggestion.** Widen the peer range to `^1.1.0 || ^2.0.0` (or whatever has been tested), and pin a tested `@google/genai` major in the README's install line.

## 2. Sessions vs. `tools.get`: which to use when the tool list has to be fixed?

**What happened.** The `@composio/core` README now leads with `composio.create(userId)` sessions and calls `composio.tools.get` / `tools.execute` "legacy". Sessions expose meta tools (search, then execute) by default. For a benchmark, both agents must see the exact same small set of tools, and tool discovery must not count as part of the race. The README doesn't say whether a session can be pinned to an explicit list of slugs, so I used `tools.get(userId, { tools: [...] })`.

**Suggestion.** Add a short "I need a fixed, explicit tool list" section that shows the session equivalent, or says `tools.get` is still the right tool for that job. "Legacy" makes a reviewer wonder whether the code is already outdated.

## 3. Toolkit versions are required, and the SDK doesn't help you find them

**What happened.** `tools.execute` throws `ComposioToolVersionRequiredError` unless a toolkit version is pinned (or `dangerouslySkipVersionCheck` is set). The error's docstring explains the fix well. But nothing in the SDK README says where to get a version string like `20250909_00`. I found current versions through the CLI (`composio execute GITHUB_LIST_REPOSITORY_ISSUES --get-schema`, which prints `version`).

**Suggestion.** Mention the CLI command in the error message itself. Alternatively, add `composio.toolkits.latestVersions(['github', 'notion'])` so an app can print a ready-to-paste `toolkitVersions` object.

## 4. Two execution paths return different shapes

**What happened.** `composio.provider.executeToolCall()` (the path the Google README shows) returns a JSON **string** that you `JSON.parse`, while `composio.tools.execute()` returns a typed `{ successful, data, error }` object. For instrumentation (timing plus success/error per call), the typed object is far nicer, so I used `tools.execute` and built the Gemini `functionResponse` myself.

**Suggestion.** Have `executeToolCall` return the typed result too (or offer a typed variant), and show error handling in the provider README. Right now a failed tool call and a successful one look identical until you parse the string.

## 5. Provider README examples assume a paid model and a different env var

**What happened.** The Google provider quickstart uses `gemini-3-pro-preview` (not on the Gemini free tier) and `GOOGLE_API_KEY`, while AI Studio and most Gemini docs say `GEMINI_API_KEY`. Neither is wrong, but a first run on a free key fails with a quota error that looks like a Composio problem.

**Suggestion.** Use a free-tier model in the quickstart (e.g. `gemini-3.8-flash`; the 2.5 models now return 404 for new keys) and note that the key variable name is the app's choice.

## 6. Two kinds of "API key" on the dashboard

**What happened.** The first key I was handed was a `ck_…` key from the dashboard's API Key page. That page says it goes in the `x-consumer-api-key` header to "authenticate MCP clients". The SDK rejected it with `401 Invalid API key: ck_**dbPn`. The SDK needs a project API key instead. The error's `suggested_fix` ("Please check you are using a valid API key") doesn't say which kind of key is expected.

**Suggestion.** When the SDK receives a key with the consumer prefix, say so: "This looks like a consumer (MCP) key; the SDK needs a project API key from Project Settings → API Keys." That one line would have saved a round trip.

## 7. `toolkits.authorize()` calls an endpoint the API no longer accepts

**What happened.** `composio.toolkits.authorize(userId, 'github')` is documented in the SDK (JSDoc example included) as the one-call way to connect a user. With SDK 0.22.0 it fails for Composio-managed OAuth:

```
400 Creating connections on this endpoint for Composio-managed OAuth auth configs is no longer supported.
Use POST /api/v3/connected_accounts/link instead.
```

The server-side error is excellent: it names the replacement. But the SDK's own high-level helper is what sends the rejected request. Worse, `authorize()` creates the auth config *before* failing, so each attempt leaves a side effect behind. The fix was to find or create the auth config with `authConfigs.list/create`, then call `connectedAccounts.link(userId, authConfigId)`.

**Suggestion.** Point `toolkits.authorize()` at the link endpoint internally (its signature can stay the same), or deprecate it with a runtime warning that names `connectedAccounts.link`.

## 8. `GoogleProvider` output is rejected by Gemini for common tools

**What happened.** The first real Gemini call with `GITHUB_LIST_REPOSITORY_ISSUES`, `NOTION_CREATE_NOTION_PAGE` and `NOTION_SEARCH_NOTION_PAGE` failed before the model ran:

```
400 Invalid JSON payload received. Unknown name "examples" at
'tools[0].function_declarations[0].parameters.properties[0].value': Cannot find field.
```

`GoogleProvider.wrapTool` dereferences `$ref`s and fixes `required` arrays, but it passes JSON Schema keywords like `examples` straight through. Gemini's `Schema` type doesn't accept them, and it rejects the entire request rather than ignoring the field. This is the exact path the provider README shows, so for these toolkits the quickstart fails on its first call.

**Workaround.** [`src/lib/gemini-schema.ts`](src/lib/gemini-schema.ts) keeps an allow-list of the keywords Gemini supports and recurses through `properties`, `items` and `anyOf`. The care is in not filtering property *names* (a parameter can legitimately be called `examples`).

**Suggestion.** Do this allow-list filtering inside `GoogleProvider.wrapTool`, or emit `parametersJsonSchema` (which accepts full JSON Schema) instead of `parameters`. Add a provider test that sends every schema keyword Composio tools use to the real Gemini API.
