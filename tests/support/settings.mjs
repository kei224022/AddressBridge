export const testPort = Number(process.env.TEST_PORT ?? 4173);
if (!Number.isInteger(testPort) || testPort < 1024 || testPort > 65535) {
  throw new Error('TEST_PORT must be an integer between 1024 and 65535');
}
export const baseURL = `http://127.0.0.1:${testPort}`;
export const origin = baseURL;
