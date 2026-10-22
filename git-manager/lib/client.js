// Browser bundle for dsh-plugin-git-manager.
//
// Registers two contributions into the shipped Harness Web UI:
//   - `sidebar.panellist`  : the Git icon in the global panel list
//   - `main` (keyed)       : the Git panel selected by that icon
// All data comes from the Host half through `POST /api/git-manager`; this file
// has no build step and must stay a single classic script. Copy the shell
// pattern from the other plugins in this repository.
window.__ModuleLoader__.load({
  id: 'dsh-plugin-git-manager',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useRef = React.useRef

    // Host settings namespace / RPC route / slot identity.
    var NS = 'git-manager'
    var RPC_PATH = '/api/git-manager'
    var TAB_ID = 'git-manager'
    var TAB_KIND = 'git-manager'
    var POLL_MS = 5000

    // ---------------------------------------------------------------- locale

    var ZH = {
      'panel.label': 'Git 管理',
      'panel.title': 'Git 管理',
      'panel.open': '打开 Git 管理',
      'panel.guide': '在当前会话仓库里查看/暂存变更、提交、切换分支、看提交图与 diff',
      'header.refresh': '刷新',
      'header.fetch': 'Fetch',
      'header.pull': 'Pull',
      'header.push': 'Push',
      'header.newBranch': '新建分支',
      'header.newBranchPlaceholder': '新分支名（可再填起点分支）',
      'header.fromPlaceholder': '起点分支（可选）',
      'header.create': '创建',
      'header.cancel': '取消',
      'header.repo': '仓库',
      'header.ahead': '领先 {n}',
      'header.behind': '落后 {n}',
      'header.detached': '游离 HEAD',
      'branch.local': '本地分支',
      'branch.remote': '远程分支',
      'branch.current': '当前',
      'branch.gone': 'upstream 已删除',
      'branch.switch': '切换',
      'branch.delete': '删除',
      'branch.empty': '没有分支',
      'changes.title': '变更',
      'changes.staged': '已暂存',
      'changes.unstaged': '未暂存',
      'changes.untracked': '未跟踪',
      'changes.conflicted': '冲突',
      'changes.empty': '工作区干净，没有未提交的变更',
      'changes.stageAll': '全部暂存',
      'changes.unstageAll': '全部取消暂存',
      'changes.stage': '暂存',
      'changes.unstage': '取消暂存',
      'commit.title': '提交信息',
      'commit.placeholder': '填写提交信息，或先点「AI 生成信息」',
      'commit.hintPlaceholder': '给 AI 的补充说明（可选）',
      'commit.cmdEnter': '⌘↵ 提交',
      'commit.ai': 'AI 生成信息',
      'commit.aiShort': 'AI 生成',
      'commit.aiBusy': '生成中…',
      'commit.commit': '提交',
      'commit.push': '提交并推送',
      'commit.messageRequired': '请先填写提交信息',
      'commit.empty': '没有可提交的暂存变更',
      'tabs.changes': '变更',
      'tabs.graph': '提交图',
      'tabs.branches': '分支',
      'tabs.diff': '差异',
      'graph.empty': '暂无提交',
      'graph.truncated': '提交图已截断',
      'diff.empty': '点击左侧变更文件或提交图中的提交，查看差异',
      'diff.binary': '二进制文件，不显示文本差异',
      'diff.truncated': '差异过大，已截断',
      'diff.additions': '+{n}',
      'diff.deletions': '-{n}',
      'diff.staged': '暂存区',
      'diff.worktree': '工作区',
      'diff.commit': '提交 {hash}',
      'diff.untracked': '新文件',
      'status.loading': '加载中…',
      'status.noSession': '请先在左侧选择一个会话，Git 面板跟随当前会话的工作目录',
      'status.noCwd': '当前会话没有工作目录',
      'status.notRepo': '当前目录不是 Git 仓库：{path}',
      'status.notRepoTitle': '不是 Git 仓库',
      'status.error': '出错了：{message}',
      'status.busy': '执行中：{label}',
      'status.fetching': 'Fetch 中…',
      'status.pulling': 'Pull 中…',
      'status.pushing': 'Push 中…',
      'status.switching': '正在切换到 {branch}…',
      'status.staging': '正在暂存…',
      'status.unstaging': '正在取消暂存…',
      'status.committing': '正在提交…',
      'status.commitOk': '已提交 {hash}',
      'status.pushOk': '推送完成',
      'status.pullOk': '拉取完成',
      'status.fetchOk': 'Fetch 完成',
      'status.branchSwitched': '已切换到 {branch}',
      'status.branchCreated': '已创建分支 {branch}',
      'status.branchDeleted': '已删除分支 {branch}',
      'status.deleteConfirm': '确定删除分支 {branch}？',
      'status.aiModel': '由 {model} 生成',
      'status.aiFallback': '模型输出不可用，已生成降级文案',
      'toast.error': '失败',
      'details.output': '最近一次操作输出',
      'details.dismiss': '关闭',
      'session.untitled': '未命名会话',
      'error.transport': '无法连接 Git 服务',
      'error.badResponse': 'Git 服务返回了非 JSON 响应',
      'error.gitFailed': 'Git 操作失败',
      'error.boundary': 'Git 面板渲染出错',
      'status.cwdUnavailable': '当前会话的工作目录不存在或无法访问：{path}',
      'status.stageOk': '已暂存',
      'status.unstageOk': '已取消暂存',
      'status.stageAllOk': '已暂存全部变更',
      'status.unstageAllOk': '已取消暂存全部变更',
      'status.aiOk': '已生成提交信息（{model}）',
      'status.aiModelEdit': '由 {model} 生成，可继续编辑',
      'status.ready': '就绪',
      'changes.stagedCount': '已暂存 {n}',
      'changes.conflictBanner': '存在 {n} 个冲突文件，解决后再提交',
      'branch.selectTitle': '切换分支',
      'header.refreshing': '刷新中…',
      'commit.committing': '提交中…',
      'diff.truncatedShort': '已截断',
      'diff.noText': '没有文本差异',
    }

    var EN = {
      'panel.label': 'Git',
      'panel.title': 'Git Manager',
      'panel.open': 'Open Git Manager',
      'panel.guide': 'Review and stage changes, commit, switch branches, browse the graph and diffs for this session repository',
      'header.refresh': 'Refresh',
      'header.fetch': 'Fetch',
      'header.pull': 'Pull',
      'header.push': 'Push',
      'header.newBranch': 'New branch',
      'header.newBranchPlaceholder': 'new branch name',
      'header.fromPlaceholder': 'start point (optional)',
      'header.create': 'Create',
      'header.cancel': 'Cancel',
      'header.repo': 'Repo',
      'header.ahead': '{n} ahead',
      'header.behind': '{n} behind',
      'header.detached': 'detached HEAD',
      'branch.local': 'Local branches',
      'branch.remote': 'Remote branches',
      'branch.current': 'current',
      'branch.gone': 'upstream gone',
      'branch.switch': 'Switch',
      'branch.delete': 'Delete',
      'branch.empty': 'No branches',
      'changes.title': 'Changes',
      'changes.staged': 'Staged',
      'changes.unstaged': 'Unstaged',
      'changes.untracked': 'Untracked',
      'changes.conflicted': 'Conflicts',
      'changes.empty': 'Working tree clean',
      'changes.stageAll': 'Stage all',
      'changes.unstageAll': 'Unstage all',
      'changes.stage': 'Stage',
      'changes.unstage': 'Unstage',
      'commit.title': 'Commit message',
      'commit.placeholder': 'Write a commit message, or generate one with AI',
      'commit.hintPlaceholder': 'Optional hint for the AI',
      'commit.cmdEnter': '⌘↵ commit',
      'commit.ai': 'AI message',
      'commit.aiShort': 'AI',
      'commit.aiBusy': 'Generating…',
      'commit.commit': 'Commit',
      'commit.push': 'Commit & push',
      'commit.messageRequired': 'Commit message is required',
      'commit.empty': 'Nothing staged to commit',
      'tabs.changes': 'Changes',
      'tabs.graph': 'Graph',
      'tabs.branches': 'Branches',
      'tabs.diff': 'Diff',
      'graph.empty': 'No commits yet',
      'graph.truncated': 'Graph truncated',
      'diff.empty': 'Pick a changed file or a commit to see its diff',
      'diff.binary': 'Binary file; no textual diff',
      'diff.truncated': 'Diff truncated',
      'diff.additions': '+{n}',
      'diff.deletions': '-{n}',
      'diff.staged': 'Staged',
      'diff.worktree': 'Working tree',
      'diff.commit': 'Commit {hash}',
      'diff.untracked': 'New file',
      'status.loading': 'Loading…',
      'status.noSession': 'Select a session on the left; the Git panel follows its working directory',
      'status.noCwd': 'The current session has no working directory',
      'status.notRepo': 'Not a Git repository: {path}',
      'status.notRepoTitle': 'Not a Git repository',
      'status.error': 'Error: {message}',
      'status.busy': 'Running: {label}',
      'status.fetching': 'Fetching…',
      'status.pulling': 'Pulling…',
      'status.pushing': 'Pushing…',
      'status.switching': 'Switching to {branch}…',
      'status.staging': 'Staging…',
      'status.unstaging': 'Unstaging…',
      'status.committing': 'Committing…',
      'status.commitOk': 'Committed {hash}',
      'status.pushOk': 'Push complete',
      'status.pullOk': 'Pull complete',
      'status.fetchOk': 'Fetch complete',
      'status.branchSwitched': 'Switched to {branch}',
      'status.branchCreated': 'Created branch {branch}',
      'status.branchDeleted': 'Deleted branch {branch}',
      'status.deleteConfirm': 'Delete branch {branch}?',
      'status.aiModel': 'Generated by {model}',
      'status.aiFallback': 'Model output unusable; used a fallback message',
      'toast.error': 'Failed',
      'details.output': 'Last command output',
      'details.dismiss': 'Dismiss',
      'session.untitled': 'Untitled session',
      'error.transport': 'Cannot reach the Git service',
      'error.badResponse': 'The Git service returned a non-JSON response',
      'error.gitFailed': 'Git operation failed',
      'error.boundary': 'The Git panel crashed',
      'status.cwdUnavailable': 'The session working directory is missing or inaccessible: {path}',
      'status.stageOk': 'Staged',
      'status.unstageOk': 'Unstaged',
      'status.stageAllOk': 'Staged all changes',
      'status.unstageAllOk': 'Unstaged all changes',
      'status.aiOk': 'Commit message generated ({model})',
      'status.aiModelEdit': 'Generated by {model}; edit as needed',
      'status.ready': 'Ready',
      'changes.stagedCount': '{n} staged',
      'changes.conflictBanner': '{n} conflicted file(s); resolve them before committing',
      'branch.selectTitle': 'Switch branch',
      'header.refreshing': 'Refreshing…',
      'commit.committing': 'Committing…',
      'diff.truncatedShort': 'truncated',
      'diff.noText': 'No textual diff',
    }

    // ---------------------------------------------------------------- styles

    var mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

    // One component-scoped stylesheet, rendered as a <style> element inside the
    // panel root (removed with the panel). Class names are prefixed `gm-` and all
    // colors come from --dsw-alias-* tokens, so light/dark follow the app theme.
    var PANEL_CSS = `
      .gm-root { display:flex; flex-direction:column; height:100%; min-height:0; container-type:inline-size; container-name:gm;
        background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-size:12px; line-height:1.45; }
      .gm-root *, .gm-root *::before, .gm-root *::after { box-sizing:border-box; }
      .gm-scroll { flex:1 1 auto; min-height:0; overflow:auto; scrollbar-width:thin; scrollbar-color:var(--dsw-alias-border-l1) transparent; }
      .gm-scroll::-webkit-scrollbar { width:8px; height:8px; }
      .gm-scroll::-webkit-scrollbar-thumb { background:var(--dsw-alias-border-l1); border-radius:8px; }
      .gm-scroll::-webkit-scrollbar-track { background:transparent; }
      .gm-content-inner { width:100%; max-width:980px; margin:0 auto; }
      .gm-row { display:flex; align-items:center; gap:6px; min-width:0; }
      .gm-spacer { flex:1 1 auto; min-width:0; }

      /* top bar */
      .gm-top { display:flex; flex-direction:column; gap:6px; padding:8px 10px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); }
      .gm-repo { font-size:13px; font-weight:650; letter-spacing:-0.01em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
      .gm-subtle { font-size:10.5px; color:var(--dsw-alias-label-secondary); white-space:nowrap; }
      .gm-select { height:26px; max-width:170px; padding:0 24px 0 8px; border-radius:6px; border:1px solid var(--dsw-alias-border-l2);
        background-color:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font-size:11.5px; cursor:pointer; appearance:none;
        background-image:linear-gradient(45deg,transparent 50%,var(--dsw-alias-label-secondary) 50%),linear-gradient(135deg,var(--dsw-alias-label-secondary) 50%,transparent 50%);
        background-position:calc(100% - 13px) 11px, calc(100% - 9px) 11px; background-size:4px 4px,4px 4px; background-repeat:no-repeat; }
      .gm-select:hover { border-color:var(--dsw-alias-label-secondary); }
      .gm-select:focus-visible { outline:2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); outline-offset:-1px; }

      /* buttons */
      .gm-btn { display:inline-flex; align-items:center; justify-content:center; gap:4px; height:24px; padding:0 8px; border-radius:6px;
        border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary);
        font:inherit; font-size:11.5px; line-height:1; cursor:pointer; white-space:nowrap; transition:background .12s,border-color .12s,color .12s,opacity .12s; }
      .gm-btn svg { width:13px; height:13px; flex:none; }
      .gm-btn:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-1); border-color:var(--dsw-alias-border-l2); }
      .gm-btn:active:not(:disabled) { transform:translateY(.5px); }
      .gm-btn:focus-visible { outline:2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); outline-offset:1px; }
      .gm-btn:disabled { opacity:.42; cursor:default; }
      .gm-btn.primary { background:var(--dsw-alias-brand-primary); border-color:transparent; color:var(--dsw-alias-bg-base); font-weight:600; }
      .gm-btn.primary:hover:not(:disabled) { background:var(--dsw-alias-brand-primary); filter:brightness(1.08); }
      .gm-btn.ghost { border-color:transparent; background:transparent; color:var(--dsw-alias-label-secondary); }
      .gm-btn.ghost:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
      .gm-btn.icon { width:24px; padding:0; }
      .gm-btn.sm { height:20px; font-size:11px; }
      .gm-btn.icon.sm { width:20px; }

      /* badges */
      .gm-badge { display:inline-flex; align-items:center; gap:3px; height:18px; padding:0 6px; border-radius:999px;
        border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary);
        font-size:10.5px; font-variant-numeric:tabular-nums; white-space:nowrap; flex:none; }
      .gm-badge.brand { color:var(--dsw-alias-brand-primary); border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent);
        background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }
      .gm-badge.ok { color:var(--dsw-alias-state-success-primary); border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 35%, transparent); }
      .gm-badge.err { color:var(--dsw-alias-state-error-primary); border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 35%, transparent); }
      .gm-badge.warn { color:var(--dsw-alias-state-warn-primary); border-color:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 35%, transparent); }

      /* tabs */
      .gm-tabs { display:flex; align-items:stretch; gap:2px; padding:0 8px; border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); overflow-x:auto; scrollbar-width:none; }
      .gm-tabs::-webkit-scrollbar { display:none; }
      .gm-tab { position:relative; display:inline-flex; align-items:center; gap:5px; height:30px; padding:0 8px; border:0; border-radius:0;
        background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; cursor:pointer; white-space:nowrap; }
      .gm-tab:hover { color:var(--dsw-alias-label-primary); }
      .gm-tab.active { color:var(--dsw-alias-label-primary); font-weight:600; }
      .gm-tab.active::after { content:''; position:absolute; left:6px; right:6px; bottom:-1px; height:2px; border-radius:2px; background:var(--dsw-alias-brand-primary); }
      .gm-tab:focus-visible { outline:2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); outline-offset:-2px; }
      .gm-count { min-width:16px; height:16px; padding:0 4px; border-radius:999px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary);
        font-size:10px; font-weight:500; display:inline-flex; align-items:center; justify-content:center; font-variant-numeric:tabular-nums; }

      /* changes */
      .gm-section { display:flex; align-items:center; gap:6px; padding:10px 10px 3px; font-size:10.5px; font-weight:650; letter-spacing:.05em;
        text-transform:uppercase; color:var(--dsw-alias-label-secondary); }
      .gm-section-count { font-weight:500; letter-spacing:0; font-variant-numeric:tabular-nums; }
      .gm-file { display:flex; align-items:center; gap:6px; min-height:24px; padding:2px 8px 2px 10px; cursor:pointer; }
      .gm-file:hover { background:var(--dsw-alias-bg-layer-2); }
      .gm-file.active { background:var(--dsw-alias-bg-layer-2); box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary); }
      .gm-stat { width:14px; flex:none; text-align:center; font-family:${mono}; font-size:11px; font-weight:700; }
      .gm-stat.m { color:var(--dsw-alias-state-warn-primary); }
      .gm-stat.a { color:var(--dsw-alias-state-success-primary); }
      .gm-stat.d, .gm-stat.u { color:var(--dsw-alias-state-error-primary); }
      .gm-stat.q { color:var(--dsw-alias-label-secondary); }
      .gm-fpath { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:${mono}; font-size:11.5px; }
      .gm-dir { color:var(--dsw-alias-label-secondary); }
      .gm-act { opacity:0; transition:opacity .12s; flex:none; }
      .gm-file:hover .gm-act, .gm-file:focus-within .gm-act, .gm-branch:hover .gm-act { opacity:1; }
      @media (hover:none) { .gm-act { opacity:1; } }
      .gm-conflict-bar { margin:8px 10px 2px; padding:5px 8px; border-radius:6px; font-size:11px;
        color:var(--dsw-alias-state-error-primary); background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
        border:1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent); }
      .gm-quick { display:flex; gap:6px; padding:8px 10px 2px; flex-wrap:wrap; }

      /* graph */
      .gm-graph { padding:4px 0 12px; font-family:${mono}; font-size:11.5px; }
      .gm-grow { display:flex; align-items:center; gap:6px; min-height:22px; padding:1px 10px; cursor:pointer; }
      .gm-grow:hover { background:var(--dsw-alias-bg-layer-2); }
      .gm-grow.active { background:var(--dsw-alias-bg-layer-2); box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary); }
      .gm-gprefix { flex:none; white-space:pre; color:var(--dsw-alias-label-secondary); }
      .gm-hash { flex:none; font-size:10.5px; color:var(--dsw-alias-label-secondary); }
      .gm-subject { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:inherit; }
      .gm-meta { flex:none; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10.5px; color:var(--dsw-alias-label-secondary); font-family:inherit; }
      .gm-ref { height:17px; padding:0 5px; }

      /* branches */
      .gm-branch { display:flex; align-items:center; gap:6px; min-height:28px; padding:3px 10px; }
      .gm-branch:hover { background:var(--dsw-alias-bg-layer-2); }
      .gm-bname { flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:${mono}; font-size:11.5px; }
      .gm-bmeta { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10.5px; color:var(--dsw-alias-label-secondary); text-align:right; }

      /* diff */
      .gm-diff { padding-bottom:16px; }
      .gm-diff-head { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:6px; padding:7px 10px;
        border-bottom:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); }
      .gm-diff-title { font-size:11px; font-weight:650; letter-spacing:.03em; text-transform:uppercase; color:var(--dsw-alias-label-secondary); flex:none; }
      .gm-hunk { margin:8px 10px 2px; padding:3px 8px; border-radius:5px; background:var(--dsw-alias-bg-layer-2);
        display:inline-block; max-width:calc(100% - 20px); font-family:${mono}; font-size:10.5px; color:var(--dsw-alias-label-secondary); white-space:pre-wrap; }
      .gm-dlines { font-family:${mono}; font-size:11.5px; line-height:1.6; margin:0 0 4px; }
      .gm-dline { display:flex; align-items:baseline; white-space:pre-wrap; word-break:break-all; }
      .gm-dline.add { background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 13%, transparent); }
      .gm-dline.del { background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 13%, transparent); }
      .gm-ln { width:38px; flex:none; text-align:right; padding-right:8px; color:var(--dsw-alias-label-secondary);
        opacity:.65; user-select:none; font-variant-numeric:tabular-nums; }
      .gm-sign { width:14px; flex:none; text-align:center; font-weight:700; }
      .gm-dline.add .gm-sign { color:var(--dsw-alias-state-success-primary); }
      .gm-dline.del .gm-sign { color:var(--dsw-alias-state-error-primary); }
      .gm-dtext { flex:1 1 auto; min-width:0; padding-right:10px; }
      .gm-meta-line { padding:2px 10px; color:var(--dsw-alias-label-secondary); font-style:italic; }

      /* commit area */
      .gm-commit { display:flex; flex-direction:column; gap:6px; padding:8px 10px; border-top:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); }
      .gm-commit-head { display:flex; align-items:center; gap:6px; }
      .gm-commit-title { font-size:10.5px; font-weight:650; letter-spacing:.05em; text-transform:uppercase; color:var(--dsw-alias-label-secondary); }
      .gm-textarea { width:100%; min-height:46px; max-height:140px; padding:6px 8px; border-radius:6px; border:1px solid var(--dsw-alias-border-l2);
        background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; line-height:1.5; resize:vertical; }
      .gm-textarea::placeholder, .gm-input::placeholder { color:var(--dsw-alias-label-secondary); opacity:.75; }
      .gm-input { flex:1 1 100px; min-width:0; height:24px; padding:0 8px; border-radius:6px; border:1px solid var(--dsw-alias-border-l2);
        background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font:inherit; font-size:11.5px; }
      .gm-textarea:focus-visible, .gm-input:focus-visible { outline:2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); outline-offset:-1px; border-color:var(--dsw-alias-brand-primary); }
      .gm-actions { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .gm-hint { font-size:10.5px; color:var(--dsw-alias-label-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .gm-ai-line { font-size:10.5px; color:var(--dsw-alias-label-secondary); }

      /* status bar */
      .gm-status { display:flex; align-items:center; gap:6px; min-height:24px; padding:3px 10px; border-top:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); font-size:11px; color:var(--dsw-alias-label-secondary); }
      .gm-dot { width:6px; height:6px; border-radius:50%; background:var(--dsw-alias-state-idle-primary); flex:none; }
      .gm-dot.ok { background:var(--dsw-alias-state-success-primary); }
      .gm-dot.err { background:var(--dsw-alias-state-error-primary); }
      .gm-dot.busy { background:var(--dsw-alias-state-warn-primary); animation:gm-pulse 1.2s ease-in-out infinite; }
      .gm-status .gm-msg { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .gm-status .gm-msg.err { color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
      .gm-status .gm-msg.ok { color:var(--dsw-alias-state-success-primary); }
      .gm-details > summary { cursor:pointer; }
      .gm-pre { margin:0; padding:6px 10px; max-height:180px; overflow:auto; font-family:${mono}; font-size:11px; color:var(--dsw-alias-label-secondary); white-space:pre-wrap; word-break:break-word; background:var(--dsw-alias-bg-layer-1); }
      @keyframes gm-pulse { 50% { opacity:.3; } }

      /* empty states */
      .gm-empty { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
        padding:28px 20px; text-align:center; color:var(--dsw-alias-label-secondary); }
      .gm-empty svg { opacity:.55; }
      .gm-empty-title { color:var(--dsw-alias-label-primary); font-size:13px; font-weight:600; }
      .gm-empty-hint { font-size:11.5px; line-height:1.6; max-width:280px; }

      /* narrow column: icon-only top-bar actions */
      @container gm (max-width: 430px) {
        .gm-top .gm-btn-label { display:none; }
        .gm-top .gm-btn { width:26px; padding:0; }
        .gm-repo { font-size:12.5px; }
        .gm-bmeta { display:none; }
      }
    `

    // The session header button lives outside the panel root, so it carries its own
    // tiny stylesheet (same tokens, same look as neighbouring header utilities).
    var HEADER_CSS = `
      .gm-header-btn { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; padding:0;
        border:1px solid transparent; border-radius:6px; background:transparent; cursor:pointer; }
      .gm-header-btn:hover { background:var(--dsw-alias-bg-layer-2); }
      .gm-header-btn:hover svg { stroke:var(--dsw-alias-label-primary) !important; }
      .gm-header-btn:focus-visible { outline:2px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); outline-offset:1px; }
      .gm-header-btn svg { display:block; }
    `

    function panelStyle() {
      return h('style', { key: 'gm-css' }, PANEL_CSS)
    }

    // Locale access: `tr` closes over the binding installed by apply(), so every
    // visible string goes through the Client locale service (zh/en dictionaries
    // above). Missing binding degrades to the key itself (never throws).
    var localeT = null
    function tr(key, params) {
      if (!localeT) return key
      try {
        return localeT(key, params)
      } catch (error) {
        return key
      }
    }

    // --------------------------------------------------------------- helpers

    // Icon paths are 24x24 line glyphs drawn with currentColor.
    var ICONS = {
      refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
      fetch: ['M12 3v10', 'M8 9l4 4 4-4', 'M4 17h16', 'M4 21h16'],
      pull: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16'],
      push: ['M12 21V9', 'M7 14l5-5 5 5', 'M4 3h16'],
      plus: ['M12 5v14', 'M5 12h14'],
      minus: ['M5 12h14'],
      close: ['M6 6l12 12', 'M18 6L6 18'],
      ai: ['M12 3l1.7 4.6L18.5 9l-4.8 1.4L12 15l-1.7-4.6L5.5 9l4.8-1.4z', 'M18.5 15l.8 2.2L21.5 18l-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'],
      check: ['M5 12l4.5 4.5L19 7'],
      commit: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M8.5 12l2.5 2.5L16 9.5'],
      file: ['M6 3h8l4 4v14H6z', 'M14 3v5h5'],
      branch: ['M6 4v9', 'M6 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M18 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M18 8v1a6 6 0 0 1-6 6H8'],
    }

    function Icon(props) {
      var paths = ICONS[props.name]
      if (!paths) return null
      var size = props.size || 13
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: props.strokeWidth || 1.8,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', focusable: 'false',
      }, paths.map(function (d, index) { return h('path', { key: index, d: d }) }))
    }

    /** One panel button: variant is 'primary' | 'ghost' | undefined; icon-only when no label. */
    function Btn(props) {
      var className = 'gm-btn'
      if (props.variant === 'primary') className += ' primary'
      else if (props.variant === 'ghost' || props.ghost) className += ' ghost'
      if (props.icon && !props.label) className += ' icon'
      if (props.small) className += ' sm'
      if (props.className) className += ' ' + props.className
      return h('button', {
        type: 'button',
        className: className,
        title: props.title || props.label || undefined,
        disabled: !!props.disabled,
        onClick: props.disabled ? undefined : props.onClick,
        onKeyDown: props.onKeyDown,
      },
        props.icon ? h(Icon, { name: props.icon, size: props.small ? 12 : 13 }) : null,
        props.label ? h('span', { className: 'gm-btn-label' }, props.label) : null)
    }

    function statusLetter(group, entry) {
      // 未跟踪按 git 习惯显示 `?`（`U` 留给 unmerged 状态，避免混淆）。
      if (group === 'untracked') return '?'
      return String(entry.status || '?').slice(0, 1)
    }

    function statusClass(group, entry) {
      if (group === 'conflicted') return 'gm-stat u'
      if (group === 'untracked') return 'gm-stat q'
      var code = String(entry.status || '?').slice(0, 1)
      if (code === 'A' || code === 'R' || code === 'C') return 'gm-stat a'
      if (code === 'D' || code === 'U') return 'gm-stat d'
      return 'gm-stat m'
    }

    function pathParts(path) {
      var value = String(path || '')
      var slash = value.lastIndexOf('/')
      if (slash < 0) return { dir: '', base: value }
      return { dir: value.slice(0, slash + 1), base: value.slice(slash + 1) }
    }

    // One RPC call to the Host half. Throws Error with a `.code` on failure.
    async function rpc(op, params) {
      var response
      try {
        response = await fetch(RPC_PATH, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(Object.assign({ op: op }, params || {})),
        })
      } catch (error) {
        var transport = new Error(tr('error.transport') + '：' + (error && error.message ? error.message : error))
        transport.code = 'transport'
        throw transport
      }
      var body
      try {
        body = await response.json()
      } catch (error) {
        throw new Error(tr('error.badResponse') + ' (HTTP ' + response.status + ')')
      }
      if (!body || body.ok !== true) {
        var failure = (body && body.error) || {}
        var shaped = new Error(failure.message || tr('error.gitFailed'))
        shaped.code = failure.code || 'internal'
        throw shaped
      }
      return body.data
    }

    // ---------------------------------------------------------------- store

    function createStore(initial) {
      var state = initial
      var listeners = []
      return {
        get: function () { return state },
        set: function (patch) {
          var next = typeof patch === 'function' ? patch(state) : patch
          var merged = Object.assign({}, state, next)
          if (merged === state) return
          state = merged
          for (var i = 0; i < listeners.length; i += 1) listeners[i]()
        },
        subscribe: function (listener) {
          listeners.push(listener)
          return function () {
            listeners = listeners.filter(function (item) { return item !== listener })
          }
        },
      }
    }

    function useStore(store) {
      var pair = useState(store.get())
      useEffect(function () {
        var unsubscribe = store.subscribe(function () { pair[1](store.get()) })
        pair[1](store.get())
        return unsubscribe
      }, [store])
      return pair[0]
    }

    // Right-Sidebar tabs are session-scoped: the body receives `sessionId`, and the
    // summary (with its cwd) is read from the injected sessions list.
    function useSessionById(sessions, sessionId) {
      var pair = useState(null)
      useEffect(function () {
        if (!sessions || !sessionId) {
          pair[1](null)
          return undefined
        }
        var read = function () { pair[1](sessions.list.getSnapshot().byId[sessionId] || null) }
        read()
        return sessions.list.subscribe(read)
      }, [sessions, sessionId])
      return pair[0]
    }

    // ------------------------------------------------------------- controller

    function createController() {
      var store = createStore({
        cwd: null,
        snapshot: null,
        graph: null,
        loading: false,
        graphLoading: false,
        error: null,
        errorCode: null,
        busy: null,
        toast: null,
        toastKind: 'ok',
        lastOutput: null,
        activeTab: 'changes',
        selected: null,
        diff: null,
        diffLoading: false,
        message: '',
        aiHint: '',
        aiModel: null,
        aiFallback: false,
        newBranchOpen: false,
        newBranchName: '',
        newBranchFrom: '',
      })
      var toastTimer = null
      var loadToken = 0

      function set(patch) { store.set(patch) }

      function toast(kind, text, output) {
        if (toastTimer) clearTimeout(toastTimer)
        set({ toast: text, toastKind: kind, lastOutput: output || store.get().lastOutput })
        toastTimer = setTimeout(function () {
          toastTimer = null
          set({ toast: null })
        }, kind === 'error' ? 12000 : 6000)
      }

      function clearToast() {
        if (toastTimer) clearTimeout(toastTimer)
        toastTimer = null
        set({ toast: null, error: null, errorCode: null })
      }

      async function loadSnapshot(cwd) {
        var token = ++loadToken
        // 首次加载才显示 loading；轮询刷新不闪「刷新中…」。
        set({ loading: store.get().snapshot === null, error: null, errorCode: null })
        try {
          var data = await rpc('snapshot', { cwd: cwd })
          if (token !== loadToken || cwd !== store.get().cwd) return
          set({ snapshot: data, loading: false })
        } catch (error) {
          if (token !== loadToken || cwd !== store.get().cwd) return
          set({ loading: false, error: error.message, errorCode: error.code || null })
        }
      }

      async function loadGraph(cwd) {
        if (!cwd) return
        set({ graphLoading: true })
        try {
          var data = await rpc('graph', { cwd: cwd, limit: 100 })
          if (cwd !== store.get().cwd) return
          set({ graph: data, graphLoading: false })
        } catch (error) {
          if (cwd !== store.get().cwd) return
          set({ graphLoading: false, graph: { lines: [] }, error: error.message })
        }
      }

      async function loadDiff(target) {
        var cwd = store.get().cwd
        if (!cwd || !target) return
        set({ diffLoading: true })
        try {
          var params = { cwd: cwd }
          if (target.kind === 'commit') {
            params.mode = 'commit'
            params.hash = target.hash
          } else {
            params.mode = target.mode
            params.path = target.path
          }
          var data = await rpc('diff', params)
          var current = store.get().selected
          if (!current || current.kind !== target.kind || current.path !== target.path || current.hash !== target.hash) return
          set({ diff: data, diffLoading: false })
        } catch (error) {
          set({ diffLoading: false, diff: null, error: error.message, errorCode: error.code || null })
        }
      }

      async function refresh() {
        var cwd = store.get().cwd
        if (!cwd) return
        await Promise.all([loadSnapshot(cwd), loadGraph(cwd)])
      }

      async function refreshSoft() {
        var cwd = store.get().cwd
        if (!cwd || store.get().busy) return
        await loadSnapshot(cwd)
      }

      function attach(cwd) {
        if (cwd === store.get().cwd) {
          if (cwd && !store.get().snapshot && !store.get().loading) void refresh()
          return
        }
        set({
          cwd: cwd,
          snapshot: null,
          graph: null,
          loading: !!cwd,
          error: null,
          errorCode: null,
          selected: null,
          diff: null,
          busy: null,
          toast: null,
          lastOutput: null,
          message: '',
          aiHint: '',
          aiModel: null,
          aiFallback: false,
          newBranchOpen: false,
          newBranchName: '',
          newBranchFrom: '',
        })
        if (cwd) void refresh()
      }

      function setMessage(value) { set({ message: value }) }
      function setAiHint(value) { set({ aiHint: value }) }
      function setTab(tab) { set({ activeTab: tab }) }

      function setNewBranch(open) {
        set({ newBranchOpen: open, newBranchName: '', newBranchFrom: '' })
      }

      function setNewBranchName(value) { set({ newBranchName: value }) }
      function setNewBranchFrom(value) { set({ newBranchFrom: value }) }

      async function runBusy(label, operation) {
        if (store.get().busy) return null
        set({ busy: label, error: null, errorCode: null })
        try {
          var result = await operation()
          set({ busy: null })
          return result
        } catch (error) {
          set({ busy: null, error: error.message, errorCode: error.code || null })
          toast('error', error.message)
          return null
        }
      }

      async function selectFile(group, entry) {
        var cwd = store.get().cwd
        if (!cwd) return
        var mode = group === 'staged' ? 'staged' : group === 'untracked' ? 'untracked' : 'worktree'
        var target = { kind: 'file', group: group, path: entry.path, mode: mode }
        set({ activeTab: 'diff', selected: target, diff: null })
        await loadDiff(target)
      }

      async function selectCommit(line) {
        if (!line.full) return
        var target = { kind: 'commit', hash: line.full, path: '', mode: 'commit' }
        set({ activeTab: 'diff', selected: target, diff: null })
        await loadDiff(target)
      }

      async function stage(group, entry) {
        var cwd = store.get().cwd
        if (!cwd) return
        var result = await runBusy('stage', function () { return rpc('stage', { cwd: cwd, paths: [entry.path] }) })
        if (result !== null) {
          toast('ok', tr('status.stageOk'), result.output)
          await refresh()
        }
      }

      async function unstage(group, entry) {
        var cwd = store.get().cwd
        if (!cwd) return
        var result = await runBusy('unstage', function () { return rpc('unstage', { cwd: cwd, paths: [entry.path] }) })
        if (result !== null) {
          toast('ok', tr('status.unstageOk'), result.output)
          await refresh()
        }
      }

      async function stageAll() {
        var cwd = store.get().cwd
        if (!cwd) return
        var result = await runBusy('stage', function () { return rpc('stage', { cwd: cwd, all: true }) })
        if (result !== null) {
          toast('ok', tr('status.stageAllOk'), result.output)
          await refresh()
        }
      }

      async function unstageAll() {
        var cwd = store.get().cwd
        if (!cwd) return
        var result = await runBusy('unstage', function () { return rpc('unstage', { cwd: cwd, all: true }) })
        if (result !== null) {
          toast('ok', tr('status.unstageAllOk'), result.output)
          await refresh()
        }
      }

      async function switchBranch(name) {
        var cwd = store.get().cwd
        if (!cwd || !name) return
        var result = await runBusy('switch', function () { return rpc('switchBranch', { cwd: cwd, name: name }) })
        if (result !== null) {
          toast('ok', tr('status.branchSwitched', { branch: result.branch || name }), result.output)
          set({ selected: null, diff: null, activeTab: 'changes' })
          await refresh()
        }
      }

      async function createBranch() {
        var state = store.get()
        var cwd = state.cwd
        var name = String(state.newBranchName || '').trim()
        if (!cwd || name === '') return
        var params = { cwd: cwd, name: name, create: true }
        var from = String(state.newBranchFrom || '').trim()
        if (from !== '') params.from = from
        var result = await runBusy('switch', function () { return rpc('switchBranch', params) })
        if (result !== null) {
          set({ newBranchOpen: false, newBranchName: '', newBranchFrom: '' })
          toast('ok', tr('status.branchCreated', { branch: result.branch || name }), result.output)
          await refresh()
        }
      }

      async function deleteBranch(name) {
        var cwd = store.get().cwd
        if (!cwd || !name) return
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (!window.confirm(tr('status.deleteConfirm', { branch: name }))) return
        }
        var result = await runBusy('delete', function () { return rpc('deleteBranch', { cwd: cwd, name: name }) })
        if (result !== null) {
          toast('ok', tr('status.branchDeleted', { branch: name }), result.output)
          await refresh()
        }
      }

      async function generateMessage() {
        var state = store.get()
        var cwd = state.cwd
        if (!cwd) return
        var result = await runBusy('ai', function () {
          return rpc('aiCommit', { cwd: cwd, hint: String(state.aiHint || '') })
        })
        if (result === null) return
        set({ message: result.message, aiModel: result.model || null, aiFallback: !!result.fallback })
        toast('ok', result.fallback ? tr('status.aiFallback') : tr('status.aiOk', { model: result.model || '' }))
      }

      async function commit(andPush) {
        var state = store.get()
        var cwd = state.cwd
        var message = String(state.message || '').trim()
        if (!cwd) return
        if (message === '') {
          toast('error', tr('commit.messageRequired'))
          return
        }
        var result = await runBusy('commit', function () { return rpc('commit', { cwd: cwd, message: message }) })
        if (result === null) return
        set({ message: '', aiModel: null, aiFallback: false })
        toast('ok', tr('status.commitOk', { hash: result.hash || '' }), result.output)
        await refresh()
        if (andPush) await push()
      }

      async function fetchRemote() {
        var cwd = store.get().cwd
        if (!cwd) return
        var result = await runBusy('fetch', function () { return rpc('fetch', { cwd: cwd }) })
        if (result !== null) {
          toast('ok', tr('status.fetchOk'), result.output)
          await refresh()
        }
      }

      async function pull() {
        var cwd = store.get().cwd
        if (!cwd) return
        var result = await runBusy('pull', function () { return rpc('pull', { cwd: cwd }) })
        if (result !== null) {
          toast('ok', tr('status.pullOk'), result.output)
          await refresh()
        }
      }

      async function push() {
        var cwd = store.get().cwd
        if (!cwd) return
        var result = await runBusy('push', function () { return rpc('push', { cwd: cwd }) })
        if (result !== null) {
          toast('ok', tr('status.pushOk'), result.output)
          await refresh()
        }
      }

      return {
        store: store,
        attach: attach,
        refresh: refresh,
        refreshSoft: refreshSoft,
        selectFile: selectFile,
        selectCommit: selectCommit,
        stage: stage,
        unstage: unstage,
        stageAll: stageAll,
        unstageAll: unstageAll,
        switchBranch: switchBranch,
        createBranch: createBranch,
        deleteBranch: deleteBranch,
        generateMessage: generateMessage,
        commit: commit,
        fetch: fetchRemote,
        pull: pull,
        push: push,
        setMessage: setMessage,
        setAiHint: setAiHint,
        setTab: setTab,
        setNewBranch: setNewBranch,
        setNewBranchName: setNewBranchName,
        setNewBranchFrom: setNewBranchFrom,
        clearToast: clearToast,
      }
    }

    // -------------------------------------------------------------- components

    var BUSY_KEYS = {
      stage: 'changes.stage',
      unstage: 'changes.unstage',
      commit: 'commit.commit',
      fetch: 'header.fetch',
      pull: 'header.pull',
      push: 'header.push',
      switch: 'branch.switch',
      delete: 'branch.delete',
      ai: 'commit.ai',
    }

    function busyLabel(kind) {
      var key = BUSY_KEYS[kind]
      return key ? tr(key) : String(kind || '')
    }

    function EmptyState(props) {
      return h('div', { className: 'gm-empty' },
        props.icon ? h(Icon, { name: props.icon, size: props.iconSize || 22 }) : null,
        props.title ? h('div', { className: 'gm-empty-title' }, props.title) : null,
        props.hint ? h('div', { className: 'gm-empty-hint' }, props.hint) : null)
    }

    function ChangesSection(props) {
      var entries = props.entries || []
      if (entries.length === 0) return null
      return h('div', null,
        h('div', { className: 'gm-section' },
          h('span', null, props.title),
          h('span', { className: 'gm-section-count' }, String(entries.length))),
        entries.map(function (entry) {
          var selected = props.selected && props.selected.kind === 'file'
            && props.selected.group === props.group && props.selected.path === entry.path
          var parts = pathParts(entry.path)
          var staged = props.group === 'staged'
          return h('div', {
            key: props.group + ':' + entry.path,
            className: 'gm-file' + (selected ? ' active' : ''),
            title: entry.oldPath ? entry.oldPath + ' → ' + entry.path : entry.path,
            onClick: function () { props.onSelect(entry) },
          },
            h('span', { className: statusClass(props.group, entry) }, statusLetter(props.group, entry)),
            h('span', { className: 'gm-fpath' },
              parts.dir ? h('span', { className: 'gm-dir' }, parts.dir) : null,
              parts.base),
            h('button', {
              type: 'button',
              className: 'gm-btn icon sm ghost gm-act',
              title: staged ? tr('changes.unstage') : tr('changes.stage'),
              onClick: function (event) {
                event.stopPropagation()
                if (staged) props.onUnstage(entry)
                else props.onStage(entry)
              },
            }, h(Icon, { name: staged ? 'minus' : 'plus', size: 12 })))
        }))
    }

    function ChangesPane(props) {
      var state = props.state
      var status = state.snapshot && state.snapshot.status ? state.snapshot.status : null
      var staged = status ? status.staged : []
      var unstaged = status ? status.unstaged : []
      var untracked = status ? status.untracked : []
      var conflicted = status ? status.conflicted : []
      var busy = state.busy
      function section(title, group, entries, tone) {
        return h(ChangesSection, {
          title: title,
          group: group,
          entries: entries,
          tone: tone,
          selected: state.selected,
          busy: busy,
          onSelect: function (entry) { props.actions.selectFile(group, entry) },
          onStage: function (entry) { props.actions.stage(group, entry) },
          onUnstage: function (entry) { props.actions.unstage(group, entry) },
        })
      }
      var empty = !conflicted.length && !staged.length && !unstaged.length && !untracked.length
      return h('div', { className: 'gm-scroll' },
        h('div', { className: 'gm-content-inner' },
          h('div', { className: 'gm-quick' },
            h(Btn, { label: tr('changes.stageAll'), icon: 'plus', disabled: !!busy || (unstaged.length + untracked.length === 0), onClick: props.actions.stageAll }),
            h(Btn, { label: tr('changes.unstageAll'), icon: 'minus', disabled: !!busy || staged.length === 0, onClick: props.actions.unstageAll })),
          conflicted.length > 0
            ? h('div', { className: 'gm-conflict-bar' }, tr('changes.conflictBanner', { n: conflicted.length }))
            : null,
          section(tr('changes.conflicted'), 'conflicted', conflicted, 'error'),
          section(tr('changes.staged'), 'staged', staged),
          section(tr('changes.unstaged'), 'unstaged', unstaged),
          section(tr('changes.untracked'), 'untracked', untracked),
          empty
            ? h(EmptyState, { icon: 'check', title: tr('changes.empty') })
            : null))
    }

    function CommitFooter(props) {
      var state = props.state
      var stagedCount = state.snapshot && state.snapshot.status ? state.snapshot.status.staged.length : 0
      var busy = state.busy
      var canCommit = !busy && String(state.message || '').trim() !== '' && stagedCount > 0
      function onKeyDown(event) {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault()
          if (canCommit) props.onCommit(false)
        }
      }
      return h('div', { className: 'gm-commit' },
        h('div', { className: 'gm-commit-head' },
          h(Icon, { name: 'commit', size: 12 }),
          h('span', { className: 'gm-commit-title' }, tr('commit.title')),
          h('span', { className: 'gm-spacer' }),
          stagedCount > 0 ? h('span', { className: 'gm-badge brand' }, tr('changes.stagedCount', { n: stagedCount })) : null),
        h('textarea', {
          className: 'gm-textarea',
          rows: 2,
          value: state.message,
          placeholder: tr('commit.placeholder'),
          onChange: function (event) { props.onMessage(event.target.value) },
          onKeyDown: onKeyDown,
        }),
        h('div', { className: 'gm-actions' },
          h('input', {
            className: 'gm-input',
            value: state.aiHint,
            placeholder: tr('commit.hintPlaceholder'),
            onChange: function (event) { props.onHint(event.target.value) },
          }),
          h(Btn, {
            label: busy === 'ai' ? tr('commit.aiBusy') : tr('commit.aiShort'),
            icon: 'ai',
            title: tr('commit.ai'),
            variant: 'primary',
            disabled: !!busy || !state.cwd,
            onClick: props.onGenerate,
          })),
        h('div', { className: 'gm-actions' },
          state.aiModel
            ? h('span', { className: 'gm-ai-line gm-hint', title: tr('status.aiModel', { model: state.aiModel }) },
              state.aiFallback ? tr('status.aiFallback') : tr('status.aiModelEdit', { model: state.aiModel }))
            : null,
          h('span', { className: 'gm-spacer' }),
          h('span', { className: 'gm-hint' }, tr('commit.cmdEnter')),
          h(Btn, {
            label: busy === 'commit' ? tr('commit.committing') : tr('commit.commit'),
            variant: 'primary',
            disabled: !canCommit,
            onClick: function () { props.onCommit(false) },
          }),
          h(Btn, {
            label: tr('commit.push'),
            disabled: !canCommit,
            onClick: function () { props.onCommit(true) },
          })))
    }

    function BranchSelect(props) {
      var branches = props.branches || []
      var repo = props.repo || {}
      var value = repo.branch || ''
      var locals = branches.filter(function (branch) { return branch.kind === 'local' })
      var remotes = branches.filter(function (branch) { return branch.kind === 'remote' })
      return h('select', {
        className: 'gm-select',
        value: value,
        title: tr('branch.selectTitle'),
        disabled: props.disabled,
        onChange: function (event) { if (event.target.value && event.target.value !== value) props.onSwitch(event.target.value) },
      },
        repo.detached ? h('option', { value: '' }, tr('header.detached')) : null,
        h('optgroup', { label: tr('branch.local') }, locals.map(function (branch) {
          return h('option', { key: 'l:' + branch.name, value: branch.name },
            branch.name + (branch.current ? '  ✓' : '') + (branch.ahead ? '  ↑' + branch.ahead : '') + (branch.behind ? '  ↓' + branch.behind : ''))
        })),
        remotes.length > 0
          ? h('optgroup', { label: tr('branch.remote') }, remotes.map(function (branch) {
            return h('option', { key: 'r:' + branch.name, value: branch.name }, branch.name)
          }))
          : null)
    }

    function CompactTopBar(props) {
      var state = props.state
      var repo = state.snapshot && state.snapshot.repo ? state.snapshot.repo : null
      var busy = state.busy
      if (!repo || !repo.isRepo) {
        return h('div', { className: 'gm-top' },
          h('div', { className: 'gm-row' },
            h(Icon, { name: 'branch', size: 14 }),
            h('span', { className: 'gm-repo' }, tr('panel.title'))))
      }
      return h('div', { className: 'gm-top' },
        h('div', { className: 'gm-row' },
          h('span', { className: 'gm-repo', title: repo.root }, repo.name || tr('panel.title')),
          repo.ahead ? h('span', { className: 'gm-badge' }, '↑' + repo.ahead) : null,
          repo.behind ? h('span', { className: 'gm-badge' }, '↓' + repo.behind) : null,
          h('span', { className: 'gm-spacer' }),
          h(BranchSelect, { branches: state.snapshot.branches, repo: repo, disabled: !!busy, onSwitch: props.onSwitch })),
        h('div', { className: 'gm-row' },
          h(Btn, { icon: 'fetch', label: 'Fetch', title: tr('header.fetch'), disabled: !!busy, onClick: props.onFetch }),
          h(Btn, { icon: 'pull', label: 'Pull', title: tr('header.pull'), disabled: !!busy, onClick: props.onPull }),
          h(Btn, { icon: 'push', label: 'Push', title: tr('header.push'), variant: 'primary', disabled: !!busy, onClick: props.onPush }),
          h('span', { className: 'gm-spacer' }),
          h(Btn, { icon: 'refresh', title: state.loading ? tr('header.refreshing') : tr('header.refresh'), disabled: !!busy, onClick: props.onRefresh }),
          h(Btn, { icon: 'plus', title: tr('header.newBranch'), disabled: !!busy, onClick: function () { props.onNewBranch(true) } })),
        state.newBranchOpen
          ? h('div', { className: 'gm-row' },
            h('input', {
              className: 'gm-input',
              value: state.newBranchName,
              placeholder: tr('header.newBranchPlaceholder'),
              onChange: function (event) { props.onNewBranchName(event.target.value) },
              onKeyDown: function (event) {
                if (event.key === 'Enter') props.onCreateBranch()
                if (event.key === 'Escape') props.onNewBranch(false)
              },
            }),
            h('input', {
              className: 'gm-input',
              style: { flex: '0 1 96px' },
              value: state.newBranchFrom,
              placeholder: tr('header.fromPlaceholder'),
              onChange: function (event) { props.onNewBranchFrom(event.target.value) },
              onKeyDown: function (event) {
                if (event.key === 'Enter') props.onCreateBranch()
                if (event.key === 'Escape') props.onNewBranch(false)
              },
            }),
            h(Btn, { label: tr('header.create'), variant: 'primary', disabled: !!busy || !state.newBranchName.trim(), onClick: props.onCreateBranch }),
            h(Btn, { label: tr('header.cancel'), variant: 'ghost', onClick: function () { props.onNewBranch(false) } }))
          : null)
    }

    function GraphView(props) {
      var state = props.state
      var lines = state.graph && state.graph.lines ? state.graph.lines : []
      if (state.graphLoading && lines.length === 0) return h(EmptyState, { icon: 'refresh', title: tr('status.loading') })
      if (lines.length === 0) return h(EmptyState, { icon: 'commit', title: tr('graph.empty') })
      return h('div', { className: 'gm-scroll' },
        h('div', { className: 'gm-content-inner gm-graph' },
          lines.map(function (line, index) {
            if (!line.full) {
              return h('div', { key: 'g:' + index, className: 'gm-grow' },
                h('span', { className: 'gm-gprefix' }, line.graph || ''))
            }
            var selected = state.selected && state.selected.kind === 'commit' && state.selected.hash === line.full
            return h('div', {
              key: 'c:' + line.full + ':' + index,
              className: 'gm-grow' + (selected ? ' active' : ''),
              title: line.full,
              onClick: function () { props.onSelectCommit(line) },
            },
              h('span', { className: 'gm-gprefix' }, line.graph || ''),
              h('span', { className: 'gm-hash' }, line.hash),
              line.refs && line.refs.length > 0
                ? h('span', { className: 'gm-row', style: { gap: '4px', flex: 'none' } }, line.refs.map(function (ref, refIndex) {
                  return h('span', {
                    key: 'r:' + refIndex,
                    className: 'gm-badge gm-ref' + (ref.indexOf('HEAD') === 0 ? ' brand' : ''),
                  }, ref)
                }))
                : null,
              h('span', { className: 'gm-subject' }, line.subject),
              h('span', { className: 'gm-meta' }, line.author + ' · ' + line.date))
          })))
    }

    function DiffView(props) {
      var state = props.state
      var diff = state.diff
      if (state.diffLoading) return h(EmptyState, { icon: 'refresh', title: tr('status.loading') })
      if (!diff) return h(EmptyState, { icon: 'file', title: tr('diff.empty') })
      var title = diff.mode === 'commit'
        ? tr('diff.commit', { hash: state.selected && state.selected.hash ? state.selected.hash.slice(0, 8) : '' })
        : diff.mode === 'staged' ? tr('diff.staged') : diff.mode === 'untracked' ? tr('diff.untracked') : tr('diff.worktree')
      return h('div', { className: 'gm-scroll' },
        h('div', { className: 'gm-content-inner gm-diff' },
          h('div', { className: 'gm-diff-head' },
            h('span', { className: 'gm-diff-title' }, title),
            h('span', { className: 'gm-fpath', title: diff.path || '' }, diff.path || ''),
            h('span', { className: 'gm-spacer' }),
            h('span', { className: 'gm-badge ok' }, '+' + diff.additions),
            h('span', { className: 'gm-badge err' }, '-' + diff.deletions),
            diff.truncated ? h('span', { className: 'gm-badge warn' }, tr('diff.truncatedShort')) : null),
          diff.binary
            ? h(EmptyState, { icon: 'file', title: tr('diff.binary') })
            : diff.hunks.length === 0
              ? h(EmptyState, { icon: 'file', title: tr('diff.noText') })
              : diff.hunks.map(function (hunk, hunkIndex) {
                return h('div', { key: 'h:' + hunkIndex },
                  h('div', { className: 'gm-hunk' }, hunk.header),
                  h('div', { className: 'gm-dlines' }, hunk.lines.map(function (line, lineIndex) {
                    var kind = line.kind === 'add' ? 'add' : line.kind === 'del' ? 'del' : ''
                    var sign = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : line.kind === 'meta' ? '\\' : ' '
                    return h('div', { key: 'l:' + hunkIndex + ':' + lineIndex, className: 'gm-dline ' + kind },
                      h('span', { className: 'gm-ln' }, line.old === undefined ? '' : String(line.old)),
                      h('span', { className: 'gm-ln' }, line.new === undefined ? '' : String(line.new)),
                      h('span', { className: 'gm-sign' }, sign),
                      h('span', { className: 'gm-dtext' }, line.text))
                  })))
              })))
    }

    function BranchesView(props) {
      var state = props.state
      var branches = state.snapshot && state.snapshot.branches ? state.snapshot.branches : []
      var locals = branches.filter(function (branch) { return branch.kind === 'local' })
      var remotes = branches.filter(function (branch) { return branch.kind === 'remote' })
      function group(title, items, allowDelete) {
        if (items.length === 0) return null
        return h('div', null,
          h('div', { className: 'gm-section' },
            h('span', null, title),
            h('span', { className: 'gm-section-count' }, String(items.length))),
          items.map(function (branch) {
            return h('div', { key: branch.kind + ':' + branch.name, className: 'gm-branch' },
              h(Icon, { name: 'branch', size: 12 }),
              h('span', { className: 'gm-bname', title: branch.name }, branch.name),
              branch.current ? h('span', { className: 'gm-badge brand' }, tr('branch.current')) : null,
              branch.upstream ? h('span', { className: 'gm-badge' }, branch.upstream) : null,
              branch.ahead ? h('span', { className: 'gm-badge' }, '↑' + branch.ahead) : null,
              branch.behind ? h('span', { className: 'gm-badge' }, '↓' + branch.behind) : null,
              branch.gone ? h('span', { className: 'gm-badge warn' }, tr('branch.gone')) : null,
              h('span', { className: 'gm-bmeta' }, branch.subject || ''),
              h('span', { className: 'gm-row gm-act', style: { gap: '4px', flex: 'none' } },
                !branch.current
                  ? h(Btn, { label: tr('branch.switch'), small: true, disabled: !!state.busy, onClick: function () { props.onSwitch(branch.name) } })
                  : null,
                !branch.current && allowDelete
                  ? h(Btn, { label: tr('branch.delete'), small: true, ghost: true, disabled: !!state.busy, onClick: function () { props.onDelete(branch.name) } })
                  : null))
          }))
      }
      return h('div', { className: 'gm-scroll' },
        h('div', { className: 'gm-content-inner' },
          group(tr('branch.local'), locals, true),
          group(tr('branch.remote'), remotes, false),
          locals.length === 0 && remotes.length === 0
            ? h(EmptyState, { icon: 'branch', title: tr('branch.empty') })
            : null))
    }

    function StatusBar(props) {
      var state = props.state
      var dotClass = 'gm-dot'
      var message = tr('status.ready')
      var messageClass = 'gm-msg'
      var dismiss = null
      if (state.toast) {
        var isError = state.toastKind === 'error'
        dotClass += isError ? ' err' : ' ok'
        messageClass += isError ? ' err' : ' ok'
        message = state.toast
        dismiss = props.onDismiss
      } else if (state.error) {
        dotClass += ' err'
        messageClass += ' err'
        message = tr('status.error', { message: state.error })
        dismiss = props.onDismiss
      } else if (state.busy) {
        dotClass += ' busy'
        message = tr('status.busy', { label: busyLabel(state.busy) })
      } else if (state.lastOutput) {
        return h('details', { className: 'gm-details' },
          h('summary', { className: 'gm-status' },
            h('span', { className: 'gm-dot ok' }),
            h('span', { className: 'gm-msg' }, tr('details.output'))),
          h('pre', { className: 'gm-pre' }, state.lastOutput))
      }
      return h('div', { className: 'gm-status' },
        h('span', { className: dotClass }),
        h('span', { className: messageClass, title: message }, message),
        dismiss
          ? h('button', {
            type: 'button',
            className: 'gm-btn icon sm ghost',
            title: tr('details.dismiss'),
            onClick: dismiss,
          }, h(Icon, { name: 'close', size: 12 }))
          : null)
    }

    function TabbedPanel(props) {
      var state = props.state
      var repo = state.snapshot && state.snapshot.repo ? state.snapshot.repo : null
      var status = state.snapshot && state.snapshot.status ? state.snapshot.status : null
      var changeCount = status
        ? status.staged.length + status.unstaged.length + status.untracked.length + status.conflicted.length
        : 0
      var tabs = [
        { id: 'changes', label: tr('tabs.changes'), count: changeCount },
        { id: 'graph', label: tr('tabs.graph'), count: 0 },
        { id: 'branches', label: tr('tabs.branches'), count: 0 },
        { id: 'diff', label: tr('tabs.diff'), count: 0 },
      ]
      var content
      if (state.activeTab === 'changes') content = h(ChangesPane, { state: state, actions: props.actions })
      else if (state.activeTab === 'graph') content = h(GraphView, { state: state, onSelectCommit: props.actions.selectCommit })
      else if (state.activeTab === 'branches') content = h(BranchesView, { state: state, onSwitch: props.actions.switchBranch, onDelete: props.actions.deleteBranch })
      else content = h(DiffView, { state: state })
      return h('div', { className: 'gm-root' },
        panelStyle(),
        h(CompactTopBar, {
          state: state,
          onSwitch: props.actions.switchBranch,
          onRefresh: props.actions.refresh,
          onFetch: props.actions.fetch,
          onPull: props.actions.pull,
          onPush: props.actions.push,
          onNewBranch: props.actions.setNewBranch,
          onNewBranchName: props.actions.setNewBranchName,
          onNewBranchFrom: props.actions.setNewBranchFrom,
          onCreateBranch: props.actions.createBranch,
        }),
        h('div', { className: 'gm-tabs' },
          tabs.map(function (tab) {
            return h('button', {
              key: tab.id,
              type: 'button',
              className: 'gm-tab' + (state.activeTab === tab.id ? ' active' : ''),
              onClick: function () { props.actions.setTab(tab.id) },
            },
              h('span', null, tab.label),
              tab.count > 0 ? h('span', { className: 'gm-count' }, String(tab.count)) : null)
          })),
        content,
        h(StatusBar, { state: state, onDismiss: props.actions.clearToast }),
        repo && repo.isRepo
          ? h(CommitFooter, {
            state: state,
            onMessage: props.actions.setMessage,
            onHint: props.actions.setAiHint,
            onGenerate: props.actions.generateMessage,
            onCommit: function (andPush) { props.actions.commit(andPush) },
          })
          : null)
    }

    function EmptyPanel(props) {
      return h('div', { className: 'gm-root' },
        panelStyle(),
        h('div', { className: 'gm-top' },
          h('div', { className: 'gm-row' },
            h(Icon, { name: 'branch', size: 14 }),
            h('span', { className: 'gm-repo' }, tr('panel.title')))),
        h(EmptyState, { icon: props.icon || 'branch', title: props.title, hint: props.hint }))
    }

    function GitPanel(props) {
      var controller = props.controller
      var summary = props.sessionSummary
      var cwd = summary && summary.cwd ? summary.cwd : null
      var state = useStore(controller.store)

      useEffect(function () {
        controller.attach(cwd)
      }, [cwd])

      useEffect(function () {
        if (!cwd) return undefined
        var timer = setInterval(function () {
          if (typeof document !== 'undefined' && document.hidden) return
          void controller.refreshSoft()
        }, POLL_MS)
        return function () { clearInterval(timer) }
      }, [cwd])

      useEffect(function () {
        if (typeof window === 'undefined') return undefined
        var onFocus = function () { void controller.refreshSoft() }
        window.addEventListener('focus', onFocus)
        return function () { window.removeEventListener('focus', onFocus) }
      }, [])

      if (!summary) return h(EmptyPanel, { title: tr('panel.title'), hint: tr('status.noSession') })
      if (!cwd) return h(EmptyPanel, { title: tr('panel.title'), hint: tr('status.noCwd') })
      var repo = state.snapshot && state.snapshot.repo ? state.snapshot.repo : null
      if (state.error && state.errorCode === 'cwd-unavailable') {
        return h(EmptyPanel, { icon: 'file', title: tr('status.cwdUnavailable', { path: cwd }) })
      }
      if (state.error && (!state.snapshot || (repo && repo.isRepo === false))) {
        return h(EmptyPanel, { icon: 'refresh', title: tr('status.error', { message: state.error }) })
      }
      if (state.snapshot && repo && repo.isRepo === false) {
        return h(EmptyPanel, { icon: 'branch', title: tr('status.notRepoTitle'), hint: cwd })
      }
      if (!state.snapshot && state.loading) return h(EmptyPanel, { icon: 'refresh', title: tr('status.loading') })
      return h(TabbedPanel, { state: state, actions: controller })
    }

    function GitIcon(props) {
      var size = props.size || 16
      var color = props.active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)'
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true', focusable: 'false',
      },
        h('line', { x1: 6, y1: 3, x2: 6, y2: 15 }),
        h('circle', { cx: 18, cy: 6, r: 3 }),
        h('circle', { cx: 6, cy: 18, r: 3 }),
        h('path', { d: 'M18 9a9 9 0 0 1-9 9' }))
    }

    function makeBoundary(fallbackText) {
      function Boundary(props) {
        React.Component.call(this, props)
        this.state = { error: null }
      }
      Boundary.prototype = Object.create(React.Component.prototype)
      Boundary.prototype.constructor = Boundary
      Boundary.getDerivedStateFromError = function (error) { return { error: error } }
      Boundary.prototype.componentDidCatch = function (error) {
        if (typeof console !== 'undefined') console.error('[git-manager] panel crashed:', error)
      }
      Boundary.prototype.render = function () {
        if (this.state.error) {
          return h('div', { className: 'gm-root' }, panelStyle(),
            h(EmptyState, {
              icon: 'refresh',
              title: fallbackText,
              hint: this.state.error && this.state.error.message ? this.state.error.message : String(this.state.error),
            }))
        }
        return this.props.children
      }
      return Boundary
    }

    // ------------------------------------------------------------------ apply

    exports.inject = ['slots', 'locale', 'sessions', 'sidebarRight', 'sidebarRightTabs']

    exports.apply = function (ctx) {
      var controller = createController()
      var sessions = ctx.sessions

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: ZH, en: EN })
      }, 'git-manager: dictionaries')

      var t = ctx.locale.bind(NS)
      localeT = t
      var Boundary = makeBoundary(t('error.boundary'))

      // Stage one: the tab type (chip title + the guide's entry box).
      ctx.effect(function () {
        return ctx.sidebarRightTabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          priority: 'extension',
          title: function () { return t('panel.title') },
          guide: [{
            order: 30,
            title: function () { return t('panel.title') },
            description: function () { return t('panel.guide') },
          }],
        })
      }, 'git-manager: right sidebar tab type')

      // Stage two: the tab body, keyed by the definition id.
      function GitTabBody(props) {
        var summary = useSessionById(sessions, props.sessionId)
        return h(Boundary, null, h(GitPanel, { controller: controller, sessionSummary: summary }))
      }

      ctx.effect(function () {
        return ctx.slots.inject('sidebar.right.pane.tab', function () {
          return ctx.slots.register({
            name: 'sidebar.right.pane.tab',
            key: TAB_ID,
            locale: NS,
          }, GitTabBody)
        })
      }, 'git-manager: right sidebar tab body')

      // The way in: one icon in the session header's utilities row.
      function HeaderGitButton() {
        return h(React.Fragment, null,
          h('style', { key: 'gm-header-css' }, HEADER_CSS),
          h('button', {
            type: 'button',
            className: 'gm-header-btn',
            title: t('panel.open'),
            'aria-label': t('panel.open'),
            onClick: function () { ctx.sidebarRight.openTab(TAB_KIND) },
          }, h(GitIcon, { size: 16, active: false })))
      }

      ctx.effect(function () {
        return ctx.slots.inject('conversation.session.header.utilities', function () {
          return ctx.slots.register({
            name: 'conversation.session.header.utilities',
            id: TAB_ID,
            order: 10,
            label: function () { return t('panel.open') },
          }, HeaderGitButton)
        })
      }, 'git-manager: session header button')
    }

    return module.exports
  },
})
