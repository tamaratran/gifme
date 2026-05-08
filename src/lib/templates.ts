/**
 * Curated list of meme reaction prompts. Each template animates the user's
 * selfie into a 5-second video via fal.ai image-to-video. The thumbnail GIF
 * shown in the (post-upload) results grid is just a hint at the vibe — the
 * actual generated clip will be the user's own face acting it out.
 *
 * The home screen no longer lets the user pre-pick a template; instead the
 * upload-a-selfie flow runs `DEFAULT_PROMPT_SUBSET` in parallel and lets the
 * user pick a favourite from the generated grid.
 */
export type MemeTemplate = {
  id: string;
  title: string;
  /** Short tagline shown under the title in the home grid. */
  caption: string;
  /** Animated GIF used purely as the grid thumbnail (vibe reference). */
  thumbnailUrl: string;
  /**
   * Text prompt sent to fal.ai. Describes the motion / expression the model
   * should drive the user's face into. Keep < 200 chars and action-focused.
   */
  prompt: string;
  /** Output clip length in seconds. Pika v2.2 supports 5 or 10. */
  duration: 5 | 10;
};

export const TEMPLATES: MemeTemplate[] = [
  {
    id: "say-what",
    title: "Say What",
    caption: "double-take of disbelief",
    thumbnailUrl: "https://media.giphy.com/media/l0HlL2vlfpWI0meJi/giphy.gif",
    prompt:
      "the person does a dramatic double-take, raises both eyebrows in disbelief, mouth slowly opens, head tilts forward",
    duration: 5,
  },
  {
    id: "party-hard",
    title: "Party Hard",
    caption: "vibing dance",
    thumbnailUrl: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
    prompt:
      "the person dances enthusiastically, head bobs side to side, big confident smile, energetic motion",
    duration: 5,
  },
  {
    id: "thumbs-up",
    title: "Thumbs Up",
    caption: "very nice approval",
    thumbnailUrl: "https://media.giphy.com/media/Od0QRnzwRBYmDU3eEO/giphy.gif",
    prompt:
      "the person gives an enthusiastic thumbs up, big toothy smile, slight nod of approval",
    duration: 5,
  },
  {
    id: "omg",
    title: "OMG",
    caption: "hands-on-face shock",
    thumbnailUrl: "https://media.giphy.com/media/jquDWJfPUMCiI/giphy.gif",
    prompt:
      "the person's eyes widen in shock, mouth drops open, hands rise to cover both cheeks in surprise",
    duration: 5,
  },
  {
    id: "surprised",
    title: "Surprised",
    caption: "wide-eyed gasp",
    thumbnailUrl: "https://media.giphy.com/media/6nWhy3ulBL7GSCvKw6/giphy.gif",
    prompt:
      "the person's eyes widen dramatically, eyebrows shoot up, mouth opens in a small gasp, head jerks back slightly",
    duration: 5,
  },
  {
    id: "side-eye",
    title: "Side Eye",
    caption: "sus suspicion",
    thumbnailUrl: "https://media.giphy.com/media/fvA1ieS8rEV8Y/giphy.gif",
    prompt:
      "the person slowly turns their eyes to the side with a suspicious expression, slight smirk, head tilts a touch",
    duration: 5,
  },
  {
    id: "head-tilt",
    title: "Head Tilt",
    caption: "cute curiosity",
    thumbnailUrl: "https://media.giphy.com/media/H4DjXQXamtTiIuCcRU/giphy.gif",
    prompt:
      "the person tilts their head adorably to one side, soft warm smile, gentle blink, curious expression",
    duration: 5,
  },
  {
    id: "thinking",
    title: "Thinking",
    caption: "brain processing",
    thumbnailUrl: "https://media.giphy.com/media/26FPJGjhefSJuaRhu/giphy.gif",
    prompt:
      "the person looks up and to the side thinking hard, taps a finger to the chin, slight squint of concentration",
    duration: 5,
  },
  {
    id: "big-smile",
    title: "Big Smile",
    caption: "joy unlocked",
    thumbnailUrl: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif",
    prompt:
      "the person breaks into a huge genuine smile, eyes crinkle with delight, slight head shake of joy",
    duration: 5,
  },
  {
    id: "mind-blown",
    title: "Mind Blown",
    caption: "🤯 reaction",
    thumbnailUrl: "https://media.giphy.com/media/3o6Zt6fzS6qEbLhKWQ/giphy.gif",
    prompt:
      "the person stares straight ahead in awe, mouth slowly drops open, head leans back as if their mind is blown",
    duration: 5,
  },
];

/**
 * The subset of prompts that runs in parallel after the user uploads a selfie.
 * Each prompt costs ~$0.20 on fal.ai Pika v2.2, so we keep this small by
 * default; pick a varied trio that reads as different "moods" so the picker
 * grid feels meaningful.
 */
export const DEFAULT_PROMPT_SUBSET: MemeTemplate[] = TEMPLATES.filter((t) =>
  ["big-smile", "mind-blown", "party-hard"].includes(t.id)
);

/**
 * Looping reaction GIFs of random people, used as inspiration on the home
 * screen. Not selectable — they just communicate the vibe of what the app
 * outputs and provide social-proof-style movement on an otherwise static page.
 *
 * Keep this list small (≤8) and the GIFs reasonably small (<2 MB each) so the
 * home screen loads fast on mobile data.
 */
export type ExampleGif = {
  id: string;
  /** Animated GIF URL (Giphy CDN). */
  url: string;
  /** Short alt-text / caption for accessibility. */
  alt: string;
};

export const EXAMPLE_GIFS: ExampleGif[] = [
  {
    id: "fist-pump",
    url: "https://media.giphy.com/media/aHOU7Pg8VRpifMNOv2/giphy.gif",
    alt: "Person celebrating with a fist pump",
  },
  {
    id: "house-party",
    url: "https://media.giphy.com/media/jxupZeSuPc1ABKgkxR/giphy.gif",
    alt: "Person dancing at a house party",
  },
  {
    id: "happy-laugh",
    url: "https://media.giphy.com/media/VjqNtkg7kSZGM/giphy.gif",
    alt: "Person laughing happily",
  },
  {
    id: "excited-laugh",
    url: "https://media.giphy.com/media/l0HUcfpjmD77zuSze/giphy.gif",
    alt: "Person laughing excitedly",
  },
  {
    id: "excited-fist-pump",
    url: "https://media.giphy.com/media/10xMuDFatcaZhu/giphy.gif",
    alt: "Person fist-pumping with excitement",
  },
  {
    id: "joyful-laugh",
    url: "https://media.giphy.com/media/eSbLmEEG80WQDIHmJl/giphy.gif",
    alt: "Person laughing joyfully",
  },
];
