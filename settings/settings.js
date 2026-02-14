/**
 * DevCurl Settings - Header filter settings logic
 * Standalone page, can be loaded in iframe overlay from panel
 */
(function () {
  "use strict";

  var CATEGORIES = {
    "chromium-client-hints": {
      label: "Chromium Client Hints",
      match: function (name) {
        return /^sec-ch-ua(-|$)/.test(name);
      },
    },
    "fetch-metadata": {
      label: "Fetch Metadata",
      match: function (name) {
        return /^sec-fetch-/.test(name);
      },
    },
    "http2-pseudo": {
      label: "HTTP/2 Pseudo-headers",
      match: function (name) {
        return /^:/.test(name);
      },
    },
    "other-browser": {
      label: "기타 브라우저 헤더",
      match: function (name) {
        return ["upgrade-insecure-requests", "priority"].indexOf(name) !== -1;
      },
    },
    custom: {
      label: "커스텀",
      match: function () {
        return true;
      },
    },
  };

  var PRESET_ORDER = ["essential", "default", "include-all"];
  var DEFAULT_HEADERS = [];

  var state = {
    filteredHeaders: [],
    activePreset: null,
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    if (str == null) return "";
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function getCategory(headerName) {
    var name = (headerName || "").toLowerCase();
    if (CATEGORIES["chromium-client-hints"].match(name))
      return "chromium-client-hints";
    if (CATEGORIES["fetch-metadata"].match(name)) return "fetch-metadata";
    if (CATEGORIES["http2-pseudo"].match(name)) return "http2-pseudo";
    if (CATEGORIES["other-browser"].match(name)) return "other-browser";
    return "custom";
  }

  function arraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false;
    var sa = a.slice().sort();
    var sb = b.slice().sort();
    for (var i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  }

  function detectActivePreset() {
    if (!window.HeaderFilter || !window.HeaderFilter.PRESETS) return null;
    var presets = window.HeaderFilter.PRESETS;
    for (var i = 0; i < PRESET_ORDER.length; i++) {
      var key = PRESET_ORDER[i];
      var preset = presets[key];
      if (preset && arraysEqual(state.filteredHeaders, preset)) return key;
    }
    return null;
  }

  function dispatchToParent(eventName) {
    var target = window.parent !== window ? window.parent : window;
    try {
      target.dispatchEvent(new CustomEvent(eventName));
    } catch (e) {}
  }

  function refreshList() {
    if (!window.HeaderFilter) return;
    window.HeaderFilter.getFilteredHeaders(function (list) {
      state.filteredHeaders = list || [];
      state.activePreset = detectActivePreset();
      renderHeaderList();
      updatePresetButtons();
    });
  }

  function groupHeadersByCategory(headers) {
    var groups = {};
    var order = [
      "chromium-client-hints",
      "fetch-metadata",
      "http2-pseudo",
      "other-browser",
      "custom",
    ];
    order.forEach(function (key) {
      groups[key] = [];
    });
    headers.forEach(function (h) {
      var cat = getCategory(h);
      if (groups[cat]) groups[cat].push(h);
    });
    return groups;
  }

  function renderHeaderList() {
    var container = getEl("headerList");
    if (!container) return;

    if (state.filteredHeaders.length === 0) {
      container.innerHTML =
        '<div class="header-list-empty">필터된 헤더가 없습니다. (전체 포함 모드)</div>';
      return;
    }

    var groups = groupHeadersByCategory(state.filteredHeaders);
    container.innerHTML = "";

    [
      "chromium-client-hints",
      "fetch-metadata",
      "http2-pseudo",
      "other-browser",
      "custom",
    ].forEach(function (catKey) {
      var items = groups[catKey];
      if (!items || items.length === 0) return;

      var cat = CATEGORIES[catKey];
      var groupEl = document.createElement("div");
      groupEl.className = "header-group";
      groupEl.innerHTML =
        '<div class="group-header" data-category="' +
        escapeHtml(catKey) +
        '">' +
        '<span class="toggle-icon">▼</span>' +
        escapeHtml(cat.label) +
        " (" +
        items.length +
        ")" +
        "</div>" +
        '<div class="group-items"></div>';
      var itemsContainer = groupEl.querySelector(".group-items");

      items.forEach(function (headerName) {
        var item = document.createElement("label");
        item.className = "header-item";
        item.innerHTML =
          '<input type="checkbox" checked data-header="' +
          escapeHtml(headerName) +
          '">' +
          '<span class="header-name">' +
          escapeHtml(headerName) +
          "</span>";
        var cb = item.querySelector("input");
        cb.checked = true;
        cb.addEventListener("change", function () {
          handleCheckboxToggle(headerName, cb.checked);
        });
        itemsContainer.appendChild(item);
      });

      groupEl
        .querySelector(".group-header")
        .addEventListener("click", function () {
          groupEl.classList.toggle("collapsed");
        });
      container.appendChild(groupEl);
    });
  }

  function handleCheckboxToggle(headerName, checked) {
    if (!window.HeaderFilter) return;
    var cb = function () {
      dispatchToParent("devcurl-settings-changed");
      refreshList();
    };
    if (checked) {
      window.HeaderFilter.addCustomHeader(headerName, cb);
    } else {
      window.HeaderFilter.removeCustomHeader(headerName, cb);
    }
  }

  function updatePresetButtons() {
    var btns = document.querySelectorAll(".preset-btn");
    btns.forEach(function (btn) {
      var preset = btn.getAttribute("data-preset");
      btn.classList.toggle("active", state.activePreset === preset);
    });
  }

  function handlePresetClick(presetName) {
    if (!window.HeaderFilter || !window.HeaderFilter.applyPreset) return;
    window.HeaderFilter.applyPreset(presetName, function () {
      dispatchToParent("devcurl-settings-changed");
      refreshList();
    });
  }

  function handleAddHeader() {
    var input = getEl("customHeaderInput");
    var errEl = getEl("addError");
    if (!input || !errEl) return;

    var name = (input.value || "").trim().toLowerCase();
    errEl.classList.add("hidden");
    errEl.textContent = "";

    if (!name) {
      errEl.textContent = "헤더 이름을 입력하세요.";
      errEl.classList.remove("hidden");
      return;
    }
    if (state.filteredHeaders.indexOf(name) !== -1) {
      errEl.textContent = "이미 목록에 있습니다.";
      errEl.classList.remove("hidden");
      return;
    }

    if (!window.HeaderFilter || !window.HeaderFilter.addCustomHeader) return;
    window.HeaderFilter.addCustomHeader(name, function () {
      input.value = "";
      dispatchToParent("devcurl-settings-changed");
      refreshList();
    });
  }

  function handleReset() {
    if (!window.HeaderFilter || !window.HeaderFilter.resetToDefault) return;
    window.HeaderFilter.resetToDefault(function () {
      dispatchToParent("devcurl-settings-changed");
      refreshList();
    });
  }

  function handleClose() {
    dispatchToParent("devcurl-settings-closed");
  }

  function init() {
    if (window.HeaderFilter && window.HeaderFilter.DEFAULT_BROWSER_HEADERS) {
      DEFAULT_HEADERS = window.HeaderFilter.DEFAULT_BROWSER_HEADERS.slice();
    }

    refreshList();

    document.querySelectorAll(".preset-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        handlePresetClick(btn.getAttribute("data-preset"));
      });
    });

    var addBtn = getEl("addHeaderBtn");
    var customInput = getEl("customHeaderInput");
    if (addBtn) addBtn.addEventListener("click", handleAddHeader);
    if (customInput) {
      customInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") handleAddHeader();
      });
    }

    var resetBtn = getEl("resetBtn");
    if (resetBtn) resetBtn.addEventListener("click", handleReset);

    var closeBtn = getEl("closeBtn");
    if (closeBtn) closeBtn.addEventListener("click", handleClose);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
