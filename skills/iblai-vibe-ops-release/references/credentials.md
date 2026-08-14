# Store credentials — how to obtain and place them

Every value below maps to a variable in `fastlane/.env` (see
[`../assets/fastlane/.env.example`](../assets/fastlane/.env.example)). Keep the
key files inside `fastlane/` and gitignore them.

---

## Apple — App Store Connect API key (`.p8`)

Used by `make ios-build` (managed signing) and both iOS Fastlane lanes.

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com/) with an
   **Account Holder / Admin**.
2. **Users and Access → Integrations → App Store Connect API** (the "Team Keys"
   tab).
3. **Generate API Key**. Give it the **App Manager** role (minimum needed to
   create apps and upload builds).
4. **Download the key** — you get `AuthKey_XXXXXXXXXX.p8` **once**. Move it to
   `fastlane/AuthKey_XXXXXXXXXX.p8`.
5. Read off the table:
   - **Key ID** → `ASC_KEY_ID`
   - **Issuer ID** (top of the page) → `ASC_ISSUER_ID`
   - the file path → `ASC_KEY_FILEPATH=./fastlane/AuthKey_XXXXXXXXXX.p8`
6. **Team ID** → `APPLE_TEAM_ID`: from the
   [Developer portal](https://developer.apple.com/account) → Membership details.
7. **Apple ID** → `APPLE_ID`: the email you sign in with (used by `produce`).

> **App creation fallback.** Uploading builds needs only the API key. Creating
> the app record (`make ios-create`) can still trigger an Apple-ID login. If it
> does, create an **app-specific password** at
> [account.apple.com](https://account.apple.com) → Sign-In and Security →
> App-Specific Passwords, and set
> `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD` in `fastlane/.env`. Or just
> create the app once in App Store Connect (**My Apps → +**) and skip the lane.

---

## Google — Play Developer service account (`.json`)

Used by `make android-create` (access check) and `make android-submit`
(`supply`).

1. In the [Play Console](https://play.google.com/console) → **Users and
   permissions → (⋯) → Setup service account / API access**, or directly in the
   [Google Cloud Console](https://console.cloud.google.com/):
   - Create (or pick) a project, enable the **Google Play Android Developer
     API**.
   - **IAM & Admin → Service Accounts → Create service account.**
   - On the new account: **Keys → Add key → Create new key → JSON.** Download it
     to `fastlane/play-service-account.json` → `SUPPLY_JSON_KEY_FILE`.
2. Back in **Play Console → Users and permissions → Invite new users**, invite
   the service-account email (`...@...iam.gserviceaccount.com`) and grant, for
   your app, **Release** permissions (Release manager / Admin for the first
   setup). Grant can take a few minutes to propagate.
3. Verify: `make android-create` (runs `validate_play_store_json_key`).

> **The first app + first upload are manual.** Google's API cannot create a new
> app listing, and it rejects `supply` until at least one `.aab` has been
> uploaded through the console. So, once per app:
> **Play Console → Create app**, then **Testing → Internal testing → Create
> release → upload one `.aab`** by hand. After that, `make android-submit`
> works for every release. Build a first `.aab` with `make android-build`.

---

## Android — release signing keystore

A release `.aab` must be signed. Generate an **upload key** once:

```bash
keytool -genkey -v -keystore ~/upload.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias upload
```

Point Tauri at it via `src-tauri/gen/android/keystore.properties`:

```properties
storeFile=/absolute/path/to/upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

Gitignore both `keystore.properties` and the `.jks`. With **Play App Signing**
(default for new apps) this is your *upload* key; Google holds the real app
signing key and re-signs the download — so losing the upload key is
recoverable, but keep it safe anyway.

---

## Where each value lands

| `.env` var | Source |
|---|---|
| `ASC_KEY_ID`, `ASC_ISSUER_ID` | App Store Connect → Integrations |
| `ASC_KEY_FILEPATH` | the downloaded `AuthKey_*.p8` |
| `APPLE_TEAM_ID` | Developer portal → Membership |
| `APPLE_ID` | your Apple sign-in email |
| `IOS_APP_IDENTIFIER` | your bundle id, e.g. `com.example.app` |
| `ANDROID_PACKAGE_NAME` | your Android package, e.g. `com.example.app` |
| `SUPPLY_JSON_KEY_FILE` | the Play service-account JSON |
| `PLAY_TRACK` | `internal` / `alpha` / `beta` / `production` |

---

## Extending beyond a binary upload

The generated lanes stop at TestFlight / the internal track on purpose. To go
further, edit `fastlane/Fastfile`:

- **Submit for App Store review** — swap `pilot` for
  [`deliver`](https://docs.fastlane.tools/actions/deliver/) with
  `submit_for_review: true`.
- **Promote an Android track** — add a lane calling
  [`supply(track_promote_to: "production")`](https://docs.fastlane.tools/actions/supply/).
- **Push listing metadata / screenshots** — flip the `skip_upload_*` flags in
  the `android submit` lane and add `fastlane/metadata` + `fastlane/screenshots`
  trees (`fastlane deliver init` / `fastlane supply init`).
