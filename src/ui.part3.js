  function eventElementFromTarget(target) {
    if (target && typeof target.closest === 'function') return target;
    if (target?.parentElement && typeof target.parentElement.closest === 'function') return target.parentElement;
    return null;
  }

  function eventClosest(target, selector, root = null) {
    const element = eventElementFromTarget(target);
    const match = element?.closest(selector) || null;
    if (match && root && !root.contains(match)) return null;
    return match;
  }

  function bindRemoteListActions(panel) {
    qsa('#nai-remoteChannels, #nai-remoteLogs, #nai-remoteUsers', panel).forEach((host) => {
      host.addEventListener('click', (event) => {
        const action = eventClosest(event.target, '[data-nai-remote-action]', host);
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        handleRemoteListAction(action);
      });
    });
  }

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
        remoteHtmlCell(remoteStack(formatUseSeconds(useTime), remoteValue(log, 'is_stream', 'isStream') ? '流' : (useTime ? '非流' : ''))),
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

  function logTypeText(type) {
    const map = { 1: '充值', 2: '消费', 3: '管理', 4: '系统', 5: '错误', 6: '退款' };
    return map[Number(type)] || '未知';
  }

  function channelStatusText(status) {
    const map = { 1: '已启用', 2: '已禁用', 3: '自动禁用' };
    return map[Number(status)] || '未知状态';
  }

  function userStatusText(user) {
    if (remoteValue(user, 'DeletedAt', 'deleted_at')) return '已注销';
    const map = { 1: '已启用', 2: '已禁用' };
    return map[Number(remoteValue(user, 'status'))] || '未知状态';
  }

  function safeJsonObject(value) {
    if (!value || typeof value !== 'string') return value && typeof value === 'object' ? value : {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function detailValue(value) {
    if (value === null || value === undefined || value === '') return '<span class="nai-remote-muted">-</span>';
    return `<span>${escapeHtml(String(value))}</span>`;
  }

  function detailLongValue(value) {
    if (value === null || value === undefined || value === '') return '<span class="nai-remote-muted">-</span>';
    return `<span class="nai-remote-detail-long">${escapeHtml(String(value))}</span>`;
  }

  function detailRows(rows) {
    return rows
      .filter((row) => row && row[1] !== undefined && row[1] !== null && row[1] !== '')
      .map(([label, value, options = {}]) => `
        <div class="nai-remote-detail-key">${escapeHtml(label)}</div>
        <div class="nai-remote-detail-value">${options.html ? value : detailValue(value)}</div>
      `).join('');
  }

  function operationParamsText(params = {}) {
    if (!params || typeof params !== 'object') return '';
    return [
      ['名称', params.name],
      ['类型', params.type ? channelTypeName(params.type) : ''],
      ['数量', params.count],
      ['分组', params.group],
      ['模型', params.models],
    ].filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([label, value]) => `${label}：${value}`).join('；');
  }

  function remoteLogDetailRows(record) {
    const other = safeJsonObject(remoteValue(record, 'other'));
    const admin = other.admin_info || {};
    const op = other.op || {};
    const useChannel = Array.isArray(admin.use_channel) ? admin.use_channel.join(' -> ') : '';
    const cacheRead = Number(other.cache_tokens || 0);
    const cacheCreate = Number(other.cache_creation_tokens || 0);
    return detailRows([
      ['时间', shortDateTime(remoteValue(record, 'created_at', 'created_time', 'createdTime', 'time'))],
      ['类型', logTypeText(remoteValue(record, 'type'))],
      ['用户', `${remoteValue(record, 'username') || '-'}${remoteValue(record, 'user_id', 'userId') ? ` (ID: ${remoteValue(record, 'user_id', 'userId')})` : ''}`],
      ['渠道信息', `${remoteValue(record, 'channel', 'channel_id', 'channelId') || '-'} - ${remoteValue(record, 'channel_name', 'channelName') || '[未知]'}`],
      ['令牌', remoteValue(record, 'token_name', 'tokenName')],
      ['分组', firstNonEmpty(remoteValue(record, 'group'), other.group)],
      ['模型', firstNonEmpty(remoteValue(record, 'model_name', 'modelName', 'model'), other.upstream_model_name)],
      ['用时/首字', `${formatUseSeconds(remoteValue(record, 'use_time', 'useTime'))}${other.frt ? ` / ${(Number(other.frt) / 1000).toFixed(1)}s` : ''}`],
      ['流模式', remoteValue(record, 'is_stream', 'isStream') ? '流' : '非流'],
      ['输入', remoteValue(record, 'prompt_tokens', 'promptTokens') ?? 0],
      ['输出', remoteValue(record, 'completion_tokens', 'completionTokens') ?? 0],
      ['缓存 Tokens', cacheRead > 0 ? cacheRead : ''],
      ['缓存创建 Tokens', cacheCreate > 0 ? cacheCreate : ''],
      ['花费', formatRemoteQuota(firstNonEmpty(remoteValue(record, 'quota'), remoteValue(record, 'use_quota', 'useQuota'), remoteValue(record, 'used_quota', 'usedQuota'), remoteValue(record, 'cost')))],
      ['IP', remoteValue(record, 'ip')],
      ['请求 ID', firstNonEmpty(remoteValue(record, 'request_id', 'requestId'), remoteValue(record, 'upstream_request_id', 'upstreamRequestId'))],
      ['详情', detailLongValue(firstNonEmpty(remoteValue(record, 'content'), remoteValue(record, 'detail'), remoteValue(record, 'details'), remoteValue(record, 'message'))), { html: true }],
      ['请求路径', other.request_path],
      ['重试渠道', useChannel],
      ['请求转换', Array.isArray(other.request_conversion) && other.request_conversion.length ? other.request_conversion.join(' -> ') : ''],
      ['计费模式', admin.local_count_tokens ? '本地计费' : (other.admin_info ? '上游返回' : '')],
      ['操作管理员', admin.admin_username || admin.admin_id ? `${admin.admin_username || '-'}${admin.admin_id ? ` (ID: ${admin.admin_id})` : ''}` : ''],
      ['认证方式', admin.auth_method],
      ['操作', op.action],
      ['操作参数', operationParamsText(op.params)],
    ]);
  }

  function remoteChannelDetailRows(record) {
    return detailRows([
      ['ID', remoteValue(record, 'id', 'Id', 'ID')],
      ['名称', remoteValue(record, 'name', 'Name')],
      ['类型', channelTypeName(remoteValue(record, 'type', 'Type'))],
      ['状态', channelStatusText(remoteValue(record, 'status', 'Status'))],
      ['分组', remoteValue(record, 'group', 'Group')],
      ['模型', detailLongValue(remoteValue(record, 'models', 'Models')), { html: true }],
      ['上游地址', detailLongValue(remoteValue(record, 'base_url', 'baseUrl', 'BaseURL')), { html: true }],
      ['优先级', remoteValue(record, 'priority', 'Priority') ?? 0],
      ['权重', remoteValue(record, 'weight', 'Weight') ?? 0],
      ['已用额度', formatRemoteQuota(remoteValue(record, 'used_quota', 'usedQuota', 'UsedQuota') || 0)],
      ['剩余额度', formatRemoteQuota(remoteValue(record, 'balance', 'Balance') || 0)],
      ['响应时间', formatResponseMs(remoteValue(record, 'response_time', 'responseTime', 'ResponseTime'))],
      ['上次测试', shortDateTime(remoteValue(record, 'test_time', 'testTime', 'TestTime'))],
      ['自动禁用', Number(remoteValue(record, 'auto_ban', 'autoBan')) === 0 ? '关闭' : '开启'],
      ['标签', remoteValue(record, 'tag', 'Tag')],
      ['备注', detailLongValue(remoteValue(record, 'remark', 'Remark')), { html: true }],
      ['详情读取状态', remoteValue(record, '__nahsDetailError') ? `详情读取失败：${remoteValue(record, '__nahsDetailError')}` : ''],
    ]);
  }

  function remoteUserDetailRows(record) {
    const used = Number(remoteValue(record, 'used_quota', 'usedQuota') || 0);
    const remain = Number(firstNonEmpty(remoteValue(record, 'quota'), remoteValue(record, 'remain_quota', 'remainQuota'), remoteValue(record, 'remaining_quota', 'remainingQuota'), remoteValue(record, 'balance')) || 0);
    return detailRows([
      ['ID', remoteValue(record, 'id', 'uid')],
      ['用户名', firstNonEmpty(remoteValue(record, 'username'), remoteValue(record, 'name'), remoteValue(record, 'email'))],
      ['显示名称', remoteValue(record, 'display_name', 'displayName')],
      ['状态', userStatusText(record)],
      ['角色', userRoleLabel(remoteValue(record, 'role'))],
      ['分组', remoteValue(record, 'group')],
      ['剩余额度', formatRemoteQuota(remain)],
      ['已用额度', formatRemoteQuota(used)],
      ['总额度', formatRemoteQuota(remain + used)],
      ['请求次数', formatRemoteQuota(remoteValue(record, 'request_count', 'requestCount') || 0)],
      ['邀请码', remoteValue(record, 'aff_code', 'affCode')],
      ['邀请人数', remoteValue(record, 'aff_count', 'affCount') || 0],
      ['邀请收益', formatRemoteQuota(remoteValue(record, 'aff_history_quota', 'affHistoryQuota') || 0)],
      ['邀请人', remoteValue(record, 'inviter_id', 'inviterId') || '无邀请人'],
      ['创建时间', shortDateTime(remoteValue(record, 'created_at', 'created_time', 'createdTime'))],
      ['最后登录', shortDateTime(remoteValue(record, 'last_login_at', 'lastLoginAt'))],
      ['备注', detailLongValue(remoteValue(record, 'remark')), { html: true }],
    ]);
  }

  function remoteDetailRows(kind, record) {
    if (kind === 'channels') return remoteChannelDetailRows(record);
    if (kind === 'logs') return remoteLogDetailRows(record);
    if (kind === 'users') return remoteUserDetailRows(record);
    return '';
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
      const action = eventClosest(event.target, '[data-nai-remote-action]', dialog);
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
      <div class="nai-remote-detail-grid">${remoteDetailRows(kind, record)}</div>
    `);
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
    const read = (key) => qs(`[data-nai-channel-edit="${key}"]`, dialog)?.value;
    const payload = { ...record };
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
