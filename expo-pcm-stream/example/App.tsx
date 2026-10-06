import { useEvent } from 'expo';
import ExpoPcmStream from 'expo-pcm-stream';
import { useEffect, useState } from 'react';
import { Button, PermissionsAndroid, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';

export default function App() {
  const pitch = useEvent(ExpoPcmStream, 'onPitch');
  const streamError = useEvent(ExpoPcmStream, 'onPitchStreamError');
  const [running, setRunning] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => () => void ExpoPcmStream.stop(), []);

  const start = async () => {
    setStartError(null);
    try {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      }
      const result = await ExpoPcmStream.start({ minFrequency: 65, maxFrequency: 1500 });
      setRunning(result != null);
    } catch (error: any) {
      setStartError(`${error.code}: ${error.message}`);
    }
  };

  const stop = async () => {
    await ExpoPcmStream.stop();
    setRunning(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Pitch Stream Example</Text>
        <Group name="Control">
          <Button title={running ? 'Stop' : 'Start'} onPress={running ? stop : start} />
          {startError && <Text>{startError}</Text>}
          {streamError && <Text>{`${streamError.code}: ${streamError.message}`}</Text>}
        </Group>
        <Group name="Pitch">
          <Text>Frequency: {pitch?.frequency != null ? `${pitch.frequency.toFixed(2)} Hz` : '-'}</Text>
          <Text>Clarity: {pitch ? pitch.clarity.toFixed(2) : '-'}</Text>
          <Text>RMS: {pitch ? pitch.rms.toFixed(4) : '-'}</Text>
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
  header: {
    fontSize: 30,
    margin: 20,
  },
  groupHeader: {
    fontSize: 20,
    marginBottom: 20,
  },
  group: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#eee',
  },
};
