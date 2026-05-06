# GifMe AI

Take a selfie. AI animates you into 10 reaction memes.

GifMe AI is a React Native (Expo) app that turns your selfie into short
reaction videos using AI image-to-video models. The selfie never leaves your
device except as a request payload to our Firebase Cloud Function, which
proxies fal.ai's image-to-video endpoint (Pika v2.2 by default). Generated
clips save to your Photos library as MP4s that auto-loop.

## Stack

- **Expo / React Native** (`~54.x`, React `19.1`)
- **expo-camera** — selfie capture (front camera by default)
- **expo-image-picker** — upload selfie from library as an alternative
- **expo-video** — inline preview of generated clips
- **expo-media-library** — save generated MP4s to Photos
- **Firebase Cloud Functions** — server-side proxy that calls fal.ai
  with an API key that never ships in the app bundle
- **@fal-ai/client** — official fal.ai client (used inside the function)
- No navigation library — tiny 3-screen state machine lives in `App.tsx`

## How it works

1. User taps **Snap a selfie →** (or **Upload from library**) on the home
   grid of meme templates (each template is a name + caption + prompt)
2. `CameraScreen` captures a JPEG via `expo-camera`, or `expo-image-picker`
   returns a selected image
3. For each template, `pipeline.ts`:
   - Encodes the selfie as a base64 data URL
   - Calls the `generateMemeVideo` Cloud Function with the selfie + the
     template's prompt + duration
   - The function forwards the request to fal.ai's Pika v2.2 endpoint
     (overridable per-call via the `model` field)
   - Downloads the returned MP4 to local cache
4. `ResultsScreen` shows progress per template (encode → generate →
   download), plays each finished clip inline (looping, muted), and
   offers **Save all to Photos**

Templates run with bounded concurrency (3 in flight) to balance throughput
against the function instance pool and per-job billing.

## Setup

### Client

```bash
npm install
cp .env.example .env   # fill in the Firebase web config values
npm run ios            # or: npm run android
```

Firebase config values come from
`https://console.firebase.google.com/project/<your-project>/settings/general/`
(the "Your apps" panel). These are safe to ship in the bundle.

### Cloud Function (image-to-video proxy)

```bash
cd functions
npm install
firebase login          # Google account that owns the project
firebase use <project-id>
firebase functions:secrets:set FAL_KEY   # paste your fal.ai key
firebase deploy --only functions
```

Requires the **Blaze** (pay-as-you-go) plan because the function makes
outbound calls to fal.ai. At Pika v2.2 720p, each 5s clip costs ~$0.20,
so a full 10-template run is ~$2.

## Project layout

```
App.tsx                       # screen state machine
src/screens/HomeScreen.tsx    # template grid + CTAs (camera / library)
src/screens/CameraScreen.tsx  # selfie capture w/ face ring overlay
src/screens/ResultsScreen.tsx # per-template progress + inline video + save-all
src/lib/pipeline.ts           # encode → generate → download pipeline
src/lib/firebase.ts           # Firebase client + `callGenerateMemeVideo` wrapper
src/lib/base64.ts             # file ↔ data URL helpers
src/lib/templates.ts          # curated meme prompt list
src/theme.ts                  # design tokens
functions/src/index.ts        # `generateMemeVideo` HTTPS callable (proxies fal.ai)
```
