/**
 * DevCurl - Code Generator (fetch / axios)
 * Generates clean backend API call code from HAR entries
 * Exposed as window.CodeGenerator for script tag loading
 */
(function (global) {
  "use strict";

  /**
   * Headers that are browser-only and should always be excluded
   * in backend API call context (more aggressive than curl filter)
   */
  var BACKEND_NOISE_HEADERS = [
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    "sec-ch-ua-full-version-list",
    "sec-ch-ua-arch",
    "sec-ch-ua-bitness",
    "sec-ch-ua-model",
    "sec-fetch-dest",
    "sec-fetch-mode",
    "sec-fetch-site",
    "sec-fetch-user",
    "upgrade-insecure-requests",
    "priority",
    ":method",
    ":authority",
    ":scheme",
    ":path",
    "accept-encoding",
    "accept-language",
    "connection",
    "host",
    "user-agent",
    "referer",
    "origin",
    "cache-control",
    "pragma",
    "dnt",
  ];

  /**
   * Checks if a header should be included in backend code
   */
  function shouldIncludeHeader(name, filteredHeaders) {
    var lower = name.toLowerCase();

    // Always exclude browser noise
    for (var i = 0; i < BACKEND_NOISE_HEADERS.length; i++) {
      if (BACKEND_NOISE_HEADERS[i] === lower) return false;
    }

    // Also exclude user-configured filtered headers
    if (Array.isArray(filteredHeaders)) {
      for (var j = 0; j < filteredHeaders.length; j++) {
        if (
          filteredHeaders[j] &&
          String(filteredHeaders[j]).toLowerCase() === lower
        ) {
          return false;
        }
      }
    }

    // Exclude cookie (backend typically uses token auth)
    if (lower === "cookie") return false;

    return true;
  }

  /**
   * Extracts clean headers object from HAR entry
   * Returns array of { name, value } with only essential headers
   */
  function getCleanHeaders(harEntry, filteredHeaders) {
    var headers = (harEntry.request && harEntry.request.headers) || [];
    var clean = [];

    headers.forEach(function (h) {
      var name = (h.name || "").trim();
      var value = (h.value || "").trim();
      if (!name) return;
      if (shouldIncludeHeader(name, filteredHeaders)) {
        clean.push({ name: name, value: value });
      }
    });

    return clean;
  }

  /**
   * Extracts request body as a structured object or string
   */
  function getBodyInfo(harEntry) {
    var postData = harEntry.request && harEntry.request.postData;
    if (!postData) return null;

    var mimeType = (postData.mimeType || "").toLowerCase();
    var text = postData.text;
    var params = postData.params;

    // JSON body - try to parse for pretty display
    if (mimeType.indexOf("application/json") !== -1 && text) {
      try {
        var parsed = JSON.parse(text);
        return { type: "json", data: parsed, raw: text };
      } catch (e) {
        return { type: "json", data: null, raw: text };
      }
    }

    // URL-encoded
    if (mimeType.indexOf("application/x-www-form-urlencoded") !== -1) {
      if (text) {
        return { type: "urlencoded", raw: text };
      }
      if (params && params.length > 0) {
        var pairs = params.map(function (p) {
          return (
            encodeURIComponent(p.name) + "=" + encodeURIComponent(p.value || "")
          );
        });
        return { type: "urlencoded", raw: pairs.join("&") };
      }
    }

    // Multipart
    if (
      mimeType.indexOf("multipart/form-data") !== -1 &&
      params &&
      params.length > 0
    ) {
      return { type: "multipart", params: params };
    }

    // Fallback raw
    if (text) {
      return { type: "raw", raw: text };
    }

    return null;
  }

  /**
   * Pretty-prints a JavaScript value as code
   */
  function prettyPrintValue(val, indent) {
    indent = indent || "  ";
    return JSON.stringify(val, null, 2)
      .split("\n")
      .map(function (line, idx) {
        return idx === 0 ? line : indent + line;
      })
      .join("\n");
  }

  // ─── fetch Generator ───

  /**
   * Generates clean fetch() code from HAR entry
   * @param {Object} harEntry - HAR request entry
   * @param {string[]} filteredHeaders - Header names to exclude
   * @returns {string} JavaScript fetch code
   */
  function generateFetch(harEntry, filteredHeaders) {
    var request = harEntry.request || {};
    var url = request.url || "";
    var method = (request.method || "GET").toUpperCase();
    var headers = getCleanHeaders(harEntry, filteredHeaders);
    var bodyInfo = getBodyInfo(harEntry);

    var lines = [];
    var optionParts = [];

    // Method (skip for GET)
    if (method !== "GET") {
      optionParts.push("  method: '" + method + "'");
    }

    // Headers
    if (headers.length > 0) {
      var headerLines = headers.map(function (h) {
        return "    '" + h.name + "': '" + escapeJs(h.value) + "'";
      });
      optionParts.push("  headers: {\n" + headerLines.join(",\n") + "\n  }");
    }

    // Body
    if (bodyInfo && method !== "GET") {
      if (bodyInfo.type === "json") {
        if (bodyInfo.data) {
          var bodyStr = prettyPrintValue(bodyInfo.data, "    ");
          optionParts.push("  body: JSON.stringify(" + bodyStr + ")");
        } else {
          optionParts.push("  body: '" + escapeJs(bodyInfo.raw) + "'");
        }
      } else if (bodyInfo.type === "urlencoded") {
        optionParts.push("  body: '" + escapeJs(bodyInfo.raw) + "'");
      } else if (bodyInfo.type === "multipart") {
        // FormData approach
        lines.push("const formData = new FormData();");
        bodyInfo.params.forEach(function (p) {
          if (p.fileName) {
            lines.push(
              "formData.append('" +
                escapeJs(p.name) +
                "', file); // " +
                p.fileName,
            );
          } else {
            lines.push(
              "formData.append('" +
                escapeJs(p.name) +
                "', '" +
                escapeJs(p.value || "") +
                "');",
            );
          }
        });
        lines.push("");
        optionParts.push("  body: formData");
      } else if (bodyInfo.raw) {
        optionParts.push("  body: '" + escapeJs(bodyInfo.raw) + "'");
      }
    }

    // Build fetch call
    if (optionParts.length === 0) {
      lines.push("const response = await fetch('" + escapeJs(url) + "');");
    } else {
      lines.push("const response = await fetch('" + escapeJs(url) + "', {");
      lines.push(optionParts.join(",\n"));
      lines.push("});");
    }

    lines.push("");
    lines.push("const data = await response.json();");

    return lines.join("\n");
  }

  // ─── axios Generator ───

  /**
   * Generates clean axios code from HAR entry
   * @param {Object} harEntry - HAR request entry
   * @param {string[]} filteredHeaders - Header names to exclude
   * @returns {string} JavaScript axios code
   */
  function generateAxios(harEntry, filteredHeaders) {
    var request = harEntry.request || {};
    var url = request.url || "";
    var method = (request.method || "GET").toUpperCase();
    var methodLower = method.toLowerCase();
    var headers = getCleanHeaders(harEntry, filteredHeaders);
    var bodyInfo = getBodyInfo(harEntry);

    var lines = [];

    // Methods with body: post, put, patch
    var hasBody =
      bodyInfo && (method === "POST" || method === "PUT" || method === "PATCH");

    // Build headers object string
    var headersStr = null;
    if (headers.length > 0) {
      var headerLines = headers.map(function (h) {
        return "    '" + h.name + "': '" + escapeJs(h.value) + "'";
      });
      headersStr = "{\n" + headerLines.join(",\n") + "\n  }";
    }

    // Build body string
    var bodyStr = null;
    if (hasBody) {
      if (bodyInfo.type === "json" && bodyInfo.data) {
        bodyStr = prettyPrintValue(bodyInfo.data, "  ");
      } else if (bodyInfo.type === "multipart") {
        lines.push("const formData = new FormData();");
        bodyInfo.params.forEach(function (p) {
          if (p.fileName) {
            lines.push(
              "formData.append('" +
                escapeJs(p.name) +
                "', file); // " +
                p.fileName,
            );
          } else {
            lines.push(
              "formData.append('" +
                escapeJs(p.name) +
                "', '" +
                escapeJs(p.value || "") +
                "');",
            );
          }
        });
        lines.push("");
        bodyStr = "formData";
      } else if (bodyInfo.raw) {
        bodyStr = "'" + escapeJs(bodyInfo.raw) + "'";
      }
    }

    // For methods with body: axios.post(url, data, { headers })
    if (hasBody) {
      if (headersStr) {
        lines.push(
          "const { data } = await axios." +
            methodLower +
            "('" +
            escapeJs(url) +
            "', " +
            (bodyStr || "null") +
            ", {",
        );
        lines.push("  headers: " + headersStr);
        lines.push("});");
      } else {
        lines.push(
          "const { data } = await axios." +
            methodLower +
            "('" +
            escapeJs(url) +
            "', " +
            (bodyStr || "null") +
            ");",
        );
      }
    }
    // For GET/DELETE/HEAD: axios.get(url, { headers, params })
    else {
      if (headersStr) {
        lines.push(
          "const { data } = await axios." +
            methodLower +
            "('" +
            escapeJs(url) +
            "', {",
        );
        lines.push("  headers: " + headersStr);
        lines.push("});");
      } else {
        lines.push(
          "const { data } = await axios." +
            methodLower +
            "('" +
            escapeJs(url) +
            "');",
        );
      }
    }

    return lines.join("\n");
  }

  // ─── Response Extractor ───

  /**
   * Extracts response details from HAR entry
   * @param {Object} harEntry - HAR request entry
   * @returns {Object} { headers, body, bodyParsed, mimeType }
   */
  function extractResponse(harEntry) {
    var response = harEntry.response || {};
    var content = response.content || {};
    var headers = response.headers || [];

    var mimeType = "";
    var cleanHeaders = [];

    headers.forEach(function (h) {
      var name = (h.name || "").trim();
      var value = (h.value || "").trim();
      if (name) {
        cleanHeaders.push({ name: name, value: value });
        if (name.toLowerCase() === "content-type") {
          mimeType = value;
        }
      }
    });

    if (!mimeType && content.mimeType) {
      mimeType = content.mimeType;
    }

    var body = content.text || "";
    var bodyParsed = null;

    // Try JSON pretty-print
    if (mimeType.indexOf("application/json") !== -1 && body) {
      try {
        bodyParsed = JSON.parse(body);
      } catch (e) {
        bodyParsed = null;
      }
    }

    return {
      headers: cleanHeaders,
      body: body,
      bodyParsed: bodyParsed,
      mimeType: mimeType.split(";")[0].trim(),
    };
  }

  /**
   * Escape string for JavaScript single-quoted strings
   */
  function escapeJs(str) {
    if (str == null || typeof str !== "string") return "";
    return str
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }

  global.CodeGenerator = {
    generateFetch: generateFetch,
    generateAxios: generateAxios,
    extractResponse: extractResponse,
    getCleanHeaders: getCleanHeaders,
  };
})(typeof window !== "undefined" ? window : this);
