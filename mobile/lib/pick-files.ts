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

export const MAX_IMAGE_SIDE = 2000;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Returns the manipulator resize action for the longer side, or null when it already fits. */
export function computeResize(
  width: number,
  height: number,
  maxSide = MAX_IMAGE_SIDE,
): { width: number } | { height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  if (Math.max(width, height) <= maxSide) return null;
  return width >= height ? { width: maxSide } : { height: maxSide };
}

async function imageSize(uri: string): Promise<{ width: number; height: number } | null> {
  const { Image } = await import('react-native');
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null),
    );
  });
}

async function fileBytes(uri: string): Promise<number | null> {
  try {
    const blob = await (await fetch(uri)).blob();
    return blob.size;
  } catch {
    return null;
  }
}

const PREPARE_ERROR =
  'We could not process this photo (HEIC or unsupported format). Take a new photo or choose a JPEG/PNG image.';
const TOO_LARGE_ERROR = 'This photo is too large to upload (max 8 MB). Retake it or choose a smaller one.';

export async function prepareInvoiceImage(file: PickedFile): Promise<PickedFile> {
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  try {
    const ImageManipulator = await import('expo-image-manipulator');
    const size = await imageSize(file.uri);
    let scale = 1;
    let quality = 0.8;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const resize = size
        ? computeResize(Math.round(size.width * scale), Math.round(size.height * scale))
        : null;
      const actions = resize
        ? [{ resize }]
        : scale < 1 && size
          ? [{ resize: { width: Math.round(size.width * scale) } }]
          : [];
      const result = await ImageManipulator.manipulateAsync(file.uri, actions, {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const bytes = await fileBytes(result.uri);
      if (bytes == null || bytes <= MAX_UPLOAD_BYTES) {
        return { uri: result.uri, name, mime: 'image/jpeg' };
      }
      quality = Math.max(0.4, quality - 0.2);
      scale *= 0.75;
    }
  } catch (e) {
    throw new Error(PREPARE_ERROR);
  }
  throw new Error(TOO_LARGE_ERROR);
}
