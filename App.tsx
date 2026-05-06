import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { HomeScreen } from "./src/screens/HomeScreen";
import { CameraScreen } from "./src/screens/CameraScreen";
import { ResultsScreen } from "./src/screens/ResultsScreen";
import { VideoToGifScreen } from "./src/screens/VideoToGifScreen";
import { type MemeTemplate } from "./src/lib/templates";
import { colors } from "./src/theme";

type Route =
  | { name: "home" }
  | { name: "camera"; templates: MemeTemplate[] }
  | { name: "results"; selfieUri: string; templates: MemeTemplate[] }
  | { name: "videoToGif" };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {route.name === "home" && (
          <HomeScreen
            onStart={(templates) => setRoute({ name: "camera", templates })}
            onPickedFromLibrary={(uri, templates) =>
              setRoute({ name: "results", selfieUri: uri, templates })
            }
            onUploadVideo={() => setRoute({ name: "videoToGif" })}
          />
        )}
        {route.name === "videoToGif" && (
          <VideoToGifScreen onBack={() => setRoute({ name: "home" })} />
        )}
        {route.name === "camera" && (
          <CameraScreen
            onCaptured={(uri) =>
              setRoute({
                name: "results",
                selfieUri: uri,
                templates: route.templates,
              })
            }
            onCancel={() => setRoute({ name: "home" })}
          />
        )}
        {route.name === "results" && (
          <ResultsScreen
            selfieUri={route.selfieUri}
            templates={route.templates}
            onBack={() => setRoute({ name: "home" })}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
