import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing, type } from "../theme";
import { EXAMPLE_GIFS } from "../lib/templates";

type Props = {
  /** Open the camera to take a fresh selfie. */
  onTakeSelfie: () => void;
  /** Selfie picked from the photo library — kicks off generation directly. */
  onUploadSelfie: (uri: string) => void;
  /** Open the standalone "convert your own video" flow. */
  onUploadVideo: () => void;
};

const MAX_CONTENT_WIDTH = 520;

export function HomeScreen({
  onTakeSelfie,
  onUploadSelfie,
  onUploadVideo,
}: Props) {
  const { width } = useWindowDimensions();
  const numCols = width >= 720 ? 3 : width >= 480 ? 3 : 2;
  const cellGap = spacing.sm;

  async function pickSelfieFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo library access needed",
        "Grant access in Settings → GifMe AI → Photos to pick a selfie."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    onUploadSelfie(result.assets[0].uri);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.brand}>GifMe AI</Text>
          <Text style={styles.tagline}>
            Upload a selfie. AI animates you into reaction GIFs you can share.
          </Text>

          <Text style={styles.sectionLabel}>What people are making</Text>

          <View style={[styles.grid, { gap: cellGap }]}>
            {EXAMPLE_GIFS.map((g) => (
              <View
                key={g.id}
                style={[
                  styles.cell,
                  {
                    width: `${(100 - (numCols - 1) * 1.5) / numCols}%`,
                  },
                ]}
              >
                <View style={styles.thumbWrap}>
                  <Image
                    source={{ uri: g.url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                    accessibilityLabel={g.alt}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerInner}>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={pickSelfieFromLibrary}
          >
            <Text style={styles.ctaText}>Upload a selfie</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.uploadLink,
              pressed && { opacity: 0.6 },
            ]}
            onPress={onTakeSelfie}
          >
            <Text style={styles.uploadLinkText}>or take a selfie instead</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.uploadLink,
              pressed && { opacity: 0.6 },
            ]}
            onPress={onUploadVideo}
          >
            <Text style={styles.uploadLinkText}>
              Already have a video? Convert it to a GIF →
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 180,
    alignItems: "center",
  },
  container: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: colors.text,
  },
  tagline: {
    ...type.caption,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...type.caption,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    aspectRatio: 1,
  },
  thumbWrap: {
    width: "100%",
    height: "100%",
    borderRadius: radii.md,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg + "ee",
    alignItems: "center",
  },
  footerInner: {
    width: "100%",
    maxWidth: MAX_CONTENT_WIDTH,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  ctaText: { fontSize: 17, fontWeight: "700", color: colors.bg },
  uploadLink: {
    alignSelf: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  uploadLinkText: {
    ...type.caption,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
});
