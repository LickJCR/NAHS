  function collectRuntimeConfig(config) {
    return {
      autoRefill: config.autoRefill === true,
      targetAliveSize: parsePositiveInt(config.targetAliveSize, 10, 0),
      aliveThreshold: parsePositiveInt(config.aliveThreshold, 5, 0),
      replenishBatchSize: parsePositiveInt(config.replenishBatchSize, 10, 1),
      monitorIntervalSec: parsePositiveInt(config.monitorIntervalSec, 60, 5),
      updatedAt: nowIso(),
    };
  }

  function collectRuntimeEditorConfig() {
    const panel = document.getElementById(SCRIPT_ID);
    const config = {
      autoRefill: qs('[data-nai-runtime-check="autoRefill"]', panel)?.checked === true,
      targetAliveSize: qs('[data-nai-runtime-field="targetAliveSize"]', panel)?.value || DEFAULT_CONFIG.targetAliveSize,
      aliveThreshold: qs('[data-nai-runtime-field="aliveThreshold"]', panel)?.value || DEFAULT_CONFIG.aliveThreshold,
      replenishBatchSize: qs('[data-nai-runtime-field="replenishBatchSize"]', panel)?.value || DEFAULT_CONFIG.replenishBatchSize,
      monitorIntervalSec: qs('[data-nai-runtime-field="monitorIntervalSec"]', panel)?.value || DEFAULT_CONFIG.monitorIntervalSec,
    };
    return collectRuntimeConfig(config);
  }

  function runtimeConfigSummary(runtimeConfig) {
    if (!runtimeConfig) return '-';
    return `${runtimeConfig.autoRefill === false ? '手动监控' : '自动补货'} / 保活 ${runtimeConfig.targetAliveSize} / 低于 ${runtimeConfig.aliveThreshold} / 添加 ${runtimeConfig.replenishBatchSize} / 间隔 ${runtimeConfig.monitorIntervalSec} 秒`;
  }

  function configForJob(job) {
    const snapshot = job?.configSnapshot || collectConfig(false);
    const runtime = job?.runtimeConfig || collectRuntimeConfig(snapshot);
    return {
      ...snapshot,
      autoRefill: runtime.autoRefill !== false,
      targetAliveSize: String(runtime.targetAliveSize),
      aliveThreshold: String(runtime.aliveThreshold),
      replenishBatchSize: String(runtime.replenishBatchSize),
      monitorIntervalSec: String(runtime.monitorIntervalSec),
    };
  }

  function applyRuntimeJobConfig() {
    const job = state.activeJob;
    if (!job || job.stopped) return;
    const nextConfig = collectRuntimeEditorConfig();
    const previous = runtimeConfigSummary(job.runtimeConfig);
    const next = runtimeConfigSummary(nextConfig);
    const ok = window.confirm(`确认将当前作业策略更新为：${next}？`);
    if (!ok) return;
    job.runtimeConfig = nextConfig;
    state.strategyDirty = false;
    recordJobLog(job, `运行策略已更新：${previous} -> ${next}。`);
    if (!job.paused && !job.stopped) startMonitorLoop();
    persistWorkspaceState();
    updateJobStats();
    updateJobControls();
  }

  function setTypePickerOpen(open) {
    const trigger = qs('[data-nai-type-trigger]');
    const menu = qs('[data-nai-type-menu]');
    if (!trigger || !menu) return;
    trigger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  }

  function updateTypePicker() {
    const select = qs('#nai-typePreset');
    const trigger = qs('[data-nai-type-trigger]');
    const menu = qs('[data-nai-type-menu]');
    if (!select || !trigger || !menu) return;
    trigger.innerHTML = renderTypePickerValue(select.value);
    menu.innerHTML = renderTypeMenuOptions(select.value);
  }

  function chooseTypePreset(value) {
    const select = qs('#nai-typePreset');
    if (!select) return;
    select.value = String(value);
    updateTypePicker();
    setTypePickerOpen(false);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setupTypePicker(panel) {
    const trigger = qs('[data-nai-type-trigger]', panel);
    const menu = qs('[data-nai-type-menu]', panel);
    if (!trigger || !menu) return;

    trigger.addEventListener('click', () => {
      setTypePickerOpen(trigger.getAttribute('aria-expanded') !== 'true');
    });

    menu.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const option = event.target.closest('[data-nai-type-option]');
      if (!option) return;
      chooseTypePreset(option.getAttribute('data-nai-type-option'));
    });

    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setTypePickerOpen(false);
    });

    document.addEventListener('click', (event) => {
      const picker = qs('[data-nai-type-picker]', panel);
      if (picker?.contains(event.target)) return;
      setTypePickerOpen(false);
    });
  }

  function togglePanel(open) {
    state.open = open;
    const panel = document.getElementById(SCRIPT_ID);
    if (panel) panel.setAttribute('data-open', String(open));
  }

  function collectConfig(includeKeys = true) {
    const panel = document.getElementById(SCRIPT_ID);
    const config = { ...DEFAULT_CONFIG };
    for (const id of fieldIds) {
      const el = qs(`[data-nai-field="${id}"]`, panel);
      if (el) config[id] = el.value;
    }
    for (const id of checkboxIds) {
      const el = qs(`[data-nai-check="${id}"]`, panel);
      if (el) config[id] = el.checked;
    }
    if (includeKeys) {
      config.keys = qs('#nai-keys', panel)?.value || '';
    }
    collectNameConfig(panel, config);
    return config;
  }

  function collectNameConfig(panel, config) {
    const saved = loadConfig();
    const segments = qsa('[data-nai-name-segment-type]', panel).map((el) => normalizeSegmentType(el.value));
    config.nameSegments = segments.length ? segments.slice(0, MAX_NAME_SEGMENTS) : normalizeNameSegments(saved.nameSegments, saved);

    const settings = normalizeNameSegmentSettings(saved.nameSegmentSettings, saved);
    qsa('[data-nai-name-setting]', panel).forEach((el) => {
      const path = String(el.getAttribute('data-nai-name-setting') || '').split('.');
      if (path.length !== 2) return;
      const [slot, key] = path;
      if (!settings[slot]) settings[slot] = defaultSegmentSettings(slot);
      settings[slot][key] = el.value;
    });
    config.nameSegmentSettings = settings;
  }

  function renderNameEditor(config) {
    const builderHost = qs('#nai-nameBuilderHost');
    const settingsHost = qs('#nai-nameSettingsHost');
    if (builderHost) builderHost.innerHTML = renderNameBuilderHtml(config);
    if (settingsHost) settingsHost.innerHTML = renderNameSegmentSettingsHtml(config);
  }

  function getChannelType(config) {
    const value = config.typePreset || DEFAULT_CONFIG.typePreset;
    const type = Number.parseInt(value, 10);
    if (!Number.isInteger(type) || type < 0) {
      throw new Error('类型编号无效');
    }
    return type;
  }

  function stripKeyCandidate(value) {
    return String(value || '')
      .trim()
      .replace(/^```[a-zA-Z0-9_-]*\s*/, '')
      .replace(/```$/, '')
      .replace(/^\s*(?:[-*]|\d+[.)])\s+/, '')
      .replace(/^\s*(?:api[-_\s]*)?key\s*[:=]\s*/i, '')
      .replace(/^\s*(?:token|secret|authorization)\s*[:=]\s*/i, '')
      .replace(/^Bearer\s+/i, '')
      .replace(/^["'`]+|["'`,;]+$/g, '')
      .trim();
  }

  function looksLikePlainKey(value) {
    const text = stripKeyCandidate(value);
    if (text.length < 16) return false;
    if (/^(?:api\s*)?key$|^name$|^model$|^models$/i.test(text)) return false;
    if (/^https?:\/\//i.test(text)) return false;
    if (/[,，;]/.test(text)) return false;
    return !/\s/.test(text);
  }

  function looksLikeLoosePrefixedKey(value) {
    const text = stripKeyCandidate(value);
    if (text.length < 8) return false;
    if (/^https?:\/\//i.test(text)) return false;
    if (/[,，;\s]/.test(text)) return false;
    return /^(?:sk-|sk-ant-|xai-|gsk_|hf_|AIza|ya29\.)/i.test(text);
  }

  function extractKnownKeyTokens(value) {
    const text = String(value || '');
    const patterns = [
      /sk-ant-[A-Za-z0-9._-]{12,}/g,
      /sk-[A-Za-z0-9._-]{12,}/g,
      /AIza[0-9A-Za-z_-]{20,}/g,
      /xai-[A-Za-z0-9._-]{12,}/g,
      /gsk_[A-Za-z0-9._-]{12,}/g,
      /hf_[A-Za-z0-9._-]{12,}/g,
      /ya29\.[A-Za-z0-9._-]{12,}/g,
      /[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g,
    ];
    return patterns.flatMap((pattern) => text.match(pattern) || []).map(stripKeyCandidate);
  }

  function collectJsonKeys(value, keys) {
    if (typeof value === 'string') {
      const candidate = stripKeyCandidate(value);
      if (looksLikePlainKey(candidate)) keys.push(candidate);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => collectJsonKeys(item, keys));
      return;
    }
    if (!value || typeof value !== 'object') return;

    if (
      typeof value.private_key === 'string' &&
      typeof value.client_email === 'string'
    ) {
      keys.push(JSON.stringify(value));
      return;
    }
    if (
      typeof value.access_token === 'string' &&
      typeof value.refresh_token === 'string' &&
      (typeof value.account_id === 'string' || typeof value.account_id === 'number')
    ) {
      keys.push(JSON.stringify(value));
      return;
    }

    for (const [key, item] of Object.entries(value)) {
      if (/(api[-_ ]?key|key|token|secret|credential)/i.test(key)) {
        collectJsonKeys(item, keys);
      }
    }
  }

  function addKeyCandidate(keys, raw, allowFallback = true, allowLoosePrefixed = false) {
    const knownTokens = extractKnownKeyTokens(raw);
    if (knownTokens.length > 0) {
      keys.push(...knownTokens);
      return;
    }

    const candidate = stripKeyCandidate(raw);
    if (!candidate) return;
    const keyValueMatch = candidate.match(/^(?:[A-Za-z0-9_. -]+)?(?:api[-_ ]?key|key|token|secret|credential)\s*[:=]\s*(.+)$/i);
    const normalized = keyValueMatch ? stripKeyCandidate(keyValueMatch[1]) : candidate;
    if (allowFallback && looksLikePlainKey(normalized)) keys.push(normalized);
    if (allowLoosePrefixed && looksLikeLoosePrefixedKey(normalized)) keys.push(normalized);
  }

  function parseKeys(raw, dedupe, options = {}) {
    const text = String(raw || '').trim();
    const keys = [];
    if (!text) return keys;
    const allowLoosePrefixed = Boolean(options.allowLoosePrefixed);

    try {
      const parsed = JSON.parse(text);
      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        typeof parsed.private_key === 'string' &&
        typeof parsed.client_email === 'string'
      ) {
        keys.push(text);
      } else {
        collectJsonKeys(parsed, keys);
      }
    } catch {
      /* continue with text extraction */
    }

    const normalized = text
      .replace(/\r/g, '\n')
      .replace(/[，；;]/g, '\n')
      .replace(/```[a-zA-Z0-9_-]*\n/g, '')
      .replace(/```/g, '');

    normalized
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((line) => {
        if (/^(?:#|\/\/)/.test(line)) return;
        addKeyCandidate(keys, line, true, allowLoosePrefixed);
        line
          .split(/[,，\t]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((part) => addKeyCandidate(keys, part, true, allowLoosePrefixed));
      });

    if (!dedupe) return keys;
    return Array.from(new Set(keys));
  }

  function normalizeList(raw) {
    return Array.from(
      new Set(
        String(raw || '')
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).join(',');
  }

  function parseOptionalJsonObject(raw, label) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return null;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`${label} 不是有效 JSON: ${error.message}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} 必须是 JSON 对象`);
    }
    return parsed;
  }

  function normalizeOptionalJsonString(raw, label) {
    const parsed = parseOptionalJsonObject(raw, label);
    return parsed ? JSON.stringify(parsed) : null;
  }

  function normalizeModelMapping(raw) {
    const parsed = parseOptionalJsonObject(raw, '模型映射');
    if (!parsed) return null;
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') {
        throw new Error(`模型映射 ${key} 的值必须是字符串`);
      }
    }
    return JSON.stringify(parsed);
  }

  function numberToken(settings, index) {
    const start = Number.parseInt(settings.numberStart || '1', 10);
    const pad = Math.max(0, Number.parseInt(settings.numberPad || '0', 10) || 0);
    const value = (Number.isFinite(start) ? start : 1) + index;
    return String(value).padStart(pad, '0');
  }

  function alphaToIndex(value) {
    const text = String(value || 'A').trim();
    const first = text[0] || 'A';
    const code = first.toUpperCase().charCodeAt(0);
    if (code < 65 || code > 90) return 0;
    return code - 65;
  }

  function indexToAlpha(index, uppercase) {
    let value = Math.max(0, index);
    let output = '';
    do {
      output = String.fromCharCode(65 + (value % 26)) + output;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    return uppercase ? output : output.toLowerCase();
  }

  function randomCode(length = 6) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  }

  function formatDateByPattern(date, pattern) {
    const pad = (value) => String(value).padStart(2, '0');
    const milli = String(date.getMilliseconds()).padStart(3, '0');
    const tokens = {
      yyyy: String(date.getFullYear()),
      YYYY: String(date.getFullYear()),
      MM: pad(date.getMonth() + 1),
      dd: pad(date.getDate()),
      DD: pad(date.getDate()),
      HH: pad(date.getHours()),
      mm: pad(date.getMinutes()),
      ss: pad(date.getSeconds()),
      SSS: milli,
    };
    return String(pattern || 'yyyyMMdd-HHmmss').replace(/yyyy|YYYY|SSS|MM|dd|DD|HH|mm|ss/g, (token) => tokens[token] ?? token);
  }

  function timestampToken(date = new Date(), format = 'yyyyMMdd-HHmmss') {
    return formatDateByPattern(date, format);
  }

  function dateToken(date = new Date(), format = 'yyyyMMdd') {
    return formatDateByPattern(date, format);
  }

  function keyPreview(key) {
    if (!key) return '';
    if (key.length <= 12) return `${key.slice(0, 4)}...`;
    return `${key.slice(0, 8)}...${key.slice(-4)}`;
  }

  function ensureNameSeed(config, keys) {
    const seedKey = JSON.stringify({
      keys,
      nameSegments: normalizeNameSegments(config.nameSegments, config),
      nameSegmentSettings: normalizeNameSegmentSettings(config.nameSegmentSettings, config),
    });
    if (state.nameSeedKey === seedKey) return;
    state.nameSeedKey = seedKey;
    state.nameTimestamp = new Date().toISOString();
    state.nameDate = state.nameTimestamp;
    state.randomCodes = new Map();
  }

  function stableRandomCode(key, index, slot = '') {
    const cacheKey = `${slot}:${index}:${key}`;
    if (!state.randomCodes.has(cacheKey)) {
      state.randomCodes.set(cacheKey, randomCode(6));
    }
    return state.randomCodes.get(cacheKey);
  }

  function makeName(config, key, index) {
    const segments = normalizeNameSegments(config.nameSegments, config);
    const settings = normalizeNameSegmentSettings(config.nameSegmentSettings, config);
    const seedDate = new Date(state.nameTimestamp || Date.now());
    return segments.map((type, segmentIndex) => {
      const slot = slotLabel(segmentIndex);
      const setting = settings[slot] || defaultSegmentSettings(slot);
      if (type === 'text') return String(setting.text || '');
      if (type === 'num') return numberToken(setting, index);
      if (type === 'alpha') {
        const alphaStart = String(setting.alphaStart || 'A');
        const uppercase = alphaStart[0] !== alphaStart[0]?.toLowerCase();
        return indexToAlpha(alphaToIndex(alphaStart) + index, uppercase);
      }
      if (type === 'rand6') return stableRandomCode(key, index, slot);
      if (type === 'ts') return timestampToken(seedDate, setting.tsFormat || 'yyyyMMdd-HHmmss');
      if (type === 'date') return dateToken(seedDate, setting.dateFormat || 'yyyyMMdd');
      if (type === 'key8') return String(key || '').slice(0, 8);
      return '';
    }).join('');
  }

  function buildRowsForKeys(config, keys, startIndex = 0) {
    ensureNameSeed(config, keys);
    return keys.map((key, index) => ({
      index: startIndex + index,
      key,
      name: makeName(config, key, startIndex + index),
    }));
  }

  function buildRows(config) {
    const keys = parseKeys(config.keys, config.dedupeKeys);
    return buildRowsForKeys(config, keys, 0);
  }

  function validateJobConfig(config, rows = []) {
    getChannelType(config);
    if (rows.length && rows.some((row) => !String(row.name || '').trim())) throw new Error('名称组合不能为空');
    if (!normalizeList(config.models)) throw new Error('模型不能为空');
    if (!String(config.group || '').trim()) throw new Error('分组不能为空');
    normalizeModelMapping(config.modelMapping);
    normalizeOptionalJsonString(config.settingJson, 'setting JSON');
    normalizeOptionalJsonString(config.settingsJson, 'settings JSON');
    normalizeOptionalJsonString(config.paramOverride, 'param_override JSON');
    normalizeOptionalJsonString(config.headerOverride, 'header_override JSON');
    normalizeOptionalJsonString(config.statusCodeMapping, 'status_code_mapping JSON');
  }

  function validateConfig(config, rows) {
    validateJobConfig(config, rows);
    if (!rows.length) throw new Error('请先粘贴至少一个 API key');
  }

  function refreshPreview() {
    const preview = qs('#nai-preview');
    if (!preview) return;
    let rows = [];
    let error = '';
    try {
      const config = collectConfig(true);
      rows = buildRows(config);
      validateConfig({ ...config, keys: rows.map((row) => row.key).join('\n') }, rows);
    } catch (err) {
      error = err.message;
    }

    if (!rows.length) {
      preview.innerHTML = `<div class="nai-bulk-help" style="padding: 10px;">粘贴 key 后显示预览。</div>`;
      return;
    }

    const visibleRows = rows.slice(0, 50);
    const body = visibleRows
      .map(
        (row) => `
          <tr>
            <td>${row.index + 1}</td>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(keyPreview(row.key))}</td>
          </tr>
        `
      )
      .join('');

    const suffix =
      rows.length > visibleRows.length
        ? `<div class="nai-bulk-help" style="padding: 8px 9px;">只显示前 ${visibleRows.length} 条，共 ${rows.length} 条。</div>`
        : '';
    const errorHtml = error
      ? `<div class="nai-bulk-error" style="padding: 8px 9px;">${escapeHtml(error)}</div>`
      : `<div class="nai-bulk-ok" style="padding: 8px 9px;">预览 ${rows.length} 条，可提交。</div>`;

    preview.innerHTML = `
      ${errorHtml}
      <table>
        <thead><tr><th>#</th><th>渠道名</th><th>key</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      ${suffix}
    `;
  }

  function buildSettingJson(config) {
    const setting = parseOptionalJsonObject(config.settingJson, 'setting JSON') || {};
    return JSON.stringify({
      force_format: setting.force_format === true,
      thinking_to_content: setting.thinking_to_content === true,
      proxy: typeof setting.proxy === 'string' ? setting.proxy : '',
      pass_through_body_enabled: setting.pass_through_body_enabled === true,
      system_prompt: typeof setting.system_prompt === 'string' ? setting.system_prompt : '',
      system_prompt_override: setting.system_prompt_override === true,
    });
  }

  function buildOtherSettingsJson(config, type) {
    const settings = parseOptionalJsonObject(config.settingsJson, 'settings JSON') || {};

    if (type === 1 || type === 14) {
      settings.allow_service_tier = config.allowServiceTier === true;
    } else {
      delete settings.allow_service_tier;
    }

    if (type === 14) {
      settings.allow_inference_geo = config.allowInferenceGeo === true;
      settings.allow_speed = config.allowSpeed === true;
      settings.claude_beta_query = config.claudeBetaQuery === true;
    } else {
      delete settings.allow_speed;
      delete settings.claude_beta_query;
      if (type !== 1) delete settings.allow_inference_geo;
    }

    if (!('disable_task_polling_sleep' in settings)) {
      settings.disable_task_polling_sleep = false;
    }

    return JSON.stringify(settings);
  }

  function numberOrNull(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function buildPayload(row, config) {
    const type = getChannelType(config);
    const modelMapping = normalizeModelMapping(config.modelMapping);
    const payload = {
      mode: 'single',
      channel: {
        name: row.name,
        type,
        base_url: null,
        key: row.key,
        openai_organization: null,
        models: normalizeList(config.models),
        group: normalizeList(config.group),
        model_mapping: modelMapping,
        priority: numberOrNull(config.priority),
        weight: numberOrNull(config.weight),
        test_model: null,
        auto_ban: config.autoBan ? 1 : 0,
        status: config.status ? 1 : 2,
        status_code_mapping: normalizeOptionalJsonString(config.statusCodeMapping, 'status_code_mapping JSON'),
        tag: String(config.tag || '').trim() || null,
        remark: String(config.remark || ''),
        setting: buildSettingJson(config),
        param_override: normalizeOptionalJsonString(config.paramOverride, 'param_override JSON'),
        header_override: normalizeOptionalJsonString(config.headerOverride, 'header_override JSON'),
        settings: buildOtherSettingsJson(config, type),
        other: String(config.other || ''),
      },
    };
    return payload;
  }

  function getApiRoot() {
    return API_ROOT;
  }

  function apiUrl(_config, suffix = '') {
    const root = getApiRoot();
    return `${root}${suffix}`;
  }

  function validateRemoteConfig(config = state.remoteConfig) {
    const remoteConfig = normalizeRemoteConfig(config);
    if (!remoteConfig.baseUrl) throw new Error('请先填写远端 NewAPI 地址。');
    if (!/^https?:\/\//iu.test(remoteConfig.baseUrl)) throw new Error('远端 NewAPI 地址必须包含 http:// 或 https://。');
    if (!remoteConfig.userId) throw new Error('请先填写远端 User ID。');
    if (!remoteConfig.userSecret) throw new Error('请先填写远端 User 密钥。');
    return remoteConfig;
  }

  function remoteApiUrl(url) {
    const remoteConfig = validateRemoteConfig();
    if (/^https?:\/\//iu.test(url)) return url;
    const path = String(url || '').startsWith('/') ? String(url) : `/${url}`;
    return `${remoteConfig.baseUrl}${path}`;
  }

  function remoteAuthHeaders(remoteConfig) {
    const headers = {
      'New-Api-User': remoteConfig.userId,
    };
    if (remoteConfig.authMode === 'bearer' || remoteConfig.authMode === 'both') {
      headers.Authorization = `Bearer ${remoteConfig.userSecret}`;
    }
    if (remoteConfig.authMode === 'new-api-key' || remoteConfig.authMode === 'both') {
      headers['New-Api-Key'] = remoteConfig.userSecret;
    }
    return headers;
  }

  function normalizeUserId(value) {
    const text = String(value ?? '').trim();
    if (!text || text === 'null' || text === 'undefined') return '';
    return text;
  }

  function getUserId() {
    try {
      const uid = normalizeUserId(localStorage.getItem('uid'));
      if (uid) return uid;
    } catch {
      /* fall through to old UI storage */
    }

    try {
      const rawUser = localStorage.getItem('user');
      if (!rawUser) return '';
      const user = JSON.parse(rawUser);
      return (
        normalizeUserId(user?.id) ||
        normalizeUserId(user?.user?.id) ||
        normalizeUserId(user?.data?.id)
      );
    } catch {
      return '';
    }
  }

  function parseApiResponseText(text, fallbackMessage = '') {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return { success: false, message: text || fallbackMessage };
    }
  }

  function remoteApiRequest(url, options = {}) {
    const remoteConfig = validateRemoteConfig();
    const headers = {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      ...remoteAuthHeaders(remoteConfig),
      ...options.headers,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const method = String(options.method || 'GET').toUpperCase();
    const targetUrl = remoteApiUrl(url);

    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method,
          url: targetUrl,
          headers,
          data: options.body,
          responseType: 'text',
          onload: (response) => {
            const data = parseApiResponseText(response.responseText, response.statusText);
            if (response.status < 200 || response.status >= 300) {
              reject(new Error(data?.message || `${response.status} ${response.statusText}`));
              return;
            }
            resolve(data);
          },
          onerror: () => reject(new Error('远端请求失败，请检查地址、跨域权限或网络。')),
          ontimeout: () => reject(new Error('远端请求超时。')),
        });
      });
    }

    return fetch(targetUrl, {
      ...options,
      method,
      headers,
      credentials: 'omit',
    }).then(async (response) => {
      const text = await response.text();
      const data = parseApiResponseText(text, response.statusText);
      if (!response.ok) {
        throw new Error(data?.message || `${response.status} ${response.statusText}`);
      }
      return data;
    });
  }

  async function apiRequest(url, options = {}) {
    if (state.operationMode === 'remote') {
      return remoteApiRequest(url, options);
    }

    const uid = getUserId();
    const headers = {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      ...options.headers,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (uid) {
      headers['New-Api-User'] = uid;
    }

    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
    });
    const text = await response.text();
    const data = parseApiResponseText(text, response.statusText);
    if (!response.ok) {
      const message = data?.message || `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return data;
  }

  function normalizeChannelResult(result) {
    const data = result?.data ?? result;
    if (!data || typeof data !== 'object') return null;
    return data.channel || data.item || data;
  }

  function channelsFromListResult(result) {
    const data = result?.data ?? result;
    const lists = [
      data?.items,
      data?.channels,
      data?.list,
      data?.rows,
      result?.items,
      result?.channels,
      Array.isArray(data) ? data : null,
    ];

    for (const list of lists) {
      if (Array.isArray(list)) return list.filter(Boolean);
    }
    return [];
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function parsePositiveInt(value, fallback, min = 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, parsed);
  }

  function sameLocalDate(iso, date = new Date()) {
    if (!iso) return false;
    const value = new Date(iso);
    return value.getFullYear() === date.getFullYear() &&
      value.getMonth() === date.getMonth() &&
      value.getDate() === date.getDate();
  }

  function formatLocalDateTime(iso) {
    if (!iso) return '-';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }

  function defaultJobName(config, date = new Date()) {
    const [, typeLabel] = channelTypeEntry(config.typePreset || DEFAULT_CONFIG.typePreset);
    return `${formatDateByPattern(date, 'yyyyMMdd-HHmmss')}-${typeLabel}`;
  }

  function resolveJobName(config) {
    return String(config.jobName || '').trim() || defaultJobName(config);
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '-';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${minutes}分`;
    if (minutes > 0) return `${minutes}分 ${seconds}秒`;
    return `${seconds}秒`;
  }

  function channelTimeToIso(value, fallback = null) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    const ms = numeric > 100000000000 ? numeric : numeric * 1000;
    return new Date(ms).toISOString();
  }

  function statusLabel(status) {
    if (Number(status) === 1) return '启用';
    if (Number(status) === 2) return '禁用';
    if (Number(status) === 3) return '自动禁用';
    return status === null || status === undefined ? '未知' : String(status);
  }

  function numericQuota(channel) {
    const value = Number(channel?.used_quota ?? channel?.usedQuota ?? channel?.UsedQuota ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  function ensureKeyPoolEntry(key) {
    if (state.keyPoolSet.has(key)) return null;
    const entry = {
      key,
      keyPreview: keyPreview(key),
      order: state.keyPool.length,
      addedAt: nowIso(),
      attemptedAt: null,
      usedAt: null,
      channelCreatedAt: null,
      channelId: null,
      channelName: '',
      status: null,
      statusText: '未使用',
      disabledAt: null,
      lastSeenAt: null,
      usedQuota: 0,
      batchNo: null,
      error: '',
    };
    state.keyPoolSet.add(key);
    state.keyPool.push(entry);
    return entry;
  }

  function syncKeyPoolFromInput(config, source = '', options = {}) {
    const keys = parseKeys(config.keys || qs('#nai-keys')?.value || '', config.dedupeKeys, options);
    let added = 0;
    for (const key of keys) {
      if (ensureKeyPoolEntry(key)) added += 1;
    }
    if (added > 0 && state.activeJob && source) {
      recordJobLog(state.activeJob, `key 库新增 ${added} 个 key（来源：${source}）。`);
    }
    return added;
  }

  function addKeysToPool() {
    const config = collectConfig(true);
    const added = syncKeyPoolFromInput(config, state.activeJob ? '手动入库' : '', {
      allowLoosePrefixed: true,
    });
    if (added > 0) {
      const keyInput = qs('#nai-keys');
      if (keyInput) keyInput.value = '';
      appendLog(`已添加 ${added} 个 key 到 key 库。`);
    } else {
      appendLog('没有发现新的有效 key，或这些 key 已经在库中。');
    }
    refreshPreview();
    updateJobStats();
    persistWorkspaceState();
    if (added > 0 && state.activeJob && !state.activeJob.stopped && !state.activeJob.paused) {
      void monitorActiveJob();
    }
  }

  function createJob(config) {
    const snapshot = { ...config };
    delete snapshot.keys;
    const name = resolveJobName(config);
    snapshot.jobName = name;
    return {
      id: `job-${Date.now()}`,
      name,
      site: currentSiteInfo(),
      startedAt: nowIso(),
      stoppedAt: null,
      stopped: false,
      paused: false,
      runtimeConfig: collectRuntimeConfig(config),
      nextIndex: 0,
      configSnapshot: snapshot,
      keys: state.keyPool,
      batches: [],
      logs: [],
      noKeyLogged: false,
    };
  }

  function recordJobLog(job, message, kind = '') {
    if (!job) return;
    const entry = {
      at: nowIso(),
      kind: kind || 'info',
      message,
    };
    job.logs.push(entry);
    appendLog(`[作业] ${message}`, kind === 'error' ? 'error' : '');
    persistWorkspaceState();
  }

  function usedEntries(job) {
    return (job?.keys || state.keyPool).filter((entry) => entry.attemptedAt);
  }

  function createdEntries(job) {
    return (job?.keys || state.keyPool).filter((entry) => entry.channelId || entry.channelCreatedAt);
  }

  function entryImportOrder(entry, fallbackIndex) {
    const order = Number(entry?.order);
    return Number.isFinite(order) ? order : fallbackIndex;
  }

  function entriesInImportOrder(entries) {
    return entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => entryImportOrder(a.entry, a.index) - entryImportOrder(b.entry, b.index) || a.index - b.index)
      .map(({ entry }) => entry);
  }

  function availableEntries(job) {
    return entriesInImportOrder((job?.keys || state.keyPool).filter((entry) => !entry.attemptedAt));
  }

  function calculateJobStats(job = state.activeJob) {
    const entries = job?.keys || state.keyPool;
    const attempted = entries.filter((entry) => entry.attemptedAt);
    const created = entries.filter((entry) => entry.channelId || entry.channelCreatedAt);
    const alive = created.filter((entry) => Number(entry.status) === 1);
    const disabled = created.filter((entry) => entry.status !== null && Number(entry.status) !== 1);
    const unknown = created.filter((entry) => entry.status === null);
    const quotas = created.map((entry) => Number(entry.usedQuota || 0)).filter(Number.isFinite);
    const now = Date.now();
    const lifetimes = created
      .map((entry) => {
        const start = Date.parse(entry.channelCreatedAt || entry.usedAt || entry.attemptedAt || '');
        if (!Number.isFinite(start)) return null;
        const end = Date.parse(entry.disabledAt || '') || now;
        return Math.max(0, end - start);
      })
      .filter((value) => value !== null);
    const firstCreated = created
      .map((entry) => entry.channelCreatedAt)
      .filter(Boolean)
      .sort()[0] || '';

    return {
      totalKeys: entries.length,
      unusedKeys: entries.filter((entry) => !entry.attemptedAt).length,
      attempted: attempted.length,
      created: created.length,
      alive: alive.length,
      disabled: disabled.length,
      unknown: unknown.length,
      todayCreated: created.filter((entry) => sameLocalDate(entry.channelCreatedAt)).length,
      batches: job?.batches?.length || 0,
      firstCreated,
      jobDurationMs: job ? now - Date.parse(job.startedAt) : 0,
      averageLifetimeMs: lifetimes.length ? lifetimes.reduce((sum, value) => sum + value, 0) / lifetimes.length : 0,
      totalQuota: quotas.reduce((sum, value) => sum + value, 0),
      averageQuota: quotas.length ? quotas.reduce((sum, value) => sum + value, 0) / quotas.length : 0,
      maxQuota: quotas.length ? Math.max(...quotas) : 0,
      minQuota: quotas.length ? Math.min(...quotas) : 0,
    };
  }

  function statCardHtml(label, value) {
    return `
      <div class="nai-job-stat">
        <div class="nai-job-stat-label">${escapeHtml(label)}</div>
        <div class="nai-job-stat-value">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function jobStatusSummary(job = state.activeJob) {
    if (!job) return '未开始';
    if (job.stopped) return '已结束';
    if (job.paused) return '暂停中';
    if (state.running) return '批次执行中';
    return '作业中';
  }

  function keyStatusSummary() {
    const entries = state.keyPool;
    const unused = entries.filter((entry) => !entry.attemptedAt).length;
    const creating = entries.filter((entry) => entry.statusText === '创建中').length;
    const created = entries.filter((entry) => entry.channelId || entry.channelCreatedAt).length;
    const failed = entries.filter((entry) => entry.statusText === '创建失败').length;
    const alive = entries.filter((entry) => (entry.channelId || entry.channelCreatedAt) && Number(entry.status) === 1).length;
    const dead = entries.filter((entry) => (entry.channelId || entry.channelCreatedAt) && entry.status !== null && Number(entry.status) !== 1).length;
    const attempted = entries.filter((entry) => entry.attemptedAt).length;
    const latestAdded = entries.map((entry) => entry.addedAt).filter(Boolean).sort().at(-1);
    const firstAdded = entries.map((entry) => entry.addedAt).filter(Boolean).sort()[0] || '';
    const durationMs = firstAdded ? Date.now() - Date.parse(firstAdded) : 0;
    return {
      total: entries.length,
      unused,
      creating,
      created,
      failed,
      alive,
      dead,
      attempted,
      latestAdded,
      firstAdded,
      durationMs,
    };
  }

  function updateKeyPoolView() {
    const listPanel = qs('#nai-keyListPanel');
    const statsPanel = qs('#nai-keyStatsPanel');
    const stats = keyStatusSummary();
    if (listPanel) {
      const rows = state.keyPool.slice(-80).reverse().map((entry) => `
        <div class="nai-key-row">
          <strong title="${escapeHtml(entry.keyPreview)}">${escapeHtml(entry.keyPreview)}</strong>
          <span>${escapeHtml(entry.statusText || '未使用')}</span>
        </div>
      `).join('');
      listPanel.innerHTML = rows
        ? `<div class="nai-key-list">${rows}</div>`
        : '<div class="nai-bulk-help" style="padding: 10px;">暂无 key。左上粘贴并点击添加入库后会显示在这里。</div>';
    }
    if (statsPanel) {
      statsPanel.innerHTML = `
        <div class="nai-key-summary">
          ${statCardHtml('总 key', String(stats.total))}
          ${statCardHtml('未使用', String(stats.unused))}
          ${statCardHtml('已使用', String(stats.attempted))}
          ${statCardHtml('存活 key', String(stats.alive))}
          ${statCardHtml('死亡 key', String(stats.dead))}
          ${statCardHtml('创建中', String(stats.creating))}
          ${statCardHtml('已创建', String(stats.created))}
          ${statCardHtml('创建失败', String(stats.failed))}
          ${statCardHtml('key 池持续', formatDuration(stats.durationMs))}
          ${statCardHtml('首次入库', formatLocalDateTime(stats.firstAdded))}
          ${statCardHtml('最近入库', formatLocalDateTime(stats.latestAdded))}
        </div>
      `;
    }
  }

  function updateJobStats() {
    const statsEl = qs('#nai-jobStats');
    const batchesEl = qs('#nai-jobBatches');
    updateKeyPoolView();
    if (!statsEl || !batchesEl) return;
    const job = state.activeJob;
    const stats = calculateJobStats(job);
    const runtimeConfigLabel = job ? runtimeConfigSummary(job.runtimeConfig) : '-';
    statsEl.innerHTML = [
      statCardHtml('作业状态', jobStatusSummary(job)),
      statCardHtml('运行策略', runtimeConfigLabel),
      statCardHtml('批次数', String(stats.batches)),
      statCardHtml('今日创建渠道', String(stats.todayCreated)),
      statCardHtml('第一个渠道时间', formatLocalDateTime(stats.firstCreated)),
      statCardHtml('作业持续', formatDuration(stats.jobDurationMs)),
      statCardHtml('平均存活', formatDuration(stats.averageLifetimeMs)),
      statCardHtml('总费用/额度', String(stats.totalQuota)),
      statCardHtml('平均费用/额度', stats.averageQuota.toFixed(2)),
      statCardHtml('最高费用/额度', String(stats.maxQuota)),
      statCardHtml('最低费用/额度', String(stats.minQuota)),
    ].join('');

    const batches = job?.batches || [];
    if (!batches.length) {
      batchesEl.innerHTML = '<div class="nai-bulk-help" style="padding: 9px;">暂无批次记录。</div>';
      return;
    }
    batchesEl.innerHTML = batches.slice(-10).reverse().map((batch) => `
      <div class="nai-job-batch-row">
        <span>#${escapeHtml(batch.no)}</span>
        <span>${escapeHtml(formatLocalDateTime(batch.startedAt))}</span>
        <span>${escapeHtml(batch.success)}/${escapeHtml(batch.size)}</span>
        <span>${escapeHtml(batch.reason || '')}</span>
      </div>
    `).join('');
  }

  function syncRuntimeFieldsFromJob(job) {
    if (!job?.runtimeConfig || state.strategyDirty) return;
    setRuntimeCheck('autoRefill', job.runtimeConfig.autoRefill !== false);
    setRuntimeField('targetAliveSize', String(job.runtimeConfig.targetAliveSize));
    setRuntimeField('aliveThreshold', String(job.runtimeConfig.aliveThreshold));
    setRuntimeField('replenishBatchSize', String(job.runtimeConfig.replenishBatchSize));
    setRuntimeField('monitorIntervalSec', String(job.runtimeConfig.monitorIntervalSec));
  }

  function updateJobPreview() {
    const preview = qs('#nai-jobPreview');
    if (!preview) return;
    const job = state.activeJob;
    const panel = document.getElementById(SCRIPT_ID);
    const rightOpen = panel?.getAttribute('data-nai-right-open') !== 'false';
    if (!job && !rightOpen) {
      preview.innerHTML = '';
      return;
    }
    if (!job) {
      const config = collectConfig(false);
      preview.innerHTML = `
        <div class="nai-job-preview-row"><span>预览名称</span><strong>${escapeHtml(resolveJobName(config))}</strong></div>
        <div class="nai-job-preview-row"><span>渠道类型</span><strong>${escapeHtml(channelTypeEntry(config.typePreset)[1])}</strong></div>
        <div class="nai-job-preview-row"><span>策略</span><strong>${escapeHtml(runtimeConfigSummary(collectRuntimeConfig(config)))}</strong></div>
        <div class="nai-job-preview-row"><span>状态</span><strong>尚未创建，右侧输入只会用于新作业。</strong></div>
      `;
      return;
    }
    const snapshot = job.configSnapshot || {};
    preview.innerHTML = `
      <div class="nai-job-preview-row"><span>作业名称</span><strong>${escapeHtml(job.name || job.id)}</strong></div>
      <div class="nai-job-preview-row"><span>作业状态</span><strong>${escapeHtml(job.stopped ? '已结束' : job.paused ? '已暂停' : '监控中')}</strong></div>
      <div class="nai-job-preview-row"><span>创建时间</span><strong>${escapeHtml(formatLocalDateTime(job.startedAt))}</strong></div>
      <div class="nai-job-preview-row"><span>站点</span><strong>${escapeHtml(job.site?.name || '-')} · ${escapeHtml(job.site?.url || '-')}</strong></div>
      <div class="nai-job-preview-row"><span>渠道类型</span><strong>${escapeHtml(channelTypeEntry(snapshot.typePreset || DEFAULT_CONFIG.typePreset)[1])}</strong></div>
      <div class="nai-job-preview-row"><span>分组</span><strong>${escapeHtml(snapshot.group || '-')}</strong></div>
      <div class="nai-job-preview-row"><span>模型</span><strong>${escapeHtml(normalizeList(snapshot.models) || '-')}</strong></div>
      <div class="nai-job-preview-row"><span>策略</span><strong>${escapeHtml(runtimeConfigSummary(job.runtimeConfig))}</strong></div>
    `;
  }

  function updateJobControls() {
    const runButtons = qsa('[data-nai-run]');
    const toggleJob = qs('[data-nai-toggle-job]');
    const refresh = qs('[data-nai-refresh-job]');
    const exportButton = qs('[data-nai-export-job]');
    const applyStrategy = qs('[data-nai-apply-strategy]');
    const openParams = qs('[data-nai-open-params]');
    const actionbar = qs('#nai-jobActionBar');
    const jobTitle = qs('#nai-jobTitle');
    const emptyState = qs('#nai-jobEmptyState');
    const runtimeSection = qs('#nai-jobRuntimeSection');
    const hasJob = Boolean(state.activeJob);
    const active = state.activeJob && !state.activeJob.stopped;
    const paused = active && state.activeJob.paused;
    const statusText = qs('#nai-jobStatusText');
    syncRuntimeFieldsFromJob(state.activeJob);
    updateJobPreview();
    if (jobTitle) jobTitle.textContent = state.activeJob?.name || '暂无作业';
    if (emptyState) emptyState.hidden = hasJob;
    if (runtimeSection) runtimeSection.hidden = !hasJob;
    if (actionbar) actionbar.hidden = !hasJob;
    if (statusText) {
      statusText.textContent = `当前状态：${jobStatusSummary(state.activeJob)}`;
    }
    runButtons.forEach((run) => {
      run.disabled = state.running;
      run.textContent = state.running ? '添加中...' : '保存创建作业';
    });
    if (toggleJob) {
      toggleJob.disabled = state.running || !active;
      toggleJob.innerHTML = !hasJob
        ? '<span class="nai-action-icon" aria-hidden="true">-</span><span>暂无作业</span>'
        : paused
          ? '<span class="nai-action-icon" aria-hidden="true">▶</span><span>开启作业</span>'
          : active
            ? '<span class="nai-action-icon" aria-hidden="true">⏸</span><span>暂停作业</span>'
            : '<span class="nai-action-icon" aria-hidden="true">✓</span><span>作业已结束</span>';
    }
    if (refresh) refresh.disabled = !state.activeJob || state.monitorBusy || state.running;
    if (exportButton) exportButton.disabled = !state.activeJob;
    if (openParams) openParams.textContent = hasJob ? '查看/新建参数' : '创建作业参数';
    if (applyStrategy) {
      applyStrategy.disabled = !state.activeJob || state.activeJob.stopped || !state.strategyDirty;
      applyStrategy.setAttribute('data-dirty', String(Boolean(state.strategyDirty && state.activeJob && !state.activeJob.stopped)));
    }
  }

  function updateEntryFromChannel(entry, channel) {
    if (!channel) return;
    const previousStatus = entry.status;
    entry.channelId = channel.id ?? entry.channelId;
    entry.channelName = channel.name || entry.channelName;
    entry.channelCreatedAt = channelTimeToIso(channel.created_time ?? channel.createdTime, entry.channelCreatedAt || entry.usedAt || nowIso());
    entry.status = Number.isFinite(Number(channel.status)) ? Number(channel.status) : entry.status;
    entry.statusText = statusLabel(entry.status);
    entry.usedQuota = numericQuota(channel);
    entry.lastSeenAt = nowIso();
    if (entry.status !== null && Number(entry.status) !== 1 && !entry.disabledAt) {
      entry.disabledAt = nowIso();
    }
    if (Number(previousStatus) === 1 && Number(entry.status) !== 1 && !entry.disabledAt) {
      entry.disabledAt = nowIso();
    }
  }

  async function findChannelByName(config, name, type) {
    const params = new URLSearchParams({
      keyword: String(name || ''),
      id_sort: 'true',
    });
    let channels = [];
    try {
      const result = await apiRequest(apiUrl(config, `/search?${params.toString()}`));
      if (!result?.success) throw new Error(result?.message || '搜索渠道失败');
      channels = channelsFromListResult(result);
    } catch {
      const fallbackParams = new URLSearchParams({
        p: '1',
        page_size: String(TEMPLATE_PAGE_SIZE),
        type: String(type),
        id_sort: 'true',
      });
      const result = await apiRequest(apiUrl(config, `?${fallbackParams.toString()}`));
      if (!result?.success) throw new Error(result?.message || '渠道列表回查失败');
      channels = channelsFromListResult(result);
    }
    return channels.find((channel) => channel.name === name && Number(channel.type) === Number(type)) ||
      channels.find((channel) => channel.name === name) ||
      null;
  }

  async function readChannelForEntry(config, entry) {
    if (entry.channelId) {
      const result = await apiRequest(apiUrl(config, `/${encodeURIComponent(entry.channelId)}`));
      if (!result?.success) throw new Error(result?.message || '读取渠道失败');
      return normalizeChannelResult(result);
    }
    if (!entry.channelName) return null;
    return findChannelByName(config, entry.channelName, getChannelType(config));
  }

  async function refreshJobStatuses(job, config) {
    const tracked = (job?.keys || []).filter((entry) => entry.channelId || entry.channelName);
    let refreshed = 0;
    for (const entry of tracked) {
      try {
        const channel = await readChannelForEntry(config, entry);
        if (channel) {
          updateEntryFromChannel(entry, channel);
          refreshed += 1;
        }
      } catch (err) {
        entry.error = err.message;
      }
    }
    updateJobStats();
    return refreshed;
  }

  async function createAutoBatch(job, config, batchSize, reason) {
    const selected = availableEntries(job).slice(0, batchSize);
    if (!selected.length) {
      if (!job.noKeyLogged) {
        recordJobLog(job, 'key 库已无未使用 key，自动补货暂停等待追加。');
        job.noKeyLogged = true;
      }
      updateJobStats();
      return 0;
    }
    job.noKeyLogged = false;

    const batch = {
      no: job.batches.length + 1,
      reason,
      startedAt: nowIso(),
      endedAt: null,
      size: selected.length,
      success: 0,
      failed: 0,
      channelIds: [],
    };
    job.batches.push(batch);
    recordJobLog(job, `开始第 ${batch.no} 批：${reason}，计划 ${selected.length} 个。`);

    ensureNameSeed(config, selected.map((entry) => entry.key));
    const delay = Math.max(0, Number.parseInt(config.delayMs || '0', 10) || 0);

    for (let i = 0; i < selected.length; i += 1) {
      if (job.stopped || job.paused) break;
      const entry = selected[i];
      const rowIndex = job.nextIndex || 0;
      const row = {
        index: rowIndex,
        key: entry.key,
        name: makeName(config, entry.key, rowIndex),
      };
      job.nextIndex = rowIndex + 1;
      entry.attemptedAt = nowIso();
      entry.usedAt = entry.attemptedAt;
      entry.channelName = row.name;
      entry.batchNo = batch.no;
      entry.statusText = '创建中';
      updateJobStats();

      try {
        const result = await apiRequest(apiUrl(config), {
          method: 'POST',
          body: JSON.stringify(buildPayload(row, config)),
        });
        if (!result?.success) throw new Error(result?.message || 'NewAPI 返回 success=false');

        let channel = normalizeChannelResult(result);
        if (!channel?.id) {
          await sleep(180);
          channel = await findChannelByName(config, row.name, getChannelType(config));
        }
        if (channel) {
          updateEntryFromChannel(entry, channel);
          if (entry.channelId) batch.channelIds.push(entry.channelId);
        } else {
          entry.channelCreatedAt = entry.channelCreatedAt || nowIso();
          entry.status = config.status ? 1 : 2;
          entry.statusText = statusLabel(entry.status);
        }
        batch.success += 1;
        recordJobLog(job, `OK 第 ${batch.no} 批 ${i + 1}/${selected.length}: ${row.name} (${keyPreview(row.key)})`);
      } catch (err) {
        batch.failed += 1;
        entry.error = err.message;
        entry.statusText = '创建失败';
        recordJobLog(job, `FAIL 第 ${batch.no} 批 ${i + 1}/${selected.length}: ${row.name} - ${err.message}`, 'error');
        if (!config.continueOnError) break;
      }

      updateJobStats();
      if (delay > 0 && i < selected.length - 1) await sleep(delay);
    }

    batch.endedAt = nowIso();
    recordJobLog(job, `第 ${batch.no} 批完成：成功 ${batch.success}/${batch.size}。`);
    if (batch.success > 0) refreshHostChannelList();
    updateJobStats();
    return batch.success;
  }

  function startMonitorLoop() {
    if (state.monitorTimer) clearInterval(state.monitorTimer);
    const runtime = state.activeJob?.runtimeConfig || collectRuntimeConfig(collectConfig(false));
    const interval = parsePositiveInt(runtime.monitorIntervalSec, 60, 5) * 1000;
    state.monitorTimer = window.setInterval(monitorActiveJob, interval);
    updateJobControls();
  }

  async function monitorActiveJob() {
    const job = state.activeJob;
    if (!job || job.stopped || job.paused || state.monitorBusy) return;
    state.monitorBusy = true;
    updateJobControls();
    const config = configForJob(job);
    try {
      const refreshed = await refreshJobStatuses(job, config);
      const stats = calculateJobStats(job);
      const threshold = parsePositiveInt(config.aliveThreshold, 5, 0);
      recordJobLog(job, `监控刷新 ${refreshed} 个渠道，当前存活 ${stats.alive} 个。`);
      if (config.autoRefill && stats.alive < threshold) {
        const batchSize = parsePositiveInt(config.replenishBatchSize, 10, 1);
        setRunning(true);
        try {
          await createAutoBatch(job, config, batchSize, `存活 ${stats.alive} < ${threshold}`);
        } finally {
          setRunning(false);
        }
      } else if (!config.autoRefill) {
        recordJobLog(job, '自动补货未启用，本次监控只刷新状态。');
      }
    } finally {
      state.monitorBusy = false;
      updateJobStats();
      updateJobControls();
    }
  }

  async function refreshActiveJobStatus() {
    const job = state.activeJob;
    if (!job || state.monitorBusy) return;
    state.monitorBusy = true;
    updateJobControls();
    try {
      const config = configForJob(job);
      const refreshed = await refreshJobStatuses(job, config);
      recordJobLog(job, `手动刷新作业状态：已读取 ${refreshed} 个渠道。`);
    } catch (err) {
      recordJobLog(job, `手动刷新失败：${err.message}`, 'error');
    } finally {
      state.monitorBusy = false;
      updateJobStats();
      updateJobControls();
    }
  }

  function toggleActiveJobRunning() {
    const job = state.activeJob;
    if (!job || job.stopped || state.running) return;
    if (job.paused) {
      resumeActiveJob();
      return;
    }
    stopActiveJob();
  }

  function stopActiveJob() {
    const job = state.activeJob;
    if (!job || job.stopped || job.paused) return;
    if (state.monitorTimer) {
      clearInterval(state.monitorTimer);
      state.monitorTimer = null;
    }
    job.paused = true;
    recordJobLog(job, '已暂停自动监控。');
    updateJobStats();
    updateJobControls();
  }

  function resumeActiveJob() {
    const job = state.activeJob;
    if (!job || job.stopped || !job.paused) return;
    job.paused = false;
    recordJobLog(job, '已继续自动监控。');
    startMonitorLoop();
    monitorActiveJob();
    updateJobStats();
    updateJobControls();
  }

  function sanitizedJobForExport(job, includeRawKeys = false) {
    if (!job) return null;
    return {
      ...job,
      keys: job.keys.map(({ key, ...entry }) => ({
        ...entry,
        keyMasked: keyPreview(key),
        ...(includeRawKeys ? { key } : {}),
      })),
    };
  }

  function exportActiveJob() {
    const job = state.activeJob;
    if (!job) return;
    const includeRawKeys = collectConfig(false).exportRawKeys === true;
    const payload = JSON.stringify(sanitizedJobForExport(job, includeRawKeys), null, 2);
    downloadJson(payload, `newapi-bulk-job-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    recordJobLog(job, '已导出本次作业日志。');
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportWorkspace() {
    persistWorkspaceState();
    const payload = JSON.stringify(workspacePayload(), null, 2);
    downloadJson(payload, `newapi-bulk-work-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    appendLog('已导出完整工作记录。');
  }

  function importWorkspaceFromFile(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || '{}'));
        const ok = window.confirm('导入工作会替换当前 key 池、作业和日志。确认继续？');
        if (!ok) return;
        applyWorkspacePayload(payload, { keepMonitor: false });
        persistWorkspaceState();
        updateModeUi();
        updateSiteInfo();
        renderWorkLog();
        updateJobStats();
        updateJobControls();
        appendLog(`已导入工作记录：${file.name}`);
        if (state.operationMode !== 'choose' && state.activeJob && !state.activeJob.stopped && !state.activeJob.paused) {
          startMonitorLoop();
        }
      } catch (err) {
        appendLog(`导入工作失败：${err.message}`, 'error');
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      appendLog(`导入工作失败：${reader.error?.message || '文件读取失败'}`, 'error');
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  function resetWorkspace() {
    const ok = window.confirm('确认重置当前工作？这会清空 key 池、作业、批次和日志，并停止监控。');
    if (!ok) return;
    if (state.monitorTimer) {
      clearInterval(state.monitorTimer);
      state.monitorTimer = null;
    }
    state.keyPool = [];
    state.keyPoolSet = new Set();
    state.activeJob = null;
    state.workLogs = [];
    state.strategyDirty = false;
    state.monitorBusy = false;
    state.running = false;
    state.nameSeedKey = '';
    state.nameTimestamp = '';
    state.nameDate = '';
    state.randomCodes = new Map();
    state.remoteChannels = [];
    state.remoteChannelsLoaded = false;
    state.remoteChannelsBusy = false;
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    resetFormToDefaults();
    const keyInput = qs('#nai-keys');
    if (keyInput) keyInput.value = '';
    setParamsPaneOpen(false);
    renderWorkLog();
    updateModeUi();
    refreshPreview();
    updateJobStats();
    updateJobControls();
  }

  function resetFormToDefaults() {
    const config = cloneValue(DEFAULT_CONFIG);
    for (const id of fieldIds) {
      setField(id, config[id] ?? '');
    }
    for (const id of checkboxIds) {
      setCheck(id, config[id] === true);
    }
    setRuntimeCheck('autoRefill', config.autoRefill === true);
    setRuntimeField('targetAliveSize', config.targetAliveSize);
    setRuntimeField('aliveThreshold', config.aliveThreshold);
    setRuntimeField('replenishBatchSize', config.replenishBatchSize);
    setRuntimeField('monitorIntervalSec', config.monitorIntervalSec);
    renderNameEditor(config);
    saveConfig(config);
    updateTypePicker();
    updateBaseUrlDisplay();
    updateGroupSelectFromInput();
  }

  function updateSiteInfo() {
    const site = currentSiteInfo();
    const name = qs('#nai-siteName');
    const url = qs('#nai-siteUrl');
    if (name) name.textContent = site.name;
    if (url) url.textContent = site.url;
  }

  function localStorageHasNewApiUser() {
    try {
      if (normalizeUserId(localStorage.getItem('uid'))) return true;
      const rawUser = localStorage.getItem('user');
      if (!rawUser) return false;
      const user = JSON.parse(rawUser);
      return Boolean(
        normalizeUserId(user?.id) ||
        normalizeUserId(user?.user?.id) ||
        normalizeUserId(user?.data?.id)
      );
    } catch {
      return false;
    }
  }

  function isLikelyNewApiPage() {
    const path = `${location.pathname}${location.search}`.toLowerCase();
    const host = location.hostname.toLowerCase();
    const title = String(document.title || '').toLowerCase();
    const metaText = qsa('meta[name], meta[property]')
      .map((meta) => `${meta.getAttribute('name') || ''} ${meta.getAttribute('property') || ''} ${meta.getAttribute('content') || ''}`)
      .join(' ')
      .toLowerCase();
    const bodyText = String(document.body?.innerText || '').slice(0, 8000).toLowerCase();
    const linkValues = qsa('a[href], form[action]').map((el) => (
      String(el.getAttribute('href') || el.getAttribute('action') || '').toLowerCase()
    ));
    const channelLinkSignal = linkValues.some((value) => (
      /(^|\/)(channels?|api\/channel)(\/|$|\?)/u.test(value)
    ));
    const adminLinkSignal = linkValues.some((value) => (
      /(^|\/)(token|redemption|models?)(\/|$|\?)/u.test(value)
    ));
    const apiTextSignal = qsa('script, link').some((el) => {
      const value = String(el.getAttribute('href') || el.getAttribute('src') || '').toLowerCase();
      return /new[\s-]*api|newapi/u.test(value);
    });
    let score = 0;
    if (/new[\s-]*api|newapi/u.test(`${host} ${title} ${metaText}`)) score += 3;
    if (/(^|\/)(channels?|api\/channel)(\/|$|\?)/u.test(path)) score += 2;
    if (channelLinkSignal) score += 2;
    if (adminLinkSignal) score += 1;
    if (apiTextSignal) score += 1;
    if (localStorageHasNewApiUser()) score += 1;
    if (/渠道|令牌|api key|模型倍率|分组/u.test(bodyText)) score += 1;
    return score >= 2;
  }

  function updateBaseUrlDisplay() {
    const display = qs('#nai-baseUrlDisplay');
    if (!display) return;
    let type = DEFAULT_CONFIG.typePreset;
    try {
      type = getChannelType(collectConfig(false));
    } catch {
      /* keep default type */
    }
    const baseUrl = defaultBaseUrlForType(type);
    display.textContent = baseUrl || baseUrlDisplayValue(type);
    display.setAttribute('data-empty', String(!baseUrl));
  }

  function updateTemplateOptions(channels, selected = '') {
    state.templates = channels;
    state.templatesLoaded = true;
    const select = qs('#nai-templateSelect');
    if (select) {
      select.innerHTML = renderTemplateOptions(channels, selected);
      if (selected) select.value = String(selected);
    }
    const help = qs('#nai-template-help');
    if (help) {
      help.textContent = channels.length
        ? `已读取 ${channels.length} 个同类型样板渠道。`
        : `当前类型暂无样板渠道；先手动创建一个后再刷新。`;
    }
  }

  async function loadTemplates() {
    const config = collectConfig(false);
    let type;
    try {
      type = getChannelType(config);
    } catch (err) {
      appendLog(err.message, 'error');
      return;
    }

    const select = qs('#nai-templateSelect');
    const previousSelected = select?.value || '';
    if (select) {
      select.innerHTML = '<option value="">读取中...</option>';
      select.disabled = true;
    }

    const params = new URLSearchParams({
      p: '1',
      page_size: String(TEMPLATE_PAGE_SIZE),
      type: String(type),
      id_sort: 'true',
    });

    try {
      const result = await apiRequest(apiUrl(config, `?${params.toString()}`));
      if (!result?.success) throw new Error(result?.message || '读取失败');
      const channels = channelsFromListResult(result);
      const selected = channels.some((channel) => String(channel.id) === String(previousSelected))
        ? previousSelected
        : '';
      updateTemplateOptions(channels, selected);
      appendLog(`已刷新 type=${type} 的样板渠道下拉，共 ${channels.length} 个。`);
    } catch (err) {
      updateTemplateOptions([]);
      appendLog(`刷新样板渠道失败：${err.message}`, 'error');
    } finally {
      if (select) select.disabled = false;
    }
  }

  async function loadRemoteChannels() {
    if (state.operationMode !== 'remote') return;
    if (state.remoteChannelsBusy) return;
    state.remoteConfig = saveRemoteConfig(remoteConfigFromFields());
    try {
      validateRemoteConfig(state.remoteConfig);
    } catch (err) {
      appendLog(`远端配置不可用：${err.message}`, 'error');
      return;
    }

    state.remoteChannelsBusy = true;
    renderRemoteChannels();
    const params = new URLSearchParams({
      p: '1',
      page_size: String(TEMPLATE_PAGE_SIZE),
      id_sort: 'true',
    });

    try {
      const result = await apiRequest(apiUrl(collectConfig(false), `?${params.toString()}`));
      if (!result?.success) throw new Error(result?.message || '读取失败');
      state.remoteChannels = channelsFromListResult(result);
      state.remoteChannelsLoaded = true;
      appendLog(`已读取远端渠道列表，共 ${state.remoteChannels.length} 个。`);
    } catch (err) {
      state.remoteChannels = [];
      state.remoteChannelsLoaded = true;
      appendLog(`读取远端渠道列表失败：${err.message}`, 'error');
    } finally {
      state.remoteChannelsBusy = false;
      renderRemoteChannels();
    }
  }

  function normalizeGroupsResult(result) {
    const data = result?.data ?? result;
    let groups = [];
    if (Array.isArray(data)) {
      groups = data;
    } else if (Array.isArray(data?.items)) {
      groups = data.items;
    } else if (data && typeof data === 'object') {
      groups = Object.keys(data);
    }
    return groups
      .map((group) => String(group || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  function updateGroupOptions(groups) {
    state.groups = groups;
    state.groupsLoaded = true;
    const select = qs('#nai-groupSelect');
    const currentGroup = qs('#nai-group')?.value || '';
    if (select) {
      select.innerHTML = renderGroupOptions(groups, currentGroup);
      select.disabled = false;
    }
    const menu = qs('[data-nai-group-menu]');
    if (menu) menu.innerHTML = renderGroupMenuOptions(groups, currentGroup);
    updateGroupTriggerText();
    const help = qs('#nai-group-help');
    if (help) {
      help.textContent = groups.length
        ? `已读取 ${groups.length} 个分组。点击下拉可多选，已选项会显示在分组选择框内。`
        : '未读取到分组，可刷新后重试。';
    }
  }

  function setGroupPickerOpen(open) {
    const trigger = qs('[data-nai-group-trigger]');
    const menu = qs('[data-nai-group-menu]');
    if (!trigger || !menu) return;
    trigger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  }

  function updateGroupTriggerText() {
    const text = qs('[data-nai-group-trigger-text]');
    if (text) text.textContent = groupTriggerLabel(qs('#nai-group')?.value || '');
  }

  function updateGroupSelectFromInput() {
    const select = qs('#nai-groupSelect');
    const selectedGroups = new Set(selectedGroupsFromValue(qs('#nai-group')?.value || '', state.groups));
    if (select) {
      Array.from(select.options).forEach((option) => {
        option.selected = selectedGroups.has(option.value);
      });
    }
    qsa('[data-nai-group-option]').forEach((option) => {
      const selected = selectedGroups.has(option.getAttribute('data-nai-group-option') || '');
      option.setAttribute('aria-selected', String(selected));
      const check = qs('input', option);
      if (check) check.checked = selected;
    });
    updateGroupTriggerText();
  }

  function applySelectedGroup() {
    const select = qs('#nai-groupSelect');
    if (!select) return;
    const groups = Array.from(select.selectedOptions)
      .map((option) => String(option.value || '').trim())
      .filter(Boolean);
    setField('group', groups.join(','));
    saveConfig(collectConfig(false));
    refreshPreview();
    updateGroupSelectFromInput();
  }

  function toggleGroupOption(group) {
    const normalizedGroup = String(group || '').trim();
    if (!normalizedGroup) return;
    const selected = new Set(normalizeList(qs('#nai-group')?.value || '').split(',').filter(Boolean));
    if (selected.has(normalizedGroup)) {
      selected.delete(normalizedGroup);
    } else {
      selected.add(normalizedGroup);
    }
    setField('group', Array.from(selected).join(','));
    saveConfig(collectConfig(false));
    updateGroupSelectFromInput();
    refreshPreview();
    updateJobPreview();
  }

  async function loadGroups() {
    const select = qs('#nai-groupSelect');
    if (select) {
      select.innerHTML = '<option value="">读取中...</option>';
      select.disabled = true;
    }
    try {
      const result = await apiRequest(GROUPS_API);
      if (!result?.success) throw new Error(result?.message || '读取失败');
      const groups = normalizeGroupsResult(result);
      updateGroupOptions(groups);
      const currentGroup = String(qs('#nai-group')?.value || '').trim();
      if (!currentGroup && groups.length > 0) {
        setField('group', groups.includes('default') ? 'default' : groups[0]);
        saveConfig(collectConfig(false));
        updateGroupSelectFromInput();
        refreshPreview();
      }
      appendLog(`已读取 ${groups.length} 个分组。`);
    } catch (err) {
      updateGroupOptions([]);
      appendLog(`分组读取失败，请刷新后重试：${err.message}`, 'error');
    }
  }

  function renderWorkLog() {
    const log = qs('#nai-log');
    if (!log) return;
    if (!state.workLogs.length) {
      log.textContent = 'Ready.';
      return;
    }
    log.textContent = state.workLogs.map((entry) => {
      const time = new Date(entry.at || Date.now()).toLocaleTimeString();
      return `[${time}] ${entry.message}`;
    }).join('\n');
    log.scrollTop = log.scrollHeight;
  }

  function appendLog(message, kind = '') {
    state.workLogs.push({
      at: nowIso(),
      kind: kind || 'info',
      message: String(message || ''),
    });
    if (state.workLogs.length > 1200) state.workLogs = state.workLogs.slice(-1200);
    renderWorkLog();
    persistWorkspaceState();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function setRunning(running) {
    state.running = running;
    qsa([
      '[data-nai-run]',
      '[data-nai-load-template]',
      '[data-nai-refresh-templates]',
      '[data-nai-refresh-site]',
      '[data-nai-refresh-groups]',
      '[data-nai-refresh-base-url]',
      '[data-nai-save-remote-config]',
      '[data-nai-test-remote]',
      '[data-nai-refresh-remote-channels]',
      '[data-nai-add-keys]',
      '[data-nai-import-work]',
      '[data-nai-reset-work]',
      '[data-nai-preview]',
      '[data-nai-copy-payload]',
    ].join(', ')).forEach((button) => {
      button.disabled = running;
    });
    qsa('[data-nai-run]').forEach((button) => {
      button.textContent = running ? '添加中...' : '保存创建作业';
    });
    updateJobControls();
  }

  function elementLabel(el) {
    return [
      el.textContent,
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('data-title'),
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  function elementSearchText(el) {
    const childSignals = qsa('[class], [data-icon], [aria-label], [title]', el)
      .slice(0, 12)
      .map((node) => [
        node.getAttribute('class'),
        node.getAttribute('data-icon'),
        node.getAttribute('aria-label'),
        node.getAttribute('title'),
      ].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' ');
    return [
      elementLabel(el),
      el.id,
      el.getAttribute('class'),
      el.getAttribute('data-testid'),
      el.getAttribute('data-test-id'),
      el.getAttribute('data-slot'),
      childSignals,
    ].filter(Boolean).join(' ');
  }

  function findHostRefreshButton() {
    const panel = document.getElementById(SCRIPT_ID);
    const controls = qsa('button, [role="button"], a');
    return controls.find((el) => {
      if (panel?.contains(el)) return false;
      if (el.classList?.contains('nai-bulk-button')) return false;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
      const text = elementSearchText(el);
      if (!/(刷新|重新加载|Refresh|Reload|refresh|reload)/i.test(text)) return false;
      return !/(余额|Balance|凭证|Credential|模型|Model|详情|Details|上游|Upstream|站点|Site)/i.test(text);
    });
  }

  function refreshHostChannelList() {
    if (state.operationMode === 'remote') return 'remote';
    const detail = { source: SCRIPT_ID, at: Date.now() };
    window.dispatchEvent(new CustomEvent('newapi:channels-created', { detail }));
    document.dispatchEvent(new CustomEvent('newapi:channels-created', { detail }));
    window.dispatchEvent(new Event('focus'));

    const refreshButton = findHostRefreshButton();
    if (refreshButton) {
      window.setTimeout(() => refreshButton.click(), 80);
      return 'button';
    }
    return 'event';
  }

  async function runAutoImport(config) {
    const targetAliveSize = parsePositiveInt(config.targetAliveSize, 10, 0);
    const firstBatchSize = Math.max(1, targetAliveSize);
    const selected = availableEntries({ keys: state.keyPool }).slice(0, firstBatchSize);
    const rows = buildRowsForKeys(config, selected.map((entry) => entry.key), 0);

    try {
      validateJobConfig(config, rows);
    } catch (err) {
      appendLog(err.message, 'error');
      refreshPreview();
      return;
    }

    if (state.operationMode === 'remote') {
      try {
        state.remoteConfig = saveRemoteConfig(remoteConfigFromFields());
        validateRemoteConfig(state.remoteConfig);
      } catch (err) {
        appendLog(`远端配置不可用：${err.message}`, 'error');
        return;
      }
    }

    if (selected.length > 0 && state.operationMode !== 'remote') {
      if (!getUserId()) {
        appendLog('未读取到登录用户 ID。新版需 localStorage.uid，v0.13.2 需 localStorage.user.id；请确认已登录并刷新页面。', 'error');
        return;
      }
    }

    const jobName = resolveJobName(config);
    const firstBatchText = selected.length
      ? `首次按当前可用 key 创建 ${selected.length} 个渠道`
      : '当前 key 库无可用 key，创建后等待补 key';
    const ok = window.confirm(`准备创建作业“${jobName}”。${firstBatchText}，存活低于 ${config.aliveThreshold} 时补充 ${config.replenishBatchSize} 个。确认继续？`);
    if (!ok) return;

    state.activeJob = createJob(config);
    state.strategyDirty = false;
    recordJobLog(state.activeJob, `作业“${state.activeJob.name}”启动，key 池 ${state.keyPool.length} 个，保活 ${targetAliveSize}，低于 ${config.aliveThreshold} 补 ${config.replenishBatchSize}，监控间隔 ${config.monitorIntervalSec} 秒。`);
    if (!selected.length) {
      recordJobLog(state.activeJob, '当前 key 库无可用 key，作业已创建并等待补 key。');
      startMonitorLoop();
      updateJobStats();
      updateJobControls();
      return;
    }
    setRunning(true);
    try {
      await createAutoBatch(state.activeJob, configForJob(state.activeJob), firstBatchSize, '保活首批');
    } finally {
      setRunning(false);
      if (!state.activeJob.stopped) startMonitorLoop();
      updateJobStats();
      updateJobControls();
      if (!state.activeJob.stopped) {
        recordJobLog(state.activeJob, `已进入自动监控，间隔 ${parsePositiveInt(config.monitorIntervalSec, 60, 5)} 秒。`);
      }
    }
  }

  async function runImport() {
    if (state.running) return;
    const config = collectConfig(true);
    if (state.activeJob && !state.activeJob.stopped) {
      const ok = window.confirm('当前已有作业。确认按右侧当前输入新建作业，并停止当前作业的监控吗？');
      if (!ok) return;
      recordJobLog(state.activeJob, '用户选择按新输入新建作业，当前作业停止监控。');
      state.activeJob.stopped = true;
      state.activeJob.stoppedAt = nowIso();
      if (state.monitorTimer) {
        clearInterval(state.monitorTimer);
        state.monitorTimer = null;
      }
    }
    await runAutoImport(config);
  }

  async function copyFirstPayload() {
    const config = collectConfig(true);
    const rows = buildRows(config);
    try {
      validateConfig(config, rows);
      const payload = buildPayload(rows[0], config);
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      appendLog('已复制首条 payload。');
    } catch (err) {
      appendLog(err.message, 'error');
    }
  }

  function applyTemplateChannel(channel) {
    if (!channel) throw new Error('没有读取到渠道数据');
    setField('typePreset', CHANNEL_TYPES.some(([value]) => value === channel.type) ? String(channel.type) : DEFAULT_CONFIG.typePreset);
    setField('models', channel.models || '');
    setField('group', channel.group || 'default');
    setField('modelMapping', prettyJsonString(channel.model_mapping));
    setField('priority', String(channel.priority ?? 0));
    setField('weight', String(channel.weight ?? 0));
    setField('tag', channel.tag || '');
    setField('remark', channel.remark || '');
    setField('settingJson', prettyJsonString(channel.setting) || DEFAULT_SETTING_JSON);
    setField('settingsJson', prettyJsonString(channel.settings) || '{}');
    setField('paramOverride', prettyJsonString(channel.param_override));
    setField('headerOverride', prettyJsonString(channel.header_override));
    setField('statusCodeMapping', prettyJsonString(channel.status_code_mapping));
    setField('other', channel.other || '');
    setCheck('status', channel.status === 1);
    setCheck('autoBan', channel.auto_ban !== 0);

    try {
      const settings = channel.settings ? JSON.parse(channel.settings) : {};
      setCheck('allowServiceTier', settings.allow_service_tier === true);
      setCheck('allowInferenceGeo', settings.allow_inference_geo === true);
      setCheck('allowSpeed', settings.allow_speed === true);
      setCheck('claudeBetaQuery', settings.claude_beta_query === true);
    } catch {
      /* keep current checkboxes */
    }

    saveConfig(collectConfig(false));
    updateGroupSelectFromInput();
    updateBaseUrlDisplay();
    refreshPreview();
    updateJobPreview();
    if (channel.base_url) {
      appendLog(`样板渠道有自定义 API 地址 ${channel.base_url}；批量创建仍会留空，使用 NewAPI 内置默认地址。`);
    }
  }

  function prettyJsonString(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }

  function setField(id, value) {
    const el = qs(`[data-nai-field="${id}"]`);
    if (el) el.value = value;
    if (id === 'typePreset') updateTypePicker();
  }

  function setCheck(id, checked) {
    const el = qs(`[data-nai-check="${id}"]`);
    if (el) el.checked = checked;
  }

  function setRuntimeField(id, value) {
    const el = qs(`[data-nai-runtime-field="${id}"]`);
    if (el) el.value = value;
  }

  function setRuntimeCheck(id, checked) {
    const el = qs(`[data-nai-runtime-check="${id}"]`);
    if (el) el.checked = checked;
  }

  async function loadSelectedTemplate() {
    const config = collectConfig(false);
    const id = String(qs('#nai-templateSelect')?.value || '').trim();
    if (!id) {
      appendLog('请先选择一个样板渠道。', 'error');
      return;
    }
    try {
      let channel = state.templates.find((item) => String(item.id) === id);
      if (!channel) {
        const result = await apiRequest(apiUrl(config, `/${encodeURIComponent(id)}`));
        if (!result?.success) throw new Error(result?.message || '读取失败');
        channel = normalizeChannelResult(result);
      }
      applyTemplateChannel(channel);
      appendLog(`已读取样板渠道 #${channel.id} 的模型/映射。`);
    } catch (err) {
      appendLog(`读取样板渠道 #${id} 失败：${err.message}`, 'error');
    }
  }
