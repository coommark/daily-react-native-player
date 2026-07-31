import DailyReactNativePlayer from 'daily-react-native-player';
import { useEvent } from 'expo';
import { Button, Linking, SafeAreaView, ScrollView, Text, View } from 'react-native';

export default function App() {
  const onChangePayload = useEvent(DailyReactNativePlayer, 'onChange');
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>daily-react-native-player</Text>
        <Text style={styles.subHeader}>
          Built primarily for Daily Bible - Offline & Audio
        </Text>
        <Text
          style={styles.link}
          onPress={() =>
            Linking.openURL(
              'https://play.google.com/store/apps/details?id=com.coommark.dailybible'
            )
          }>
          Google Play
        </Text>
        <Text
          style={styles.link}
          onPress={() =>
            Linking.openURL('https://apps.apple.com/us/app/daily-bible-offline-audio/id6754987448')
          }>
          App Store
        </Text>
        <Group name="Constants">
          <Text>{DailyReactNativePlayer.PI}</Text>
        </Group>
        <Group name="Functions">
          <Text>{DailyReactNativePlayer.hello()}</Text>
        </Group>
        <Group name="Async functions">
          <Button
            title="Set value"
            onPress={async () => {
              await DailyReactNativePlayer.setValueAsync('Hello from JS!');
            }}
          />
        </Group>
        <Group name="Events">
          <Text>{onChangePayload?.value}</Text>
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  );
}

const styles = {
  header: { fontSize: 28, marginHorizontal: 20, marginTop: 20 },
  subHeader: { fontSize: 16, marginHorizontal: 20, marginTop: 8, color: '#333' },
  link: {
    fontSize: 16,
    marginHorizontal: 20,
    marginTop: 6,
    color: '#0B57D0',
    textDecorationLine: 'underline' as const,
  },
  groupHeader: { fontSize: 20, marginBottom: 20 },
  group: { margin: 20, backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  container: { flex: 1, backgroundColor: '#eee' },
  view: { flex: 1, height: 200 },
};
