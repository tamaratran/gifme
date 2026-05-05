/**
 * Curated list of meme reaction prompts. Each template animates the user's
 * selfie into a 5-second video via fal.ai image-to-video. The thumbnail GIF
 * shown in the home grid is just a hint at the vibe — the actual generated
 * clip will be the user's own face acting it out.
 *
 * Keep this list editable — the home screen renders whatever is here.
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
