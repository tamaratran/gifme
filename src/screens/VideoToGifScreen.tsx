/**
 * Free flow: user picks a video from their library/disk, we convert it to a
 * GIF server-side via the `convertVideoToGif` callable. No fal.ai charge —
 * just our ffmpeg + gifsicle pipeline.
 *
 * Inline base64 upload is capped at ~8 MB (well below the 10 MB Cloud
 * Functions request limit). Longer/heavier clips get a friendly error
 * pointing the user back to a shorter selection.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing, type as t } from "../theme";
import { callConvertVideoToGif } from "../lib/firebase";
import { writeBase64ToCache } from "../lib/base64";

const MAX_INLINE_BYTES = 8 * 1024 * 1024;

type Status =
  | { kind: "idle" }
  | { kind: "encoding" }
  | { kind: "uploading" }
  | { kind: "done"; gifDataUrl: string; sizeBytes: number }
  | { kind: "error"; message: string };

type Props = {
  onBack: () => void;
};

export function VideoToGifScreen({ onBack }: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [saving, setSaving] = useState(false);

  async function pickAndConvert() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo library access needed",
        "Grant access in Settings to pick a video."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      videoMaxDuration: 10,
      // Lower quality keeps the inline upload under 8 MB on most clips.
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    const uri = asset.uri;
    const mime =
      asset.mimeType ??
      (uri.endsWith(".mov") ? "video/quicktime" : "video/mp4");

    try {
      setStatus({ kind: "encoding" });
      const dataUrl = await readVideoAsDataUrl(uri, mime);
      const decodedBytes = estimateDecodedBytes(dataUrl);
      if (decodedBytes > MAX_INLINE_BYTES) {
        setStatus({
          kind: "error",
          message: `That clip is ~${(decodedBytes / 1024 / 1024).toFixed(1)} MB. Pick a shorter video (≤10s) or a smaller file (≤8 MB).`,
        });
        return;
      }

      setStatus({ kind: "uploading" });
      const { gifDataUrl, sizeBytes } = await callConvertVideoToGif({
        videoUrl: dataUrl,
      });
      setStatus({ kind: "done", gifDataUrl, sizeBytes });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus({ kind: "error", message });
    }
  }

  async function saveGif() {
    if (status.kind !== "done") return;
    if (Platform.OS === "web") {
      // On web, trigger a browser download.
      const a = document.createElement("a");
      a.href = status.gifDataUrl;
      a.download = `gifme-${Date.now()}.gif`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo library access needed",
        "Enable access in Settings so GifMe can save your GIF."
      );
      return;
    }
    setSaving(true);
    try {
      const b64 = status.gifDataUrl.replace(/^data:image\/gif;base64,/, "");
      const fileUri = await writeBase64ToCache(b64, `gifme-${Date.now()}.gif`);
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert("Saved", "GIF saved to Photos.");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert("Couldn't save", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={onBack}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Video → GIF</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.tagline}>
            Pick a short clip (≤10s, ≤8 MB) and we'll turn it into a GIF.
            Free, no AI, ~30 seconds.
          </Text>

          <View style={styles.preview}>
            {status.kind === "done" ? (
              <Image
                source={{ uri: status.gifDataUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
              />
            ) : status.kind === "encoding" || status.kind === "uploading" ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.previewText}>
                  {status.kind === "encoding"
                    ? "Reading video…"
                    : "Converting to GIF…"}
                </Text>
              </View>
            ) : status.kind === "error" ? (
              <View style={styles.center}>
                <Text style={[styles.previewText, { color: colors.danger }]}>
                  Couldn't convert
                </Text>
                <Text style={styles.errorDetail} numberOfLines={4}>
                  {status.message}
                </Text>
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={styles.previewText}>No video picked yet</Text>
              </View>
            )}
          </View>

          {status.kind === "done" && (
            <Text style={styles.sizeText}>
              {(status.sizeBytes / 1024 / 1024).toFixed(2)} MB
            </Text>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerInner}>
            {status.kind === "done" ? (
              <>
                <Pressable
                  onPress={saveGif}
                  disabled={saving}
                  style={({ pressed }) => [
                    styles.cta,
                    (pressed || saving) && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.ctaText}>
                    {saving ? "Saving…" : "Save GIF"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={pickAndConvert}
                  style={({ pressed }) => [
                    styles.secondary,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.secondaryText}>Pick another video</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={pickAndConvert}
                disabled={status.kind === "encoding" || status.kind === "uploading"}
                style={({ pressed }) => [
                  styles.cta,
                  (pressed ||
                    status.kind === "encoding" ||
                    status.kind === "uploading") && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.ctaText}>
                  {status.kind === "encoding"
                    ? "Reading…"
                    : status.kind === "uploading"
                    ? "Converting…"
                    : "Pick a video"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

async function readVideoAsDataUrl(uri: string, mime: string): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });
  }
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mime};base64,${b64}`;
}

function estimateDecodedBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return 0;
  const b64 = dataUrl.slice(comma + 1);
  // base64 inflates by ~4/3, so decoded length ≈ b64Length * 3 / 4 minus padding.
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, alignItems: "center" },
  page: { width: "100%", maxWidth: 520, flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: { ...t.body, color: colors.accent },
  title: { ...t.body, fontWeight: "700", color: colors.text },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 160,
    paddingTop: spacing.sm,
  },
  tagline: {
    ...t.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  preview: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  previewText: {
    ...t.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  errorDetail: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  sizeText: {
    ...t.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg + "ee",
    alignItems: "center",
  },
  footerInner: { width: "100%", maxWidth: 520, gap: spacing.sm },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  ctaText: { fontSize: 17, fontWeight: "700", color: colors.bg },
  secondary: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  secondaryText: {
    ...t.caption,
    fontSize: 13,
    color: colors.accent,
    textDecorationLine: "underline",
  },
});
