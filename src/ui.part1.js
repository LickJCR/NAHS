  function renderTypeOptions(selected) {
    const options = CHANNEL_TYPES.map(([value, label]) => {
      const isSelected = String(value) === String(selected) ? ' selected' : '';
      return `<option value="${value}"${isSelected}>${escapeHtml(label)} (${value})</option>`;
    });
    return options.join('');
  }

  function channelTypeEntry(type) {
    const entry = CHANNEL_TYPES.find(([value]) => String(value) === String(type));
    if (entry) return entry;
    return [Number(type) || 0, `#${type}`];
  }

  function channelTypeIconName(type) {
    return CHANNEL_TYPE_ICONS[Number(type)] || 'OpenAI';
  }

  function sanitizeHostIcon(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    qsa('script, style', clone).forEach((child) => child.remove());
    qsa('*', clone).forEach((child) => {
      for (const attr of Array.from(child.attributes)) {
        if (/^on/i.test(attr.name)) child.removeAttribute(attr.name);
      }
    });
    for (const attr of Array.from(clone.attributes || [])) {
      if (/^on/i.test(attr.name)) clone.removeAttribute(attr.name);
    }
    const tag = clone.tagName?.toLowerCase();
    if (tag === 'img') {
      const src = clone.getAttribute('src') || '';
      if (!src || /^javascript:/i.test(src)) return '';
      return `<img src="${escapeHtml(src)}" alt="">`;
    }
    if (tag === 'svg') return clone.outerHTML;
    return '';
  }

  function captureHostTypeIcons() {
    const panel = document.getElementById(SCRIPT_ID);
    const candidates = qsa('button, [role="option"], [role="menuitem"], [class*="select"], [class*="channel"], [class*="provider"]')
      .filter((el) => !panel?.contains(el));
    const icons = {};
    for (const [type, label] of CHANNEL_TYPES) {
      const normalized = String(label).toLowerCase();
      const match = candidates.find((el) => {
        const text = String(el.textContent || '').toLowerCase();
        return text.includes(normalized) && qs('svg, img', el);
      });
      const icon = sanitizeHostIcon(match ? qs('svg, img', match) : null);
      if (icon) icons[type] = icon;
    }
    state.hostTypeIcons = icons;
  }

  function channelIconHtml(type) {
    const hostIcon = state.hostTypeIcons?.[Number(type)];
    if (hostIcon) {
      return `
        <span class="nai-channel-icon nai-host-channel-icon" title="NewAPI ${escapeHtml(channelTypeIconName(type))}" aria-hidden="true">${hostIcon}</span>
      `;
    }
    const iconName = channelTypeIconName(type);
    const [text, background, color] = CHANNEL_ICON_META[iconName] || CHANNEL_ICON_META.OpenAI;
    return `
      <span
        class="nai-channel-icon"
        title="${escapeHtml(iconName)}"
        style="background:${escapeHtml(background)};color:${escapeHtml(color)};"
        aria-hidden="true"
      >${escapeHtml(text)}</span>
    `;
  }

  function typeOptionContentHtml(type, label) {
    return `
      ${channelIconHtml(type)}
      <span class="nai-type-label">${escapeHtml(label)}</span>
      <span class="nai-type-id">${escapeHtml(type)}</span>
    `;
  }

  function renderTypePickerValue(selected) {
    const [type, label] = channelTypeEntry(selected);
    return typeOptionContentHtml(type, label);
  }

  function renderTypeMenuOptions(selected) {
    return CHANNEL_TYPES.map(([type, label]) => {
      const isSelected = String(type) === String(selected);
      return `
        <button
          type="button"
          class="nai-type-option"
          data-nai-type-option="${escapeHtml(type)}"
          role="option"
          aria-selected="${isSelected ? 'true' : 'false'}"
        >${typeOptionContentHtml(type, label)}</button>
      `;
    }).join('');
  }

  function renderNameSegmentTypeOptions(selected) {
    return NAME_SEGMENT_TYPES
      .map(([value, label]) => {
        const isSelected = String(value) === String(selected) ? ' selected' : '';
        return `<option value="${escapeHtml(value)}"${isSelected}>${escapeHtml(label)}</option>`;
      })
      .join('');
  }

  function nameSegmentLabel(type) {
    const found = NAME_SEGMENT_TYPES.find(([value]) => value === type);
    return found ? found[1] : '空';
  }

  function renderNameBuilderHtml(config) {
    const segments = normalizeNameSegments(config.nameSegments, config);
    return `
      <div class="nai-bulk-name-builder" data-nai-name-builder>
        ${segments.map((type, index) => `
          <div class="nai-name-segment" data-nai-name-segment="${index}">
            <span class="nai-name-segment-label">${escapeHtml(slotLabel(index))}:</span>
            <select data-nai-name-segment-type="${index}" aria-label="名称段 ${escapeHtml(slotLabel(index))}">
              ${renderNameSegmentTypeOptions(type)}
            </select>
            ${segments.length > 1 ? `<button type="button" class="nai-bulk-small-button nai-name-remove" data-nai-name-remove="${index}" title="删除此段">x</button>` : ''}
          </div>
          ${index < segments.length - 1 ? '<span class="nai-bulk-plus">+</span>' : ''}
        `).join('')}
        ${segments.length < MAX_NAME_SEGMENTS ? '<button type="button" class="nai-bulk-small-button" data-nai-name-add-segment>+ 添加段</button>' : ''}
      </div>
    `;
  }

  function settingValue(settings, slot, key) {
    return settings[slot]?.[key] ?? defaultSegmentSettings(slot)[key] ?? '';
  }

  function settingInput(slot, key, label, value, attrs = '') {
    return `
      <label class="nai-bulk-field">
        <span>${escapeHtml(label)}</span>
        <input data-nai-name-setting="${escapeHtml(slot)}.${escapeHtml(key)}" value="${escapeHtml(value)}" ${attrs}>
      </label>
    `;
  }

  function renderNameSegmentSettingsHtml(config) {
    const segments = normalizeNameSegments(config.nameSegments, config);
    const settings = normalizeNameSegmentSettings(config.nameSegmentSettings, config);
    const cards = segments
      .map((type, index) => {
        const slot = slotLabel(index);
        if (type === 'text') {
          return `
            <div class="nai-name-setting-card">
              <div class="nai-name-setting-title">固定文字.${escapeHtml(slot)}</div>
              ${settingInput(slot, 'text', '自定义', settingValue(settings, slot, 'text'))}
            </div>
          `;
        }
        if (type === 'num') {
          return `
            <div class="nai-name-setting-card">
              <div class="nai-name-setting-title">顺序数字.${escapeHtml(slot)}</div>
              <div class="nai-name-setting-row">
                ${settingInput(slot, 'numberStart', '起始', settingValue(settings, slot, 'numberStart'), 'inputmode="numeric"')}
                ${settingInput(slot, 'numberPad', '位数', settingValue(settings, slot, 'numberPad'), 'inputmode="numeric"')}
              </div>
            </div>
          `;
        }
        if (type === 'alpha') {
          return `
            <div class="nai-name-setting-card">
              <div class="nai-name-setting-title">顺序字母.${escapeHtml(slot)}</div>
              ${settingInput(slot, 'alphaStart', '字母起始', settingValue(settings, slot, 'alphaStart'))}
            </div>
          `;
        }
        if (type === 'ts') {
          return `
            <div class="nai-name-setting-card">
              <div class="nai-name-setting-title">时间戳.${escapeHtml(slot)}</div>
              ${settingInput(slot, 'tsFormat', '格式', settingValue(settings, slot, 'tsFormat'), 'placeholder="yyyyMMdd-HHmmss"')}
            </div>
          `;
        }
        if (type === 'date') {
          return `
            <div class="nai-name-setting-card">
              <div class="nai-name-setting-title">日期.${escapeHtml(slot)}</div>
              ${settingInput(slot, 'dateFormat', '格式', settingValue(settings, slot, 'dateFormat'), 'placeholder="yyyyMMdd"')}
            </div>
          `;
        }
        return '';
      })
      .filter(Boolean);

    if (!cards.length) {
      return '<div class="nai-name-settings" data-nai-name-settings></div>';
    }

    return `
      <div class="nai-name-settings" data-nai-name-settings>
        <div class="nai-name-settings-grid">${cards.join('')}</div>
      </div>
    `;
  }

  function selectedGroupsFromValue(value, groups = []) {
    const selected = normalizeList(value).split(',').filter(Boolean);
    if (!selected.length) return [];
    return selected.filter((group) => groups.includes(group));
  }

  function renderGroupOptions(groups = [], selected = '') {
    if (!groups.length) {
      return '<option value="">暂无分组</option>';
    }
    const selectedGroups = new Set(selectedGroupsFromValue(selected, groups));
    return groups.map((group) => {
      const isSelected = selectedGroups.has(group) ? ' selected' : '';
      return `<option value="${escapeHtml(group)}"${isSelected}>${escapeHtml(group)}</option>`;
    }).join('');
  }

  function renderGroupMenuOptions(groups = [], selected = '') {
    if (!groups.length) {
      return '<div class="nai-bulk-help" style="padding: 8px;">暂无分组</div>';
    }
    const selectedGroups = new Set(selectedGroupsFromValue(selected, groups));
    return groups.map((group) => {
      const isSelected = selectedGroups.has(group);
      return `
        <button type="button" class="nai-group-option" data-nai-group-option="${escapeHtml(group)}" aria-selected="${isSelected ? 'true' : 'false'}">
          <input type="checkbox" tabindex="-1"${isSelected ? ' checked' : ''}>
          <span>${escapeHtml(group)}</span>
        </button>
      `;
    }).join('');
  }

  function groupTriggerLabel(value) {
    const groups = normalizeList(value).split(',').filter(Boolean);
    if (!groups.length) return '选择分组';
    if (groups.length <= 2) return groups.join(', ');
    return `${groups.slice(0, 2).join(', ')} +${groups.length - 2}`;
  }

  function currentSiteInfo() {
    if (state.operationMode === 'remote') {
      const url = normalizeRemoteBaseUrl(state.remoteConfig.baseUrl);
      return {
        name: url ? '远端 NewAPI' : '远端 NewAPI 未配置',
        url: url || '未填写地址',
      };
    }
    const title = String(document.title || '').replace(/\s+/g, ' ').trim();
    return {
      name: title || location.hostname,
      url: location.origin,
    };
  }

  function defaultBaseUrlForType(type) {
    return CHANNEL_BASE_URLS[Number(type)] || '';
  }

  function baseUrlDisplayValue(type) {
    return defaultBaseUrlForType(type) || '此类型无内置默认 Base URL';
  }

  function renderTemplateOptions(channels = [], selected = '') {
    if (!channels.length) {
      return '<option value="">暂无同类型样板渠道</option>';
    }
    return [
      '<option value="">选择样板渠道</option>',
      ...channels.map((channel) => {
        const modelCount = normalizeList(channel.models).split(',').filter(Boolean).length;
        const label = `#${channel.id} ${channel.name || '(未命名)'}${modelCount ? ` - ${modelCount} 模型` : ''}`;
        const isSelected = String(channel.id) === String(selected) ? ' selected' : '';
        return `<option value="${escapeHtml(channel.id)}"${isSelected}>${escapeHtml(label)}</option>`;
      }),
    ].join('');
  }

  function renderRemoteAuthModeOptions(selected = DEFAULT_REMOTE_CONFIG.authMode) {
    const options = [
      ['bearer', 'Authorization: Bearer'],
      ['new-api-key', 'New-Api-Key'],
      ['both', '同时发送'],
    ];
    return options.map(([value, label]) => {
      const isSelected = value === selected ? ' selected' : '';
      return `<option value="${escapeHtml(value)}"${isSelected}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  function renderRemoteSiteTabs() {
    if (!state.remoteSites.length) {
      return '<div class="nai-remote-site-empty">暂无台子。填写上方连接信息后点击“保存并新增台子”。</div>';
    }
    return state.remoteSites.map((site, index) => {
      const active = site.id === state.activeRemoteSiteId;
      const subtitle = site.config?.baseUrl || '';
      return `
        <button type="button" class="nai-remote-site-tab" data-nai-remote-site="${escapeHtml(site.id)}" data-active="${active ? 'true' : 'false'}">
          <span class="nai-remote-site-index">${index + 1}</span>
          <span class="nai-remote-site-text">
            <strong>${escapeHtml(site.name || `台子 ${index + 1}`)}</strong>
            <small>${escapeHtml(subtitle)}</small>
          </span>
          <span class="nai-remote-site-remove" data-nai-remove-remote-site="${escapeHtml(site.id)}" title="移除台子">x</span>
        </button>
      `;
    }).join('');
  }

  function panelHtml(config) {
    const site = currentSiteInfo();
    const defaultBaseUrl = defaultBaseUrlForType(config.typePreset);
    const remoteConfig = state.remoteConfig;
    return `
      <div class="nai-bulk-header">
        <div class="nai-bulk-title">
          <strong class="nai-bulk-title-line">NewAPI Helper Suite</strong>
          <span class="nai-bulk-header-separator"></span>
          ${versionBadgeHtml()}
          <span class="nai-bulk-header-separator"></span>
          <span id="nai-modeLabel">选择工作模式</span>
          <span class="nai-bulk-header-separator"></span>
          <span class="nai-bulk-title-site">当前站点：<strong id="nai-siteName">${escapeHtml(site.name)}</strong> · <strong id="nai-siteUrl">${escapeHtml(site.url)}</strong></span>
        </div>
        <div class="nai-bulk-header-actions">
          <button type="button" class="nai-bulk-small-button" data-nai-change-mode>切换模式</button>
          <button type="button" class="nai-bulk-small-button" data-nai-refresh-site>刷新站点</button>
          <button type="button" class="nai-bulk-small-button" data-nai-import-work>导入工作</button>
          <button type="button" class="nai-bulk-small-button" data-nai-export-work>导出工作</button>
          <button type="button" class="nai-bulk-small-button" data-nai-reset-work>重置</button>
          <button type="button" class="nai-bulk-close" data-nai-close aria-label="关闭">x</button>
          <input class="nai-bulk-hidden-file" type="file" accept="application/json,.json" data-nai-import-work-file>
        </div>
      </div>
      <div class="nai-mode-chooser" data-nai-mode-chooser>
        <button type="button" class="nai-mode-card" data-nai-mode-choice="local">
          <span class="nai-mode-card-icon" aria-hidden="true">●</span>
          <span class="nai-mode-card-title">当前浏览器渠道 key 批量添加</span>
          <span class="nai-mode-card-desc">使用当前 NewAPI 页面登录态和本地数据。</span>
        </button>
        <button type="button" class="nai-mode-card" data-nai-mode-choice="remote">
          <span class="nai-mode-card-icon" aria-hidden="true">↗</span>
          <span class="nai-mode-card-title">远端 NewAPI 管理</span>
          <span class="nai-mode-card-desc">填写 NewAPI 地址、用户 ID 和用户密钥后通过 API 管理。</span>
        </button>
      </div>
      <div class="nai-bulk-body">
        <section class="nai-remote-only nai-remote-config-panel">
          <div class="nai-pane-title">
            <span>新增 NewAPI 台子</span>
            <small>最多保存 ${MAX_REMOTE_SITES} 个台子；每个台子的 key 池、作业和列表互相独立。</small>
          </div>
          <div class="nai-remote-config-grid">
            <div class="nai-bulk-field">
              <label for="nai-remoteSiteName">台子名称</label>
              <input id="nai-remoteSiteName" data-nai-remote-site-name placeholder="留空自动使用域名">
            </div>
            <div class="nai-bulk-field">
              <label for="nai-remoteBaseUrl">NewAPI 地址</label>
              <input id="nai-remoteBaseUrl" data-nai-remote-field="baseUrl" placeholder="https://newapi.example.com" value="${escapeHtml(remoteConfig.baseUrl)}">
            </div>
            <div class="nai-bulk-field">
              <label for="nai-remoteUserId">User ID</label>
              <input id="nai-remoteUserId" data-nai-remote-field="userId" inputmode="numeric" value="${escapeHtml(remoteConfig.userId)}">
            </div>
            <div class="nai-bulk-field">
              <label for="nai-remoteUserSecret">User 密钥</label>
              <input id="nai-remoteUserSecret" data-nai-remote-field="userSecret" data-nai-sensitive type="password" value="${escapeHtml(remoteConfig.userSecret)}">
            </div>
            <div class="nai-bulk-field">
              <label for="nai-remoteAuthMode">密钥发送方式</label>
              <select id="nai-remoteAuthMode" data-nai-remote-field="authMode">${renderRemoteAuthModeOptions(remoteConfig.authMode)}</select>
            </div>
            <div class="nai-remote-config-actions">
              <button type="button" class="nai-bulk-small-button" data-nai-add-remote-site>保存并新增台子</button>
              <button type="button" class="nai-bulk-small-button" data-nai-test-remote>测试连接</button>
            </div>
          </div>
          <div id="nai-remoteConnectionStatus" class="nai-remote-status" data-state="idle"></div>
        </section>
        <div class="nai-remote-only nai-remote-site-tabs" data-nai-remote-site-tabs>
          ${renderRemoteSiteTabs()}
        </div>
        <div class="nai-remote-only nai-remote-tabs" data-nai-remote-tabs>
          <button type="button" class="nai-remote-tab" data-nai-remote-tab="bulk" data-active="true">批量添加</button>
          <button type="button" class="nai-remote-tab" data-nai-remote-tab="channels" data-active="false">渠道列表</button>
          <button type="button" class="nai-remote-tab" data-nai-remote-tab="logs" data-active="false">日志列表</button>
          <button type="button" class="nai-remote-tab" data-nai-remote-tab="users" data-active="false">用户列表</button>
        </div>
        <div class="nai-remote-panel" data-nai-remote-panel="bulk">
        <div class="nai-workbench">
          <aside class="nai-pane nai-pane-left">
            <section class="nai-pane-half nai-left-input">
              <div class="nai-step">
                <div class="nai-step-kicker">第一步</div>
                <div class="nai-step-title">批量添加 key</div>
                <div class="nai-step-desc">粘贴后点击添加入库；key 池会保留历史，直到你点击顶栏重置。</div>
              </div>
              <div class="nai-bulk-field">
                <label for="nai-keys">key 库，批量粘贴/追加</label>
                <textarea id="nai-keys" data-nai-sensitive placeholder="sk-ant-...&#10;或 JSON 数组、逗号分隔、key=value、带序号/引号的列表&#10;&#10;入库后会进入当前工作记录；导出工作会包含 key 池，用于迁移后继续执行。"></textarea>
              </div>
              <div class="nai-bulk-actions nai-key-add-actions">
                <button type="button" class="nai-bulk-action nai-bulk-action-primary" data-nai-add-keys>添加入库</button>
              </div>
            </section>

            <section class="nai-pane-half nai-left-workspace">
              <div class="nai-key-tabs" data-nai-key-tabs>
                <button type="button" class="nai-key-tab" data-nai-key-tab="list" data-active="true">key 库列表</button>
                <button type="button" class="nai-key-tab" data-nai-key-tab="stats" data-active="false">key 库统计</button>
              </div>
              <div id="nai-keyListPanel" class="nai-key-tab-panel"></div>
              <div id="nai-keyStatsPanel" class="nai-key-tab-panel" hidden></div>
            </section>
          </aside>

          <main class="nai-pane nai-pane-center">
            <section class="nai-pane-half nai-center-top">
              <div class="nai-step">
                <div class="nai-step-kicker">第二步</div>
                <div class="nai-step-title">添加作业参数</div>
                <div class="nai-step-desc">右侧只用于新建和预览作业；已创建的作业不直接编辑，变更配置会按新输入新建作业。</div>
              </div>

              <div class="nai-pane-card">
                <div class="nai-job-status">
                  <div>
                    <strong id="nai-jobTitle">暂无作业</strong>
                    <span id="nai-jobStatusText" class="nai-job-status-text">当前状态：未开始</span>
                  </div>
                  <button type="button" class="nai-bulk-small-button" data-nai-open-params>创建作业参数</button>
                </div>
                <div id="nai-jobEmptyState" class="nai-job-empty">
                  尚未创建作业。先点击“创建作业参数”，在右侧配置作业名称、类型、模型、分组、名称组合和策略，然后点击“保存创建作业”。
                </div>
                <div id="nai-jobRuntimeSection" class="nai-bulk-section nai-job-runtime" hidden>
                  <div class="nai-job-strategy-row">
                    <label class="nai-bulk-check">
                      <input id="nai-runtime-autoRefill" type="checkbox" data-nai-runtime-check="autoRefill"${config.autoRefill ? ' checked' : ''}>
                      <span>自动</span>
                    </label>
                    <div class="nai-job-strategy-field">
                      <label for="nai-runtime-targetAliveSize">保活</label>
                      <input id="nai-runtime-targetAliveSize" data-nai-runtime-field="targetAliveSize" inputmode="numeric" value="${escapeHtml(config.targetAliveSize)}">
                    </div>
                    <div class="nai-job-strategy-field">
                      <label for="nai-runtime-aliveThreshold">低于</label>
                      <input id="nai-runtime-aliveThreshold" data-nai-runtime-field="aliveThreshold" inputmode="numeric" value="${escapeHtml(config.aliveThreshold)}">
                    </div>
                    <div class="nai-job-strategy-field">
                      <label for="nai-runtime-replenishBatchSize">添加</label>
                      <input id="nai-runtime-replenishBatchSize" data-nai-runtime-field="replenishBatchSize" inputmode="numeric" value="${escapeHtml(config.replenishBatchSize)}">
                    </div>
                    <div class="nai-job-strategy-field">
                      <label for="nai-runtime-monitorIntervalSec">监控间隔</label>
                      <input id="nai-runtime-monitorIntervalSec" data-nai-runtime-field="monitorIntervalSec" inputmode="numeric" value="${escapeHtml(config.monitorIntervalSec)}">
                      <span class="nai-job-strategy-unit">秒</span>
                    </div>
                    <button type="button" class="nai-bulk-small-button nai-job-strategy-apply" data-nai-apply-strategy data-dirty="false" disabled>应用策略</button>
                  </div>
                  <div id="nai-jobActionBar" class="nai-bulk-actions nai-job-actionbar">
                    <button type="button" class="nai-bulk-action nai-bulk-action-primary" data-nai-toggle-job>
                      <span class="nai-action-icon" aria-hidden="true">⏸</span>
                      <span>暂停作业</span>
                    </button>
                    <button type="button" class="nai-bulk-action" data-nai-refresh-job>
                      <span class="nai-action-icon" aria-hidden="true">↻</span>
                      <span>刷新状态</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section class="nai-pane-half nai-center-monitor">
              <div class="nai-pane-card">
                <div class="nai-job-tabs" data-nai-job-tabs>
                  <button type="button" class="nai-job-tab" data-nai-job-tab="stats" data-active="true">作业统计</button>
                  <button type="button" class="nai-job-tab" data-nai-job-tab="batches" data-active="false">批次记录</button>
                  <button type="button" class="nai-job-tab" data-nai-job-tab="logs" data-active="false">作业日志</button>
                </div>
                <div id="nai-jobStatsPanel" class="nai-job-tab-panel">
                  <div class="nai-pane-title" style="margin-top: 10px;">
                    <span>作业统计</span>
                    <small>监控中即时刷新</small>
                  </div>
                  <div id="nai-jobStats" class="nai-job-stats"></div>
                </div>
                <div id="nai-jobBatchesPanel" class="nai-job-tab-panel" hidden>
                  <div class="nai-pane-title" style="margin-top: 10px;">
                    <span>批次记录</span>
                    <small>作业补批和创建批次</small>
                  </div>
                  <div id="nai-jobBatches" class="nai-job-batches"></div>
                </div>
                <div id="nai-jobLogsPanel" class="nai-job-tab-panel" hidden>
                  <div class="nai-pane-title" style="margin-top: 10px;">
                    <span>作业日志</span>
                    <button type="button" class="nai-bulk-small-button" data-nai-export-job>导出日志</button>
                  </div>
                  <div id="nai-log" class="nai-bulk-log">Ready.</div>
                </div>
              </div>
            </section>
          </main>

          <aside class="nai-pane nai-pane-right">
            <div class="nai-right-placeholder">右侧用于创建或预览作业参数。点击中栏“创建作业参数”后显示。</div>
            <div class="nai-right-sticky">
              <div class="nai-right-sticky-header">
                <div class="nai-step">
                  <div class="nai-step-kicker">创建 / 预览</div>
                  <div class="nai-step-title">作业信息</div>
                  <div class="nai-step-desc">这里用于新建作业和查看当前作业快照；已创建作业不直接编辑。</div>
                </div>
                <button type="button" class="nai-bulk-action nai-bulk-action-primary" data-nai-run>保存创建</button>
              </div>
              <div id="nai-jobPreview" class="nai-job-preview-card"></div>
            </div>
            <div class="nai-pane-right-form">
              <div class="nai-bulk-field">
                <label for="nai-jobName">自定义作业名称</label>
                <input id="nai-jobName" data-nai-field="jobName" placeholder="留空自动使用 时间戳+类型" value="${escapeHtml(config.jobName)}">
                <small>如果不填写，创建时自动补充为“时间戳 + 类型”。已有作业不会被改名；再次创建会生成新作业。</small>
              </div>
              <div class="nai-bulk-grid">
                <div class="nai-bulk-field nai-span-4">
                  <label>API 路径</label>
                  <div class="nai-bulk-static">${escapeHtml(API_ROOT)}</div>
                </div>
                <div class="nai-bulk-field nai-span-8">
                  <label for="nai-typePreset">类型</label>
                  <div class="nai-type-picker" data-nai-type-picker>
                    <button
                      type="button"
                      class="nai-type-trigger"
                      data-nai-type-trigger
                      aria-haspopup="listbox"
                      aria-expanded="false"
                    >${renderTypePickerValue(config.typePreset)}</button>
                    <div class="nai-type-menu" data-nai-type-menu role="listbox" hidden>
                      ${renderTypeMenuOptions(config.typePreset)}
                    </div>
                  </div>
                  <select id="nai-typePreset" class="nai-bulk-hidden-select" data-nai-field="typePreset" aria-hidden="true" tabindex="-1">${renderTypeOptions(config.typePreset)}</select>
                </div>
                <div class="nai-bulk-group-panel">
                  <div class="nai-bulk-field">
                    <label for="nai-groupTrigger">分组选择</label>
                    <div class="nai-bulk-combo-row">
                      <div class="nai-group-picker" data-nai-group-picker>
                        <button type="button" id="nai-groupTrigger" class="nai-group-trigger" data-nai-group-trigger aria-haspopup="listbox" aria-expanded="false">
                          <span class="nai-group-trigger-text" data-nai-group-trigger-text>${escapeHtml(groupTriggerLabel(config.group))}</span>
                        </button>
                        <div class="nai-group-menu" data-nai-group-menu role="listbox" hidden>${renderGroupMenuOptions([], config.group)}</div>
                        <select id="nai-groupSelect" class="nai-bulk-hidden-select" data-nai-group-select multiple aria-hidden="true" tabindex="-1">${renderGroupOptions([], config.group)}</select>
                      </div>
                      <button type="button" class="nai-bulk-small-button" data-nai-refresh-groups>刷新</button>
                    </div>
                    <input type="hidden" id="nai-group" data-nai-field="group" value="${escapeHtml(config.group)}">
                    <small id="nai-group-help">已读取的分组会在下拉中展示；可多选，已选项直接显示在分组选择框内。</small>
                  </div>
                </div>
                <div class="nai-bulk-field nai-span-12">
                  <label>API 地址（NewAPI 内置默认，仅展示）</label>
                  <div class="nai-bulk-combo-row">
                    <div id="nai-baseUrlDisplay" class="nai-bulk-static nai-bulk-static-disabled" data-empty="${defaultBaseUrl ? 'false' : 'true'}" aria-disabled="true">${escapeHtml(baseUrlDisplayValue(config.typePreset))}</div>
                    <button type="button" class="nai-bulk-small-button" data-nai-refresh-base-url>刷新</button>
                  </div>
                  <small>创建时不会填写 base_url；提交会留空，让 NewAPI 使用内置默认地址。</small>
                </div>
              </div>

              <div class="nai-bulk-section">
                <div class="nai-bulk-field">
                  <label>名称组合</label>
                  <div id="nai-nameBuilderHost">${renderNameBuilderHtml(config)}</div>
                  <small>A/B/C 按顺序拼接；点“+ 添加段”继续扩展。</small>
                  <div id="nai-nameSettingsHost">${renderNameSegmentSettingsHtml(config)}</div>
                </div>
              </div>

              <div class="nai-bulk-section">
                <div class="nai-template-row">
                  <div class="nai-bulk-field">
                    <div class="nai-template-label-line">
                      <label for="nai-templateSelect">选择样板渠道</label>
                      <small id="nai-template-help">*按当前类型读取最近 ${TEMPLATE_PAGE_SIZE} 个渠道。</small>
                    </div>
                    <select id="nai-templateSelect" data-nai-template-select>${renderTemplateOptions()}</select>
                  </div>
                  <div class="nai-template-actions">
                    <button type="button" class="nai-bulk-small-button" data-nai-load-template>读取样板</button>
                    <button type="button" class="nai-bulk-small-button" data-nai-refresh-templates>刷新样板</button>
                  </div>
                </div>
              </div>

              <div class="nai-bulk-section">
                <div class="nai-bulk-grid">
                  <div class="nai-bulk-field nai-span-12">
                    <label for="nai-models">模型</label>
                    <textarea id="nai-models" data-nai-field="models" placeholder="claude-sonnet-4-20250514,claude-opus-4-20250514">${escapeHtml(config.models)}</textarea>
                    <small>支持逗号或换行；提交前会去重并转换成逗号分隔。</small>
                  </div>
                  <div class="nai-bulk-field nai-span-12">
                    <label for="nai-modelMapping">模型映射 JSON</label>
                    <textarea id="nai-modelMapping" data-nai-field="modelMapping" placeholder='{"claude-sonnet-4": "claude-sonnet-4-20250514"}'>${escapeHtml(config.modelMapping)}</textarea>
                    <small>留空表示不配置。NewAPI 要求值必须是字符串。</small>
                  </div>
                </div>
              </div>

              <div class="nai-bulk-section">
                <div class="nai-bulk-grid">
                  <div class="nai-bulk-field nai-span-3">
                    <label for="nai-priority">优先级</label>
                    <input id="nai-priority" data-nai-field="priority" inputmode="numeric" value="${escapeHtml(config.priority)}">
                  </div>
                  <div class="nai-bulk-field nai-span-3">
                    <label for="nai-weight">权重</label>
                    <input id="nai-weight" data-nai-field="weight" inputmode="numeric" value="${escapeHtml(config.weight)}">
                  </div>
                  <div class="nai-bulk-field nai-span-3">
                    <label for="nai-delayMs">间隔 ms</label>
                    <input id="nai-delayMs" data-nai-field="delayMs" inputmode="numeric" value="${escapeHtml(config.delayMs)}">
                  </div>
                  <div class="nai-bulk-field nai-span-3">
                    <label for="nai-tag">标签</label>
                    <input id="nai-tag" data-nai-field="tag" value="${escapeHtml(config.tag)}">
                  </div>
                  <div class="nai-bulk-field nai-span-12">
                    <label for="nai-remark">备注</label>
                    <input id="nai-remark" data-nai-field="remark" value="${escapeHtml(config.remark)}">
                  </div>
                  <div class="nai-span-12 nai-bulk-checks">
                    ${checkboxHtml('status', '启用', config.status)}
                    ${checkboxHtml('autoBan', '自动禁用', config.autoBan)}
                    ${checkboxHtml('dedupeKeys', 'key 去重', config.dedupeKeys)}
                    ${checkboxHtml('continueOnError', '遇错继续', config.continueOnError)}
                    ${checkboxHtml('allowServiceTier', '允许 service_tier', config.allowServiceTier)}
                    ${checkboxHtml('allowInferenceGeo', '允许 inference_geo', config.allowInferenceGeo)}
                    ${checkboxHtml('allowSpeed', '允许 speed', config.allowSpeed)}
                    ${checkboxHtml('claudeBetaQuery', 'Claude beta query', config.claudeBetaQuery)}
                  </div>
                </div>
              </div>

              <div class="nai-bulk-section">
                <details class="nai-bulk-details">
                  <summary>高级 JSON 字段</summary>
                  <div class="nai-bulk-grid">
                    <div class="nai-bulk-field nai-span-6">
                      <label for="nai-settingJson">setting JSON</label>
                      <textarea id="nai-settingJson" data-nai-field="settingJson">${escapeHtml(config.settingJson)}</textarea>
                    </div>
                    <div class="nai-bulk-field nai-span-6">
                      <label for="nai-settingsJson">settings JSON</label>
                      <textarea id="nai-settingsJson" data-nai-field="settingsJson">${escapeHtml(config.settingsJson)}</textarea>
                    </div>
                    <div class="nai-bulk-field nai-span-6">
                      <label for="nai-paramOverride">param_override JSON</label>
                      <textarea id="nai-paramOverride" data-nai-field="paramOverride">${escapeHtml(config.paramOverride)}</textarea>
                    </div>
                    <div class="nai-bulk-field nai-span-6">
                      <label for="nai-headerOverride">header_override JSON</label>
                      <textarea id="nai-headerOverride" data-nai-field="headerOverride">${escapeHtml(config.headerOverride)}</textarea>
                    </div>
                    <div class="nai-bulk-field nai-span-6">
                      <label for="nai-statusCodeMapping">status_code_mapping JSON</label>
                      <textarea id="nai-statusCodeMapping" data-nai-field="statusCodeMapping">${escapeHtml(config.statusCodeMapping)}</textarea>
                    </div>
                    <div class="nai-bulk-field nai-span-6">
                      <label for="nai-other">other</label>
                      <textarea id="nai-other" data-nai-field="other">${escapeHtml(config.other)}</textarea>
                    </div>
                  </div>
                </details>
              </div>

              <div class="nai-bulk-section">
                <div class="nai-bulk-section-title">策略</div>
                <div class="nai-job-strategy-row nai-create-strategy-row">
                  <label class="nai-bulk-check">
                    <input id="nai-create-autoRefill" type="checkbox" data-nai-check="autoRefill"${config.autoRefill ? ' checked' : ''}>
                    <span>自动补货</span>
                  </label>
                  <div class="nai-job-strategy-field">
                    <label for="nai-create-targetAliveSize">保活</label>
                    <input id="nai-create-targetAliveSize" data-nai-field="targetAliveSize" inputmode="numeric" value="${escapeHtml(config.targetAliveSize)}">
                  </div>
                  <div class="nai-job-strategy-field">
                    <label for="nai-create-aliveThreshold">低于</label>
                    <input id="nai-create-aliveThreshold" data-nai-field="aliveThreshold" inputmode="numeric" value="${escapeHtml(config.aliveThreshold)}">
                  </div>
                  <div class="nai-job-strategy-field">
                    <label for="nai-create-replenishBatchSize">添加</label>
                    <input id="nai-create-replenishBatchSize" data-nai-field="replenishBatchSize" inputmode="numeric" value="${escapeHtml(config.replenishBatchSize)}">
                  </div>
                  <div class="nai-job-strategy-field">
                    <label for="nai-create-monitorIntervalSec">间隔</label>
                    <input id="nai-create-monitorIntervalSec" data-nai-field="monitorIntervalSec" inputmode="numeric" value="${escapeHtml(config.monitorIntervalSec)}">
                    <span class="nai-job-strategy-unit">秒</span>
                  </div>
                </div>
                <small class="nai-bulk-muted">创建作业时使用这里的策略；创建后会复制到中栏作业第二行，可随时修改并应用。</small>
              </div>

              <div class="nai-bulk-section">
                <div class="nai-bulk-section-title">预览</div>
                <div id="nai-preview" class="nai-bulk-preview"></div>
              </div>
              <div class="nai-bulk-section nai-bulk-actions">
                <button type="button" class="nai-bulk-action" data-nai-preview>刷新预览</button>
                <button type="button" class="nai-bulk-action" data-nai-copy-payload>复制首条 payload</button>
                <button type="button" class="nai-bulk-action nai-bulk-action-primary" data-nai-run>保存创建作业</button>
              </div>
            </div>
          </aside>
        </div>
        </div>
        <div class="nai-remote-panel nai-remote-list-panel" data-nai-remote-panel="channels">
          <div class="nai-pane-title">
            <span>渠道列表</span>
            <button type="button" class="nai-bulk-small-button" data-nai-refresh-remote-channels>刷新渠道列表</button>
          </div>
          <div id="nai-remoteChannelStatus" class="nai-remote-channel-status">尚未读取远端渠道。</div>
          <div id="nai-remoteChannels" class="nai-remote-channel-list"></div>
        </div>
        <div class="nai-remote-panel nai-remote-list-panel" data-nai-remote-panel="logs">
          <div class="nai-pane-title">
            <span>日志列表</span>
            <button type="button" class="nai-bulk-small-button" data-nai-refresh-remote-logs>刷新日志列表</button>
          </div>
          <div id="nai-remoteLogStatus" class="nai-remote-channel-status">尚未读取远端日志。</div>
          <div id="nai-remoteLogs" class="nai-remote-channel-list"></div>
        </div>
        <div class="nai-remote-panel nai-remote-list-panel" data-nai-remote-panel="users">
          <div class="nai-pane-title">
            <span>用户列表</span>
            <button type="button" class="nai-bulk-small-button" data-nai-refresh-remote-users>刷新用户列表</button>
          </div>
          <div id="nai-remoteUserStatus" class="nai-remote-channel-status">尚未读取远端用户。</div>
          <div id="nai-remoteUsers" class="nai-remote-channel-list"></div>
