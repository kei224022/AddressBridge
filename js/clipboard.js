/** Clipboard API と旧ブラウザ向けフォールバック。 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    Object.assign(textarea.style, { position: 'fixed', opacity: '0' });
    document.body.appendChild(textarea);
    try {
      textarea.select();
      document.execCommand('copy');
    } finally {
      textarea.remove();
    }
  }
}

export function bindCopyButtons(getText) {
  const ids = ['copy-result', 'copy-envelope', 'copy-postcard', 'copy-label'];
  for (const id of ids) {
    const button = document.getElementById(id);
    if (!button) continue;
    const originalText = button.textContent;
    let resetTimer;
    button.addEventListener('click', async () => {
      await copyText(getText());
      button.textContent = '✓ コピーしました';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { button.textContent = originalText; }, 2000);
    });
  }
}
