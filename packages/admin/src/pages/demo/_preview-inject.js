// Preview controls injection script
export function generatePreviewScript(previewData) {
  return `
(function() {
  var previewData = ${JSON.stringify(previewData)};

  function init() {
    // Inject CSS styles
    var style = document.createElement('style');
    style.textContent =
      '.preview-controls { position: fixed; top: 0; left: 0; right: 0; background: rgba(26, 26, 46, 0); backdrop-filter: blur(8px); border-bottom: 1px solid rgba(233, 69, 96, 0); padding: 6px 12px; z-index: 10000; display: flex; align-items: center; gap: 12px; min-height: 36px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0); transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease, transform 0.2s ease; opacity: 0.6; }' +
      '.preview-controls:hover, .preview-controls:focus-within { background: rgba(26, 26, 46, 0.95); border-bottom-color: rgba(233, 69, 96, 0.3); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); opacity: 1; }' +
      '.preview-label { color: rgba(255, 255, 255, 0.7); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-family: system-ui, -apple-system, sans-serif; }' +
      '.theme-selector { display: flex; gap: 8px; }' +
      '.theme-btn { padding: 4px 10px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s ease; text-decoration: none; font-family: system-ui, -apple-system, sans-serif; }' +
      '.theme-btn:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(233, 69, 96, 0.5); color: #ffffff; }' +
      '.theme-btn.active { background: rgba(233, 69, 96, 0.2); border-color: #e94560; color: #e94560; }' +
      '.preview-actions { margin-left: auto; display: flex; align-items: center; gap: 8px; }' +
      '.preview-badge { padding: 3px 8px; background: rgba(233, 69, 96, 0.15); color: #e94560; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; font-family: system-ui, -apple-system, sans-serif; }' +
      '.preview-toggle { border: 1px solid rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.06); color: #f0f0f0; border-radius: 6px; padding: 2px 8px; font-size: 12px; cursor: pointer; transition: all 0.2s ease; }' +
      '.preview-toggle:hover { background: rgba(255, 255, 255, 0.12); border-color: rgba(233, 69, 96, 0.5); }' +
      '.preview-mini-toggle { position: fixed; top: 8px; right: 10px; z-index: 10001; border: 1px solid rgba(233, 69, 96, 0.45); background: rgba(26, 26, 46, 0.85); color: #f3f3f3; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; cursor: pointer; opacity: 0; pointer-events: none; transform: translateY(-6px); transition: all 0.2s ease; }' +
      'body[data-preview-controls="minimized"] .preview-controls { opacity: 0; pointer-events: none; transform: translateY(-110%); }' +
      'body[data-preview-controls="minimized"] .preview-mini-toggle { opacity: 1; pointer-events: auto; transform: translateY(0); }' +
      'body { padding-top: 44px !important; }' +
      'body[data-preview-controls="minimized"] { padding-top: 0 !important; }';
    document.head.appendChild(style);

    // Build theme buttons HTML
    var themeButtons = previewData.themes.map(function(theme) {
      var isActive = theme.id === previewData.theme;
      var url = '/demo' + previewData.currentPath + '?theme=' + theme.id;
      var activeClass = isActive ? ' active' : '';
      return '<a href="' + url + '" class="theme-btn' + activeClass + '">' + theme.name + '</a>';
    }).join('');

    // Build preview controls HTML
    var controlsHTML =
      '<div class="preview-controls" id="preview-controls">' +
        '<span class="preview-label">Theme:</span>' +
        '<div class="theme-selector">' + themeButtons + '</div>' +
        '<div class="preview-actions">' +
          '<span class="preview-badge">PREVIEW</span>' +
          '<button type="button" class="preview-toggle" data-preview-toggle="minimize"' +
                  ' aria-controls="preview-controls" aria-expanded="true"' +
                  ' title="Minimize preview controls">&minus;</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="preview-mini-toggle" data-preview-toggle="expand"' +
              ' aria-controls="preview-controls" aria-expanded="false"' +
              ' title="Expand preview controls">Preview</button>';

    // Inject controls at the start of body
    document.body.insertAdjacentHTML('afterbegin', controlsHTML);

    // Setup minimize/expand functionality
    var previewBase = "/demo";
    var previewTheme = previewData.theme;
    var previewStateKey = "artis:preview-controls";

    function setPreviewState(state, persist) {
      if (persist === undefined) persist = true;
      document.body.dataset.previewControls = state;
      var expanded = state !== "minimized";
      document.querySelectorAll("[data-preview-toggle]").forEach(function(btn) {
        btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      if (persist) {
        try {
          localStorage.setItem(previewStateKey, state);
        } catch (e) {
          // Storage might be unavailable in private mode
        }
      }
    }

    // Restore saved state
    try {
      var savedState = localStorage.getItem(previewStateKey);
      if (savedState === "expanded" || savedState === "minimized") {
        setPreviewState(savedState, false);
      } else {
        setPreviewState("minimized", false);
      }
    } catch (e) {
      setPreviewState("minimized", false);
    }

    // Attach event listeners
    document.querySelectorAll('[data-preview-toggle="minimize"]').forEach(function(btn) {
      btn.addEventListener("click", function() { setPreviewState("minimized"); });
    });

    document.querySelectorAll('[data-preview-toggle="expand"]').forEach(function(btn) {
      btn.addEventListener("click", function() { setPreviewState("expanded"); });
    });

    // Link rewriting functionality
    function isExcludedPreviewPath(pathname) {
      return [
        "/themes/",
        "/files/",
        "/assets/",
        "/favicon",
        "/robots.txt",
        "/api/"
      ].some(function(prefix) { return pathname.startsWith(prefix); });
    }

    function rewritePreviewLinks() {
      var links = document.querySelectorAll("a[href]");
      links.forEach(function(link) {
        var rawHref = link.getAttribute("href");
        if (!rawHref) return;

        // Skip special protocols
        if (rawHref.startsWith("#")) return;
        if (rawHref.startsWith("mailto:")) return;
        if (rawHref.startsWith("tel:")) return;
        if (rawHref.startsWith("javascript:")) return;

        var url;
        try {
          url = new URL(rawHref, window.location.href);
        } catch (e) {
          return;
        }

        // Skip external links
        if (url.origin !== window.location.origin) return;

        // Skip if already in preview scope
        if (url.pathname === previewBase || url.pathname.startsWith(previewBase + '/')) return;

        // Skip excluded paths
        if (isExcludedPreviewPath(url.pathname)) return;

        // Rewrite to preview URL
        var nextPath = url.pathname === "/" ? "" : url.pathname;
        var nextUrl = new URL(previewBase + nextPath, window.location.origin);

        // Preserve theme parameter
        var themeValue = previewTheme || url.searchParams.get("theme");
        if (themeValue) {
          nextUrl.searchParams.set("theme", themeValue);
        }

        // Copy other query params
        url.searchParams.forEach(function(value, key) {
          if (key === "theme") return;
          nextUrl.searchParams.set(key, value);
        });

        // Preserve hash
        nextUrl.hash = url.hash;

        // Update the link
        link.setAttribute("href", nextUrl.pathname + nextUrl.search + nextUrl.hash);
      });
    }

    // Debounced rewrite scheduler
    var rewriteQueued = false;
    function scheduleRewrite() {
      if (rewriteQueued) return;
      rewriteQueued = true;
      requestAnimationFrame(function() {
        rewriteQueued = false;
        rewritePreviewLinks();
      });
    }

    // Watch for DOM changes and rewrite new links
    var observer = new MutationObserver(scheduleRewrite);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["href"]
    });

    // Initial rewrite
    scheduleRewrite();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
  `;
}
