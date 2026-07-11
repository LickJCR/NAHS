  function remoteActionButton(label, action, kind, index, variant = '') {
    return `
      <button type="button" class="nai-remote-action-button" data-variant="${escapeHtml(variant)}" data-nai-remote-action="${escapeHtml(action)}" data-kind="${escapeHtml(kind)}" data-index="${escapeHtml(index)}">
        ${escapeHtml(label)}
      </button>
    `;
  }

  function remoteActionsCell(kind, index, canEdit = false) {
    return remoteHtmlCell(`
      <div class="nai-remote-actions">
        ${remoteActionButton('详情', 'detail', kind, index)}
        ${canEdit ? remoteActionButton('编辑', 'edit-channel', kind, index, 'primary') : ''}
      </div>
    `, 'nai-remote-action-cell');
  }

  function renderRemoteTable(host, emptyText, columns, rows, gridTemplate, minWidth = '100%') {
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = `<div class="nai-empty-state">${escapeHtml(emptyText)}</div>`;
      return;
    }
    const last = columns.length - 1;
    host.innerHTML = `
      <div class="nai-remote-channel-table" style="grid-template-columns: ${escapeHtml(gridTemplate)}; min-width: ${escapeHtml(minWidth)};">
        ${columns.map((column, index) => `<div class="nai-remote-channel-head ${index === last ? 'nai-remote-action-head' : ''}">${escapeHtml(column)}</div>`).join('')}
        ${rows.join('')}
      </div>
    `;
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
    const rows = resource.items.map((channel, index) => [
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
      remoteActionsCell('channels', index, true),
    ].join(''));
    renderRemoteTable(
      qs('#nai-remoteChannels'),
      '暂无渠道数据。',
      ['ID', '名称', '类型', '状态', '模型', '分组', '标签', '优先级', '权重', '已使用 / 剩余', '响应', '上次测试', '操作'],
      rows,
      '70px 240px 120px 122px 280px 150px 110px 78px 78px 150px 100px 135px 138px',
      '1771px'
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
    const rows = resource.items.map((log, index) => {
      const useTime = remoteValue(log, 'use_time', 'useTime');
      const channelId = remoteValue(log, 'channel', 'channel_id', 'channelId');
      const requestId = firstNonEmpty(remoteValue(log, 'request_id', 'requestId'), remoteValue(log, 'upstream_request_id', 'upstreamRequestId'));
      return [
        remoteHtmlCell(remoteStackHtml(shortDateTime(remoteValue(log, 'created_at', 'created_time', 'createdTime', 'time')), logTypeBadge(remoteValue(log, 'type')))),
        remoteHtmlCell(remoteStack(channelId ? `#${channelId}` : '-', remoteValue(log, 'channel_name', 'channelName') || '')),
        remoteHtmlCell(remoteStack(remoteValue(log, 'username') || '-', remoteValue(log, 'user_id', 'userId') ? `ID: ${remoteValue(log, 'user_id', 'userId')}` : '')),
        remoteHtmlCell(remoteStack(remoteValue(log, 'token_name', 'tokenName') || '-', remoteValue(log, 'group') || '')),
        remoteHtmlCell(remoteBadge(remoteValue(log, 'model_name', 'modelName', 'model') || '-')),
        remoteHtmlCell(remoteStack(formatUseSeconds(useTime), remoteValue(log, 'is_stream', 'isStream') ? 'Stream' : (useTime ? 'Non-stream' : ''))),
        remoteHtmlCell(remoteStack(`${formatRemoteQuota(remoteValue(log, 'prompt_tokens', 'promptTokens') || 0)} / ${formatRemoteQuota(remoteValue(log, 'completion_tokens', 'completionTokens') || 0)}`, '')),
        remoteCell(formatRemoteQuota(firstNonEmpty(remoteValue(log, 'quota'), remoteValue(log, 'use_quota', 'useQuota'), remoteValue(log, 'used_quota', 'usedQuota'), remoteValue(log, 'cost')))),
        remoteHtmlCell(remoteStack(firstNonEmpty(remoteValue(log, 'content'), remoteValue(log, 'detail'), remoteValue(log, 'details'), remoteValue(log, 'message')) || '-', requestId || ''), 'nai-remote-wrap-cell'),
        remoteActionsCell('logs', index),
      ].join('');
    });
    renderRemoteTable(
      qs('#nai-remoteLogs'),
      '暂无日志数据。',
      ['时间', '渠道', '用户', '令牌', '模型', '耗时', 'Token', '费用', '详情', '操作'],
      rows,
      '170px 150px 150px 160px 170px 120px 130px 110px minmax(460px, 1fr) 110px',
      '1730px'
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
    const rows = resource.items.map((user, index) => {
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
        remoteActionsCell('users', index),
      ].join('');
    });
    renderRemoteTable(
      qs('#nai-remoteUsers'),
      '暂无用户数据。',
      ['ID', '用户名', '状态', '额度', '分组', '角色', '邀请信息', '创建时间', '最后登录', '操作'],
      rows,
      '80px 240px 130px 170px 150px 110px 280px 170px 170px 110px',
      '1610px'
    );
  }

  function renderRemoteResourceViews() {
    renderRemoteChannels();
    renderRemoteLogs();
    renderRemoteUsers();
  }

  function remoteRecordByIndex(kind, index) {
    const resource = state.remoteResources[kind];
    const numeric = Number.parseInt(index, 10);
    if (!resource || !Number.isFinite(numeric) || numeric < 0) return null;
    return resource.items[numeric] || null;
  }

  function remoteRecordTitle(kind, record) {
    if (kind === 'channels') return `渠道 #${remoteValue(record, 'id', 'ID') || '-'} ${remoteValue(record, 'name', 'Name') || ''}`.trim();
    if (kind === 'logs') return `日志 #${remoteValue(record, 'id', 'ID') || remoteValue(record, 'request_id', 'requestId') || '-'}`;
    return `用户 #${remoteValue(record, 'id', 'uid') || '-'} ${remoteValue(record, 'username', 'name', 'email') || ''}`.trim();
  }

  function remoteDetailValueHtml(value) {
    if (value === null || value === undefined || value === '') return '<span class="nai-remote-muted">-</span>';
    if (typeof value === 'object') {
      return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
    }
    return `<span>${escapeHtml(String(value))}</span>`;
  }

  function remoteDetailRows(record) {
    return Object.entries(record || {})
      .filter(([key]) => !String(key).startsWith('__nahs'))
      .map(([key, value]) => `
        <div class="nai-remote-detail-key">${escapeHtml(key)}</div>
        <div class="nai-remote-detail-value">${remoteDetailValueHtml(value)}</div>
      `).join('');
  }

  function openRemoteDialog(title, body, actions = '') {
    closeRemoteDialog();
    const dialog = document.createElement('div');
    dialog.className = 'nai-remote-dialog-backdrop';
    dialog.innerHTML = `
      <section class="nai-remote-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>
          <strong>${escapeHtml(title)}</strong>
          <button type="button" class="nai-remote-dialog-x" data-nai-remote-action="close-dialog">×</button>
        </header>
        <div class="nai-remote-dialog-body">${body}</div>
        <footer>
          <span class="nai-remote-dialog-status" data-nai-remote-dialog-status></span>
          ${actions}
          <button type="button" class="nai-bulk-small-button" data-nai-remote-action="close-dialog">关闭</button>
        </footer>
      </section>
    `;
    dialog.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const action = event.target.closest('[data-nai-remote-action]');
      if (action) {
        handleRemoteListAction(action);
        return;
      }
      if (event.target === dialog) closeRemoteDialog();
    });
    document.body.appendChild(dialog);
  }

  function closeRemoteDialog() {
    document.querySelectorAll('.nai-remote-dialog-backdrop').forEach((item) => item.remove());
  }

  function openRemoteRecordDetail(kind, index) {
    const record = remoteRecordByIndex(kind, index);
    if (!record) return;
    openRemoteDialog(remoteRecordTitle(kind, record), `
      <div class="nai-remote-detail-grid">${remoteDetailRows(record)}</div>
      <div class="nai-remote-json-block"><pre>${escapeHtml(JSON.stringify(record, null, 2))}</pre></div>
    `);
  }

  function remoteJsonForTextarea(value) {
    return escapeHtml(JSON.stringify(value || {}, null, 2));
  }

  function channelEditForm(record, index) {
    const type = String(remoteValue(record, 'type', 'Type') ?? '');
    return `
      <div class="nai-remote-edit-grid">
        <label><span>名称</span><input data-nai-channel-edit="name" value="${escapeHtml(remoteValue(record, 'name', 'Name') || '')}"></label>
        <label><span>类型</span><select data-nai-channel-edit="type">${CHANNEL_TYPES.map(([value, label]) => `<option value="${value}"${String(value) === type ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select></label>
        <label><span>状态</span><select data-nai-channel-edit="status">
          <option value="1"${Number(remoteValue(record, 'status', 'Status')) === 1 ? ' selected' : ''}>已启用</option>
          <option value="2"${Number(remoteValue(record, 'status', 'Status')) === 2 ? ' selected' : ''}>已禁用</option>
          <option value="3"${Number(remoteValue(record, 'status', 'Status')) === 3 ? ' selected' : ''}>自动禁用</option>
        </select></label>
        <label><span>分组</span><input data-nai-channel-edit="group" value="${escapeHtml(remoteValue(record, 'group', 'Group') || '')}"></label>
        <label><span>模型</span><textarea data-nai-channel-edit="models">${escapeHtml(remoteValue(record, 'models', 'Models') || '')}</textarea></label>
        <label><span>上游地址</span><input data-nai-channel-edit="base_url" value="${escapeHtml(remoteValue(record, 'base_url', 'baseUrl', 'BaseURL') || '')}"></label>
        <label><span>优先级</span><input data-nai-channel-edit="priority" inputmode="numeric" value="${escapeHtml(remoteValue(record, 'priority', 'Priority') ?? 0)}"></label>
        <label><span>权重</span><input data-nai-channel-edit="weight" inputmode="numeric" value="${escapeHtml(remoteValue(record, 'weight', 'Weight') ?? 0)}"></label>
        <label><span>标签</span><input data-nai-channel-edit="tag" value="${escapeHtml(remoteValue(record, 'tag', 'Tag') || '')}"></label>
        <label><span>备注</span><input data-nai-channel-edit="remark" value="${escapeHtml(remoteValue(record, 'remark', 'Remark') || '')}"></label>
        <label class="nai-remote-edit-json"><span>JSON</span><textarea data-nai-channel-edit-json>${remoteJsonForTextarea(record)}</textarea></label>
      </div>
    `;
  }

  function openRemoteChannelEdit(index) {
    const record = remoteRecordByIndex('channels', index);
    if (!record) return;
    openRemoteDialog(`编辑 ${remoteRecordTitle('channels', record)}`, channelEditForm(record, index), `
      <button type="button" class="nai-bulk-small-button nai-bulk-action-primary" data-nai-remote-action="save-channel" data-index="${escapeHtml(index)}">保存</button>
    `);
  }

  function channelPayloadFromDialog(index) {
    const record = remoteRecordByIndex('channels', index) || {};
    const dialog = document.querySelector('.nai-remote-dialog');
    const textarea = qs('[data-nai-channel-edit-json]', dialog);
    let payload = {};
    try {
      payload = textarea?.value.trim() ? JSON.parse(textarea.value) : {};
    } catch (err) {
      throw new Error(`JSON 格式错误：${err.message}`);
    }
    const read = (key) => qs(`[data-nai-channel-edit="${key}"]`, dialog)?.value;
    payload = { ...record, ...payload };
    payload.id = remoteValue(payload, 'id', 'ID') || remoteValue(record, 'id', 'ID');
    payload.name = read('name') || payload.name;
    payload.type = Number(read('type') || payload.type || 0);
    payload.__nahsOriginalStatus = Number(remoteValue(record, 'status', 'Status') || 0);
    payload.__nahsNextStatus = Number(read('status') || payload.status || 1);
    payload.group = read('group') ?? payload.group;
    payload.models = read('models') ?? payload.models;
    payload.base_url = read('base_url') ?? payload.base_url;
    payload.priority = Number(read('priority') || payload.priority || 0);
    payload.weight = Number(read('weight') || payload.weight || 0);
    payload.tag = read('tag') || null;
    payload.remark = read('remark') ?? payload.remark;
    delete payload.__nahsDetailLoaded;
    delete payload.__nahsDetailError;
    return payload;
  }

  function setRemoteDialogStatus(text, variant = '') {
    const status = qs('[data-nai-remote-dialog-status]');
    if (!status) return;
    status.textContent = text;
    status.setAttribute('data-variant', variant);
  }

  async function updateRemoteChannelPayload(payload) {
    const id = remoteValue(payload, 'id', 'ID');
    if (!id) throw new Error('缺少渠道 ID，无法保存。');
    const originalStatus = Number(payload.__nahsOriginalStatus || 0);
    const nextStatus = Number(payload.__nahsNextStatus || 0);
    const requestPayload = { ...payload };
    delete requestPayload.status;
    delete requestPayload.__nahsOriginalStatus;
    delete requestPayload.__nahsNextStatus;
    const candidates = [
      [apiUrl(collectConfig(false)), 'PUT'],
      [apiUrl(collectConfig(false), '/'), 'PUT'],
      [apiUrl(collectConfig(false), `/${encodeURIComponent(id)}`), 'PUT'],
      [apiUrl(collectConfig(false), `/${encodeURIComponent(id)}`), 'PATCH'],
    ];
    let lastError = null;
    let updatedResult = null;
    for (const [url, method] of candidates) {
      try {
        const result = await apiRequest(url, { method, body: JSON.stringify(requestPayload) });
        if (!endpointResultOk(result)) throw new Error(result?.message || '保存失败');
        updatedResult = result;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (!updatedResult) throw lastError || new Error('保存失败');
    if (Number.isFinite(nextStatus) && nextStatus > 0 && nextStatus !== originalStatus) {
      const statusResult = await apiRequest(apiUrl(collectConfig(false), `/${encodeURIComponent(id)}/status`), {
        method: 'POST',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!endpointResultOk(statusResult)) throw new Error(statusResult?.message || '状态更新失败');
    }
    return { ...(normalizeChannelResult(updatedResult) || requestPayload), status: nextStatus || requestPayload.status };
  }

  async function saveRemoteChannelEdit(button) {
    const index = button.getAttribute('data-index') || '';
    try {
      button.disabled = true;
      setRemoteDialogStatus('保存中...');
      const payload = channelPayloadFromDialog(index);
      const updated = await updateRemoteChannelPayload(payload);
      const numeric = Number.parseInt(index, 10);
      state.remoteResources.channels.items[numeric] = { ...payload, ...updated, __nahsDetailLoaded: true };
      state.remoteResources.channels.updatedAt = nowIso();
      renderRemoteChannels();
      persistWorkspaceState();
      setRemoteDialogStatus('已保存', 'ok');
      appendLog(`已更新远端渠道：${payload.name || payload.id}`);
    } catch (err) {
      setRemoteDialogStatus(err.message, 'error');
      appendLog(`更新远端渠道失败：${err.message}`, 'error');
    } finally {
      button.disabled = false;
    }
  }

  function handleRemoteListAction(target) {
    const action = target.getAttribute('data-nai-remote-action') || '';
    if (action === 'close-dialog') {
      closeRemoteDialog();
      return;
    }
    if (action === 'detail') {
      openRemoteRecordDetail(target.getAttribute('data-kind') || '', target.getAttribute('data-index') || '');
      return;
    }
    if (action === 'edit-channel') {
      openRemoteChannelEdit(target.getAttribute('data-index') || '');
      return;
    }
    if (action === 'save-channel') {
      saveRemoteChannelEdit(target);
    }
  }
