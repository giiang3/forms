/* Opens a form in a popup. Usage:
   <button data-forms-popup="https://giiang3.github.io/forms/#/f/codigo">Responder</button>
   <script src="https://giiang3.github.io/forms/embed.js" defer></script> */
(function () {
  if (window.__formsPopup) return
  window.__formsPopup = true

  function open(url) {
    var back = document.createElement('div')
    back.setAttribute('role', 'dialog')
    back.setAttribute('aria-modal', 'true')
    back.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(17,18,26,.55);display:flex;align-items:center;justify-content:center;padding:16px;'
    var box = document.createElement('div')
    box.style.cssText = 'position:relative;width:min(960px,100%);height:min(720px,100%);border-radius:12px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35);background:#fff;'
    var frame = document.createElement('iframe')
    frame.src = url
    frame.title = 'Formulário'
    frame.setAttribute('allow', 'clipboard-write')
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block;'
    var close = document.createElement('button')
    close.type = 'button'
    close.setAttribute('aria-label', 'Fechar')
    close.innerHTML = '&times;'
    close.style.cssText = 'position:absolute;top:8px;right:8px;width:36px;height:36px;border:0;border-radius:18px;background:rgba(17,18,26,.75);color:#fff;font:24px/36px system-ui,sans-serif;cursor:pointer;'
    function shut() {
      document.removeEventListener('keydown', onKey)
      back.remove()
      document.documentElement.style.overflow = prev
    }
    function onKey(e) {
      if (e.key === 'Escape') shut()
    }
    close.onclick = shut
    back.onclick = function (e) {
      if (e.target === back) shut()
    }
    document.addEventListener('keydown', onKey)
    var prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    box.appendChild(frame)
    box.appendChild(close)
    back.appendChild(box)
    document.body.appendChild(back)
    close.focus()
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-forms-popup]')
    if (!el) return
    e.preventDefault()
    open(el.getAttribute('data-forms-popup'))
  })
})()
