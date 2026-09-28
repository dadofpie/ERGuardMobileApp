export type DeviceLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

async function loadLocation() {
  try {
    return await import('expo-location');
  } catch {
    throw new Error('Location is unavailable in this build. Rebuild the iOS app and try again.');
  }
}

/** Current GPS for emergency LOA. Staff use this to assign a hospital. */
export async function getEmergencyLocation(): Promise<DeviceLocation> {
  const Location = await loadLocation();
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location is required so dispatch can assign a hospital.');
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const latitude = pos.coords.latitude;
  const longitude = pos.coords.longitude;
  let label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places[0];
    if (place) {
      label =
        [place.name, place.street, place.district, place.city, place.region]
          .filter(Boolean)
          .join(', ') || label;
    }
  } catch {
    /* coordinates are enough for dispatch */
  }
  return { latitude, longitude, label };
}
