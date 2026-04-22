import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing, type } from "../theme";
import { TEMPLATES, type MemeTemplate } from "../lib/templates";

type Props = {
  onStart: (picked: MemeTemplate[]) => void;
};

export function HomeScreen({ onStart }: Props) {
  // We face-swap every template at once — the home screen doubles as a
  // preview of what the user's about to generate.
  const picks = useMemo(() => TEMPLATES, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.display}>GifMe</Text>
        <Text style={styles.tagline}>
          Snap a selfie. Get your face on every GIF on the internet.
        </Text>

        <View style={styles.grid}>
          {picks.map((t) => (
            <View key={t.id} style={styles.cell}>
              <Image
                source={{ uri: t.previewUrl ?? t.gifUrl }}
                style={styles.thumb}
                contentFit="cover"
                transition={200}
              />
              <Text style={styles.cellTitle} numberOfLines={1}>
                {t.title}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => onStart(picks)}
        >
          <Text style={styles.ctaText}>Snap a selfie →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl * 3 },
  display: { ...type.display, color: colors.text, marginBottom: spacing.sm },
  tagline: {
    ...type.body,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  cell: {
    width: "47%",
    gap: spacing.sm,
  },
  thumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  cellTitle: { ...type.caption, color: colors.textMuted },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    backgroundColor: colors.bg + "f0",
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  ctaText: { ...type.title, color: colors.bg },
});
