/** ボタンの待機表示と通知表示。 */
export function setLoading(btn, loading, loadingText = '') {
  const originalText = btn.dataset.originalText ?? btn.textContent;
  btn.dataset.originalText = originalText;
  if (loading) {
    btn.disabled = true;
    btn.setAttribute('aria-disabled', 'true');
    btn.innerHTML = loadingText
      ? `<span class="spinner"></span>${loadingText}`
      : '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    btn.textContent = originalText;
  }
}

export function createSnackbar(element) {
  let snackTimer = null;
  function showSnackbar(msg) {
    if (snackTimer) clearTimeout(snackTimer);
    element.textContent = msg;
    element.classList.add('show');
    snackTimer = setTimeout(() => element.classList.remove('show'), 3000);
  }
  return showSnackbar;
}
