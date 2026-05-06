import { useMemo } from "react";
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
import { TEMPLATES, type MemeTemplate } from "../lib/templates";

type Props = {
  onStart: (picked: MemeTemplate[]) => void;
  onPickedFromLibrary: (uri: string, picked: MemeTemplate[]) => void;
};

const MAX_CONTENT_WIDTH = 520;

export function HomeScreen({ onStart, onPickedFromLibrary }: Props) {
  const picks = useMemo(() => TEMPLATES, []);
  const { width } = useWindowDimensions();
  const numCols = width >= 720 ? 4 : width >= 480 ? 3 : 2;
  const cellGap = spacing.sm;

  async function pickFromLibrary() {
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
    onPickedFromLibrary(result.assets[0].uri, picks);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.container}>
          <Text style={styles.brand}>GifMe AI</Text>
          <Text style={styles.tagline}>
            Snap a selfie. AI animates you into 10 reaction memes.
          </Text>

          <View style={[styles.grid, { gap: cellGap }]}>
            {picks.map((t) => (
              <View
                key={t.id}
                style={[
                  styles.cell,
                  {
                    width: `${(100 - (numCols - 1) * 1.5) / numCols}%`,
                  },
                ]}
              >
                <View style={styles.thumbWrap}>
                  <Image
                    source={{ uri: t.thumbnailUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.thumbScrim} />
                  <Text style={styles.thumbTitle} numberOfLines={1}>
                    {t.title}
                  </Text>
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
            onPress={() => onStart(picks)}
          >
            <Text style={styles.ctaText}>Snap a selfie</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.uploadLink,
              pressed && { opacity: 0.6 },
            ]}
            onPress={pickFromLibrary}
          >
            <Text style={styles.uploadLinkText}>or upload from library</Text>
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
    paddingBottom: 140,
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
    justifyContent: "flex-end",
  },
  thumbScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.0)",
  },
  thumbTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.55)",
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
