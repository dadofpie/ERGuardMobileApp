import { Redirect } from 'expo-router';

/** Hospital directory was removed. Dispatch assigns the facility from the LOA location. */
export default function HospitalsRedirect() {
  return <Redirect href="/(tabs)/claims" />;
}
