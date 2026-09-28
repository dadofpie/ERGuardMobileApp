export function serializeLoginPayload(
  identifier: string,
  password: string,
  deviceName?: string,
): { identifier: string; password: string; device_name?: string } {
  const payload: { identifier: string; password: string; device_name?: string } = {
    identifier: String(identifier || '').trim(),
    password,
  };
  if (deviceName) payload.device_name = deviceName;
  return payload;
}
