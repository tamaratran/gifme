// `gifsicle` is an ESM package whose default export is the path to its
// bundled binary. There are no first-party types, so declare the shape here.
declare module "gifsicle" {
  const path: string;
  export default path;
}
