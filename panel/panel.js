/**
 * DevCurl Panel - Main DevTools panel logic
 * Request capture, filtering, multi-format code generation, response view
 */
(function () {
  "use strict";

  var XHR_FETCH_TYPES = ["xhr", "fetch"];

  // State
  var state = {
    requests: [],
    selectedIndex: -1,
    urlSearch: "",
    methods: ["ALL"],
    statuses: ["ALL"],
    filteredHeaders: [],
    activeTab: "curl", // curl | fetch | axios | response
    selectedEntry: null,
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  function qs(sel, ctx) {
    return (ctx || document).querySelector(sel);
  }

  function qsAll(sel, ctx) {
    return (ctx || document).querySelectorAll(sel);
  }

  // Check if request is XHR or Fetch
  function isXhrOrFetch(entry) {
    var rt = entry._resourceType;
    if (!rt) return true;
    return XHR_FETCH_TYPES.indexOf(String(rt).toLowerCase()) !== -1;
  }

  // Extract pathname from URL
  function getPathname(url) {
    try {
      return new URL(url).pathname || url;
    } catch (e) {
      return url;
    }
  }

  // Debounce helper
  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(null, args);
        timer = null;
      }, ms);
    };
  }

  // Get status class (2xx, 3xx, etc.)
  function getStatusClass(statusCode) {
    if (!statusCode) return "other";
    var n = parseInt(statusCode, 10);
    if (n >= 200 && n < 300) return "2xx";
    if (n >= 300 && n < 400) return "3xx";
    if (n >= 400 && n < 500) return "4xx";
    if (n >= 500) return "5xx";
    return "other";
  }

  // Get method class
  function getMethodClass(method) {
    var m = (method || "GET").toUpperCase();
    var map = {
      GET: "get",
      POST: "post",
      PUT: "put",
      DELETE: "delete",
      PATCH: "patch",
    };
    return map[m] || "other";
  }

  // Filter requests based on state
  function getFilteredRequests() {
    var url = state.urlSearch.trim().toLowerCase();
    var methods = state.methods;
    var statuses = state.statuses;
    var allMethods = methods.indexOf("ALL") !== -1;
    var allStatuses = statuses.indexOf("ALL") !== -1;

    return state.requests.filter(function (entry) {
      var req = entry.request || {};
      var res = entry.response || {};
      var path = getPathname(req.url || "");
      var method = (req.method || "GET").toUpperCase();
      var status = res.status || 0;
      var statusClass = getStatusClass(status);

      if (url && path.toLowerCase().indexOf(url) === -1) return false;
      if (!allMethods && methods.indexOf(method) === -1) return false;
      if (!allStatuses && statuses.indexOf(statusClass) === -1) return false;
      return true;
    });
  }

  // Render request list
  function renderRequestList() {
    var list = getEl("requestList");
    if (!list) return;

    var filtered = getFilteredRequests();
    list.innerHTML = "";

    filtered.forEach(function (entry, idx) {
      var req = entry.request || {};
      var res = entry.response || {};
      var method = req.method || "GET";
      var path = getPathname(req.url || "");
      var status = res.status || "—";
      var methodClass = getMethodClass(method);
      var statusClass = getStatusClass(status);

      var li = document.createElement("li");
      li.className =
        "request-item" + (state.selectedIndex === idx ? " selected" : "");
      li.setAttribute("role", "option");
      li.setAttribute("data-index", String(idx));
      li.innerHTML =
        '<span class="method-badge ' +
        methodClass +
        '">' +
        escapeHtml(method) +
        "</span>" +
        '<span class="request-path" title="' +
        escapeHtml(path) +
        '">' +
        escapeHtml(path || "/") +
        "</span>" +
        '<span class="request-status status-' +
        statusClass +
        '">' +
        escapeHtml(String(status)) +
        "</span>";
      li.addEventListener("click", function () {
        selectRequest(parseInt(li.getAttribute("data-index"), 10));
      });
      list.appendChild(li);
    });
  }

  function escapeHtml(str) {
    if (str == null) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Select request and update detail view
  function selectRequest(index) {
    var filtered = getFilteredRequests();
    if (index < 0 || index >= filtered.length) {
      state.selectedIndex = -1;
      state.selectedEntry = null;
      showEmptyState();
      return;
    }
    state.selectedIndex = index;
    state.selectedEntry = filtered[index];
    renderRequestList();
    renderDetail(state.selectedEntry);
  }

  function showEmptyState() {
    var empty = getEl("emptyState");
    var content = getEl("detailContent");
    if (empty) empty.classList.remove("hidden");
    if (content) content.classList.add("hidden");
  }

  function hideEmptyState() {
    var empty = getEl("emptyState");
    var content = getEl("detailContent");
    if (empty) empty.classList.add("hidden");
    if (content) content.classList.remove("hidden");
  }

  // ─── Syntax Highlighting ───

  // curl syntax highlighting
  function highlightCurl(text) {
    var escaped = escapeHtml(text);
    return escaped
      .replace(/\bcurl\b/g, '<span class="syn-keyword">curl</span>')
      .replace(/(-[XHdbF])(?=\s|$)/g, function (m) {
        return '<span class="syn-flag">' + m + "</span>";
      })
      .replace(/'(https?:\/\/[^']*)'/g, function (m, url) {
        return '\'<span class="syn-url">' + url + "</span>'";
      });
  }

  // JavaScript syntax highlighting (fetch / axios)
  function highlightJs(text) {
    var escaped = escapeHtml(text);
    return (
      escaped
        // Keywords
        .replace(
          /\b(const|let|var|await|async|new|return|function|import|from|true|false|null)\b/g,
          '<span class="syn-keyword">$1</span>',
        )
        // String values (single-quoted)
        .replace(
          /'([^'\\]*(\\.[^'\\]*)*)'/g,
          "'<span class=\"syn-string\">$1</span>'",
        )
        // Methods / properties
        .replace(
          /\b(fetch|axios|JSON|FormData|response|data|formData)\b/g,
          '<span class="syn-builtin">$1</span>',
        )
        // Method calls
        .replace(
          /\.(stringify|get|post|put|patch|delete|append|json)\b/g,
          '.<span class="syn-method">$1</span>',
        )
        // Object keys
        .replace(
          /(\s+)(method|headers|body|params)(\s*:)/g,
          '$1<span class="syn-key">$2</span>$3',
        )
        // Comments
        .replace(/(\/\/.*)/g, '<span class="syn-comment">$1</span>')
    );
  }

  // JSON syntax highlighting
  function highlightJson(text) {
    var escaped = escapeHtml(text);
    return (
      escaped
        // Keys
        .replace(
          /&quot;([^&]*?)&quot;\s*:/g,
          '&quot;<span class="syn-key">$1</span>&quot;:',
        )
        // String values
        .replace(
          /:\s*&quot;([^&]*?)&quot;/g,
          ': &quot;<span class="syn-string">$1</span>&quot;',
        )
        // Numbers
        .replace(/:\s*(\d+\.?\d*)/g, ': <span class="syn-number">$1</span>')
        // Booleans and null
        .replace(
          /:\s*(true|false|null)\b/g,
          ': <span class="syn-keyword">$1</span>',
        )
    );
  }

  // ─── Detail Rendering ───

  // Render detail view based on active tab
  function renderDetail(entry) {
    hideEmptyState();

    if (!window.CurlGenerator || !window.HeaderFilter) {
      var codeEl = getEl("codeOutput");
      if (codeEl) codeEl.innerHTML = "Libraries not loaded.";
      return;
    }

    var summary = window.CurlGenerator.extractResponseSummary(entry);
    var statusClass = getStatusClass(summary.statusCode);

    // Response summary
    var statusDot = getEl("statusDot");
    var statusCode = getEl("statusCode");
    var statusText = getEl("statusText");
    var contentType = getEl("contentType");
    var responseTime = getEl("responseTime");

    if (statusDot) {
      statusDot.className = "status-dot status-" + statusClass;
    }
    if (statusCode) {
      statusCode.textContent = summary.statusCode || "—";
      statusCode.className = "status-code status-" + statusClass;
    }
    if (statusText) statusText.textContent = summary.statusText || "—";
    if (contentType) contentType.textContent = summary.contentType || "—";
    if (responseTime)
      responseTime.textContent =
        summary.responseTime >= 0 ? summary.responseTime + "ms" : "—";

    // Render active tab content
    renderActiveTab(entry);
  }

  // Render the currently active tab
  function renderActiveTab(entry) {
    if (!entry) return;

    var codePanel = getEl("codePanel");
    var responsePanel = getEl("responsePanel");

    if (state.activeTab === "response") {
      // Show response panel, hide code panel
      if (codePanel) codePanel.classList.add("hidden");
      if (responsePanel) responsePanel.classList.remove("hidden");
      renderResponseTab(entry);
    } else {
      // Show code panel, hide response panel
      if (codePanel) codePanel.classList.remove("hidden");
      if (responsePanel) responsePanel.classList.add("hidden");
      renderCodeTab(entry, state.activeTab);
    }
  }

  // Render code tab (curl, fetch, axios)
  function renderCodeTab(entry, format) {
    window.HeaderFilter.getFilteredHeaders(function (filtered) {
      state.filteredHeaders = filtered;
      var code = "";
      var highlighted = "";

      switch (format) {
        case "curl":
          code = window.CurlGenerator.generateCurl(entry, filtered);
          highlighted = highlightCurl(code);
          break;
        case "fetch":
          if (window.CodeGenerator) {
            code = window.CodeGenerator.generateFetch(entry, filtered);
          }
          highlighted = highlightJs(code);
          break;
        case "axios":
          if (window.CodeGenerator) {
            code = window.CodeGenerator.generateAxios(entry, filtered);
          }
          highlighted = highlightJs(code);
          break;
        default:
          code = window.CurlGenerator.generateCurl(entry, filtered);
          highlighted = highlightCurl(code);
      }

      var codeEl = getEl("codeOutput");
      if (codeEl) {
        codeEl.innerHTML = highlighted;
      }
    });
  }

  // Render response tab
  function renderResponseTab(entry) {
    if (!window.CodeGenerator) return;

    var resp = window.CodeGenerator.extractResponse(entry);

    // Response headers
    var headersBody = getEl("responseHeadersBody");
    var headerCount = getEl("headerCount");

    if (headersBody) {
      headersBody.innerHTML = "";
      resp.headers.forEach(function (h) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td class="header-name">' +
          escapeHtml(h.name) +
          "</td>" +
          '<td class="header-value">' +
          escapeHtml(h.value) +
          "</td>";
        headersBody.appendChild(tr);
      });
    }

    if (headerCount) {
      headerCount.textContent = resp.headers.length;
    }

    // Response body
    var bodyEl = getEl("responseBody");
    if (bodyEl) {
      if (resp.bodyParsed) {
        var prettyJson = JSON.stringify(resp.bodyParsed, null, 2);
        bodyEl.innerHTML = highlightJson(prettyJson);
      } else if (resp.body) {
        bodyEl.textContent = resp.body;
      } else {
        bodyEl.innerHTML =
          '<span class="syn-comment">// No response body</span>';
      }
    }
  }

  // ─── Tab Management ───

  function initTabs() {
    qsAll(".detail-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        var tabName = tab.getAttribute("data-tab");
        if (!tabName) return;

        // Update active state
        state.activeTab = tabName;
        qsAll(".detail-tab").forEach(function (t) {
          t.classList.toggle("active", t.getAttribute("data-tab") === tabName);
        });

        // Re-render if we have a selected entry
        if (state.selectedEntry) {
          renderActiveTab(state.selectedEntry);
        }
      });
    });
  }

  // ─── Response Headers Toggle ───

  function initResponseHeadersToggle() {
    var toggle = getEl("responseHeadersToggle");
    var headers = getEl("responseHeaders");
    if (toggle && headers) {
      toggle.addEventListener("click", function () {
        var isCollapsed = headers.classList.contains("collapsed");
        headers.classList.toggle("collapsed");
        var icon = toggle.querySelector(".toggle-icon");
        if (icon) {
          icon.textContent = isCollapsed ? "▼" : "▶";
        }
      });
    }
  }

  // ─── Copy to Clipboard ───

  function copyCode() {
    var codeEl = getEl("codeOutput");
    if (!codeEl) return;

    var text = codeEl.textContent || codeEl.innerText;
    if (!text) return;

    var btn = getEl("copyBtn");
    performCopy(text, btn);
  }

  function copyResponse() {
    var bodyEl = getEl("responseBody");
    if (!bodyEl) return;

    var text = bodyEl.textContent || bodyEl.innerText;
    if (!text) return;

    var btn = getEl("copyResponseBtn");
    performCopy(text, btn);
  }

  function performCopy(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(function () {
          showCopiedFeedback(btn);
        })
        .catch(function () {
          fallbackCopy(text, btn);
        });
    } else {
      fallbackCopy(text, btn);
    }
  }

  function fallbackCopy(text, btn) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showCopiedFeedback(btn);
    } catch (e) {
      if (btn) btn.textContent = "Copy failed";
      setTimeout(function () {
        if (btn) btn.textContent = "Copy";
      }, 1500);
    }
    document.body.removeChild(ta);
  }

  function showCopiedFeedback(btn) {
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(function () {
      btn.textContent = orig;
      btn.classList.remove("copied");
    }, 1500);
  }

  // ─── Request Management ───

  function addRequest(entry) {
    if (!entry || !entry.request) return;
    if (!isXhrOrFetch(entry)) return;

    state.requests.push(entry);
    renderRequestList();
  }

  function clearRequests() {
    state.requests = [];
    state.selectedIndex = -1;
    state.selectedEntry = null;
    renderRequestList();
    showEmptyState();
  }

  // ─── Filter Handlers ───

  function initFilters() {
    var urlInput = getEl("urlSearch");
    if (urlInput) {
      urlInput.addEventListener(
        "input",
        debounce(function () {
          state.urlSearch = urlInput.value;
          renderRequestList();
          if (state.selectedIndex >= 0) {
            var filtered = getFilteredRequests();
            if (state.selectedIndex < filtered.length) {
              renderDetail(filtered[state.selectedIndex]);
            } else {
              showEmptyState();
            }
          }
        }, 300),
      );
    }

    // Method filters
    qsAll("#methodFilters .filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var method = btn.getAttribute("data-method");
        if (method === "ALL") {
          state.methods = ["ALL"];
          qsAll("#methodFilters .filter-btn").forEach(function (b) {
            b.classList.toggle(
              "active",
              b.getAttribute("data-method") === "ALL",
            );
          });
        } else {
          state.methods = state.methods.filter(function (m) {
            return m !== "ALL";
          });
          if (state.methods.indexOf(method) !== -1) {
            state.methods = state.methods.filter(function (m) {
              return m !== method;
            });
          } else {
            state.methods.push(method);
          }
          if (state.methods.length === 0) state.methods = ["ALL"];
          qsAll("#methodFilters .filter-btn").forEach(function (b) {
            var m = b.getAttribute("data-method");
            b.classList.toggle(
              "active",
              m === "ALL"
                ? state.methods.indexOf("ALL") !== -1
                : state.methods.indexOf(m) !== -1,
            );
          });
        }
        renderRequestList();
        updateDetailIfSelected();
      });
    });

    // Status filters
    qsAll("#statusFilters .filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var status = btn.getAttribute("data-status");
        if (status === "ALL") {
          state.statuses = ["ALL"];
          qsAll("#statusFilters .filter-btn").forEach(function (b) {
            b.classList.toggle(
              "active",
              b.getAttribute("data-status") === "ALL",
            );
          });
        } else {
          state.statuses = state.statuses.filter(function (s) {
            return s !== "ALL";
          });
          if (state.statuses.indexOf(status) !== -1) {
            state.statuses = state.statuses.filter(function (s) {
              return s !== status;
            });
          } else {
            state.statuses.push(status);
          }
          if (state.statuses.length === 0) state.statuses = ["ALL"];
          qsAll("#statusFilters .filter-btn").forEach(function (b) {
            var s = b.getAttribute("data-status");
            b.classList.toggle(
              "active",
              s === "ALL"
                ? state.statuses.indexOf("ALL") !== -1
                : state.statuses.indexOf(s) !== -1,
            );
          });
        }
        renderRequestList();
        updateDetailIfSelected();
      });
    });
  }

  function updateDetailIfSelected() {
    if (state.selectedIndex < 0) return;
    var filtered = getFilteredRequests();
    if (state.selectedIndex < filtered.length) {
      state.selectedEntry = filtered[state.selectedIndex];
      renderDetail(state.selectedEntry);
    } else {
      showEmptyState();
    }
  }

  // ─── Settings Overlay ───

  var settingsOverlay = null;
  var settingsMessageHandler = null;

  function showSettingsOverlay() {
    if (settingsOverlay) return;

    var overlay = document.createElement("div");
    overlay.id = "devcurl-settings-overlay";
    overlay.className = "settings-overlay";
    var settingsUrl =
      typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL("settings/settings.html")
        : "../settings/settings.html";
    overlay.innerHTML =
      '<div class="settings-overlay-backdrop"></div>' +
      '<div class="settings-overlay-frame">' +
      '<iframe src="' +
      settingsUrl +
      '" title="헤더 필터 설정"></iframe>' +
      "</div>";

    overlay
      .querySelector(".settings-overlay-backdrop")
      .addEventListener("click", closeSettingsOverlay);

    overlay._escHandler = function (e) {
      if (e.key === "Escape") closeSettingsOverlay();
    };
    document.addEventListener("keydown", overlay._escHandler);

    settingsMessageHandler = function (e) {
      if (e.type === "devcurl-settings-closed") {
        closeSettingsOverlay();
      } else if (e.type === "devcurl-settings-changed") {
        updateDetailIfSelected();
      }
    };

    window.addEventListener("devcurl-settings-closed", settingsMessageHandler);
    window.addEventListener("devcurl-settings-changed", settingsMessageHandler);

    document.body.appendChild(overlay);
    settingsOverlay = overlay;
  }

  function closeSettingsOverlay() {
    if (!settingsOverlay) return;
    window.removeEventListener(
      "devcurl-settings-closed",
      settingsMessageHandler,
    );
    window.removeEventListener(
      "devcurl-settings-changed",
      settingsMessageHandler,
    );
    if (settingsOverlay._escHandler) {
      document.removeEventListener("keydown", settingsOverlay._escHandler);
    }
    settingsMessageHandler = null;
    settingsOverlay.remove();
    settingsOverlay = null;
  }

  // ─── Bottom Actions ───

  function initActions() {
    var clearBtn = getEl("clearBtn");
    if (clearBtn) clearBtn.addEventListener("click", clearRequests);

    var settingsBtn = getEl("settingsBtn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", showSettingsOverlay);
    }

    var copyBtn = getEl("copyBtn");
    if (copyBtn) copyBtn.addEventListener("click", copyCode);

    var copyResponseBtn = getEl("copyResponseBtn");
    if (copyResponseBtn)
      copyResponseBtn.addEventListener("click", copyResponse);
  }

  // ─── Compact Mode ───

  function initCompactMode() {
    var leftPanel = document.querySelector(".left-panel");
    var toggle = getEl("panelToggle");
    var container = document.querySelector(".panel-container");

    function checkWidth() {
      var w = window.innerWidth;
      if (w < 600) {
        if (toggle) toggle.classList.remove("hidden");
        if (container) container.classList.add("compact");
      } else {
        if (toggle) toggle.classList.add("hidden");
        if (container) container.classList.remove("compact");
        if (leftPanel) leftPanel.classList.remove("collapsed");
        if (toggle) toggle.classList.remove("collapsed");
      }
    }

    if (toggle && leftPanel) {
      toggle.addEventListener("click", function () {
        leftPanel.classList.toggle("collapsed");
        toggle.classList.toggle("collapsed");
      });
    }

    window.addEventListener("resize", debounce(checkWidth, 100));
    checkWidth();
  }

  // ─── Chrome DevTools Network Capture ───

  function initNetworkCapture() {
    if (
      typeof chrome === "undefined" ||
      !chrome.devtools ||
      !chrome.devtools.network
    ) {
      return;
    }

    chrome.devtools.network.onRequestFinished.addListener(function (request) {
      addRequest(request);
    });

    chrome.devtools.network.getHAR(function (harLog) {
      if (!harLog || !harLog.entries) return;
      harLog.entries.forEach(function (entry) {
        addRequest(entry);
      });
    });
  }

  // ─── Init ───

  function init() {
    initFilters();
    initTabs();
    initActions();
    initResponseHeadersToggle();
    initCompactMode();
    initNetworkCapture();
    renderRequestList();
    showEmptyState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
