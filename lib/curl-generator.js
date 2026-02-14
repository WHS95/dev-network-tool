/**
 * DevCurl - HAR to cURL conversion library
 * Chrome Extension (Manifest V3) - Vanilla JS, no bundler
 * Exposed as window.CurlGenerator for script tag loading
 */
(function (global) {
  'use strict';

  /**
   * Escapes single quotes in a value for use inside single-quoted curl strings.
   * Bash escaping: 'value with '\'' apostrophe'
   */
  function escapeForSingleQuotes(str) {
    if (str == null || typeof str !== 'string') return '';
    return str.replace(/'/g, "'\\''");
  }

  /**
   * Builds curl header flag: -H 'Name: value'
   */
  function buildHeaderFlag(name, value) {
    return "-H '" + escapeForSingleQuotes(name + ': ' + value) + "'";
  }

  /**
   * Builds curl cookie flag: -b 'cookie_value'
   */
  function buildCookieFlag(value) {
    return "-b '" + escapeForSingleQuotes(value) + "'";
  }

  /**
   * Processes request body based on Content-Type
   */
  function processBody(harEntry) {
    var postData = harEntry.request && harEntry.request.postData;
    if (!postData) return null;

    var mimeType = (postData.mimeType || '').toLowerCase();
    var params = postData.params;
    var text = postData.text;

    // application/json
    if (mimeType.indexOf('application/json') !== -1 && text) {
      return "-d '" + escapeForSingleQuotes(text.trim()) + "'";
    }

    // application/x-www-form-urlencoded
    if (mimeType.indexOf('application/x-www-form-urlencoded') !== -1) {
      if (text) {
        return "-d '" + escapeForSingleQuotes(text.trim()) + "'";
      }
      if (params && params.length > 0) {
        var pairs = params.map(function (p) {
          return encodeURIComponent(p.name) + '=' + encodeURIComponent(p.value || '');
        });
        return "-d '" + escapeForSingleQuotes(pairs.join('&')) + "'";
      }
    }

    // multipart/form-data
    if (mimeType.indexOf('multipart/form-data') !== -1 && params && params.length > 0) {
      return params.map(function (p) {
        if (p.fileName) {
          return "-F '" + escapeForSingleQuotes(p.name + '=@' + p.fileName) + "'";
        }
        return "-F '" + escapeForSingleQuotes(p.name + '=' + (p.value || '')) + "'";
      });
    }

    // Fallback: raw text
    if (text) {
      return "-d '" + escapeForSingleQuotes(text.trim()) + "'";
    }

    return null;
  }

  /**
   * Generates multi-line curl command from HAR entry
   * @param {Object} harEntry - HAR request entry from chrome.devtools.network
   * @param {string[]} filteredHeaders - Header names to exclude (lowercase)
   * @returns {string} Multi-line curl command
   */
  function generateCurl(harEntry, filteredHeaders) {
    filteredHeaders = filteredHeaders || [];
    var filterSet = {};
    filteredHeaders.forEach(function (h) {
      filterSet[h.toLowerCase()] = true;
    });

    var request = harEntry.request || {};
    var url = request.url || '';
    var method = (request.method || 'GET').toUpperCase();
    var headers = request.headers || [];

    var parts = [];

    // 1. URL
    parts.push("curl '" + escapeForSingleQuotes(url) + "'");

    // 2. HTTP Method (skip for GET)
    if (method !== 'GET') {
      parts.push('-X ' + method);
    }

    // 3 & 4. Headers (exclude filtered, Cookie uses -b)
    var cookieValue = null;
    headers.forEach(function (h) {
      var name = (h.name || '').trim();
      var value = (h.value || '').trim();
      var nameLower = name.toLowerCase();

      if (filterSet[nameLower]) return;
      if (nameLower === 'cookie') {
        cookieValue = value;
        return;
      }
      if (!name) return;

      parts.push(buildHeaderFlag(name, value));
    });

    // 5. Cookie (after headers, use -b)
    if (cookieValue) {
      parts.push(buildCookieFlag(cookieValue));
    }

    // 6. Body
    var bodyResult = processBody(harEntry);
    if (bodyResult) {
      if (Array.isArray(bodyResult)) {
        bodyResult.forEach(function (flag) {
          parts.push(flag);
        });
      } else {
        parts.push(bodyResult);
      }
    }

    // 7. Assembly with line breaks
    return parts.join(' \\\n  ');
  }

  /**
   * Generates single-line curl command
   * @param {Object} harEntry - HAR request entry
   * @param {string[]} filteredHeaders - Header names to exclude (lowercase)
   * @returns {string} Single-line curl command
   */
  function generateCurlOneline(harEntry, filteredHeaders) {
    var multiline = generateCurl(harEntry, filteredHeaders);
    return multiline.replace(/\s*\\\s*\n\s*/g, ' ').trim();
  }

  /**
   * Extracts response summary from HAR entry
   * @param {Object} harEntry - HAR request entry
   * @returns {Object} { statusCode, statusText, contentType, responseTime, size }
   */
  function extractResponseSummary(harEntry) {
    var response = harEntry.response || {};
    var content = response.content || {};
    var headers = response.headers || [];

    var contentType = '';
    headers.forEach(function (h) {
      if ((h.name || '').toLowerCase() === 'content-type') {
        contentType = (h.value || '').split(';')[0].trim();
      }
    });
    if (!contentType && content.mimeType) {
      contentType = content.mimeType.split(';')[0].trim();
    }

    return {
      statusCode: response.status || 0,
      statusText: response.statusText || '',
      contentType: contentType,
      responseTime: Math.round(harEntry.time || 0),
      size: content.size || 0
    };
  }

  global.CurlGenerator = {
    generateCurl: generateCurl,
    generateCurlOneline: generateCurlOneline,
    extractResponseSummary: extractResponseSummary
  };
})(typeof window !== 'undefined' ? window : this);
