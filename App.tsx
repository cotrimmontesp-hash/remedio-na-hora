// Remédio na Hora — lembra os horários de remédio cadastrados pelo usuário. Alarme nativo no Android.
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import Inicio from './src/telas/Inicio';
import { cor } from './src/tema';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: cor.fundo }}>
        <StatusBar style="light" />
        <Inicio />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
