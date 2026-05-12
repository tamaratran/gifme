import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { HomeScreen } from "./src/screens/HomeScreen";
import { ResultsScreen } from "./src/screens/ResultsScreen";
import { VideoToGifScreen } from "./src/screens/VideoToGifScreen";
import { DEFAULT_PROMPT_SUBSET } from "./src/lib/templates";
import { colors } from "./src/theme";

type Route =
  | { name: "home" }
  | { name: "results"; selfieUri: string }
  | { name: "videoToGif" };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {route.name === "home" && (
          <HomeScreen
            onUploadSelfie={(uri) =>
              setRoute({ name: "results", selfieUri: uri })
            }
            onUploadVideo={() => setRoute({ name: "videoToGif" })}
          />
        )}
        {route.name === "videoToGif" && (
          <VideoToGifScreen onBack={() => setRoute({ name: "home" })} />
        )}
        {route.name === "results" && (
          <ResultsScreen
            selfieUri={route.selfieUri}
            templates={DEFAULT_PROMPT_SUBSET}
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
