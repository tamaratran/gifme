import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing, type as t } from "../theme";
import { type MemeTemplate } from "../lib/templates";
import { swapFacesInGif } from "../lib/pipeline";

type Status =
  | { kind: "pending" }
  | { kind: "running"; message: string; progress: number }
  | { kind: "done"; uri: string }
  | { kind: "error"; message: string };

type Row = {
  template: MemeTemplate;
  status: Status;
};

type Props = {
  selfieUri: string;
  templates: MemeTemplate[];
  onBack: () => void;
};

export function ResultsScreen({ selfieUri, templates, onBack }: Props) {
  const [rows, setRows] = useState<Row[]>(
    templates.map((template) => ({ template, status: { kind: "pending" } }))
  );
  const [savingAll, setSavingAll] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Run all face swaps in parallel. Each template's frame-level concurrency
    // is already capped inside swapFacesInGif, so we don't need extra gating.
    templates.forEach((template, idx) => {
      const update = (patch: Status) =>
        setRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, status: patch } : r))
        );

      update({ kind: "running", message: "Starting…", progress: 0 });

      swapFacesInGif(template.gifUrl, selfieUri, `gifme-${template.id}.gif`, {
        concurrency: 4,
        onProgress: (p) => {
          const phaseLabel = {
            fetch: "Downloading template",
            decode: "Reading frames",
            swap: `Swapping faces ${p.done}/${p.total}`,
            encode: "Rendering GIF",
            save: "Saving",
          }[p.phase];
          const ratio = p.total === 0 ? 0 : p.done / p.total;
          update({ kind: "running", message: phaseLabel, progress: ratio });
        },
      })
        .then((uri) => update({ kind: "done", uri }))
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          update({ kind: "error", message });
        });
    });
  }, [templates, selfieUri]);

  async function saveAll() {
    const ready = rows.filter((r): r is Row & { status: { kind: "done"; uri: string } } =>
      r.status.kind === "done"
    );
    if (ready.length === 0) return;

    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo library access needed",
        "Enable access in Settings so GifMe can save your GIFs."
      );
      return;
    }

    setSavingAll(true);
    try {
      for (const r of ready) {
        await MediaLibrary.saveToLibraryAsync(r.status.uri);
      }
      Alert.alert("Saved", `${ready.length} GIF${ready.length === 1 ? "" : "s"} saved to Photos.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert("Couldn't save", message);
    } finally {
      setSavingAll(false);
    }
  }

  const doneCount = rows.filter((r) => r.status.kind === "done").length;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>
          {doneCount}/{rows.length} ready
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.template.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => <ResultCell row={item} />}
      />

      <View style={styles.footer}>
        <Pressable
          onPress={saveAll}
          disabled={savingAll || doneCount === 0}
          style={({ pressed }) => [
            styles.cta,
            (pressed || savingAll) && { opacity: 0.85 },
            doneCount === 0 && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.ctaText}>
            {savingAll ? "Saving…" : `Save ${doneCount} GIF${doneCount === 1 ? "" : "s"} to Photos`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ResultCell({ row }: { row: Row }) {
  const { template, status } = row;

  return (
    <View style={styles.cell}>
      <View style={styles.cellImageWrap}>
        {status.kind === "done" ? (
          <Image
            source={{ uri: status.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <Image
            source={{ uri: template.gifUrl }}
            style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
            contentFit="cover"
          />
        )}
        {status.kind === "running" && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.text} />
            <Text style={styles.overlayText}>{status.message}</Text>
          </View>
        )}
        {status.kind === "error" && (
          <View style={styles.overlay}>
            <Text style={[styles.overlayText, { color: colors.danger }]}>Failed</Text>
          </View>
        )}
      </View>
      <Text style={styles.cellTitle} numberOfLines={1}>
        {template.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  back: { ...t.body, color: colors.accent },
  title: { ...t.title, color: colors.text },
  grid: { padding: spacing.lg, paddingBottom: 160, gap: spacing.md },
  cell: { flex: 1, gap: spacing.sm, marginBottom: spacing.md },
  cellImageWrap: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000b",
    padding: spacing.md,
    gap: spacing.sm,
  },
  overlayText: { ...t.caption, color: colors.text, textAlign: "center" },
  cellTitle: { ...t.caption, color: colors.textMuted },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    backgroundColor: colors.bg + "f0",
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  ctaText: { ...t.title, color: colors.bg },
});
