import * as FileSystem from "expo-file-system/legacy";

/** Read a file URI to a base64 data URL suitable for posting to a HTTP API. */
export async function fileToDataUrl(
  uri: string,
  mime = "image/jpeg"
): Promise<string> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mime};base64,${b64}`;
}

/** Write a remote URL to a local cache file and return the file URI. */
export async function downloadToCache(
  url: string,
  filename: string
): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  const { uri } = await FileSystem.downloadAsync(url, dest);
  return uri;
}

/** Convert a base64 string back to a local file URI (for saving to Photos). */
export async function writeBase64ToCache(
  base64: string,
  filename: string
): Promise<string> {
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(dest, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return dest;
}
