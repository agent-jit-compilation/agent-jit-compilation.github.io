'use strict';

const button = document.getElementById('copy-citation');
const status = document.getElementById('copy-status');

button.addEventListener('click', async () => {
  const citation = document.getElementById('bibtex');
  try {
    await navigator.clipboard.writeText(citation.textContent);
    status.textContent = 'Citation copied.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(citation);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    status.textContent = 'Citation selected. Copy with your keyboard or use Download citation.';
  }
});
