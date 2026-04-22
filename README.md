# GifMe

Take a selfie. Get your face on every meme GIF on the internet.

GifMe is a React Native (Expo) app that swaps your face onto a grid of popular
meme GIFs using Replicate's face-swap model. Generated GIFs save to your
Photos library.

## Stack

- **Expo / React Native** (`~54.x`, React `19.1`)
- **expo-camera** — selfie capture (front camera by default)
- **expo-media-library** — save generated GIFs to Photos
- **Replicate HTTP API** — `cdingram/face-swap` for per-frame face injection
- **omggif + gifenc + jpeg-js** — pure-JS GIF decode, JPEG (de)encode, GIF encode
- No navigation library — tiny 3-screen state machine lives in `App.tsx`

## How it works

1. User taps **Snap a selfie →** on the home grid of meme templates
2. `CameraScreen` captures a JPEG via `expo-camera`
3. For each template, `pipeline.ts`:
   - Downloads the meme GIF
   - Decodes it into RGBA frames (`omggif`)
   - For each frame: JPEG-encodes it, calls Replicate face-swap with the
     selfie as `swap_image`, downloads + decodes the result
   - Re-encodes all swapped frames into a new GIF (`gifenc`)
4. `ResultsScreen` shows progress per template and offers **Save all to Photos**

Frame swaps run with bounded concurrency (4 per template) so one slow
template doesn't stall the whole batch.

## Setup

```bash
npm install
cp .env.example .env   # then fill in REPLICATE_API_TOKEN
npm run ios            # or: npm run android
```

Create a Replicate token at https://replicate.com/account/api-tokens.
Face-swap predictions are ~$0.02–0.05 each; a full 10-template run with
~10 frames per GIF costs a couple dollars.

## Project layout

```
App.tsx                      # screen state machine
src/screens/HomeScreen.tsx   # template grid + CTA
src/screens/CameraScreen.tsx # selfie capture w/ face ring overlay
src/screens/ResultsScreen.tsx# per-template progress + save-all
src/lib/pipeline.ts          # fetch → decode → swap → encode pipeline
src/lib/replicate.ts         # HTTP client for Replicate predictions API
src/lib/gif.ts               # omggif / gifenc wrappers
src/lib/base64.ts            # file ↔ data URL helpers
src/lib/templates.ts         # curated meme GIF list
src/theme.ts                 # design tokens
types/                       # ambient types for omggif + gifenc
```
