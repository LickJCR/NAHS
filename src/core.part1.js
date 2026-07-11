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
          timeout: options.timeout || 15000,
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
