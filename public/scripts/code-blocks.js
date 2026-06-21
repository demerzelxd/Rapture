function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return Promise.reject(new Error('Clipboard API is unavailable'));
}

document.querySelectorAll('.content-prose pre.astro-code').forEach(function (pre) {
  if (pre.closest('.code-frame')) {
    return;
  }

  var frame = document.createElement('figure');
  frame.className = 'code-frame';

  var toolbar = document.createElement('figcaption');
  toolbar.className = 'code-toolbar';

  var language = document.createElement('span');
  language.textContent = pre.dataset.language || 'code';

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code block');

  button.addEventListener('click', function () {
    copyText(pre.innerText).then(function () {
      button.textContent = 'Copied';
      button.dataset.copied = 'true';
      window.setTimeout(function () {
        button.textContent = 'Copy';
        delete button.dataset.copied;
      }, 1500);
    }).catch(function () {
      var range = document.createRange();
      range.selectNodeContents(pre);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = 'Selected';
      window.setTimeout(function () {
        button.textContent = 'Copy';
      }, 1500);
    });
  });

  toolbar.append(language, button);
  pre.parentNode.insertBefore(frame, pre);
  frame.append(toolbar, pre);
});
