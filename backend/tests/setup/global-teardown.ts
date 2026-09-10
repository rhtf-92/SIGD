export default async function globalTeardown(): Promise<void> {
  const container = (globalThis as Record<string, unknown>).__SIGD_CONTAINER__ as
    | { stop: () => Promise<void> }
    | undefined;

  if (container) {
    await container.stop();
  }
}