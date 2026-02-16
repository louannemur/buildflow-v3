/**
 * iframe bridge script — injected into the preview iframe for parent <-> iframe communication.
 * This script is serialized as a string and embedded in the preview HTML.
 *
 * Protocol:
 * Parent -> iframe:
 *   GET_TREE          -> iframe responds with TREE_DATA
 *   GET_ELEMENT {bfId} -> iframe responds with ELEMENT_DATA
 *   SCROLL_TO {bfId}  -> scrolls element into view
 *
 * iframe -> parent:
 *   READY             -> iframe finished rendering
 *   ELEMENT_CLICK     -> user clicked an element
 *   ELEMENT_HOVER     -> user hovered an element
 *   ELEMENT_HOVER_OUT -> mouse left element
 *   TREE_DATA         -> response to GET_TREE
 *   SCROLL_UPDATE     -> iframe scroll position changed
 */

/**
 * Returns the bridge script as a string to be injected into the iframe HTML.
 */
export function getIframeBridgeScript(): string {
  return `
(function() {
  // Helper: extract element info from a DOM element with data-bf-id
  function getElementInfo(el) {
    if (!el || !el.getAttribute) return null;
    var bfId = el.getAttribute('data-bf-id');
    if (!bfId) return null;

    var rect = el.getBoundingClientRect();
    var parentEl = el.parentElement;
    var parentBfId = null;
    while (parentEl) {
      if (parentEl.getAttribute && parentEl.getAttribute('data-bf-id')) {
        parentBfId = parentEl.getAttribute('data-bf-id');
        break;
      }
      parentEl = parentEl.parentElement;
    }

    // Get direct text content (not from children)
    var textContent = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) { // TEXT_NODE
        textContent += el.childNodes[i].textContent;
      }
    }

    // Get child bf-ids
    var children = [];
    var childEls = el.querySelectorAll(':scope > [data-bf-id]');
    for (var j = 0; j < childEls.length; j++) {
      children.push(childEls[j].getAttribute('data-bf-id'));
    }

    // Extract element-specific attributes (e.g. src/alt for img)
    var attributes;
    var tagName = el.tagName.toLowerCase();
    if (tagName === 'img') {
      attributes = {};
      attributes.src = el.getAttribute('src') || '';
      attributes.alt = el.getAttribute('alt') || '';
    }

    var result = {
      bfId: bfId,
      tag: tagName,
      classes: el.getAttribute('class') || '',
      textContent: textContent.trim().substring(0, 100),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      parentBfId: parentBfId,
      children: children
    };
    if (attributes) result.attributes = attributes;
    return result;
  }

  // Helper: get full tree of all bf-id elements
  function getFullTree() {
    var elements = document.querySelectorAll('[data-bf-id]');
    var tree = [];
    for (var i = 0; i < elements.length; i++) {
      var info = getElementInfo(elements[i]);
      if (info) tree.push(info);
    }
    return tree;
  }

  // ── Block all interactive behavior ──────────────────────────────
  // In design mode, nothing should be interactive — only selectable.

  // Block form submissions
  document.addEventListener('submit', function(e) {
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // Block focus on inputs/textareas/selects
  document.addEventListener('focus', function(e) {
    var tag = e.target && e.target.tagName && e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      e.target.blur();
    }
  }, true);

  // Block mousedown on interactive elements (prevents drag, text selection in inputs, etc.)
  document.addEventListener('mousedown', function(e) {
    var t = e.target;
    while (t && t !== document.body) {
      var tag = t.tagName && t.tagName.toLowerCase();
      if (tag === 'a' || tag === 'button' || tag === 'input' || tag === 'select' || tag === 'textarea') {
        e.preventDefault();
        break;
      }
      t = t.parentElement;
    }
  }, true);

  // Inject cursor style so elements look selectable
  var bfStyle = document.createElement('style');
  bfStyle.textContent = '[data-bf-id] { cursor: default !important; }';
  document.head.appendChild(bfStyle);

  // Track currently hovered element to prevent duplicate events
  var lastHoveredBfId = null;

  // Event: click — always intercept, select nearest bf-id element
  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    var target = e.target;
    while (target && target !== document.body) {
      if (target.getAttribute && target.getAttribute('data-bf-id')) {
        var info = getElementInfo(target);
        if (info) {
          window.parent.postMessage({
            type: 'ELEMENT_CLICK',
            bfId: info.bfId,
            element: info
          }, '*');
        }
        return;
      }
      target = target.parentElement;
    }
    // Clicked on non-bf-id area — deselect
    window.parent.postMessage({ type: 'ELEMENT_CLICK', bfId: null, element: null }, '*');
  }, true);

  // Event: hover on bf-id element
  document.addEventListener('mouseover', function(e) {
    var target = e.target;
    while (target && target !== document.body) {
      if (target.getAttribute && target.getAttribute('data-bf-id')) {
        var bfId = target.getAttribute('data-bf-id');
        if (bfId !== lastHoveredBfId) {
          lastHoveredBfId = bfId;
          var info = getElementInfo(target);
          if (info) {
            window.parent.postMessage({
              type: 'ELEMENT_HOVER',
              bfId: info.bfId,
              element: info
            }, '*');
          }
        }
        return;
      }
      target = target.parentElement;
    }
    // Hovered on non-bf-id area
    if (lastHoveredBfId) {
      lastHoveredBfId = null;
      window.parent.postMessage({ type: 'ELEMENT_HOVER_OUT' }, '*');
    }
  }, true);

  // Event: mouse leaves document
  document.addEventListener('mouseleave', function() {
    lastHoveredBfId = null;
    window.parent.postMessage({ type: 'ELEMENT_HOVER_OUT' }, '*');
  });

  // Event: double-click for inline text editing
  document.addEventListener('dblclick', function(e) {
    var target = e.target;
    while (target && target !== document.body) {
      if (target.getAttribute && target.getAttribute('data-bf-id')) {
        // Check if the element has direct text content
        var hasDirectText = false;
        var hasChildElements = false;
        for (var i = 0; i < target.childNodes.length; i++) {
          if (target.childNodes[i].nodeType === 3 && target.childNodes[i].textContent.trim()) {
            hasDirectText = true;
          }
          if (target.childNodes[i].nodeType === 1) {
            hasChildElements = true;
          }
        }

        // Only enable inline editing for elements with text and no child elements
        if (hasDirectText && !hasChildElements) {
          e.preventDefault();
          e.stopPropagation();

          var bfId = target.getAttribute('data-bf-id');
          var originalText = target.textContent;

          // Make element editable
          target.contentEditable = 'true';
          target.style.outline = '2px solid #3b82f6';
          target.style.outlineOffset = '2px';
          target.style.cursor = 'text';
          target.focus();

          // Select all text
          var range = document.createRange();
          range.selectNodeContents(target);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);

          // Save on blur or Enter
          function finishEdit() {
            var newText = target.textContent.trim();
            target.contentEditable = 'false';
            target.style.outline = '';
            target.style.outlineOffset = '';
            target.style.cursor = '';
            target.removeEventListener('blur', finishEdit);
            target.removeEventListener('keydown', handleEditKeydown);

            if (newText && newText !== originalText) {
              window.parent.postMessage({
                type: 'TEXT_EDIT',
                bfId: bfId,
                newText: newText
              }, '*');
            } else {
              // Restore original text if empty or unchanged
              target.textContent = originalText;
            }
          }

          function handleEditKeydown(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              finishEdit();
            }
            if (e.key === 'Escape') {
              target.textContent = originalText;
              finishEdit();
            }
          }

          target.addEventListener('blur', finishEdit);
          target.addEventListener('keydown', handleEditKeydown);
        }
        return;
      }
      target = target.parentElement;
    }
  }, true);

  // Track scroll for overlay positioning
  var scrollTimeout = null;
  window.addEventListener('scroll', function() {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(function() {
      window.parent.postMessage({
        type: 'SCROLL_UPDATE',
        scrollTop: window.scrollY,
        scrollLeft: window.scrollX
      }, '*');
    }, 16); // ~60fps throttle
  }, true);

  // Listen for parent messages
  window.addEventListener('message', function(e) {
    var data = e.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'GET_TREE': {
        var tree = getFullTree();
        window.parent.postMessage({ type: 'TREE_DATA', elements: tree }, '*');
        break;
      }

      case 'GET_ELEMENT': {
        var el = document.querySelector('[data-bf-id="' + data.bfId + '"]');
        var info = el ? getElementInfo(el) : null;
        window.parent.postMessage({ type: 'ELEMENT_DATA', bfId: data.bfId, element: info }, '*');
        break;
      }

      case 'SCROLL_TO': {
        var scrollEl = document.querySelector('[data-bf-id="' + data.bfId + '"]');
        if (scrollEl) {
          scrollEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      }
    }
  });

  // Notify parent that iframe is ready
  // Use a small delay to ensure React has rendered
  var readyCheck = setInterval(function() {
    if (document.querySelector('[data-bf-id]')) {
      clearInterval(readyCheck);
      var tree = getFullTree();
      window.parent.postMessage({ type: 'READY' }, '*');
      window.parent.postMessage({ type: 'TREE_DATA', elements: tree }, '*');
    }
  }, 100);

  // Fallback: send ready after 3 seconds even if no bf-id elements found
  setTimeout(function() {
    clearInterval(readyCheck);
    window.parent.postMessage({ type: 'READY' }, '*');
    var tree = getFullTree();
    window.parent.postMessage({ type: 'TREE_DATA', elements: tree }, '*');
  }, 3000);
})();
`;
}
