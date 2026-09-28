export type PickedFile = { uri: string; name: string; mime: string };

function fromAsset(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  name?: string | null;
}): PickedFile {
  const name = asset.fileName || asset.name || asset.uri.split('/').pop() || 'upload.jpg';
  return {
    uri: asset.uri,
    name,
    mime: asset.mimeType || (name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
  };
}

async function loadImagePicker() {
  try {
    return await import('expo-image-picker');
  } catch {
    throw new Error('Camera and photo library are unavailable in this build. Rebuild the iOS app and try again.');
  }
}

async function loadDocumentPicker() {
  try {
    return await import('expo-document-picker');
  } catch {
    throw new Error('File picker is unavailable in this build. Rebuild the iOS app and try again.');
  }
}

export async function pickProfilePhoto(): Promise<PickedFile | null> {
  const ImagePicker = await loadImagePicker();
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is required to set a profile photo.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return fromAsset(result.assets[0]);
}

export async function captureClaimPhoto(): Promise<PickedFile | null> {
  const ImagePicker = await loadImagePicker();
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is required to photograph receipts.');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return fromAsset(result.assets[0]);
}

export async function pickInvoiceImage(): Promise<PickedFile | null> {
  const ImagePicker = await loadImagePicker();
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library access is required to attach an invoice.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  return fromAsset(result.assets[0]);
}

export async function pickClaimDocuments(): Promise<PickedFile[]> {
  const DocumentPicker = await loadDocumentPicker();
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'application/pdf'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => fromAsset(asset));
}

export async function prepareInvoiceImage(file: PickedFile): Promise<PickedFile> {
  try {
    const ImageManipulator = await import('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(file.uri, [], {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return { uri: result.uri, name, mime: 'image/jpeg' };
  } catch {
    return { ...file, mime: file.mime.startsWith('image/') ? file.mime : 'image/jpeg' };
  }
}
