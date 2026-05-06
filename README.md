# GifMe AI

Take a selfie. Get your face on every meme GIF on the internet.

GifMe AI is a React Native (Expo) app that swaps your face onto a grid of
popular meme GIFs. The selfie never leaves your device except as a request
payload to our Firebase Cloud Function, which proxies Replicate's
`cdingram/face-swap` model. Generated GIFs save to your Photos library.

## Stack

- **Expo / React Native** (`~54.x`, React `19.1`)
- **expo-camera** — selfie capture (front camera by default)
- **expo-image-picker** — upload selfie from library as an alternative
- **expo-media-library** — save generated GIFs to Photos
- **Firebase Cloud Functions** — server-side proxy that calls Replicate
  (`cdingram/face-swap`) with a token that never ships in the app bundle
- **omggif + gifenc + jpeg-js** — pure-JS GIF decode, JPEG (de)encode, GIF encode
- No navigation library — tiny 3-screen state machine lives in `App.tsx`

## How it works

1. User taps **Snap a selfie →** (or **Upload from library**) on the home
   grid of meme templates
2. `CameraScreen` captures a JPEG via `expo-camera`, or `expo-image-picker`
   returns a selected image
3. For each template, `pipeline.ts`:
   - Downloads the meme GIF
   - Decodes it into RGBA frames (`omggif`)
   - For each frame: JPEG-encodes it, calls the `faceSwap` Cloud Function
     with the selfie as `swapImage`, downloads + decodes the result
   - Re-encodes all swapped frames into a new GIF (`gifenc`)
4. `ResultsScreen` shows progress per template and offers **Save all to Photos**

Frame swaps run with bounded concurrency (4 per template) so one slow
template doesn't stall the whole batch.

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

### Cloud Function (face-swap proxy)

```bash
cd functions
npm install
firebase login          # Google account that owns the project
firebase use <project-id>
firebase functions:secrets:set REPLICATE_API_TOKEN   # paste your token
firebase deploy --only functions
```

Requires the **Blaze** (pay-as-you-go) plan because the function makes
outbound calls to Replicate. Usage is typically pennies for development.

## Project layout

```
App.tsx                       # screen state machine
src/screens/HomeScreen.tsx    # template grid + CTAs (camera / library)
src/screens/CameraScreen.tsx  # selfie capture w/ face ring overlay
src/screens/ResultsScreen.tsx # per-template progress + save-all
src/lib/pipeline.ts           # fetch → decode → swap → encode pipeline
src/lib/firebase.ts           # Firebase client + `callFaceSwap` wrapper
src/lib/gif.ts                # omggif / gifenc wrappers
src/lib/base64.ts             # file ↔ data URL helpers
src/lib/templates.ts          # curated meme GIF list
src/theme.ts                  # design tokens
types/                        # ambient types for omggif + gifenc
functions/src/index.ts        # `faceSwap` HTTPS callable (proxies Replicate)
```
