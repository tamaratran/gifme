/**
 * Curated list of popular meme GIFs we face-swap into.
 * These URLs point at GIFs hosted on GIPHY / Tenor / media CDNs.
 * Keep this list editable — the home screen renders whatever is here.
 */
export type MemeTemplate = {
  id: string;
  title: string;
  /** URL of the animated GIF to face-swap into. */
  gifUrl: string;
  /** Optional preview URL used for the grid thumbnail (falls back to gifUrl). */
  previewUrl?: string;
};

// Live Giphy IDs verified to still serve real content (Giphy returns a
// ~239KB "content not available" placeholder for dead IDs). If a URL ever
// 404s, swap in a replacement here.
export const TEMPLATES: MemeTemplate[] = [
  {
    id: "kimmy-say-what",
    title: "Say What",
    gifUrl: "https://media.giphy.com/media/l0HlL2vlfpWI0meJi/giphy.gif",
  },
  {
    id: "office-party-hard",
    title: "Party Hard",
    gifUrl: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  },
  {
    id: "sacha-thumbs-up",
    title: "Thumbs Up",
    gifUrl: "https://media.giphy.com/media/Od0QRnzwRBYmDU3eEO/giphy.gif",
  },
  {
    id: "jim-carrey-omg",
    title: "OMG",
    gifUrl: "https://media.giphy.com/media/jquDWJfPUMCiI/giphy.gif",
  },
  {
    id: "surprised-meme",
    title: "Surprised",
    gifUrl: "https://media.giphy.com/media/6nWhy3ulBL7GSCvKw6/giphy.gif",
  },
  {
    id: "ping-pong-cat",
    title: "Ping Pong Cat",
    gifUrl: "https://media.giphy.com/media/fvA1ieS8rEV8Y/giphy.gif",
  },
  {
    id: "cute-cat",
    title: "Cute Cat",
    gifUrl: "https://media.giphy.com/media/H4DjXQXamtTiIuCcRU/giphy.gif",
  },
  {
    id: "chat-conversation",
    title: "Chat",
    gifUrl: "https://media.giphy.com/media/26FPJGjhefSJuaRhu/giphy.gif",
  },
  {
    id: "animation-smile",
    title: "Smile",
    gifUrl: "https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif",
  },
  {
    id: "south-park-numbers",
    title: "Numbers Go Up",
    gifUrl: "https://media.giphy.com/media/3o6Zt6fzS6qEbLhKWQ/giphy.gif",
  },
];
