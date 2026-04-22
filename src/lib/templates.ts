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

export const TEMPLATES: MemeTemplate[] = [
  {
    id: "dancing-baby",
    title: "Dancing Baby",
    gifUrl: "https://media.giphy.com/media/l0HlL2vlfpWI0meJi/giphy.gif",
  },
  {
    id: "drake-hotline",
    title: "Drake Hotline",
    gifUrl: "https://media.giphy.com/media/3ohzAiaTQrKCRK3y6c/giphy.gif",
  },
  {
    id: "this-is-fine",
    title: "This is Fine",
    gifUrl: "https://media.giphy.com/media/z3iVHI6pVRH7afEvy4/giphy.gif",
  },
  {
    id: "leo-cheers",
    title: "Leo Cheers",
    gifUrl: "https://media.giphy.com/media/3o6wrebs8nuGOMSmvS/giphy.gif",
  },
  {
    id: "obama-mic-drop",
    title: "Mic Drop",
    gifUrl: "https://media.giphy.com/media/fvA1ieS8rEV8Y/giphy.gif",
  },
  {
    id: "shaq-shimmy",
    title: "Shaq Shimmy",
    gifUrl: "https://media.giphy.com/media/26xBIygOcC3bAFQHe/giphy.gif",
  },
  {
    id: "michael-scott-no",
    title: "Michael Scott No",
    gifUrl: "https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif",
  },
  {
    id: "crying-jordan",
    title: "Crying Jordan",
    gifUrl: "https://media.giphy.com/media/xDQ3Oql1BN54VPxirV/giphy.gif",
  },
  {
    id: "homer-bush",
    title: "Disappearing Homer",
    gifUrl: "https://media.giphy.com/media/11IxTysmUVvwly/giphy.gif",
  },
  {
    id: "pedro-ha",
    title: "Pedro Ha",
    gifUrl: "https://media.giphy.com/media/W04NQhvRlNcis/giphy.gif",
  },
];
