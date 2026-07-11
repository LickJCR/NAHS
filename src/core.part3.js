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
    const resetRemoteMode = state.operationMode === 'remote';
    const ok = window.confirm(resetRemoteMode
      ? '确认重置远端模式？这会清空已保存的远端台子、连接状态、key 池、作业、批次和日志，并停止监控。'
      : '确认重置当前工作？这会清空 key 池、作业、批次和日志，并停止监控。');
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
    state.remoteResources = defaultRemoteResources();
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    if (resetRemoteMode) {
      state.remoteTab = 'bulk';
      state.activeRemoteSiteId = '';
      state.remoteSites = [];
      state.remoteConfig = { ...DEFAULT_REMOTE_CONFIG };
      state.remoteConnection = defaultRemoteConnection();
      state.groups = [];
      state.groupsLoaded = false;
      state.templates = [];
      state.templatesLoaded = false;
      localStorage.removeItem(REMOTE_SITES_STORAGE_KEY);
      localStorage.removeItem(REMOTE_CONFIG_STORAGE_KEY);
    }
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
    applyConfigToForm(config);
  }

  function applyConfigToForm(configInput) {
    const config = { ...cloneValue(DEFAULT_CONFIG), ...(configInput || {}) };
    config.nameSegments = normalizeNameSegments(config.nameSegments, config);
    config.nameSegmentSettings = normalizeNameSegmentSettings(config.nameSegmentSettings, config);
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

  function listItemsFromResult(result) {
    return channelsFromListResult(result);
  }

  async function loadRemoteResource(kind, options) {
    if (state.operationMode !== 'remote') return;
    if (!activeRemoteSite()) {
      appendLog('请先新增并选择一个远端台子。', 'error');
      return;
    }
    const resource = state.remoteResources[kind];
    if (!resource || resource.busy) return;
    state.remoteConfig = saveRemoteConfig(remoteConfigFromFields());
    try {
      validateRemoteConfig(state.remoteConfig);
    } catch (err) {
      appendLog(`远端配置不可用：${err.message}`, 'error');
      return;
    }

    resource.busy = true;
    resource.error = '';
    renderRemoteResourceViews();
    try {
      let lastError = null;
      let result = null;
      let endpoint = '';
      for (const candidate of options.endpoints) {
        try {
          endpoint = candidate;
          result = await apiRequest(candidate);
          if (!endpointResultOk(result)) throw new Error(result?.message || '读取失败');
          break;
        } catch (err) {
          lastError = err;
          result = null;
        }
      }
      if (!result) throw lastError || new Error('读取失败');
      let items = options.normalize(result);
      if (typeof options.afterNormalize === 'function') {
        items = await options.afterNormalize(items, result);
      }
      resource.items = items;
      resource.loaded = true;
      resource.updatedAt = nowIso();
      resource.meta = { endpoint };
      appendLog(`${options.successPrefix}，共 ${resource.items.length} 条。`);
    } catch (err) {
      resource.items = [];
      resource.loaded = true;
      resource.error = `${options.errorPrefix}：${err.message}`;
      appendLog(resource.error, 'error');
    } finally {
      resource.busy = false;
      renderRemoteResourceViews();
      persistWorkspaceState();
    }
  }

  function remoteChannelId(channel) {
    if (!channel || typeof channel !== 'object') return '';
    return channel.id ?? channel.Id ?? channel.ID ?? channel.channel_id ?? channel.channelId ?? '';
  }

  async function readRemoteChannelDetail(channel) {
    const id = remoteChannelId(channel);
    if (!id) return channel;
    const endpoints = [
      apiUrl(collectConfig(false), `/${encodeURIComponent(id)}`),
      apiUrl(collectConfig(false), `?id=${encodeURIComponent(id)}`),
    ];
    let lastError = null;
    for (const endpoint of endpoints) {
      try {
        const result = await apiRequest(endpoint);
        if (!endpointResultOk(result)) throw new Error(result?.message || '读取渠道详情失败');
        const detail = normalizeChannelResult(result);
        if (detail && typeof detail === 'object') {
          return { ...channel, ...detail, __nahsDetailLoaded: true };
        }
      } catch (err) {
        lastError = err;
      }
    }
    return { ...channel, __nahsDetailError: lastError?.message || '读取渠道详情失败' };
  }

  async function enrichRemoteChannelDetails(channels) {
    if (!Array.isArray(channels) || !channels.length) return [];
    const result = channels.slice();
    let cursor = 0;
    const worker = async () => {
      while (cursor < channels.length) {
        const index = cursor;
        cursor += 1;
        result[index] = await readRemoteChannelDetail(channels[index]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, channels.length) }, worker));
    return result;
  }

  async function loadRemoteChannels() {
    const params = new URLSearchParams({
      p: '1',
      page_size: String(TEMPLATE_PAGE_SIZE),
      id_sort: 'true',
    });
    return loadRemoteResource('channels', {
      endpoints: [apiUrl(collectConfig(false), `?${params.toString()}`)],
      normalize: channelsFromListResult,
      afterNormalize: enrichRemoteChannelDetails,
      successPrefix: '已读取渠道列表',
      errorPrefix: '读取渠道列表失败',
    });
  }

  async function loadRemoteLogs() {
    const params = new URLSearchParams({
      p: '1',
      page_size: String(TEMPLATE_PAGE_SIZE),
    });
    return loadRemoteResource('logs', {
      endpoints: [
        `/api/log?${params.toString()}`,
        `/api/log/?${params.toString()}`,
        `/api/log/self?${params.toString()}`,
      ],
      normalize: listItemsFromResult,
      successPrefix: '已读取日志列表',
      errorPrefix: '读取日志列表失败',
    });
  }

  async function loadRemoteUsers() {
    const params = new URLSearchParams({
      p: '1',
      page_size: String(TEMPLATE_PAGE_SIZE),
    });
    return loadRemoteResource('users', {
      endpoints: [
        `/api/user/?${params.toString()}`,
        `/api/user?${params.toString()}`,
        `/api/user/search?${params.toString()}`,
      ],
      normalize: listItemsFromResult,
      successPrefix: '已读取用户列表',
      errorPrefix: '读取用户列表失败',
    });
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

  function endpointResultOk(result) {
    return result && result.success !== false;
  }

  async function inspectRemoteEndpoint(label, url, describe) {
    try {
      const result = await apiRequest(url);
      const ok = endpointResultOk(result);
      return {
        label,
        url,
        ok,
        result,
        detail: ok
          ? (typeof describe === 'function' ? describe(result) : 'OK')
          : (result?.message || '返回 success=false'),
      };
    } catch (err) {
      return {
        label,
        url,
        ok: false,
        result: null,
        detail: err.message,
      };
    }
  }

  function normalizedObjectKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/gu, '');
  }

  function findDeepValue(value, candidates, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 5) return '';
    const wanted = new Set(candidates.map(normalizedObjectKey));
    for (const [key, item] of Object.entries(value)) {
      if (wanted.has(normalizedObjectKey(key)) && item !== null && item !== undefined && typeof item !== 'object') {
        return item;
      }
    }
    for (const item of Object.values(value)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const found = findDeepValue(item, candidates, depth + 1);
      if (found !== '') return found;
    }
    return '';
  }

  function firstNonEmpty(...values) {
    for (const value of values) {
      if (value !== null && value !== undefined && String(value).trim() !== '') return value;
    }
    return '';
  }

  function formatRemoteQuota(...values) {
    const parts = values
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
      .map((value) => String(value));
    return parts.length ? parts.join(' / ') : '';
  }

  function extractRemoteSiteInfo(statusResult, remoteConfig) {
    const data = statusResult?.data ?? statusResult ?? {};
    let hostname = remoteConfig.baseUrl;
    try {
      hostname = new URL(remoteConfig.baseUrl).hostname;
    } catch {
      /* keep base url */
    }
    return {
      name: firstNonEmpty(
        findDeepValue(data, ['system_name', 'site_name', 'server_name', 'name', 'title', 'app_name']),
        hostname
      ),
      version: firstNonEmpty(
        findDeepValue(data, ['version', 'system_version', 'newapi_version', 'app_version', 'build_version']),
        findDeepValue(data, ['commit', 'revision'])
      ),
    };
  }

  function extractRemoteAccountInfo(accountResult, remoteConfig) {
    const data = accountResult?.data ?? accountResult?.user ?? accountResult ?? {};
    const quota = formatRemoteQuota(
      firstNonEmpty(findDeepValue(data, ['remain_quota', 'remaining_quota', 'balance', 'quota'])),
      firstNonEmpty(findDeepValue(data, ['used_quota', 'usedQuota'])),
      firstNonEmpty(findDeepValue(data, ['request_count', 'requestCount']))
    );
    return {
      id: firstNonEmpty(findDeepValue(data, ['id', 'uid', 'user_id', 'userId']), remoteConfig.userId),
      name: firstNonEmpty(
        findDeepValue(data, ['username', 'user_name', 'display_name', 'displayName', 'name', 'email']),
        accountResult ? '' : '未读取到账号详情'
      ),
      group: firstNonEmpty(findDeepValue(data, ['group', 'group_name', 'groupName', 'role'])),
      quota,
    };
  }

  async function inspectRemoteAccount() {
    const endpoints = [
      '/api/user/self',
      '/api/user',
      '/api/user/info',
      '/api/user/profile',
      '/api/user/status',
    ];
    const checks = [];
    for (const endpoint of endpoints) {
      const check = await inspectRemoteEndpoint('账号信息', endpoint, '已读取账号信息');
      checks.push(check);
      if (check.ok) return { check, checks: [check] };
    }
    const last = checks[0] || { label: '账号信息', ok: false, detail: '未配置账号信息接口' };
    return {
      check: null,
      checks: [{
        label: '账号信息',
        url: endpoints.join(', '),
        ok: false,
        detail: `未读取到账号详情：${last.detail}`,
      }],
    };
  }

  async function inspectRemoteConnection() {
    const remoteConfig = validateRemoteConfig(state.remoteConfig);
    const channelParams = new URLSearchParams({
      p: '1',
      page_size: '1',
      id_sort: 'true',
    });
    const [statusCheck, groupCheck, channelCheck] = await Promise.all([
      inspectRemoteEndpoint('站点状态', '/api/status', (result) => {
        const site = extractRemoteSiteInfo(result, remoteConfig);
        return site.version ? `${site.name} / ${site.version}` : site.name;
      }),
      inspectRemoteEndpoint('分组 API', GROUPS_API, (result) => `${normalizeGroupsResult(result).length} 个分组`),
      inspectRemoteEndpoint('渠道 API', `${API_ROOT}?${channelParams.toString()}`, (result) => {
        const channels = channelsFromListResult(result);
        const total = firstNonEmpty(findDeepValue(result, ['total', 'count', 'total_count', 'totalCount']));
        return total ? `${total} 个渠道` : `读取到 ${channels.length} 条样本`;
      }),
    ]);
    const accountProbe = await inspectRemoteAccount();
    const checks = [statusCheck, groupCheck, channelCheck, ...accountProbe.checks];
    const usable = groupCheck.ok || channelCheck.ok;
    if (!usable) {
      const failure = checks.find((item) => !item.ok);
      throw new Error(failure ? `${failure.label} 失败：${failure.detail}` : '远端 API 验证失败。');
    }
    const groups = groupCheck.ok ? normalizeGroupsResult(groupCheck.result) : null;
    const site = extractRemoteSiteInfo(statusCheck.ok ? statusCheck.result : null, remoteConfig);
    const account = extractRemoteAccountInfo(accountProbe.check?.result || null, remoteConfig);
    const channelDetail = channelCheck.ok ? channelCheck.detail : '渠道 API 未通过';
    const groupDetail = groupCheck.ok ? groupCheck.detail : '分组 API 未通过';
    return {
      site,
      account,
      groups,
      checks,
      message: `远端连接成功：${site.name || remoteConfig.baseUrl}，${groupDetail}，${channelDetail}。`,
    };
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
      '[data-nai-add-remote-site]',
      '[data-nai-test-remote]',
      '[data-nai-refresh-remote-channels]',
      '[data-nai-refresh-remote-logs]',
      '[data-nai-refresh-remote-users]',
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
