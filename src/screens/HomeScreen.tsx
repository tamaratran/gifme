import { useMemo } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

export function HomeScreen({ onStart, onPickedFromLibrary }: Props) {
  // We face-swap every template at once — the home screen doubles as a
  // preview of what the user's about to generate.
  const picks = useMemo(() => TEMPLATES, []);

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo library access needed",
        "Grant access in Settings → GifMe AI → Photos to pick a selfie from your library."
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
        <Text style={styles.display}>GifMe AI</Text>
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
        <Pressable
          style={({ pressed }) => [
            styles.ctaSecondary,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={pickFromLibrary}
        >
          <Text style={styles.ctaSecondaryText}>Upload from library</Text>
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
  ctaSecondary: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.textMuted + "66",
  },
  ctaSecondaryText: { ...type.body, color: colors.text },
});
