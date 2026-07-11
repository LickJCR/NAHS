        </div>
      </div>
    `;
  }

  function checkboxHtml(id, label, checked) {
    return `
      <label class="nai-bulk-check">
        <input id="nai-${id}" type="checkbox" data-nai-check="${id}"${checked ? ' checked' : ''}>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function versionBadgeHtml() {
    return `
      <span class="nai-bulk-title-badge">v${escapeHtml(SCRIPT_VERSION)}</span>
      <span class="nai-bulk-header-separator"></span>
      <span class="nai-bulk-title-badge nai-bulk-title-badge-mark">${escapeHtml(TOOL_MARK)}</span>
    `;
  }

  function mount() {
    if (document.getElementById(SCRIPT_ID)) return;
    injectStyles();
    captureHostTypeIcons();
    state.remoteSites = loadRemoteSites();
    if (!state.activeRemoteSiteId && state.remoteSites.length) state.activeRemoteSiteId = state.remoteSites[0].id;
    const initialRemoteSite = activeRemoteSite();
    state.remoteConfig = initialRemoteSite ? normalizeRemoteConfig(initialRemoteSite.config) : loadRemoteConfig();
    if (initialRemoteSite && state.operationMode === 'remote') {
      applyRemoteSiteToState(initialRemoteSite);
    }
    restoreWorkspaceState();
    if (state.operationMode === 'remote' && activeRemoteSite()) {
      applyRemoteSiteToState(activeRemoteSite());
    }

    const config = loadConfig();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nai-bulk-button';
    button.setAttribute('aria-label', `NewAPI 批量添加渠道 ${TOOL_MARK} v${SCRIPT_VERSION}`);
    button.title = '拖动调整位置，点击打开';
    button.innerHTML = `
      <span class="nai-bulk-button-main">批量渠道</span>
      <span class="nai-bulk-button-sub">${escapeHtml(TOOL_MARK)} v${escapeHtml(SCRIPT_VERSION)}</span>
    `;
    button.addEventListener('click', (event) => {
      if (Date.now() < state.buttonClickSuppressedUntil) {
        event.preventDefault();
        return;
      }
      togglePanel(true);
    });
    setupButtonDrag(button);

    const panel = document.createElement('div');
    panel.id = SCRIPT_ID;
    panel.className = 'nai-bulk-panel';
    panel.setAttribute('data-open', 'false');
    panel.setAttribute('data-nai-mode', state.operationMode);
    panel.setAttribute('data-nai-remote-tab', state.remoteTab);
    panel.setAttribute('data-nai-right-open', String(Boolean(state.activeJob)));
    panel.innerHTML = panelHtml(config);

    document.body.append(button, panel);
    restoreButtonPosition(button);
    bindPanel(panel);
    setupTypePicker(panel);
    updateModeUi();
    updateBaseUrlDisplay();
    refreshPreview();
    renderWorkLog();
    updateJobStats();
    updateJobControls();
    if (state.operationMode !== 'choose') {
      loadGroups();
      loadTemplates();
    }
    if (state.operationMode !== 'choose' && state.activeJob && !state.activeJob.stopped && !state.activeJob.paused) {
      startMonitorLoop();
    }
  }

  function bindPanel(panel) {
    qs('[data-nai-close]', panel).addEventListener('click', () => togglePanel(false));
    qs('[data-nai-preview]', panel).addEventListener('click', refreshPreview);
    qsa('[data-nai-run]', panel).forEach((button) => button.addEventListener('click', runImport));
    qs('[data-nai-add-keys]', panel).addEventListener('click', addKeysToPool);
    qs('[data-nai-copy-payload]', panel).addEventListener('click', copyFirstPayload);
    qs('[data-nai-refresh-job]', panel).addEventListener('click', refreshActiveJobStatus);
    qs('[data-nai-toggle-job]', panel).addEventListener('click', toggleActiveJobRunning);
    qs('[data-nai-export-job]', panel).addEventListener('click', exportActiveJob);
    qs('[data-nai-load-template]', panel).addEventListener('click', loadSelectedTemplate);
    qs('[data-nai-refresh-templates]', panel).addEventListener('click', loadTemplates);
    qs('[data-nai-change-mode]', panel).addEventListener('click', () => setOperationMode('choose'));
    qs('[data-nai-add-remote-site]', panel).addEventListener('click', addRemoteSiteFromForm);
    qs('[data-nai-test-remote]', panel).addEventListener('click', testRemoteConnection);
    qs('[data-nai-refresh-remote-channels]', panel).addEventListener('click', loadRemoteChannels);
    qs('[data-nai-refresh-remote-logs]', panel).addEventListener('click', loadRemoteLogs);
    qs('[data-nai-refresh-remote-users]', panel).addEventListener('click', loadRemoteUsers);
    bindRemoteListActions(panel);
    qs('[data-nai-refresh-site]', panel).addEventListener('click', () => {
      updateSiteInfo();
      appendLog('已刷新站点信息。');
    });
    qs('[data-nai-refresh-groups]', panel).addEventListener('click', loadGroups);
    qs('[data-nai-refresh-base-url]', panel).addEventListener('click', () => {
      updateBaseUrlDisplay();
      appendLog('已刷新内置 API 地址显示。');
    });
    qs('[data-nai-group-select]', panel).addEventListener('change', applySelectedGroup);
    qs('[data-nai-group-trigger]', panel).addEventListener('click', () => {
      setGroupPickerOpen(qs('[data-nai-group-trigger]', panel).getAttribute('aria-expanded') !== 'true');
    });
    qs('[data-nai-group-menu]', panel).addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const option = event.target.closest('[data-nai-group-option]');
      if (!option) return;
      toggleGroupOption(option.getAttribute('data-nai-group-option') || '');
    });
    qs('[data-nai-open-params]', panel).addEventListener('click', () => setParamsPaneOpen(true));
    qs('[data-nai-apply-strategy]', panel).addEventListener('click', applyRuntimeJobConfig);
    qs('[data-nai-export-work]', panel).addEventListener('click', exportWorkspace);
    qs('[data-nai-import-work]', panel).addEventListener('click', () => qs('[data-nai-import-work-file]', panel)?.click());
    qs('[data-nai-import-work-file]', panel).addEventListener('change', importWorkspaceFromFile);
    qs('[data-nai-reset-work]', panel).addEventListener('click', resetWorkspace);
    qs('[data-nai-toggle-params]', panel)?.addEventListener('click', () => {
      const isOpen = panel.getAttribute('data-nai-right-open') !== 'false';
      setParamsPaneOpen(!isOpen);
    });

    panel.addEventListener('click', (event) => {
      const target = eventElementFromTarget(event.target);
      if (!target) return;
      const keyTab = target.closest('[data-nai-key-tab]');
      if (keyTab) {
        setKeyTab(keyTab.getAttribute('data-nai-key-tab') || 'list');
        return;
      }
      const modeChoice = target.closest('[data-nai-mode-choice]');
      if (modeChoice) {
        setOperationMode(modeChoice.getAttribute('data-nai-mode-choice') || 'choose');
        return;
      }
      const remoteTab = target.closest('[data-nai-remote-tab]');
      if (remoteTab) {
        setRemoteTab(remoteTab.getAttribute('data-nai-remote-tab') || 'bulk');
        return;
      }
      const removeRemoteSite = target.closest('[data-nai-remove-remote-site]');
      if (removeRemoteSite) {
        removeRemoteSiteById(removeRemoteSite.getAttribute('data-nai-remove-remote-site') || '');
        return;
      }
      const remoteSite = target.closest('[data-nai-remote-site]');
      if (remoteSite) {
        selectRemoteSite(remoteSite.getAttribute('data-nai-remote-site') || '');
        return;
      }
      const remoteAction = target.closest('[data-nai-remote-action]');
      if (remoteAction) {
        handleRemoteListAction(remoteAction);
        return;
      }
      const jobTab = target.closest('[data-nai-job-tab]');
      if (jobTab) {
        setJobTab(jobTab.getAttribute('data-nai-job-tab') || 'stats');
        return;
      }
      if (target.closest('[data-nai-name-add-segment]')) {
        const config = collectConfig(false);
        config.nameSegments = normalizeNameSegments(config.nameSegments, config);
        if (config.nameSegments.length < MAX_NAME_SEGMENTS) config.nameSegments.push('');
        saveConfig(config);
        renderNameEditor(config);
        refreshPreview();
        return;
      }
      const remove = target.closest('[data-nai-name-remove]');
      if (remove) {
        const config = collectConfig(false);
        const index = Number.parseInt(remove.getAttribute('data-nai-name-remove') || '-1', 10);
        config.nameSegments = normalizeNameSegments(config.nameSegments, config);
        if (index >= 0 && config.nameSegments.length > 1) config.nameSegments.splice(index, 1);
        saveConfig(config);
        renderNameEditor(config);
        refreshPreview();
      }
    });

    panel.addEventListener('change', (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.matches('[data-nai-name-segment-type]')) return;
      const config = collectConfig(false);
      saveConfig(config);
      renderNameEditor(config);
      refreshPreview();
    });

    panel.addEventListener('input', (event) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.matches('[data-nai-name-setting]')) return;
      saveConfig(collectConfig(false));
      refreshPreview();
    });

    qsa('[data-nai-field], [data-nai-check]', panel).forEach((el) => {
      el.addEventListener('input', () => {
        saveConfig(collectConfig(false));
        if (el.getAttribute('data-nai-field') === 'group') {
          updateGroupSelectFromInput();
          updateJobPreview();
        }
        if (isStrategyField(el)) markStrategyDirty();
        refreshPreview();
        updateJobPreview();
      });
      el.addEventListener('change', () => {
        saveConfig(collectConfig(false));
        if (isStrategyField(el)) markStrategyDirty();
        if (el.getAttribute('data-nai-field') === 'typePreset') {
          updateTypePicker();
          updateBaseUrlDisplay();
          loadTemplates();
        }
        if (el.getAttribute('data-nai-field') === 'group') {
          updateGroupSelectFromInput();
          updateJobPreview();
        }
        refreshPreview();
        updateJobPreview();
      });
    });

    qsa('[data-nai-runtime-field], [data-nai-runtime-check]', panel).forEach((el) => {
      el.addEventListener('input', () => {
        if (isStrategyField(el)) markStrategyDirty();
      });
      el.addEventListener('change', () => {
        if (isStrategyField(el)) markStrategyDirty();
      });
    });

    qs('#nai-keys', panel).addEventListener('input', () => {
      refreshPreview();
    });

    qsa('[data-nai-remote-field]', panel).forEach((el) => {
      el.addEventListener('input', updateRemoteConfigPreview);
      el.addEventListener('change', updateRemoteConfigPreview);
    });

    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setGroupPickerOpen(false);
    });

    document.addEventListener('click', (event) => {
      const picker = qs('[data-nai-group-picker]', panel);
      if (picker?.contains(event.target)) return;
      setGroupPickerOpen(false);
    });
  }

  function remoteConfigFromFields(panel = document.getElementById(SCRIPT_ID)) {
    const config = { ...state.remoteConfig };
    qsa('[data-nai-remote-field]', panel).forEach((el) => {
      const key = el.getAttribute('data-nai-remote-field');
      if (!key) return;
      config[key] = el.value;
    });
    return normalizeRemoteConfig(config);
  }

  function remoteSiteNameFromField(panel = document.getElementById(SCRIPT_ID), config = state.remoteConfig) {
    const value = String(qs('[data-nai-remote-site-name]', panel)?.value || '').trim();
    return value || remoteSiteLabel(config);
  }

  function syncRemoteConfigFields() {
    const panel = document.getElementById(SCRIPT_ID);
    if (!panel) return;
    const config = state.remoteConfig;
    qsa('[data-nai-remote-field]', panel).forEach((el) => {
      const key = el.getAttribute('data-nai-remote-field');
      if (!key || config[key] === undefined) return;
      el.value = config[key];
    });
    const siteName = qs('[data-nai-remote-site-name]', panel);
    const activeSite = activeRemoteSite();
    if (siteName) siteName.value = activeSite?.name || '';
  }

  function updateRemoteConfigPreview() {
    state.remoteConfig = remoteConfigFromFields();
    setRemoteConnectionState({
      state: 'idle',
      checkedAt: '',
      message: '连接配置已变更，请重新测试。',
      baseUrl: state.remoteConfig.baseUrl,
      site: {},
      account: {},
      checks: [],
    });
    updateSiteInfo();
  }

  function setOperationMode(mode) {
    const nextMode = normalizeOperationMode(mode);
    state.operationMode = nextMode;
    if (nextMode === 'local') state.remoteTab = 'bulk';
    if (nextMode === 'remote') state.remoteConfig = remoteConfigFromFields();
    persistWorkspaceState();
    updateModeUi();
    updateSiteInfo();
    refreshPreview();

    if (nextMode === 'choose') {
      appendLog('已回到工作模式选择。');
      return;
    }

    if (nextMode === 'remote') {
      saveRemoteConfig(state.remoteConfig);
      appendLog('已切换到远端 NewAPI 模式。');
      if (!activeRemoteSite()) {
        appendLog('远端模式暂无台子，请先保存并新增台子。');
        return;
      }
      try {
        validateRemoteConfig(state.remoteConfig);
      } catch {
        return;
      }
    } else {
      appendLog('已切换到当前浏览器站点模式。');
    }
    loadGroups();
    loadTemplates();
  }

  function setRemoteTab(tab) {
    state.remoteTab = normalizeRemoteTab(tab);
    persistWorkspaceState();
    updateModeUi();
    if (state.operationMode === 'remote' && state.remoteTab === 'channels' && !state.remoteResources.channels.loaded) {
      loadRemoteChannels();
    }
    if (state.operationMode === 'remote' && state.remoteTab === 'logs' && !state.remoteResources.logs.loaded) {
      loadRemoteLogs();
    }
    if (state.operationMode === 'remote' && state.remoteTab === 'users' && !state.remoteResources.users.loaded) {
      loadRemoteUsers();
    }
  }

  function refreshWorkspaceViews() {
    renderWorkLog();
    updateJobStats();
    updateJobControls();
    refreshPreview();
    updateSiteInfo();
    updateModeUi();
  }

  function selectRemoteSite(id) {
    const site = state.remoteSites.find((item) => item.id === id);
    if (!site) return;
    if (state.activeRemoteSiteId === id) {
      state.remoteConfig = normalizeRemoteConfig(site.config);
      updateModeUi();
      return;
    }
    saveActiveRemoteSiteWorkspace();
    if (state.monitorTimer) {
      clearInterval(state.monitorTimer);
      state.monitorTimer = null;
    }
    applyRemoteSiteToState(site);
    if (site.workspace?.formConfig) applyConfigToForm(site.workspace.formConfig);
    saveRemoteSites();
    refreshWorkspaceViews();
    appendLog(`已切换到台子：${site.name}`);
    loadGroups();
    loadTemplates();
    if (state.activeJob && !state.activeJob.stopped && !state.activeJob.paused) {
      startMonitorLoop();
    }
  }

  function addRemoteSiteFromForm() {
    if (state.remoteSites.length >= MAX_REMOTE_SITES) {
      const config = remoteConfigFromFields();
      const existing = state.remoteSites.find((site) => site.config.baseUrl === config.baseUrl && site.config.userId === config.userId);
      if (!existing) {
        appendLog(`最多只能保存 ${MAX_REMOTE_SITES} 个远端台子。`, 'error');
        return;
      }
    }
    const config = remoteConfigFromFields();
    try {
      validateRemoteConfig(config);
    } catch (err) {
      appendLog(`台子配置不可用：${err.message}`, 'error');
      return;
    }
    const name = remoteSiteNameFromField(undefined, config);
    saveActiveRemoteSiteWorkspace();
    let site = state.remoteSites.find((item) => item.config.baseUrl === config.baseUrl && item.config.userId === config.userId);
    const connection = state.remoteConnection?.baseUrl === config.baseUrl
      ? normalizeRemoteConnection(state.remoteConnection)
      : { ...defaultRemoteConnection(), baseUrl: config.baseUrl };
    if (site) {
      site.name = name;
      site.config = config;
      site.connection = connection;
      site.updatedAt = nowIso();
    } else {
      const workspace = defaultRemoteWorkspace();
      workspace.formConfig = cloneValue(DEFAULT_CONFIG);
      site = normalizeRemoteSite({
        id: `remote-site-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        name,
        config,
        connection,
        workspace,
      }, state.remoteSites.length);
      state.remoteSites.push(site);
    }
    applyRemoteSiteToState(site);
    if (site.workspace?.formConfig) applyConfigToForm(site.workspace.formConfig);
    saveRemoteSites();
    refreshWorkspaceViews();
    appendLog(`已保存并选中台子：${site.name}`);
  }

  function removeRemoteSiteById(id) {
    const site = state.remoteSites.find((item) => item.id === id);
    if (!site) return;
    const ok = window.confirm(`确认移除台子“${site.name}”？这会删除该台子的本地 key 池、作业、日志和列表缓存。`);
    if (!ok) return;
    if (state.activeRemoteSiteId === id && state.monitorTimer) {
      clearInterval(state.monitorTimer);
      state.monitorTimer = null;
    }
    state.remoteSites = state.remoteSites.filter((item) => item.id !== id);
    if (state.activeRemoteSiteId === id) {
      const next = state.remoteSites[0] || null;
      if (next) {
        applyRemoteSiteToState(next);
        if (next.workspace?.formConfig) applyConfigToForm(next.workspace.formConfig);
      } else {
        state.activeRemoteSiteId = '';
        state.remoteConfig = { ...DEFAULT_REMOTE_CONFIG };
        state.remoteConnection = defaultRemoteConnection();
        applyWorkspacePayload(defaultRemoteWorkspace(), { keepMode: true, keepRemoteTab: true, keepMonitor: false });
        resetFormToDefaults();
      }
    }
    saveRemoteSites();
    refreshWorkspaceViews();
    appendLog(`已移除台子：${site.name}`);
  }

  function modeLabelText() {
    if (state.operationMode === 'local') return '当前浏览器站点模式';
    if (state.operationMode === 'remote') return '远端 NewAPI 模式';
    return '选择工作模式';
  }

  function updateModeUi() {
    const panel = document.getElementById(SCRIPT_ID);
    if (!panel) return;
    panel.setAttribute('data-nai-mode', state.operationMode);
    panel.setAttribute('data-nai-remote-tab', state.remoteTab);
    const label = qs('#nai-modeLabel', panel);
    if (label) label.textContent = modeLabelText();
    qsa('[data-nai-remote-tab]', panel).forEach((button) => {
      button.setAttribute('data-active', String(button.getAttribute('data-nai-remote-tab') === state.remoteTab));
      button.disabled = state.operationMode === 'remote' && !activeRemoteSite();
    });
    const siteTabs = qs('[data-nai-remote-site-tabs]', panel);
    if (siteTabs) siteTabs.innerHTML = renderRemoteSiteTabs();
    syncRemoteConfigFields();
    renderRemoteConnectionStatus();
    renderRemoteResourceViews();
  }

  function setRemoteConnectionState(next) {
    state.remoteConnection = {
      state: next.state || 'idle',
      checkedAt: next.checkedAt || '',
      message: next.message || '',
      baseUrl: next.baseUrl || state.remoteConfig.baseUrl || '',
      site: next.site || {},
      account: next.account || {},
      checks: Array.isArray(next.checks) ? next.checks : [],
    };
    renderRemoteConnectionStatus();
  }

  function remoteStatusLabel(value) {
    if (value === 'testing') return '测试中';
    if (value === 'ok') return '连接成功';
    if (value === 'error') return '连接失败';
    return '未测试';
  }

  function remoteSummaryCell(label, value) {
    const text = value === null || value === undefined || value === '' ? '-' : String(value);
    return `
      <div class="nai-remote-status-cell">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(text)}</strong>
      </div>
    `;
  }

  function renderRemoteCheckItems(checks = []) {
    if (!checks.length) return '<div class="nai-remote-check-empty">暂无 API 检查结果。</div>';
    return checks.map((item) => `
      <div class="nai-remote-check" data-ok="${item.ok ? 'true' : 'false'}">
        <span>${escapeHtml(item.label || item.url || '-')}</span>
        <strong>${escapeHtml(item.detail || (item.ok ? 'OK' : '失败'))}</strong>
      </div>
    `).join('');
  }

  function renderRemoteConnectionStatus() {
    const host = qs('#nai-remoteConnectionStatus');
    if (!host) return;
    const connection = state.remoteConnection || {};
    const site = connection.site || {};
    const account = connection.account || {};
    const checkedAt = connection.checkedAt
      ? new Date(connection.checkedAt).toLocaleString()
      : '-';
    host.setAttribute('data-state', connection.state || 'idle');
    host.innerHTML = `
      <div class="nai-remote-status-head">
        <span class="nai-remote-status-dot" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(remoteStatusLabel(connection.state))}</strong>
          <span>${escapeHtml(connection.message || '尚未测试远端连接。')}</span>
        </div>
      </div>
      <div class="nai-remote-status-grid">
        ${remoteSummaryCell('远端地址', connection.baseUrl || state.remoteConfig.baseUrl)}
        ${remoteSummaryCell('站点名称', site.name)}
        ${remoteSummaryCell('站点版本', site.version)}
        ${remoteSummaryCell('账号 ID', account.id || state.remoteConfig.userId)}
        ${remoteSummaryCell('账号名称', account.name)}
        ${remoteSummaryCell('账号分组', account.group)}
        ${remoteSummaryCell('余额/额度', account.quota)}
        ${remoteSummaryCell('检测时间', checkedAt)}
      </div>
      <div class="nai-remote-checks">
        ${renderRemoteCheckItems(connection.checks)}
      </div>
    `;
  }

  async function testRemoteConnection() {
    state.remoteConfig = saveRemoteConfig(remoteConfigFromFields());
    syncRemoteConfigFields();
    updateSiteInfo();
    setRemoteConnectionState({
      state: 'testing',
      checkedAt: '',
      message: '正在读取站点、账号和 API 状态...',
      baseUrl: state.remoteConfig.baseUrl,
      site: {},
      account: { id: state.remoteConfig.userId },
      checks: [],
    });
    try {
      validateRemoteConfig(state.remoteConfig);
      const result = await inspectRemoteConnection();
      if (result.groups) {
        updateGroupOptions(result.groups);
      }
      updateModeUi();
      setRemoteConnectionState({
        state: 'ok',
        checkedAt: nowIso(),
        message: result.message,
        baseUrl: state.remoteConfig.baseUrl,
        site: result.site,
        account: result.account,
        checks: result.checks,
      });
      appendLog(result.message);
    } catch (err) {
      setRemoteConnectionState({
        state: 'error',
        checkedAt: nowIso(),
        message: err.message,
        baseUrl: state.remoteConfig.baseUrl,
        site: {},
        account: { id: state.remoteConfig.userId },
        checks: [],
      });
      appendLog(`远端连接失败：${err.message}`, 'error');
    }
  }

  function channelTypeName(type) {
    const item = CHANNEL_TYPES.find(([value]) => Number(value) === Number(type));
    return item ? item[1] : `Type ${type || '-'}`;
  }

  function parseJsonObject(value) {
    if (!value || typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function splitCsv(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  }

  function remoteValue(row, ...keys) {
    if (!row || typeof row !== 'object') return undefined;
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    const normalized = new Map(Object.keys(row).map((key) => [
      String(key).replace(/[_\-\s]/g, '').toLowerCase(),
      key,
    ]));
    for (const key of keys) {
      const match = normalized.get(String(key).replace(/[_\-\s]/g, '').toLowerCase());
      if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') return row[match];
    }
    return undefined;
  }

  function shortDateTime(value) {
    if (!value) return '-';
    const numeric = Number(value);
    const date = Number.isFinite(numeric) ? new Date(numeric > 100000000000 ? numeric : numeric * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const pad = (part) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function remoteRelativeTime(value) {
    if (!value) return '-';
    const numeric = Number(value);
    const ms = Number.isFinite(numeric) ? (numeric > 100000000000 ? numeric : numeric * 1000) : new Date(value).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return '-';
    const seconds = Math.max(1, Math.round((Date.now() - ms) / 1000));
    if (seconds < 60) return `${seconds} 秒前`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} 天前`;
    return shortDateTime(value);
  }

  function formatRemoteQuota(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return value === null || value === undefined || value === '' ? '-' : String(value);
    if (Math.abs(number) >= 1000000) return number.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return String(number);
  }

  function formatResponseMs(value) {
    const ms = Number(value || 0);
    if (!Number.isFinite(ms) || ms <= 0) return '未测试';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  }

  function formatUseSeconds(value) {
    const seconds = Number(value || 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${(seconds % 60).toFixed(0)}s`;
  }

  function remoteCell(value, className = '') {
    const text = value === null || value === undefined || value === '' ? '-' : String(value);
    return `<div class="nai-remote-channel-cell ${className}">${escapeHtml(text)}</div>`;
  }

  function remoteHtmlCell(html, className = '') {
    return `<div class="nai-remote-channel-cell ${className}">${html}</div>`;
  }

  function remoteBadge(label, variant = 'neutral', className = '') {
    const text = label === null || label === undefined || label === '' ? '-' : String(label);
    return `<span class="nai-remote-badge ${className}" data-variant="${escapeHtml(variant)}">${escapeHtml(text)}</span>`;
  }

  function remoteBadgeList(values) {
    const list = splitCsv(values);
    if (!list.length) return '<span class="nai-remote-muted">-</span>';
    return `<div class="nai-remote-badge-list">${list.slice(0, 8).map((item) => remoteBadge(item)).join('')}${list.length > 8 ? remoteBadge(`+${list.length - 8}`) : ''}</div>`;
  }

  function remoteStack(primary, secondary = '') {
    return `
      <div class="nai-remote-stack">
        <span>${escapeHtml(primary || '-')}</span>
        ${secondary ? `<small>${escapeHtml(secondary)}</small>` : ''}
      </div>
    `;
  }

  function remoteStackHtml(primary, secondaryHtml = '') {
    return `
      <div class="nai-remote-stack">
        <span>${escapeHtml(primary || '-')}</span>
        ${secondaryHtml ? `<small>${secondaryHtml}</small>` : ''}
      </div>
    `;
  }

  function renderRemoteTable(host, emptyText, columns, rows, gridTemplate, minWidth = '100%') {
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = `<div class="nai-empty-state">${escapeHtml(emptyText)}</div>`;
      return;
    }
    host.innerHTML = `
      <div class="nai-remote-channel-table" style="grid-template-columns: ${escapeHtml(gridTemplate)}; min-width: ${escapeHtml(minWidth)};">
        ${columns.map((column) => `<div class="nai-remote-channel-head">${escapeHtml(column)}</div>`).join('')}
        ${rows.join('')}
      </div>
    `;
  }

  function channelStatusBadge(channel) {
    const status = Number(remoteValue(channel, 'status', 'Status'));
    let label = '未知';
    let variant = 'neutral';
    if (status === 1) {
      label = '已启用';
      variant = 'success';
    } else if (status === 2) {
      label = '已禁用';
      variant = 'destructive';
    } else if (status === 3) {
      label = '自动禁用';
      variant = 'warning';
    }
    const info = remoteValue(channel, 'channel_info', 'channelInfo', 'ChannelInfo') || {};
    const size = Number(info.multi_key_size || info.multiKeySize || 0);
    if (size > 0) {
      const disabled = info.multi_key_status_list && typeof info.multi_key_status_list === 'object'
        ? Object.keys(info.multi_key_status_list).length
        : 0;
      label = `${label} (${Math.max(0, size - disabled)}/${size})`;
    }
    return remoteBadge(label, variant);
  }

  function logTypeBadge(type) {
    const map = {
      0: ['未知', 'neutral'],
      1: ['充值', 'info'],
      2: ['消耗', 'success'],
      3: ['管理', 'neutral'],
      4: ['系统', 'neutral'],
      5: ['错误', 'destructive'],
      6: ['退款', 'info'],
      7: ['登录', 'info'],
    };
    const [label, variant] = map[Number(type)] || map[0];
    return remoteBadge(label, variant);
  }

  function userStatusBadge(user) {
    if (remoteValue(user, 'DeletedAt', 'deleted_at')) return remoteBadge('已注销', 'destructive');
    const status = Number(remoteValue(user, 'status'));
    if (status === 1) return remoteBadge('已启用', 'success');
    if (status === 2) return remoteBadge('已禁用', 'neutral');
    return remoteBadge(status || '未知', 'neutral');
  }

  function userRoleLabel(role) {
    if (Number(role) === 100) return '超级管理员';
    if (Number(role) === 10) return '管理员';
    if (Number(role) === 1) return '普通用户';
    return role === null || role === undefined || role === '' ? '-' : String(role);
  }

  function renderQuotaProgress(remaining, used) {
    const rem = Number(remaining || 0);
    const use = Number(used || 0);
    const total = rem + use;
    if (!Number.isFinite(total) || total <= 0) return remoteBadge('无余额');
    const percent = Math.max(0, Math.min(100, (rem / total) * 100));
    return `
      <div class="nai-remote-quota">
        <div><strong>${escapeHtml(formatRemoteQuota(rem))}</strong><span>${escapeHtml(formatRemoteQuota(total))}</span></div>
        <i><b style="width:${percent.toFixed(1)}%"></b></i>
      </div>
    `;
  }

  function updateRemoteResourceStatus(selector, resource, loadingText, loadedText, emptyText) {
    const status = qs(selector);
    if (!status) return;
    if (resource.busy) {
      status.textContent = loadingText;
    } else if (resource.loaded) {
      status.textContent = resource.error || loadedText(resource.items.length, resource.updatedAt);
    } else {
      status.textContent = emptyText;
    }
  }

  function renderRemoteChannels() {
    const resource = state.remoteResources.channels;
    updateRemoteResourceStatus(
      '#nai-remoteChannelStatus',
      resource,
      '正在读取远端渠道...',
      (count, at) => `已读取 ${count} 个渠道${at ? `，更新时间 ${shortDateTime(at)}` : ''}。`,
      '尚未读取远端渠道。'
    );
    const rows = resource.items.map((channel) => [
      remoteCell(remoteValue(channel, 'id', 'Id', 'ID') ?? '-'),
      remoteHtmlCell(remoteStack(remoteValue(channel, 'name', 'Name') || '(未命名)', remoteValue(channel, 'remark', 'Remark') || ''), 'nai-remote-wrap-cell'),
      remoteHtmlCell(remoteBadge(channelTypeName(remoteValue(channel, 'type', 'Type')))),
      remoteHtmlCell(channelStatusBadge(channel)),
      remoteHtmlCell(remoteBadgeList(remoteValue(channel, 'models', 'Models'))),
      remoteHtmlCell(remoteBadgeList(remoteValue(channel, 'group', 'Group'))),
      remoteHtmlCell(remoteValue(channel, 'tag', 'Tag') ? remoteBadge(remoteValue(channel, 'tag', 'Tag')) : '<span class="nai-remote-muted">-</span>'),
      remoteCell(remoteValue(channel, 'priority', 'Priority') ?? 0),
      remoteCell(remoteValue(channel, 'weight', 'Weight') ?? 0),
      remoteHtmlCell(remoteStack(`已用: ${formatRemoteQuota(remoteValue(channel, 'used_quota', 'usedQuota', 'UsedQuota') || 0)}`, `剩余: ${formatRemoteQuota(remoteValue(channel, 'balance', 'Balance') || 0)}`)),
      remoteHtmlCell(remoteBadge(formatResponseMs(remoteValue(channel, 'response_time', 'responseTime', 'ResponseTime')))),
      remoteHtmlCell(remoteStack(remoteRelativeTime(remoteValue(channel, 'test_time', 'testTime', 'TestTime')), shortDateTime(remoteValue(channel, 'test_time', 'testTime', 'TestTime')))),
      remoteCell('-'),
    ].join(''));
    renderRemoteTable(
      qs('#nai-remoteChannels'),
      '暂无渠道数据。',
      ['ID', '名称', '类型', '状态', '模型', '分组', '标签', '优先级', '权重', '已使用 / 剩余', '响应', '上次测试', '操作'],
      rows,
      '80px minmax(220px, 1.4fr) 150px 130px minmax(190px, 1fr) minmax(150px, .8fr) 110px 90px 80px 170px 110px 150px 90px',
      '1780px'
    );
  }

  function renderRemoteLogs() {
    const resource = state.remoteResources.logs;
    updateRemoteResourceStatus(
      '#nai-remoteLogStatus',
      resource,
      '正在读取远端日志...',
      (count, at) => `已读取 ${count} 条日志${at ? `，更新时间 ${shortDateTime(at)}` : ''}。`,
      '尚未读取远端日志。'
    );
    const rows = resource.items.map((log) => {
      const useTime = remoteValue(log, 'use_time', 'useTime');
      const channelId = remoteValue(log, 'channel', 'channel_id', 'channelId');
      const requestId = firstNonEmpty(remoteValue(log, 'request_id', 'requestId'), remoteValue(log, 'upstream_request_id', 'upstreamRequestId'));
      return [
        remoteHtmlCell(remoteStackHtml(shortDateTime(remoteValue(log, 'created_at', 'created_time', 'createdTime', 'time')), logTypeBadge(remoteValue(log, 'type')))),
        remoteHtmlCell(remoteStack(channelId ? `#${channelId}` : '-', remoteValue(log, 'channel_name', 'channelName') || '')),
        remoteHtmlCell(remoteStack(remoteValue(log, 'username') || '-', remoteValue(log, 'user_id', 'userId') ? `ID: ${remoteValue(log, 'user_id', 'userId')}` : '')),
        remoteHtmlCell(remoteStack(remoteValue(log, 'token_name', 'tokenName') || '-', remoteValue(log, 'group') || '')),
        remoteHtmlCell(remoteBadge(remoteValue(log, 'model_name', 'modelName', 'model') || '-')),
        remoteHtmlCell(remoteStack(formatUseSeconds(useTime), remoteValue(log, 'is_stream', 'isStream') ? '流' : (useTime ? '非流' : ''))),
        remoteHtmlCell(remoteStack(`${formatRemoteQuota(remoteValue(log, 'prompt_tokens', 'promptTokens') || 0)} / ${formatRemoteQuota(remoteValue(log, 'completion_tokens', 'completionTokens') || 0)}`, '')),
        remoteCell(formatRemoteQuota(firstNonEmpty(remoteValue(log, 'quota'), remoteValue(log, 'use_quota', 'useQuota'), remoteValue(log, 'used_quota', 'usedQuota'), remoteValue(log, 'cost')))),
        remoteHtmlCell(remoteStack(firstNonEmpty(remoteValue(log, 'content'), remoteValue(log, 'detail'), remoteValue(log, 'details'), remoteValue(log, 'message')) || '-', requestId || ''), 'nai-remote-wrap-cell'),
      ].join('');
    });
    renderRemoteTable(
      qs('#nai-remoteLogs'),
      '暂无日志数据。',
      ['时间', '渠道', '用户', '令牌', '模型', '耗时', 'Token', '费用', '详情'],
      rows,
      '170px 150px 150px 160px 170px 120px 130px 110px minmax(460px, 1fr)',
      '1620px'
    );
  }

  function renderRemoteUsers() {
    const resource = state.remoteResources.users;
    updateRemoteResourceStatus(
      '#nai-remoteUserStatus',
      resource,
      '正在读取远端用户...',
      (count, at) => `已读取 ${count} 个用户${at ? `，更新时间 ${shortDateTime(at)}` : ''}。`,
      '尚未读取远端用户。'
    );
    const rows = resource.items.map((user) => {
      const username = firstNonEmpty(remoteValue(user, 'username'), remoteValue(user, 'name'), remoteValue(user, 'email'));
      const displayName = remoteValue(user, 'display_name', 'displayName');
      const inviterId = remoteValue(user, 'inviter_id', 'inviterId');
      return [
        remoteCell(remoteValue(user, 'id', 'uid') ?? '-'),
        remoteHtmlCell(remoteStack(username, displayName && displayName !== username ? displayName : remoteValue(user, 'remark') || ''), 'nai-remote-wrap-cell'),
        remoteHtmlCell(`${userStatusBadge(user)}<div class="nai-remote-cell-note">请求: ${escapeHtml(formatRemoteQuota(remoteValue(user, 'request_count', 'requestCount') || 0))}</div>`),
        remoteHtmlCell(renderQuotaProgress(firstNonEmpty(remoteValue(user, 'quota'), remoteValue(user, 'remain_quota', 'remainQuota'), remoteValue(user, 'remaining_quota', 'remainingQuota'), remoteValue(user, 'balance')), remoteValue(user, 'used_quota', 'usedQuota'))),
        remoteHtmlCell(remoteBadge(remoteValue(user, 'group') || '-')),
        remoteCell(userRoleLabel(remoteValue(user, 'role'))),
        remoteHtmlCell(`<div class="nai-remote-badge-list nai-remote-wrap-cell">${remoteBadge(`邀请: ${remoteValue(user, 'aff_count', 'affCount') || 0}`)}${remoteBadge(`收益: ${formatRemoteQuota(remoteValue(user, 'aff_history_quota', 'affHistoryQuota') || 0)}`)}${inviterId ? remoteBadge(`邀请人: ${inviterId}`) : remoteBadge('无邀请人')}</div>`),
        remoteCell(shortDateTime(remoteValue(user, 'created_at', 'created_time', 'createdTime'))),
        remoteCell(shortDateTime(remoteValue(user, 'last_login_at', 'lastLoginAt'))),
        remoteCell('-'),
      ].join('');
    });
    renderRemoteTable(
      qs('#nai-remoteUsers'),
      '暂无用户数据。',
      ['ID', '用户名', '状态', '额度', '分组', '角色', '邀请信息', '创建时间', '最后登录', '操作'],
      rows,
      '80px minmax(240px, 1.1fr) 130px 170px 150px 110px minmax(280px, .9fr) 170px 170px 90px',
      '1590px'
    );
  }

  function renderRemoteResourceViews() {
    renderRemoteChannels();
    renderRemoteLogs();
    renderRemoteUsers();
  }

  function setParamsPaneOpen(open) {
    const panel = document.getElementById(SCRIPT_ID);
    if (!panel) return;
    panel.setAttribute('data-nai-right-open', String(open));
    const toggle = qs('[data-nai-toggle-params]', panel);
    if (toggle) toggle.textContent = open ? '收起' : '展开';
    updateJobPreview();
  }

  function setKeyTab(tab) {
    const panel = document.getElementById(SCRIPT_ID);
    if (!panel) return;
    qsa('[data-nai-key-tab]', panel).forEach((button) => {
      button.setAttribute('data-active', String(button.getAttribute('data-nai-key-tab') === tab));
    });
    const listPanel = qs('#nai-keyListPanel', panel);
    const statsPanel = qs('#nai-keyStatsPanel', panel);
    if (listPanel) listPanel.hidden = tab !== 'list';
    if (statsPanel) statsPanel.hidden = tab !== 'stats';
  }

  function setJobTab(tab) {
    const panel = document.getElementById(SCRIPT_ID);
    if (!panel) return;
    qsa('[data-nai-job-tab]', panel).forEach((button) => {
      button.setAttribute('data-active', String(button.getAttribute('data-nai-job-tab') === tab));
    });
    const statsPanel = qs('#nai-jobStatsPanel', panel);
    const batchesPanel = qs('#nai-jobBatchesPanel', panel);
    const logsPanel = qs('#nai-jobLogsPanel', panel);
    if (statsPanel) statsPanel.hidden = tab !== 'stats';
    if (batchesPanel) batchesPanel.hidden = tab !== 'batches';
    if (logsPanel) logsPanel.hidden = tab !== 'logs';
  }

  function isStrategyField(el) {
    const field = el?.getAttribute?.('data-nai-runtime-field');
    const check = el?.getAttribute?.('data-nai-runtime-check');
    return ['targetAliveSize', 'aliveThreshold', 'replenishBatchSize', 'monitorIntervalSec'].includes(field) || check === 'autoRefill';
  }

  function markStrategyDirty() {
    if (!state.activeJob) return;
    state.strategyDirty = true;
    updateJobControls();
  }
