import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  type CameraType,
} from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing, type as t } from "../theme";

type Props = {
  onCaptured: (uri: string) => void;
  onCancel: () => void;
};

export function CameraScreen({ onCaptured, onCancel }: Props) {
  const [perm, requestPerm] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("front");
  const [busy, setBusy] = useState(false);
  const camRef = useRef<CameraView>(null);

  if (!perm) {
    return (
      <View style={styles.fallback}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!perm.granted) {
    return (
      <SafeAreaView style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Camera access needed</Text>
        <Text style={styles.fallbackBody}>
          GifMe needs your camera to snap a selfie. We don&apos;t upload the
          photo anywhere except to run the face-swap.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={requestPerm}>
          <Text style={styles.primaryBtnText}>Grant camera access</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onCancel}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  async function snap() {
    if (!camRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: true,
      });
      if (photo?.uri) onCaptured(photo.uri);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing={facing} />

      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.faceRing} />
        <Text style={styles.hint}>Center your face in the circle</Text>
      </View>

      <SafeAreaView style={styles.chrome} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <Pressable style={styles.iconBtn} onPress={onCancel}>
            <Text style={styles.iconBtnText}>✕</Text>
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setFacing((f) => (f === "front" ? "back" : "front"))}
          >
            <Text style={styles.iconBtnText}>⟲</Text>
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          <Pressable
            onPress={snap}
            disabled={busy}
            style={({ pressed }) => [
              styles.shutter,
              pressed && { transform: [{ scale: 0.95 }] },
              busy && { opacity: 0.5 },
            ]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  faceRing: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 3,
    borderColor: colors.text + "cc",
  },
  hint: {
    ...t.body,
    color: colors.text,
    backgroundColor: "#0009",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  chrome: { flex: 1, justifyContent: "space-between" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  bottomRow: {
    alignItems: "center",
    paddingBottom: spacing.xxl,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0009",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: { color: colors.text, fontSize: 22, fontWeight: "600" },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 5,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.text,
  },
  fallback: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    gap: spacing.lg,
    justifyContent: "center",
  },
  fallbackTitle: { ...t.title, color: colors.text },
  fallbackBody: { ...t.body, color: colors.textMuted },
  primaryBtn: {
    backgroundColor: colors.accent,
    padding: spacing.lg,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  primaryBtnText: { ...t.title, color: colors.bg },
  secondaryBtn: {
    padding: spacing.md,
    alignItems: "center",
  },
  secondaryBtnText: { ...t.body, color: colors.textMuted },
});
