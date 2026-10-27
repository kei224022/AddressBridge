/** 外部 API の待機上限。本文の読み込み・JSON 解析までを対象にする。 */
export const API_TIMEOUT_MS = {
  zipcloud: 5000,
  geocoding: 5000,
  deepl: 5000,
};

/**
 * JSON レスポンスを期限付きで取得する。HTTP エラー・通信失敗・期限超過は呼び出し元で扱う。
 * timeoutMs はこの関数専用のオプションで、fetch には渡さない。
 */
export async function fetchJson(url, { timeoutMs = 5000, ...options } = {}) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new DOMException('通信の待機時間を超えました', 'TimeoutError');
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });

  try {
    const request = (async () => {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    })();
    // AbortSignal に反応しない通信・本文読み込みでも、呼び出し元の待機を終了する。
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
