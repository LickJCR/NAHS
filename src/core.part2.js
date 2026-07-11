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
