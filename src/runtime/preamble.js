(() => {
  'use strict';

  const SCRIPT_ID = 'nai-bulk-channel-importer';
  const SCRIPT_VERSION = '0.7.6';
  const TOOL_MARK = 'NACP';
  const STORAGE_KEY = 'nai:bulk-channel-importer:v1';
  const WORKSPACE_STORAGE_KEY = 'nai:bulk-channel-importer:workspace:v1';
  const REMOTE_CONFIG_STORAGE_KEY = 'nai:bulk-channel-importer:remote-config:v1';
  const REMOTE_SITES_STORAGE_KEY = 'nai:bulk-channel-importer:remote-sites:v1';
  const BUTTON_POSITION_KEY = 'nai:bulk-channel-importer:button-position:v1';
  const API_ROOT = '/api/channel';
  const GROUPS_API = '/api/group/';
  const TEMPLATE_PAGE_SIZE = 100;
  const MAX_REMOTE_SITES = 5;
  const NAME_SLOT_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const MAX_NAME_SEGMENTS = 12;
  const NAME_SEGMENT_TYPES = [
    ['', '空'],
    ['text', '固定文字'],
    ['num', '顺序数字'],
    ['alpha', '顺序字母'],
    ['rand6', '六位随机码'],
    ['ts', '时间戳'],
    ['date', '日期'],
    ['key8', 'key 前 8 位'],
  ];

  const CHANNEL_TYPES = [
    [1, 'OpenAI'],
    [2, 'Midjourney'],
    [3, 'Azure'],
    [4, 'Ollama'],
    [5, 'MidjourneyPlus'],
    [6, 'OpenAIMax'],
    [7, 'OhMyGPT'],
    [8, 'Custom'],
    [9, 'AILS'],
    [10, 'AIProxy'],
    [11, 'PaLM'],
    [12, 'API2GPT'],
    [13, 'AIGC2D'],
    [14, 'Anthropic'],
    [15, 'Baidu'],
    [16, 'Zhipu'],
    [17, 'Ali'],
    [18, 'Xunfei'],
    [19, '360'],
    [20, 'OpenRouter'],
    [21, 'AIProxyLibrary'],
    [22, 'FastGPT'],
    [23, 'Tencent'],
    [24, 'Gemini'],
    [25, 'Moonshot'],
    [26, 'ZhipuV4'],
    [27, 'Perplexity'],
    [31, 'LingYiWanWu'],
    [33, 'AWS'],
    [34, 'Cohere'],
    [35, 'MiniMax'],
    [36, 'SunoAPI'],
    [37, 'Dify'],
    [38, 'Jina'],
    [39, 'Cloudflare'],
    [40, 'SiliconFlow'],
    [41, 'VertexAI'],
    [42, 'Mistral'],
    [43, 'DeepSeek'],
    [44, 'MokaAI'],
    [45, 'VolcEngine'],
    [46, 'BaiduV2'],
    [47, 'Xinference'],
    [48, 'xAI'],
    [49, 'Coze'],
    [50, 'Kling'],
    [51, 'Jimeng'],
    [52, 'Vidu'],
    [53, 'Submodel'],
    [54, 'DoubaoVideo'],
    [55, 'Sora'],
    [56, 'Replicate'],
    [57, 'ChatGPT Subscription (Codex)'],
    [58, 'Advanced Custom'],
  ];

  const CHANNEL_BASE_URLS = {
    1: 'https://api.openai.com',
    2: 'https://oa.api2d.net',
    3: '',
    4: 'http://localhost:11434',
    5: 'https://api.openai-sb.com',
    6: 'https://api.openaimax.com',
    7: 'https://api.ohmygpt.com',
    8: '',
    9: 'https://api.caipacity.com',
    10: 'https://api.aiproxy.io',
    11: '',
    12: 'https://api.api2gpt.com',
    13: 'https://api.aigc2d.com',
    14: 'https://api.anthropic.com',
    15: 'https://aip.baidubce.com',
    16: 'https://open.bigmodel.cn',
    17: 'https://dashscope.aliyuncs.com',
    18: '',
    19: 'https://api.360.cn',
    20: 'https://openrouter.ai/api',
    21: 'https://api.aiproxy.io',
    22: 'https://fastgpt.run/api/openapi',
    23: 'https://hunyuan.tencentcloudapi.com',
    24: 'https://generativelanguage.googleapis.com',
    25: 'https://api.moonshot.cn',
    26: 'https://open.bigmodel.cn',
    27: 'https://api.perplexity.ai',
    31: 'https://api.lingyiwanwu.com',
    33: '',
    34: 'https://api.cohere.ai',
    35: 'https://api.minimax.chat',
    36: '',
    37: 'https://api.dify.ai',
    38: 'https://api.jina.ai',
    39: 'https://api.cloudflare.com',
    40: 'https://api.siliconflow.cn',
    41: '',
    42: 'https://api.mistral.ai',
    43: 'https://api.deepseek.com',
    44: 'https://api.moka.ai',
    45: 'https://ark.cn-beijing.volces.com',
    46: 'https://qianfan.baidubce.com',
    47: '',
    48: 'https://api.x.ai',
    49: 'https://api.coze.cn',
    50: 'https://api.klingai.com',
    51: 'https://visual.volcengineapi.com',
    52: 'https://api.vidu.cn',
    53: 'https://llm.submodel.ai',
    54: 'https://ark.cn-beijing.volces.com',
    55: 'https://api.openai.com',
    56: 'https://api.replicate.com',
    57: 'https://chatgpt.com',
    58: '',
  };

  const CHANNEL_TYPE_ICONS = {
    1: 'OpenAI',
    2: 'Midjourney',
    3: 'Azure',
    4: 'Ollama',
    5: 'Midjourney',
    6: 'OpenAI',
    7: 'OpenAI',
    8: 'OpenAI',
    9: 'OpenAI',
    10: 'OpenAI',
    11: 'Google',
    12: 'OpenAI',
    13: 'OpenAI',
    14: 'Claude',
    15: 'Baidu',
    16: 'Zhipu',
    17: 'Qwen',
    18: 'Spark',
    19: 'Ai360',
    20: 'OpenRouter',
    21: 'OpenAI',
    22: 'FastGPT',
    23: 'Hunyuan',
    24: 'Gemini',
    25: 'Moonshot',
    26: 'Zhipu',
    27: 'Perplexity',
    31: 'Yi',
    33: 'Aws',
    34: 'Cohere',
    35: 'Minimax',
    36: 'Suno',
    37: 'Dify',
    38: 'Jina',
    39: 'Cloudflare',
    40: 'SiliconCloud',
    41: 'Gemini',
    42: 'Mistral',
    43: 'DeepSeek',
    44: 'OpenAI',
    45: 'Volcengine',
    46: 'Baidu',
    47: 'Xinference',
    48: 'XAI',
    49: 'Coze',
    50: 'Kling',
    51: 'Jimeng',
    52: 'Vidu',
    53: 'OpenAI',
    54: 'Doubao',
    55: 'OpenAI',
    56: 'Replicate',
    57: 'OpenAI',
    58: 'NewAPI',
  };

  const CHANNEL_ICON_META = {
    Ai360: ['360', '#e8f6ef', '#1e8d57'],
    Aws: ['AWS', '#fff4dc', '#f59e0b'],
    Azure: ['AZ', '#e7f1ff', '#2563eb'],
    Baidu: ['BD', '#e9efff', '#3158d4'],
    Claude: ['CL', '#fff0e6', '#d97843'],
    Cloudflare: ['CF', '#fff1d6', '#f59e0b'],
    Cohere: ['CO', '#e8f7ef', '#14955f'],
    Coze: ['CZ', '#e9f3ff', '#1682d4'],
    DeepSeek: ['DS', '#e9f2ff', '#3b82f6'],
    Dify: ['DF', '#eef2ff', '#6366f1'],
    Doubao: ['DB', '#fff0ea', '#f97316'],
    FastGPT: ['FG', '#e8f7f3', '#0f9f85'],
    Gemini: ['GM', '#eee9ff', '#7c3aed'],
    Google: ['GO', '#e9f5ff', '#4285f4'],
    Hunyuan: ['HY', '#eaf7ff', '#0891b2'],
    Jimeng: ['JM', '#fff0f4', '#e11d48'],
    Jina: ['JN', '#ecfeff', '#0891b2'],
    Kling: ['KL', '#f4f2ff', '#6d5dfc'],
    Midjourney: ['MJ', '#f2f0ea', '#6b5f4a'],
    Minimax: ['MM', '#fff4e6', '#d97706'],
    Mistral: ['MI', '#fff5d7', '#ca8a04'],
    Moonshot: ['MS', '#eef2ff', '#4f46e5'],
    NewAPI: ['NA', '#fff0e6', '#e87046'],
    Ollama: ['OL', '#e8ecef', '#475569'],
    OpenAI: ['AI', '#e9f8ef', '#10a37f'],
    OpenRouter: ['OR', '#ede9fe', '#7c3aed'],
    Perplexity: ['PX', '#e6fbff', '#0891b2'],
    Qwen: ['QW', '#e8f0ff', '#2f6fed'],
    Replicate: ['RP', '#f1f5f9', '#475569'],
    SiliconCloud: ['SF', '#e9f7ef', '#16a34a'],
    Spark: ['XF', '#fff1f2', '#e11d48'],
    Suno: ['SU', '#fff7ed', '#ea580c'],
    Vidu: ['VD', '#fdf2f8', '#db2777'],
    Volcengine: ['VE', '#fff0ea', '#f97316'],
    XAI: ['XA', '#f1f5f9', '#111827'],
    Xinference: ['XI', '#f0f9ff', '#0284c7'],
    Yi: ['YI', '#f0fdf4', '#16a34a'],
    Zhipu: ['ZP', '#eef2ff', '#4f46e5'],
  };

  const DEFAULT_SETTING_JSON = JSON.stringify({
    force_format: false,
    thinking_to_content: false,
    proxy: '',
    pass_through_body_enabled: false,
    system_prompt: '',
    system_prompt_override: false,
  });

  const DEFAULT_CONFIG = {
    jobName: '',
    typePreset: '14',
    nameSegments: ['text', 'num'],
    nameSegmentSettings: {
      A: {
        text: 'Anthropic-',
        numberStart: '1',
        numberPad: '2',
        alphaStart: 'A',
        tsFormat: 'yyyyMMdd-HHmmss',
        dateFormat: 'yyyyMMdd',
      },
      B: {
        text: '',
        numberStart: '1',
        numberPad: '2',
        alphaStart: 'A',
        tsFormat: 'yyyyMMdd-HHmmss',
        dateFormat: 'yyyyMMdd',
      },
    },
    models: '',
    group: 'default',
    modelMapping: '',
    priority: '0',
    weight: '0',
    tag: '',
    remark: '',
    status: true,
    autoBan: true,
    delayMs: '250',
    autoRefill: true,
    targetAliveSize: '10',
    replenishBatchSize: '10',
    aliveThreshold: '5',
    monitorIntervalSec: '60',
    exportRawKeys: false,
    dedupeKeys: true,
    continueOnError: false,
    allowServiceTier: false,
    allowInferenceGeo: false,
    allowSpeed: false,
    claudeBetaQuery: false,
    settingJson: DEFAULT_SETTING_JSON,
    settingsJson: '{}',
    paramOverride: '',
    headerOverride: '',
    statusCodeMapping: '',
    other: '',
  };

  const DEFAULT_REMOTE_CONFIG = {
    baseUrl: '',
    userId: '',
    userSecret: '',
    authMode: 'bearer',
  };

  const state = {
    operationMode: 'choose',
    remoteTab: 'bulk',
    remoteConfig: { ...DEFAULT_REMOTE_CONFIG },
    activeRemoteSiteId: '',
    remoteSites: [],
    remoteConnection: defaultRemoteConnection(),
    remoteResources: defaultRemoteResources(),
    open: false,
    running: false,
    nameSeedKey: '',
    nameTimestamp: '',
    nameDate: '',
    randomCodes: new Map(),
    groups: [],
    groupsLoaded: false,
    templates: [],
    templatesLoaded: false,
    keyPool: [],
    keyPoolSet: new Set(),
    activeJob: null,
    workLogs: [],
    strategyDirty: false,
    monitorTimer: null,
    monitorBusy: false,
    hostTypeIcons: {},
    buttonDrag: null,
    buttonClickSuppressedUntil: 0,
  };

  const fieldIds = [
    'jobName',
    'typePreset',
    'models',
    'group',
    'modelMapping',
    'priority',
    'weight',
    'tag',
    'remark',
    'delayMs',
    'targetAliveSize',
    'replenishBatchSize',
    'aliveThreshold',
    'monitorIntervalSec',
    'settingJson',
    'settingsJson',
    'paramOverride',
    'headerOverride',
    'statusCodeMapping',
    'other',
  ];

  const checkboxIds = [
    'status',
    'autoBan',
    'autoRefill',
    'exportRawKeys',
    'dedupeKeys',
    'continueOnError',
    'allowServiceTier',
    'allowInferenceGeo',
    'allowSpeed',
    'claudeBetaQuery',
  ];

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function slotLabel(index) {
    return NAME_SLOT_LETTERS[index] || String(index + 1);
  }

  function defaultSegmentSettings(slot) {
    const base = DEFAULT_CONFIG.nameSegmentSettings[slot] || DEFAULT_CONFIG.nameSegmentSettings.A;
    return { ...base };
  }

  function normalizeSegmentType(value) {
    const text = String(value || '').trim();
    if (text === 'prefix' || text === 'suffix' || /^text\d*$/.test(text)) return 'text';
    return NAME_SEGMENT_TYPES.some(([type]) => type === text) ? text : '';
  }

  function oldNameSegmentsFromConfig(config) {
    const parts = [
      config.namePart1,
      config.namePart2,
      config.namePart3,
      config.namePart4,
      config.namePart5,
    ].map(normalizeSegmentType).filter(Boolean);
    return parts.length ? parts : cloneValue(DEFAULT_CONFIG.nameSegments);
  }

  function normalizeNameSegments(value, fallbackConfig = null) {
    let segments = [];
    if (Array.isArray(value)) {
      segments = value.map(normalizeSegmentType);
    } else if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) segments = parsed.map(normalizeSegmentType);
      } catch {
        segments = value.split(',').map(normalizeSegmentType);
      }
    }
    if (!segments.length && fallbackConfig) segments = oldNameSegmentsFromConfig(fallbackConfig);
    if (!segments.length) segments = cloneValue(DEFAULT_CONFIG.nameSegments);
    return segments.slice(0, MAX_NAME_SEGMENTS);
  }

  function normalizeNameSegmentSettings(settings = {}, legacyConfig = {}) {
    const normalized = {};
    for (let index = 0; index < MAX_NAME_SEGMENTS; index += 1) {
      const slot = slotLabel(index);
      normalized[slot] = {
        ...defaultSegmentSettings(slot),
        ...(settings && typeof settings === 'object' ? settings[slot] || {} : {}),
      };
    }

    if (legacyConfig.nameText1 !== undefined || legacyConfig.prefix !== undefined) {
      normalized.A.text = String(legacyConfig.nameText1 ?? legacyConfig.prefix ?? normalized.A.text ?? '');
    }
    if (legacyConfig.nameText2 !== undefined || legacyConfig.suffix !== undefined) {
      normalized.B.text = String(legacyConfig.nameText2 ?? legacyConfig.suffix ?? normalized.B.text ?? '');
    }
    if (legacyConfig.nameText3 !== undefined) {
      normalized.C.text = String(legacyConfig.nameText3 ?? '');
    }
    if (legacyConfig.numberStart !== undefined) {
      for (const slot of Object.keys(normalized)) normalized[slot].numberStart = String(legacyConfig.numberStart);
    }
    if (legacyConfig.numberPad !== undefined) {
      for (const slot of Object.keys(normalized)) normalized[slot].numberPad = String(legacyConfig.numberPad);
    }
    if (legacyConfig.alphaStart !== undefined) {
      for (const slot of Object.keys(normalized)) normalized[slot].alphaStart = String(legacyConfig.alphaStart);
    }

    return normalized;
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      const config = { ...DEFAULT_CONFIG, ...parsed };
      if (config.typePreset === 'custom') {
        config.typePreset = CHANNEL_TYPES.some(([value]) => String(value) === String(config.customType))
          ? String(config.customType)
          : DEFAULT_CONFIG.typePreset;
      }
      if (!CHANNEL_TYPES.some(([value]) => String(value) === String(config.typePreset))) {
        config.typePreset = DEFAULT_CONFIG.typePreset;
      }
      config.nameSegments = normalizeNameSegments(parsed.nameSegments, config);
      config.nameSegmentSettings = normalizeNameSegmentSettings(parsed.nameSegmentSettings, config);
      return config;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(config) {
    const sanitized = { ...config };
    delete sanitized.keys;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  }

  function normalizeOperationMode(value) {
    return value === 'local' || value === 'remote' ? value : 'choose';
  }

  function normalizeRemoteTab(value) {
    return ['bulk', 'channels', 'logs', 'users'].includes(value) ? value : 'bulk';
  }

  function normalizeRemoteBaseUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const withProtocol = /^https?:\/\//iu.test(text) ? text : `https://${text}`;
    try {
      const url = new URL(withProtocol);
      return url.origin.replace(/\/+$/u, '');
    } catch {
      return withProtocol.replace(/\/+$/u, '');
    }
  }

  function normalizeRemoteConfig(value = {}) {
    const config = { ...DEFAULT_REMOTE_CONFIG, ...(value && typeof value === 'object' ? value : {}) };
    const authMode = ['bearer', 'new-api-key', 'both'].includes(config.authMode) ? config.authMode : DEFAULT_REMOTE_CONFIG.authMode;
    return {
      baseUrl: normalizeRemoteBaseUrl(config.baseUrl),
      userId: normalizeUserId(config.userId),
      userSecret: String(config.userSecret || '').trim(),
      authMode,
    };
  }

  function defaultRemoteConnection() {
    return {
      state: 'idle',
      checkedAt: '',
      message: '尚未测试远端连接。',
      baseUrl: '',
      site: {},
      account: {},
      checks: [],
    };
  }

  function defaultRemoteResource() {
    return {
      items: [],
      loaded: false,
      busy: false,
      error: '',
      updatedAt: '',
      meta: {},
    };
  }

  function defaultRemoteResources() {
    return {
      channels: defaultRemoteResource(),
      logs: defaultRemoteResource(),
      users: defaultRemoteResource(),
    };
  }

  function normalizeRemoteConnection(value = {}) {
    const data = value && typeof value === 'object' ? value : {};
    return {
      ...defaultRemoteConnection(),
      state: ['idle', 'testing', 'ok', 'error'].includes(data.state) ? data.state : 'idle',
      checkedAt: String(data.checkedAt || ''),
      message: String(data.message || '尚未测试远端连接。'),
      baseUrl: normalizeRemoteBaseUrl(data.baseUrl),
      site: data.site && typeof data.site === 'object' ? data.site : {},
      account: data.account && typeof data.account === 'object' ? data.account : {},
      checks: Array.isArray(data.checks) ? data.checks : [],
    };
  }

  function normalizeRemoteResource(value = {}) {
    const data = value && typeof value === 'object' ? value : {};
    return {
      items: Array.isArray(data.items) ? data.items.filter(Boolean) : [],
      loaded: data.loaded === true,
      busy: false,
      error: String(data.error || ''),
      updatedAt: String(data.updatedAt || ''),
      meta: data.meta && typeof data.meta === 'object' ? data.meta : {},
    };
  }

  function normalizeRemoteResources(value = {}) {
    const data = value && typeof value === 'object' ? value : {};
    return {
      channels: normalizeRemoteResource(data.channels),
      logs: normalizeRemoteResource(data.logs),
      users: normalizeRemoteResource(data.users),
    };
  }

  function defaultRemoteWorkspace() {
    return {
      keyPool: [],
      activeJob: null,
      workLogs: [],
      formConfig: null,
      resources: defaultRemoteResources(),
    };
  }

  function remoteSiteLabel(config, fallback = '') {
    const normalized = normalizeRemoteConfig(config);
    if (fallback) return fallback;
    if (!normalized.baseUrl) return '未命名台子';
    try {
      return new URL(normalized.baseUrl).hostname;
    } catch {
      return normalized.baseUrl;
    }
  }

  function normalizeRemoteSite(value = {}, index = 0) {
    const config = normalizeRemoteConfig(value.config || value);
    const id = String(value.id || `remote-site-${Date.now()}-${index}`).trim();
    const workspace = value.workspace && typeof value.workspace === 'object' ? value.workspace : defaultRemoteWorkspace();
    return {
      id,
      name: String(value.name || remoteSiteLabel(config)).trim() || `台子 ${index + 1}`,
      config,
      connection: normalizeRemoteConnection(value.connection || { baseUrl: config.baseUrl }),
      workspace: {
        ...defaultRemoteWorkspace(),
        ...workspace,
        resources: normalizeRemoteResources(workspace.resources),
      },
      createdAt: value.createdAt || nowIso(),
      updatedAt: value.updatedAt || nowIso(),
    };
  }

  function legacyRemoteSiteFromConfig() {
    const config = loadRemoteConfig();
    if (!config.baseUrl && !config.userId && !config.userSecret) return null;
    return normalizeRemoteSite({
      id: `remote-site-${Date.now()}`,
      name: remoteSiteLabel(config),
      config,
      connection: { ...defaultRemoteConnection(), baseUrl: config.baseUrl },
      workspace: defaultRemoteWorkspace(),
    });
  }

  function loadRemoteSites() {
    try {
      const raw = localStorage.getItem(REMOTE_SITES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed?.sites) ? parsed.sites : Array.isArray(parsed) ? parsed : [];
        state.activeRemoteSiteId = String(parsed?.activeId || '');
        const sites = list.map(normalizeRemoteSite).filter((site) => site.config.baseUrl).slice(0, MAX_REMOTE_SITES);
        if (sites.length) return sites;
      }
    } catch {
      /* fall through to legacy remote config */
    }
    const legacy = legacyRemoteSiteFromConfig();
    if (legacy) {
      state.activeRemoteSiteId = legacy.id;
      return [legacy];
    }
    return [];
  }

  function saveRemoteSites() {
    const payload = {
      version: SCRIPT_VERSION,
      activeId: state.activeRemoteSiteId,
      sites: state.remoteSites.slice(0, MAX_REMOTE_SITES),
    };
    localStorage.setItem(REMOTE_SITES_STORAGE_KEY, JSON.stringify(payload));
  }

  function loadRemoteConfig() {
    try {
      const raw = localStorage.getItem(REMOTE_CONFIG_STORAGE_KEY);
      return raw ? normalizeRemoteConfig(JSON.parse(raw)) : { ...DEFAULT_REMOTE_CONFIG };
    } catch {
      return { ...DEFAULT_REMOTE_CONFIG };
    }
  }

  function saveRemoteConfig(config = state.remoteConfig) {
    const normalized = normalizeRemoteConfig(config);
    state.remoteConfig = normalized;
    localStorage.setItem(REMOTE_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function activeRemoteSite() {
    return state.remoteSites.find((site) => site.id === state.activeRemoteSiteId) || null;
  }

  function remoteWorkspacePayload() {
    let formConfig = null;
    try {
      const panel = document.getElementById(SCRIPT_ID);
      formConfig = panel ? collectConfig(false) : null;
    } catch {
      formConfig = null;
    }
    return {
      keyPool: state.keyPool,
      activeJob: jobForStorage(state.activeJob),
      workLogs: state.workLogs,
      formConfig,
      resources: normalizeRemoteResources(state.remoteResources),
    };
  }

  function saveActiveRemoteSiteWorkspace() {
    const site = activeRemoteSite();
    if (!site) return;
    site.workspace = remoteWorkspacePayload();
    site.connection = normalizeRemoteConnection(state.remoteConnection);
    site.config = normalizeRemoteConfig(state.remoteConfig);
    site.name = String(site.name || remoteSiteLabel(site.config)).trim();
    site.updatedAt = nowIso();
  }

  function applyRemoteSiteToState(site, options = {}) {
    if (!site) return;
    state.activeRemoteSiteId = site.id;
    state.remoteConfig = normalizeRemoteConfig(site.config);
    state.remoteConnection = normalizeRemoteConnection(site.connection || { baseUrl: site.config.baseUrl });
    applyWorkspacePayload(site.workspace || defaultRemoteWorkspace(), {
      keepMode: true,
      keepRemoteTab: true,
      keepMonitor: options.keepMonitor === true,
    });
    state.remoteResources = normalizeRemoteResources(site.workspace?.resources);
  }

  function jobForStorage(job) {
    if (!job) return null;
    const { keys, ...rest } = job;
    return rest;
  }

  function normalizeWorkspacePayload(payload) {
    const data = payload && typeof payload === 'object' ? payload : {};
    const keyPool = Array.isArray(data.keyPool) ? data.keyPool : [];
    const activeJob = data.activeJob && typeof data.activeJob === 'object' ? data.activeJob : null;
    const workLogs = Array.isArray(data.workLogs) ? data.workLogs : [];
    return {
      operationMode: normalizeOperationMode(data.operationMode),
      remoteTab: normalizeRemoteTab(data.remoteTab),
      keyPool,
      activeJob,
      workLogs,
      formConfig: data.formConfig && typeof data.formConfig === 'object' ? data.formConfig : null,
      resources: normalizeRemoteResources(data.resources),
    };
  }

  function applyWorkspacePayload(payload, options = {}) {
    const normalized = normalizeWorkspacePayload(payload);
    if (!options.keepMode) state.operationMode = normalized.operationMode;
    if (!options.keepRemoteTab) state.remoteTab = normalized.remoteTab;
    state.keyPool = normalized.keyPool.map((entry, index) => ({
      key: String(entry.key || ''),
      keyPreview: entry.keyPreview || keyPreview(entry.key || ''),
      order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index,
      addedAt: entry.addedAt || nowIso(),
      attemptedAt: entry.attemptedAt || null,
      usedAt: entry.usedAt || null,
      channelCreatedAt: entry.channelCreatedAt || null,
      channelId: entry.channelId ?? null,
      channelName: entry.channelName || '',
      status: entry.status ?? null,
      statusText: entry.statusText || '未使用',
      disabledAt: entry.disabledAt || null,
      lastSeenAt: entry.lastSeenAt || null,
      usedQuota: Number(entry.usedQuota || 0),
      batchNo: entry.batchNo ?? null,
      error: entry.error || '',
    })).filter((entry) => entry.key);
    state.keyPoolSet = new Set(state.keyPool.map((entry) => entry.key));
    state.activeJob = normalized.activeJob ? { ...normalized.activeJob, keys: state.keyPool } : null;
    if (state.activeJob && !state.activeJob.name) {
      state.activeJob.name = state.activeJob.configSnapshot?.jobName || state.activeJob.id || defaultJobName(state.activeJob.configSnapshot || DEFAULT_CONFIG);
    }
    if (state.activeJob?.runtimeConfig) {
      state.activeJob.runtimeConfig = {
        autoRefill: state.activeJob.runtimeConfig.autoRefill !== false,
        targetAliveSize: parsePositiveInt(state.activeJob.runtimeConfig.targetAliveSize, 10, 0),
        aliveThreshold: parsePositiveInt(state.activeJob.runtimeConfig.aliveThreshold, 5, 0),
        replenishBatchSize: parsePositiveInt(state.activeJob.runtimeConfig.replenishBatchSize, 10, 1),
        monitorIntervalSec: parsePositiveInt(state.activeJob.runtimeConfig.monitorIntervalSec, 60, 5),
        updatedAt: state.activeJob.runtimeConfig.updatedAt || nowIso(),
      };
    }
    state.workLogs = normalized.workLogs.map((entry) => ({
      at: entry.at || nowIso(),
      kind: entry.kind || 'info',
      message: String(entry.message || ''),
    })).filter((entry) => entry.message);
    state.remoteResources = normalized.resources;
    state.strategyDirty = false;
    if (!options.keepMonitor && state.monitorTimer) {
      clearInterval(state.monitorTimer);
      state.monitorTimer = null;
    }
  }

  function workspacePayload() {
    return {
      version: SCRIPT_VERSION,
      tool: TOOL_MARK,
      exportedAt: nowIso(),
      operationMode: state.operationMode,
      remoteTab: state.remoteTab,
      site: currentSiteInfo(),
      keyPool: state.keyPool,
      activeJob: jobForStorage(state.activeJob),
      workLogs: state.workLogs,
      resources: state.operationMode === 'remote' ? normalizeRemoteResources(state.remoteResources) : undefined,
    };
  }

  function persistWorkspaceState() {
    try {
      if (state.operationMode === 'remote' && state.activeRemoteSiteId) {
        saveActiveRemoteSiteWorkspace();
        saveRemoteSites();
        return;
      }
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspacePayload()));
    } catch (err) {
      console.warn('[NewAPI Bulk Channel Importer] workspace persist failed:', err);
    }
  }

  function restoreWorkspaceState() {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) return;
      applyWorkspacePayload(JSON.parse(raw), { keepMonitor: false });
    } catch (err) {
      console.warn('[NewAPI Bulk Channel Importer] workspace restore failed:', err);
    }
  }

  function readButtonPosition() {
    try {
      const raw = localStorage.getItem(BUTTON_POSITION_KEY);
      if (!raw) return null;
      const position = JSON.parse(raw);
      if (!position || typeof position !== 'object') return null;
      const left = Number(position.left);
      const top = Number(position.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
      return { left, top };
    } catch {
      return null;
    }
  }

  function saveButtonPosition(position) {
    try {
      localStorage.setItem(BUTTON_POSITION_KEY, JSON.stringify(position));
    } catch {
      /* ignore storage failures */
    }
  }

  function clampButtonPosition(position, button) {
    const margin = 8;
    const width = button.offsetWidth || 138;
    const height = button.offsetHeight || 68;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    return {
      left: Math.min(Math.max(margin, position.left), maxLeft),
      top: Math.min(Math.max(margin, position.top), maxTop),
    };
  }

  function applyButtonPosition(button, position) {
    const clamped = clampButtonPosition(position, button);
    button.style.left = `${clamped.left}px`;
    button.style.top = `${clamped.top}px`;
    button.style.right = 'auto';
    button.style.bottom = 'auto';
    return clamped;
  }

  function restoreButtonPosition(button) {
    const position = readButtonPosition();
    if (!position) return;
    saveButtonPosition(applyButtonPosition(button, position));
  }

  function onButtonPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    state.buttonDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    button.dataset.dragging = 'true';
    button.setPointerCapture?.(event.pointerId);
  }

  function onButtonPointerMove(event) {
    const drag = state.buttonDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    applyButtonPosition(event.currentTarget, {
      left: drag.left + dx,
      top: drag.top + dy,
    });
  }

  function onButtonPointerEnd(event) {
    const drag = state.buttonDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const button = event.currentTarget;
    try {
      button.releasePointerCapture?.(event.pointerId);
    } catch {
      /* pointer capture may already be released */
    }
    delete button.dataset.dragging;
    if (drag.moved) {
      const rect = button.getBoundingClientRect();
      saveButtonPosition(clampButtonPosition({ left: rect.left, top: rect.top }, button));
      state.buttonClickSuppressedUntil = Date.now() + 350;
    }
    state.buttonDrag = null;
  }

  function setupButtonDrag(button) {
    button.addEventListener('pointerdown', onButtonPointerDown);
    button.addEventListener('pointermove', onButtonPointerMove);
    button.addEventListener('pointerup', onButtonPointerEnd);
    button.addEventListener('pointercancel', onButtonPointerEnd);
    window.addEventListener('resize', () => restoreButtonPosition(button));
  }
