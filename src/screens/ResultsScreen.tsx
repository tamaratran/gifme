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
import { VideoView, useVideoPlayer } from "expo-video";
import * as MediaLibrary from "expo-media-library";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radii, spacing, type as t } from "../theme";
import { type MemeTemplate } from "../lib/templates";
import { generateMemeVideo, type PipelineProgress } from "../lib/pipeline";

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

const PHASE_LABEL: Record<PipelineProgress["phase"], string> = {
  encode: "Preparing selfie",
  generate: "Generating video",
  download: "Downloading",
  save: "Saving",
};

// fal.ai Pika v2.2 charges per request; cap concurrent jobs so we never
// fan out 10 simultaneous requests (which would also overwhelm the function
// instance pool). 3 in flight at once balances throughput and cost.
const MAX_CONCURRENT_JOBS = 3;

export function ResultsScreen({ selfieUri, templates, onBack }: Props) {
  const [rows, setRows] = useState<Row[]>(
    templates.map((template) => ({ template, status: { kind: "pending" } }))
  );
  const [savingAll, setSavingAll] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let queueIdx = 0;
    let inFlight = 0;
    let cancelled = false;

    const update = (idx: number, patch: Status) =>
      setRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: patch } : r))
      );

    const runOne = (idx: number) => {
      const template = templates[idx];
      if (!template) return;
      inFlight++;
      update(idx, { kind: "running", message: "Starting…", progress: 0 });

      generateMemeVideo(
        selfieUri,
        template.prompt,
        template.duration,
        `gifme-${template.id}.mp4`,
        {
          onProgress: (p) => {
            const ratio = p.total === 0 ? 0 : p.done / p.total;
            update(idx, {
              kind: "running",
              message: PHASE_LABEL[p.phase],
              progress: ratio,
            });
          },
        }
      )
        .then(({ uri }) => {
          if (!cancelled) update(idx, { kind: "done", uri });
        })
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          if (!cancelled) update(idx, { kind: "error", message });
        })
        .finally(() => {
          inFlight--;
          drain();
        });
    };

    const drain = () => {
      // Bail if the screen has been unmounted — fal.ai requests are billed per
      // clip ($0.20 each), so we must not start new ones after the user
      // navigates away.
      while (
        !cancelled &&
        inFlight < MAX_CONCURRENT_JOBS &&
        queueIdx < templates.length
      ) {
        runOne(queueIdx++);
      }
    };

    drain();

    return () => {
      cancelled = true;
    };
  }, [templates, selfieUri]);

  async function saveAll() {
    const ready = rows.filter(
      (r): r is Row & { status: { kind: "done"; uri: string } } =>
        r.status.kind === "done"
    );
    if (ready.length === 0) return;

    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo library access needed",
        "Enable access in Settings so GifMe can save your videos."
      );
      return;
    }

    setSavingAll(true);
    try {
      for (const r of ready) {
        await MediaLibrary.saveToLibraryAsync(r.status.uri);
      }
      Alert.alert(
        "Saved",
        `${ready.length} video${ready.length === 1 ? "" : "s"} saved to Photos.`
      );
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
      <View style={styles.page}>
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
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => <ResultCell row={item} />}
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.footerInner}>
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
              {savingAll
                ? "Saving…"
                : `Save ${doneCount} video${doneCount === 1 ? "" : "s"} to Photos`}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ResultCell({ row }: { row: Row }) {
  const { template, status } = row;
  const videoUri = status.kind === "done" ? status.uri : null;
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.cell}>
      <View style={styles.cellImageWrap}>
        {status.kind === "done" ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri: template.thumbnailUrl }}
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
            <Text style={[styles.overlayText, { color: colors.danger }]}>
              Failed
            </Text>
            <Text
              style={[styles.overlayText, styles.errorDetail]}
              numberOfLines={3}
            >
              {status.message}
            </Text>
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
  grid: { paddingHorizontal: spacing.lg, paddingBottom: 140, gap: spacing.sm },
  cell: { flex: 1, gap: spacing.xs, marginBottom: spacing.sm },
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
  errorDetail: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  cellTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
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
  footerInner: { width: "100%", maxWidth: 520 },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  ctaText: { fontSize: 17, fontWeight: "700", color: colors.bg },
});
