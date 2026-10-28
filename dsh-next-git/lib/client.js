// Browser bundle for @caozeal/dsh-next-git.
//
// Registers two contributions into the shipped Harness Web UI:
//   - `sidebar.panellist`  : the Git icon in the global panel list
//   - `main` (keyed)       : the Git panel selected by that icon
// All data comes from the Host half through `POST /api/git-manager`; this file
// has no build step and must stay a single classic script. Copy the shell
// pattern from the other plugins in this repository.
window.__ModuleLoader__.load({
  id: '@caozeal/dsh-next-git',
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
      'changes.emptyHint': '切到「提交图」看看历史，或者继续写代码',
      'changes.stageAll': '全部暂存',
      'changes.unstageAll': '全部取消暂存',
      'changes.stage': '暂存',
      'changes.unstage': '取消暂存',
      'changes.discard': '丢弃改动',
      'changes.discardUntracked': '删除文件',
      'changes.discardConfirm': '丢弃 {path} 的改动？此操作不可恢复。',
      'changes.discardUntrackedConfirm': '删除未跟踪文件 {path}？此操作不可恢复。',
      'changes.discardStagedConfirm': '丢弃 {path} 的暂存与工作区改动？此操作不可恢复。',
      'conflict.resolve': '解决冲突',
      'conflict.title': '冲突解决',
      'conflict.hintPlaceholder': '补充说明（可选），例如「版本号取上游」',
      'conflict.ai': 'AI 生成解决建议',
      'conflict.regenerate': '重新生成',
      'conflict.takeOurs': '取当前分支',
      'conflict.takeTheirs': '取对方分支',
      'conflict.apply': '应用并标记已解决',
      'conflict.discard': '放弃',
      'conflict.empty': '先生成建议，或直接取某一侧；生成过程不会改动文件',
      'conflict.generating': '正在生成解决建议…',
      'conflict.preview': 'AI 建议的解决结果 · 确认后才会写入文件',
      'conflict.model': '由 {model} 生成',
      'conflict.remaining': '还剩 {n} 个冲突文件',
      'conflict.noBase': 'add/add 冲突，没有共同祖先版本',
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
      'commit.prompt': 'AI 提示词',
      'commit.promptTitle': '自定义 AI 提交提示词',
      'commit.promptHint': '留空使用默认提示词。这里只改「怎么写」，diff 与文件列表始终会传给模型。',
      'commit.promptSave': '保存',
      'commit.promptReset': '恢复默认',
      'commit.promptCancel': '取消',
      'commit.promptCustom': '自定义提示词',
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
      'diff.conflict': '冲突差异 · 当前分支 ↔ 合入分支',
      'diff.conflictSame': '两边内容完全一致',
      'diff.conflictDeleted': '该文件在合并的某一侧被删除',
      'diff.conflictDeletedHint': '点右上角「解决冲突」决定保留还是删除',
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
      'status.discardOk': '已丢弃 {path}',
      'status.stashSaveOk': '已 stash 当前改动',
      'status.stashPopOk': '已恢复 stash@{n}',
      'status.stashDropOk': '已删除 stash@{n}',
      'status.promptSaved': '提示词已保存',
      'status.promptReset': '已恢复默认提示词',
      'status.resolveOk': '已解决 {path}',
      'status.resolveAllOk': '全部冲突已解决，可以提交了',
      'status.takeOursOk': '已取当前分支版本',
      'status.takeTheirsOk': '已取对方分支版本',
      'status.conflictApplied': '已应用解决结果',
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
      'stash.title': 'Stash',
      'stash.empty': '没有 stash 记录',
      'stash.placeholder': 'stash 说明（可选）',
      'stash.save': '暂存改动',
      'stash.pop': '恢复',
      'stash.drop': '删除',
      'stash.popConfirm': '恢复 stash@{n} 并从列表移除？',
      'stash.dropConfirm': '删除 stash@{n}？此操作不可恢复。',
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
      'changes.emptyHint': 'Check the commit graph, or keep coding',
      'changes.stageAll': 'Stage all',
      'changes.unstageAll': 'Unstage all',
      'changes.stage': 'Stage',
      'changes.unstage': 'Unstage',
      'changes.discard': 'Discard changes',
      'changes.discardUntracked': 'Delete file',
      'changes.discardConfirm': 'Discard changes to {path}? This cannot be undone.',
      'changes.discardUntrackedConfirm': 'Delete untracked file {path}? This cannot be undone.',
      'changes.discardStagedConfirm': 'Discard staged and working-tree changes to {path}? This cannot be undone.',
      'conflict.resolve': 'Resolve conflict',
      'conflict.title': 'Resolve conflict',
      'conflict.hintPlaceholder': 'Optional hint, e.g. "take the upstream version"',
      'conflict.ai': 'Generate a resolution',
      'conflict.regenerate': 'Regenerate',
      'conflict.takeOurs': 'Take ours',
      'conflict.takeTheirs': 'Take theirs',
      'conflict.apply': 'Apply and mark resolved',
      'conflict.discard': 'Discard',
      'conflict.empty': 'Generate a suggestion, or take one side; generating never touches the file',
      'conflict.generating': 'Generating a resolution…',
      'conflict.preview': 'AI suggestion · nothing is written until you apply',
      'conflict.model': 'Generated by {model}',
      'conflict.remaining': '{n} conflicted file(s) left',
      'conflict.noBase': 'add/add conflict; no common ancestor',
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
      'commit.prompt': 'AI prompt',
      'commit.promptTitle': 'Custom AI commit prompt',
      'commit.promptHint': 'Leave empty to use the default. This only changes how it writes; the diff and file list are always sent.',
      'commit.promptSave': 'Save',
      'commit.promptReset': 'Reset to default',
      'commit.promptCancel': 'Cancel',
      'commit.promptCustom': 'Custom prompt',
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
      'diff.conflict': 'Conflict · ours ↔ theirs',
      'diff.conflictSame': 'Both sides are identical',
      'diff.conflictDeleted': 'The file was deleted on one side of the merge',
      'diff.conflictDeletedHint': 'Use "Resolve conflict" to keep or delete it',
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
      'status.discardOk': 'Discarded {path}',
      'status.stashSaveOk': 'Stashed current changes',
      'status.stashPopOk': 'Restored stash@{n}',
      'status.stashDropOk': 'Dropped stash@{n}',
      'status.promptSaved': 'Prompt saved',
      'status.promptReset': 'Restored the default prompt',
      'status.resolveOk': 'Resolved {path}',
      'status.resolveAllOk': 'All conflicts resolved; ready to commit',
      'status.takeOursOk': 'Took the ours side',
      'status.takeTheirsOk': 'Took the theirs side',
      'status.conflictApplied': 'Resolution applied',
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
      'stash.title': 'Stash',
      'stash.empty': 'No stash entries',
      'stash.placeholder': 'Stash message (optional)',
      'stash.save': 'Stash changes',
      'stash.pop': 'Restore',
      'stash.drop': 'Drop',
      'stash.popConfirm': 'Restore stash@{n} and remove it from the list?',
      'stash.dropConfirm': 'Drop stash@{n}? This cannot be undone.',
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
      /* ---- DeepSeek-blue whale palette ---------------------------------- */
      .gm-root {
        --gm-blue: #4d6bfe;
        --gm-blue-2: #7b93ff;
        --gm-cyan: #43c9ff;
        --gm-deep: #2f49d6;
        --gm-ink: var(--dsw-alias-label-primary);
        --gm-dim: var(--dsw-alias-label-secondary);
        --gm-line: var(--dsw-alias-border-l1);
        --gm-card: var(--dsw-alias-bg-layer-1);
        --gm-card2: var(--dsw-alias-bg-layer-2);
        --gm-base: var(--dsw-alias-bg-base);
        --gm-blue-04: color-mix(in srgb, var(--gm-blue) 4%, transparent);
        --gm-blue-06: color-mix(in srgb, var(--gm-blue) 6%, transparent);
        --gm-blue-08: color-mix(in srgb, var(--gm-blue) 8%, transparent);
        --gm-blue-12: color-mix(in srgb, var(--gm-blue) 12%, transparent);
        --gm-blue-18: color-mix(in srgb, var(--gm-blue) 18%, transparent);
        --gm-blue-28: color-mix(in srgb, var(--gm-blue) 28%, transparent);
        --gm-blue-40: color-mix(in srgb, var(--gm-blue) 40%, transparent);
        /* 提交图 lane 调色板：8 色，相邻不撞色；每条分支线跨行保持同色。
           色相刻意错开（蓝/紫/青/绿/橙/粉/黄/灰），深浅色主题下都够辨识。 */
        --gm-lane-0: #4d6bfe;
        --gm-lane-1: #8b5cf6;
        --gm-lane-2: #06b6d4;
        --gm-lane-3: #22c55e;
        --gm-lane-4: #f59e0b;
        --gm-lane-5: #ec4899;
        --gm-lane-6: #14b8a6;
        --gm-lane-7: #a855f7;
        --gm-ok: var(--dsw-alias-state-success-primary);
        --gm-err: var(--dsw-alias-state-error-primary);
        --gm-warn: var(--dsw-alias-state-warn-primary);
        display:flex; flex-direction:column; height:100%; min-height:0;
        container-type:inline-size; container-name:gm;
        background:linear-gradient(180deg, var(--gm-blue-04), transparent 180px), var(--gm-base);
        color:var(--gm-ink); font-size:12px; line-height:1.5;
        animation:gm-fade .18s ease;
      }
      .gm-root *, .gm-root *::before, .gm-root *::after { box-sizing:border-box; }
      .gm-scroll { flex:1 1 0; min-height:0; overflow:auto; scrollbar-width:thin;
        scrollbar-color:var(--gm-blue-28) transparent; }
      .gm-scroll::-webkit-scrollbar { width:10px; height:10px; }
      .gm-scroll::-webkit-scrollbar-thumb { background:var(--gm-blue-28); border-radius:99px; border:3px solid transparent; background-clip:content-box; }
      .gm-scroll::-webkit-scrollbar-track { background:transparent; }
      .gm-scroll::-webkit-scrollbar-thumb:hover { background:var(--gm-blue-40); background-clip:content-box; }
      .gm-content-inner { width:100%; }
      .gm-row { display:flex; align-items:center; gap:6px; min-width:0; }
      .gm-spacer { flex:1 1 auto; min-width:0; }
      .gm-mark { display:inline-flex; align-items:center; justify-content:center; flex:none;
        background:linear-gradient(150deg, var(--gm-blue-12), var(--gm-blue-06));
        box-shadow:inset 0 0 0 1px var(--gm-blue-18), 0 2px 6px var(--gm-blue-12); }
      .gm-mark img { width:80%; height:80%; object-fit:contain; display:block;
        filter:drop-shadow(0 1px 3px var(--gm-blue-28)); }

      /* ---- playful top bar ---------------------------------------------- */
      .gm-top { position:relative; flex:none; display:flex; flex-direction:column; gap:7px; padding:10px 12px 9px;
        border-bottom:1px solid var(--gm-line); overflow:hidden;
        background:linear-gradient(135deg, color-mix(in srgb, var(--gm-blue) 12%, var(--gm-card)), var(--gm-card) 72%); }
      .gm-top::before { content:''; position:absolute; right:-34px; top:-46px; width:132px; height:132px; border-radius:50%;
        background:radial-gradient(circle at 32% 32%, color-mix(in srgb, var(--gm-cyan) 42%, transparent), transparent 68%);
        opacity:.55; pointer-events:none; }
      .gm-top::after { content:''; position:absolute; left:-20px; bottom:-30px; width:90px; height:90px; border-radius:50%;
        background:radial-gradient(circle, var(--gm-blue-18), transparent 70%); pointer-events:none; }
      .gm-top > * { position:relative; z-index:1; }
      .gm-repo { font-size:13.5px; font-weight:700; letter-spacing:-0.01em; white-space:nowrap; overflow:hidden;
        text-overflow:ellipsis; min-width:0; }
      .gm-repo-dot { width:7px; height:7px; border-radius:50%; flex:none;
        background:linear-gradient(135deg, var(--gm-cyan), var(--gm-blue)); box-shadow:0 0 0 3px var(--gm-blue-12); }
      .gm-subtle { font-size:10.5px; color:var(--gm-dim); white-space:nowrap; }

      /* ---- controls ------------------------------------------------------ */
      .gm-btn { display:inline-flex; align-items:center; justify-content:center; gap:4px; height:25px; padding:0 10px;
        border-radius:9px; border:1px solid var(--gm-blue-12); background:var(--gm-blue-06); color:var(--gm-ink);
        font:inherit; font-size:11.5px; line-height:1; cursor:pointer; white-space:nowrap;
        transition:transform .12s, box-shadow .12s, background .12s, border-color .12s, color .12s, opacity .12s; }
      .gm-btn svg { width:13px; height:13px; flex:none; }
      .gm-btn:hover:not(:disabled) { background:var(--gm-blue-12); border-color:var(--gm-blue-28); color:var(--gm-blue); transform:translateY(-1px); }
      .gm-btn:active:not(:disabled) { transform:translateY(0); }
      .gm-btn:focus-visible { outline:2px solid var(--gm-blue-40); outline-offset:1px; }
      .gm-btn:disabled { opacity:.4; cursor:default; }
      .gm-btn.primary { border-color:transparent; color:#fff; font-weight:600;
        background:linear-gradient(135deg, var(--gm-blue), var(--gm-deep));
        box-shadow:0 4px 14px var(--gm-blue-28); }
      .gm-btn.primary:hover:not(:disabled) { color:#fff; filter:brightness(1.06); box-shadow:0 6px 18px var(--gm-blue-40); }
      .gm-btn.ghost { border-color:transparent; background:transparent; color:var(--gm-dim); }
      .gm-btn.ghost:hover:not(:disabled) { background:var(--gm-blue-08); color:var(--gm-blue); }
      .gm-btn.icon { width:25px; padding:0; }
      .gm-btn.sm { height:21px; font-size:11px; border-radius:7px; }
      .gm-btn.icon.sm { width:21px; }
      .gm-ai-busy { position:relative; overflow:hidden; }
      .gm-ai-busy::after { content:''; position:absolute; inset:0; background:linear-gradient(110deg, transparent 20%, rgba(255,255,255,.35) 50%, transparent 80%);
        transform:translateX(-100%); animation:gm-shimmer 1.2s linear infinite; }

      .gm-select { height:26px; max-width:174px; padding:0 26px 0 10px; border-radius:999px;
        border:1px solid var(--gm-blue-28); background-color:var(--gm-blue-08); color:var(--gm-ink);
        font-size:11.5px; font-weight:600; cursor:pointer; appearance:none;
        background-image:linear-gradient(45deg,transparent 50%,var(--gm-blue) 50%),linear-gradient(135deg,var(--gm-blue) 50%,transparent 50%);
        background-position:calc(100% - 14px) 11px, calc(100% - 10px) 11px; background-size:4px 4px,4px 4px; background-repeat:no-repeat;
        transition:box-shadow .12s, background-color .12s; }
      .gm-select:hover { background-color:var(--gm-blue-12); box-shadow:0 2px 10px var(--gm-blue-18); }
      .gm-select:focus-visible { outline:2px solid var(--gm-blue-40); outline-offset:-1px; }

      /* ---- badges -------------------------------------------------------- */
      .gm-badge { display:inline-flex; align-items:center; gap:3px; height:18px; padding:0 7px; border-radius:999px;
        border:1px solid var(--gm-blue-18); background:var(--gm-blue-06); color:var(--gm-dim);
        font-size:10.5px; font-variant-numeric:tabular-nums; white-space:nowrap; flex:none; }
      .gm-badge.brand { color:#fff; border-color:transparent;
        background:linear-gradient(135deg, var(--gm-blue), var(--gm-cyan)); box-shadow:0 2px 8px var(--gm-blue-28); }
      .gm-badge.ok { color:var(--gm-ok); border-color:color-mix(in srgb, var(--gm-ok) 35%, transparent); background:color-mix(in srgb, var(--gm-ok) 8%, transparent); }
      .gm-badge.err { color:var(--gm-err); border-color:color-mix(in srgb, var(--gm-err) 35%, transparent); background:color-mix(in srgb, var(--gm-err) 8%, transparent); }
      .gm-badge.warn { color:var(--gm-warn); border-color:color-mix(in srgb, var(--gm-warn) 38%, transparent); background:color-mix(in srgb, var(--gm-warn) 10%, transparent); }

      /* ---- pill tabs ----------------------------------------------------- */
      .gm-tabs { flex:none; display:flex; align-items:center; gap:4px; padding:7px 10px; border-bottom:1px solid var(--gm-line);
        background:var(--gm-card); overflow-x:auto; scrollbar-width:none; }
      .gm-tabs::-webkit-scrollbar { display:none; }
      .gm-tab { display:inline-flex; align-items:center; gap:5px; height:27px; padding:0 11px; border-radius:999px;
        border:1px solid transparent; background:transparent; color:var(--gm-dim); font:inherit; font-size:12px;
        cursor:pointer; white-space:nowrap; transition:background .14s, color .14s, box-shadow .14s, transform .14s; }
      .gm-tab:hover { background:var(--gm-blue-08); color:var(--gm-blue); }
      .gm-tab.active { color:#fff; font-weight:600;
        background:linear-gradient(135deg, var(--gm-blue), var(--gm-deep));
        box-shadow:0 3px 12px var(--gm-blue-28); }
      .gm-tab:focus-visible { outline:2px solid var(--gm-blue-40); outline-offset:1px; }
      .gm-count { min-width:16px; height:16px; padding:0 4px; border-radius:999px; background:var(--gm-blue-12);
        color:var(--gm-blue); font-size:10px; font-weight:600; display:inline-flex; align-items:center;
        justify-content:center; font-variant-numeric:tabular-nums; }
      .gm-tab.active .gm-count { background:rgba(255,255,255,.24); color:#fff; }

      /* ---- changes ------------------------------------------------------- */
      .gm-quick { display:flex; gap:6px; padding:9px 10px 1px; flex-wrap:wrap; }
      .gm-section { display:flex; align-items:center; gap:6px; padding:11px 12px 3px; font-size:10.5px;
        font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--gm-dim); }
      .gm-section::before { content:''; width:6px; height:6px; border-radius:2px; flex:none;
        background:linear-gradient(135deg, var(--gm-cyan), var(--gm-blue)); box-shadow:0 0 0 2px var(--gm-blue-12); }
      .gm-section-count { font-weight:500; letter-spacing:0; font-variant-numeric:tabular-nums; color:var(--gm-blue); }
      .gm-file { display:flex; align-items:center; gap:7px; min-height:26px; padding:3px 8px; margin:0 6px;
        border-radius:9px; cursor:pointer; transition:background .12s; }
      .gm-file:hover { background:var(--gm-blue-06); }
      .gm-file.active { background:var(--gm-blue-12); box-shadow:inset 3px 0 0 var(--gm-blue); }
      .gm-stat { width:16px; height:16px; border-radius:5px; flex:none; display:inline-flex; align-items:center;
        justify-content:center; font-family:${mono}; font-size:10px; font-weight:700; background:var(--gm-blue-08); }
      .gm-stat.m { color:var(--gm-warn); }
      .gm-stat.a { color:var(--gm-ok); }
      .gm-stat.d, .gm-stat.u { color:var(--gm-err); }
      .gm-stat.q { color:var(--gm-dim); }
      .gm-fpath { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        font-family:${mono}; font-size:11.5px; }
      .gm-dir { color:var(--gm-dim); }
      .gm-act { opacity:0; transition:opacity .12s, transform .12s; flex:none; }
      .gm-file:hover .gm-act, .gm-file:focus-within .gm-act, .gm-branch:hover .gm-act { opacity:1; }
      .gm-act:hover { transform:scale(1.12); }
      @media (hover:none) { .gm-act { opacity:1; } }
      .gm-resolution { display:flex; flex-direction:column; gap:7px; padding:10px 12px 14px; }
      .gm-res-head { display:flex; align-items:center; gap:6px; color:var(--gm-blue); }
      .gm-res-title { font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
      .gm-res-path { font: 600 12px ui-monospace, SFMono-Regular, Menlo, monospace; color:var(--gm-fg);
        padding:2px 0; word-break:break-all; }
      .gm-res-note { font-size:11px; color:var(--gm-dim); line-height:1.6; }
      /* .gm-input 默认 flex:1 1 100px，在纵向 flex 里会被拉成 100px 高，这里压回去 */
      .gm-resolution .gm-input { flex:none; width:100%; height:28px; }
      .gm-res-code { margin-top:4px; border-radius:10px; background:var(--gm-blue-06);
        border:1px solid var(--gm-blue-12); padding:6px 0; overflow:auto; max-height:46vh; }
      .gm-res-line { display:flex; gap:8px; font: 11.5px/1.65 ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space:pre; padding:0 8px; }
      .gm-res-line .no { width:34px; text-align:right; color:var(--gm-dim); flex:none; user-select:none; }
      .gm-res-line .tx { color:var(--gm-fg); }
      .gm-conflict-bar { margin:9px 10px 2px; padding:6px 10px; border-radius:10px; font-size:11px; font-weight:600;
        color:var(--gm-err); background:color-mix(in srgb, var(--gm-err) 8%, transparent);
        border:1px solid color-mix(in srgb, var(--gm-err) 28%, transparent); }

      /* ---- graph --------------------------------------------------------- */
      .gm-graph { padding:6px 0 14px; font-family:${mono}; font-size:11.5px; line-height:20px; }
      .gm-grow { display:flex; align-items:center; gap:6px; min-height:20px; padding:0 10px; margin:0 6px;
        border-radius:9px; cursor:pointer; transition:background .12s; }
      .gm-grow:hover { background:var(--gm-blue-06); }
      .gm-grow.active { background:var(--gm-blue-12); box-shadow:inset 3px 0 0 var(--gm-blue); }
      .gm-glane { flex:none; overflow:hidden;
        -webkit-mask-image:linear-gradient(90deg, #000 88%, transparent 100%);
        mask-image:linear-gradient(90deg, #000 88%, transparent 100%); }
      .gm-glane line { stroke:var(--gm-blue); stroke-width:1.7; stroke-linecap:round; opacity:.78; }
      .gm-glane circle { fill:var(--gm-blue); stroke:var(--gm-card); stroke-width:1.5; }
      .gm-grow.active .gm-glane line, .gm-grow:hover .gm-glane line { opacity:1; }
      .gm-grow.active .gm-glane circle { stroke:var(--gm-base); stroke-width:2; }
      .gm-hash { flex:none; font-size:10.5px; color:var(--gm-blue); opacity:.75; }
      .gm-subject { flex:1 1 auto; min-width:56px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:inherit; }
      .gm-meta { flex:none; max-width:145px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        font-size:10.5px; color:var(--gm-dim); font-family:inherit; }
      .gm-ref { height:17px; max-width:120px; overflow:hidden; text-overflow:ellipsis; display:inline-block; }

      /* ---- branches ------------------------------------------------------ */
      .gm-branch { display:flex; align-items:center; gap:6px; min-height:30px; padding:3px 10px; margin:0 6px;
        border-radius:9px; transition:background .12s; }
      .gm-branch:hover { background:var(--gm-blue-06); }
      .gm-branch > svg { color:var(--gm-blue); opacity:.85; flex:none; }
      .gm-bname { flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        font-family:${mono}; font-size:11.5px; }
      .gm-bmeta { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        font-size:10.5px; color:var(--gm-dim); text-align:right; }

      /* ---- diff ---------------------------------------------------------- */
      .gm-diff { padding-bottom:18px; }
      .gm-diff-head { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:6px; padding:8px 12px;
        border-bottom:1px solid var(--gm-line);
        background:linear-gradient(135deg, color-mix(in srgb, var(--gm-blue) 9%, var(--gm-card)), var(--gm-card) 80%); }
      .gm-diff-title { font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase;
        color:var(--gm-blue); flex:none; }
      .gm-hunk { margin:9px 12px 3px; padding:3px 9px; border-radius:999px; background:var(--gm-blue-08);
        border:1px solid var(--gm-blue-18); display:inline-block; max-width:calc(100% - 24px);
        font-family:${mono}; font-size:10.5px; color:var(--gm-blue); white-space:pre-wrap; }
      .gm-dlines { font-family:${mono}; font-size:11.5px; line-height:1.62; margin:0 6px 6px; }
      .gm-dline { display:flex; align-items:baseline; white-space:pre-wrap; word-break:break-word; border-radius:4px; }
      /* 增删底色优先用平台自己的 diff 配色（--dsw-alias-file-diff-*），深浅色主题自动跟随；
         主题未注入时退回原来的 color-mix 兜底。 */
      .gm-dline.add { background:var(--dsw-alias-file-diff-added-bg, color-mix(in srgb, var(--gm-ok) 10%, transparent)); }
      .gm-dline.del { background:var(--dsw-alias-file-diff-deleted-bg, color-mix(in srgb, var(--gm-err) 10%, transparent)); }
      .gm-ln { width:38px; flex:none; text-align:right; padding-right:8px; color:var(--gm-dim);
        opacity:.6; user-select:none; font-variant-numeric:tabular-nums; border-radius:3px; }
      .gm-dline.add .gm-ln { background:var(--dsw-alias-file-diff-added-gutter, transparent); }
      .gm-dline.del .gm-ln { background:var(--dsw-alias-file-diff-deleted-gutter, transparent); }
      .gm-sign { width:14px; flex:none; text-align:center; font-weight:700; }
      .gm-dline.add .gm-sign { color:var(--dsw-alias-file-diff-added-marker, var(--gm-ok)); }
      .gm-dline.del .gm-sign { color:var(--dsw-alias-file-diff-deleted-marker, var(--gm-err)); }
      .gm-dtext { flex:1 1 auto; min-width:0; padding-right:10px; }
      /* 词级高亮：只有真正变化的 token 才加深底色，一眼看出「改了哪个词」。 */
      .gm-dword { border-radius:3px; padding:0 1px; }
      .gm-dword.add { background:color-mix(in srgb, var(--dsw-alias-file-diff-added-marker, var(--gm-ok)) 34%, transparent); }
      .gm-dword.del { background:color-mix(in srgb, var(--dsw-alias-file-diff-deleted-marker, var(--gm-err)) 34%, transparent); }
      .gm-meta-line { padding:2px 12px; color:var(--gm-dim); font-style:italic; }

      /* ---- commit card --------------------------------------------------- */
      .gm-commit { position:relative; flex:none; overflow:hidden; display:flex; flex-direction:column; gap:7px; margin:8px 10px 10px; padding:11px 10px 10px;
        border-radius:14px; border:1px solid var(--gm-blue-18);
        background:linear-gradient(180deg, color-mix(in srgb, var(--gm-blue) 6%, var(--gm-card)), var(--gm-card));
        box-shadow:0 8px 22px color-mix(in srgb, var(--gm-blue) 10%, transparent); }
      .gm-commit::before { content:''; position:absolute; top:0; left:0; right:0; height:3px;
        background:linear-gradient(90deg, var(--gm-cyan), var(--gm-blue) 45%, transparent 90%); }
      .gm-commit-head { display:flex; align-items:center; gap:6px; }
      .gm-prompt { display:flex; flex-direction:column; gap:5px; padding:8px; border-radius:10px;
        background:var(--gm-blue-06); border:1px solid var(--gm-blue-12); }
      .gm-prompt .gm-section { padding:0; }
      .gm-prompt-text { min-height:96px; max-height:180px; font-size:11px;
        font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .gm-commit-title { font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase;
        color:var(--gm-blue); }
      .gm-textarea { width:100%; min-height:46px; max-height:140px; padding:7px 9px; border-radius:10px;
        border:1px solid var(--gm-line); background:var(--gm-base); color:var(--gm-ink);
        font:inherit; font-size:12px; line-height:1.5; resize:vertical; transition:border-color .12s, box-shadow .12s; }
      .gm-textarea::placeholder, .gm-input::placeholder { color:var(--gm-dim); opacity:.7; }
      .gm-textarea:focus-visible { outline:none; border-color:var(--gm-blue-40);
        box-shadow:0 0 0 3px var(--gm-blue-12); }
      .gm-input { flex:1 1 100px; min-width:0; height:25px; padding:0 9px; border-radius:9px;
        border:1px solid var(--gm-line); background:var(--gm-base); color:var(--gm-ink);
        font:inherit; font-size:11.5px; transition:border-color .12s, box-shadow .12s; }
      .gm-input:focus-visible { outline:none; border-color:var(--gm-blue-40); box-shadow:0 0 0 3px var(--gm-blue-12); }
      .gm-actions { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
      .gm-hint { font-size:10.5px; color:var(--gm-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .gm-ai-line { font-size:10.5px; color:var(--gm-dim); }

      /* ---- status pill ---------------------------------------------------- */
      .gm-status { flex:none; display:flex; align-items:center; gap:6px; min-height:24px; padding:3px 11px;
        margin:7px 10px 0; border-radius:999px; border:1px solid var(--gm-blue-12); background:var(--gm-blue-06);
        font-size:11px; color:var(--gm-dim); animation:gm-pop .18s ease; }
      .gm-dot { width:6px; height:6px; border-radius:50%; background:var(--gm-blue); flex:none;
        box-shadow:0 0 0 3px var(--gm-blue-12); }
      .gm-dot.ok { background:var(--gm-ok); box-shadow:0 0 0 3px color-mix(in srgb, var(--gm-ok) 18%, transparent); }
      .gm-dot.err { background:var(--gm-err); box-shadow:0 0 0 3px color-mix(in srgb, var(--gm-err) 18%, transparent); }
      .gm-dot.busy { background:var(--gm-cyan); box-shadow:0 0 0 3px color-mix(in srgb, var(--gm-cyan) 22%, transparent);
        animation:gm-pulse 1.1s ease-in-out infinite; }
      .gm-status .gm-msg { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .gm-status .gm-msg.err { color:var(--gm-err); white-space:pre-wrap; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
      .gm-status .gm-msg.ok { color:var(--gm-ok); }
      .gm-details { flex:none; margin:7px 10px 0; }
      .gm-details > summary { list-style:none; }
      .gm-details > summary::-webkit-details-marker { display:none; }
      .gm-details[open] > summary { border-bottom-left-radius:10px; border-bottom-right-radius:10px; }
      .gm-pre { margin:0; padding:7px 12px; max-height:180px; overflow:auto; font-family:${mono}; font-size:11px;
        color:var(--gm-dim); white-space:pre-wrap; word-break:break-word;
        background:var(--gm-blue-04); border:1px solid var(--gm-blue-12); border-top:none;
        border-bottom-left-radius:12px; border-bottom-right-radius:12px; }

      /* ---- empty states + spinner ---------------------------------------- */
      .gm-empty { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; align-items:center;
        justify-content:center; gap:10px; padding:30px 22px; text-align:center; color:var(--gm-dim); }
      .gm-empty-bubble { position:relative; overflow:hidden; width:108px; height:108px; border-radius:36px; display:flex; align-items:center;
        justify-content:center; background:radial-gradient(circle at 35% 30%, var(--gm-blue-18), var(--gm-blue-04) 70%);
        border:1px solid var(--gm-blue-12); }
      .gm-empty-bubble::before, .gm-empty-bubble::after { content:''; position:absolute; border-radius:50%;
        background:var(--gm-blue-18); animation:gm-rise 3.2s ease-in infinite; }
      .gm-empty-bubble::before { width:6px; height:6px; left:22px; bottom:16px; }
      .gm-empty-bubble::after { width:4px; height:4px; left:78px; bottom:22px; animation-delay:1.4s; }
      .gm-empty-mascot { width:88px; height:88px; object-fit:contain; pointer-events:none;
        animation:gm-bob 3.2s ease-in-out infinite; filter:drop-shadow(0 8px 16px var(--gm-blue-28)); }
      .gm-empty-title { color:var(--gm-ink); font-size:13px; font-weight:650; }
      .gm-empty-hint { font-size:11.5px; line-height:1.6; max-width:280px; }
      .gm-spinner { width:18px; height:18px; border-radius:50%; border:2px solid var(--gm-blue-18);
        border-top-color:var(--gm-blue); animation:gm-spin .8s linear infinite; }

      /* ---- animations ----------------------------------------------------- */
      @keyframes gm-fade { from { opacity:0; } to { opacity:1; } }
      @keyframes gm-pop { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
      @keyframes gm-bob { 0%,100% { transform:translateY(0) rotate(-1.5deg); } 50% { transform:translateY(-6px) rotate(1.5deg); } }
      @keyframes gm-pulse { 50% { opacity:.35; } }
      @keyframes gm-shimmer { to { transform:translateX(100%); } }
      @keyframes gm-spin { to { transform:rotate(360deg); } }
      @keyframes gm-rise { 0% { transform:translateY(6px) scale(.7); opacity:0; } 30% { opacity:.8; }
        100% { transform:translateY(-42px) scale(1.15); opacity:0; } }

      /* ---- narrow column -------------------------------------------------- */
      @container gm (max-width: 430px) {
        .gm-top .gm-btn-label { display:none; }
        .gm-top .gm-btn { width:27px; padding:0; }
        .gm-repo { font-size:12.5px; }
        .gm-bmeta { display:none; }
        .gm-meta { display:none; }
        .gm-empty-bubble { width:86px; height:86px; border-radius:28px; }
      }
    `

    // The session header button lives outside the panel root, so it carries its own
    // tiny stylesheet (same tokens, same look as neighbouring header utilities).
    var HEADER_CSS = `
      .gm-header-btn { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; padding:0;
        border:1px solid transparent; border-radius:9px; background:transparent; cursor:pointer;
        transition:background .14s, transform .14s, box-shadow .14s; }
      .gm-header-btn:hover { background:color-mix(in srgb, #4d6bfe 14%, transparent); transform:translateY(-1px); }
      .gm-header-btn:hover svg { stroke:#4d6bfe !important; }
      .gm-header-btn:focus-visible { outline:2px solid color-mix(in srgb, #4d6bfe 45%, transparent); outline-offset:1px; }
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
    // Generated mascot: chibi Whale-chan (DeepSeek 鲸鱼娘), 224px webp, transparent.
    var WHALE_IMG = 'data:image/webp;base64,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'
    var MASCOT_IMG = 'data:image/webp;base64,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'

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
      trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 14h10l1-14', 'M10 11v6', 'M14 11v6'],
      gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'],
      stash: ['M4 5h16v4H4z', 'M6 9v10h12V9', 'M10 13h4'],
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

    /** Small brand glyph next to the repo name / commit card: the generated chubby whale. */
    function WhaleGlyph(props) {
      var size = props.size || 26
      return h('span', {
        className: 'gm-mark',
        style: { width: size + 'px', height: size + 'px', borderRadius: Math.round(size * 0.34) + 'px' },
      }, h('img', { src: WHALE_IMG, alt: '', draggable: false }))
    }

    function Spinner() {
      return h('span', { className: 'gm-spinner', role: 'status', 'aria-label': 'loading' })
    }

    /** Guide-page glyph: the generated Whale-chan mascot, sized by the registry's IconProps. */
    function WhaleChanIcon(props) {
      var size = props && props.size ? props.size : 16
      return h('img', {
        src: MASCOT_IMG, width: size, height: size, alt: '',
        style: { borderRadius: '4px', objectFit: 'contain', display: 'block' },
      })
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
        'aria-label': props.title || props.label || undefined,
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
        // 自定义 AI 提示词编辑态。promptDraft 是编辑中的草稿，
        // 只有点保存才写回 git config，避免边打字边写盘。
        promptOpen: false,
        promptDraft: '',
        stashMessage: '',
        // 冲突解决：resolution 非空时「差异」页切到解决视图。
        // suggested 为 null 表示还没生成，用户可以先选边或让 AI 生成。
        resolution: null,
        conflictHint: '',
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
      function setStashMessage(value) {
        set({ stashMessage: String(value || '') })
      }

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

      /**
       * 丢弃改动。分组的语义决定用哪个后端模式：
       *   unstaged → worktree（只回退工作区）
       *   untracked → untracked（删除文件）
       *   staged → all（连暂存区一起回退）
       * 三种都不可恢复，所以一律先 window.confirm。
       */
      async function discard(group, entry) {
        var cwd = store.get().cwd
        if (!cwd || !entry || !entry.path) return
        var mode = group === 'untracked' ? 'untracked' : group === 'staged' ? 'all' : 'worktree'
        var key = group === 'untracked'
          ? 'changes.discardUntrackedConfirm'
          : group === 'staged' ? 'changes.discardStagedConfirm' : 'changes.discardConfirm'
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (!window.confirm(tr(key, { path: entry.path }))) return
        }
        var result = await runBusy('discard', function () {
          return rpc('discard', { cwd: cwd, paths: [entry.path], mode: mode })
        })
        if (result !== null) {
          toast('ok', tr('status.discardOk', { path: entry.path }), result.output)
          set({ selected: null, diff: null })
          await refresh()
        }
      }

      async function stashSave() {
        var state = store.get()
        var cwd = state.cwd
        if (!cwd) return
        var params = { cwd: cwd }
        var message = String(state.stashMessage || '').trim()
        if (message !== '') params.message = message
        // 未跟踪文件默认不进 stash；有未跟踪改动时一并存起来，否则用户会以为「全存了」
        var status = state.snapshot && state.snapshot.status ? state.snapshot.status : null
        if (status && status.untracked && status.untracked.length > 0) params.includeUntracked = true
        var result = await runBusy('stash', function () { return rpc('stashPush', params) })
        if (result !== null) {
          set({ stashMessage: '' })
          toast('ok', tr('status.stashSaveOk'), result.output)
          await refresh()
        }
      }

      async function stashPop(index) {
        var cwd = store.get().cwd
        if (!cwd) return
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (!window.confirm(tr('stash.popConfirm', { n: index }))) return
        }
        var result = await runBusy('stash', function () { return rpc('stashPop', { cwd: cwd, index: index }) })
        if (result !== null) {
          toast('ok', tr('status.stashPopOk', { n: index }), result.output)
          await refresh()
        }
      }

      async function stashDrop(index) {
        var cwd = store.get().cwd
        if (!cwd) return
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          if (!window.confirm(tr('stash.dropConfirm', { n: index }))) return
        }
        var result = await runBusy('stash', function () { return rpc('stashDrop', { cwd: cwd, index: index }) })
        if (result !== null) {
          toast('ok', tr('status.stashDropOk', { n: index }), result.output)
          await refresh()
        }
      }

      function openPrompt() {
        var snapshot = store.get().snapshot
        set({ promptOpen: true, promptDraft: snapshot && snapshot.commitPrompt ? snapshot.commitPrompt : '' })
      }

      function closePrompt() {
        set({ promptOpen: false, promptDraft: '' })
      }

      function setPromptDraft(value) {
        set({ promptDraft: String(value || '') })
      }

      async function savePrompt() {
        var state = store.get()
        var cwd = state.cwd
        if (!cwd) return
        var result = await runBusy('prompt', function () {
          return rpc('setCommitPrompt', { cwd: cwd, prompt: String(state.promptDraft || '') })
        })
        if (result !== null) {
          set({ promptOpen: false, promptDraft: '' })
          toast('ok', tr('status.promptSaved'))
          await refresh()
        }
      }

      async function resetPrompt() {
        var cwd = store.get().cwd
        if (!cwd) return
        var result = await runBusy('prompt', function () {
          return rpc('setCommitPrompt', { cwd: cwd, prompt: '' })
        })
        if (result !== null) {
          set({ promptOpen: false, promptDraft: '' })
          toast('ok', tr('status.promptReset'))
          await refresh()
        }
      }

      // ------------------------------------------------------------ 冲突解决

      function openResolution(entry) {
        if (!entry || !entry.path) return
        set({
          resolution: { path: entry.path, suggested: null, model: null, loading: false, hasBase: true },
          conflictHint: '',
          activeTab: 'diff',
          selected: { kind: 'file', group: 'conflicted', path: entry.path },
        })
      }

      function closeResolution() {
        set({ resolution: null, conflictHint: '' })
      }

      function setConflictHint(value) {
        set({ conflictHint: String(value || '') })
      }

      async function aiResolve() {
        var state = store.get()
        var resolution = state.resolution
        if (!state.cwd || !resolution || resolution.loading) return
        set({ resolution: { path: resolution.path, suggested: resolution.suggested, model: resolution.model, loading: true, hasBase: resolution.hasBase } })
        var result = await runBusy('aiConflict', function () {
          return rpc('aiConflict', { cwd: state.cwd, path: resolution.path, hint: String(state.conflictHint || '').trim() })
        })
        if (result !== null) {
          set({ resolution: { path: resolution.path, suggested: result.suggested, model: result.model, loading: false, hasBase: result.hasBase } })
        } else {
          set({ resolution: { path: resolution.path, suggested: resolution.suggested, model: resolution.model, loading: false, hasBase: resolution.hasBase } })
        }
      }

      async function applyResolution() {
        var state = store.get()
        var resolution = state.resolution
        if (!state.cwd || !resolution || !resolution.suggested) return
        var result = await runBusy('applyConflict', function () {
          return rpc('applyConflict', { cwd: state.cwd, path: resolution.path, content: resolution.suggested })
        })
        if (result !== null) {
          set({ resolution: null, conflictHint: '' })
          toast('ok', result.unmerged === 0 ? tr('status.resolveAllOk') : tr('status.conflictApplied'), result.output)
          await refresh()
        }
      }

      async function takeConflictSide(side) {
        var state = store.get()
        var resolution = state.resolution
        if (!state.cwd || !resolution) return
        var result = await runBusy('takeSide', function () {
          return rpc('takeSide', { cwd: state.cwd, path: resolution.path, side: side })
        })
        if (result !== null) {
          set({ resolution: null, conflictHint: '' })
          var label = side === 'ours' ? tr('status.takeOursOk') : tr('status.takeTheirsOk')
          toast('ok', result.unmerged === 0 ? tr('status.resolveAllOk') : label, result.output)
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
        discard: discard,
        stashSave: stashSave,
        stashPop: stashPop,
        stashDrop: stashDrop,
        setStashMessage: setStashMessage,
        openPrompt: openPrompt,
        closePrompt: closePrompt,
        setPromptDraft: setPromptDraft,
        savePrompt: savePrompt,
        resetPrompt: resetPrompt,
        openResolution: openResolution,
        closeResolution: closeResolution,
        setConflictHint: setConflictHint,
        aiResolve: aiResolve,
        applyResolution: applyResolution,
        takeConflictSide: takeConflictSide,
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
        props.spinner
          ? h(Spinner)
          : props.icon
            ? h(Icon, { name: props.icon, size: props.iconSize || 22 })
            : h('div', { className: 'gm-empty-bubble' },
              h('img', { className: 'gm-empty-mascot', src: MASCOT_IMG, alt: '', draggable: false })),
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
            h('span', { className: 'gm-row', style: { gap: '2px' } },
              // 冲突文件不给「暂存」：git add 会把带 <<<<<<< 的文件直接标记为已解决。
              // 唯一入口是「解决」，由 applyConflict / takeSide 负责清掉冲突标记。
              props.group === 'conflicted'
                ? h('button', {
                  type: 'button',
                  className: 'gm-btn icon sm ghost gm-act',
                  title: tr('conflict.resolve'),
                  onClick: function (event) {
                    event.stopPropagation()
                    props.onResolve(entry)
                  },
                }, h(Icon, { name: 'ai', size: 12 }))
                : h('button', {
                  type: 'button',
                  className: 'gm-btn icon sm ghost gm-act',
                  title: staged ? tr('changes.unstage') : tr('changes.stage'),
                  onClick: function (event) {
                    event.stopPropagation()
                    if (staged) props.onUnstage(entry)
                    else props.onStage(entry)
                  },
                }, h(Icon, { name: staged ? 'minus' : 'plus', size: 12 })),
              // 冲突文件不给「丢弃」：那等于放弃冲突解决状态，语义上容易误伤
              props.onDiscard && props.group !== 'conflicted'
                ? h('button', {
                  type: 'button',
                  className: 'gm-btn icon sm ghost gm-act',
                  title: props.group === 'untracked' ? tr('changes.discardUntracked') : tr('changes.discard'),
                  onClick: function (event) {
                    event.stopPropagation()
                    props.onDiscard(entry)
                  },
                }, h(Icon, { name: 'trash', size: 12 }))
                : null))
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
          onDiscard: function (entry) { props.actions.discard(group, entry) },
          onResolve: function (entry) { props.actions.openResolution(entry) },
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
            ? h(EmptyState, { title: tr('changes.empty'), hint: tr('changes.emptyHint') })
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
        state.promptOpen
          ? h('div', { className: 'gm-prompt' },
            h('div', { className: 'gm-section' },
              h('span', null, tr('commit.promptTitle')),
              h('span', { className: 'gm-spacer' }),
              h('button', {
                type: 'button',
                className: 'gm-btn icon sm ghost',
                title: tr('commit.promptCancel'),
                onClick: props.onClosePrompt,
              }, h(Icon, { name: 'close', size: 12 }))),
            h('textarea', {
              className: 'gm-textarea gm-prompt-text',
              value: state.promptDraft,
              placeholder: tr('commit.promptHint'),
              onChange: function (event) { props.onPromptDraft(event.target.value) },
            }),
            h('div', { className: 'gm-hint' }, tr('commit.promptHint')),
            h('div', { className: 'gm-actions' },
              h(Btn, { label: tr('commit.promptReset'), small: true, ghost: true, disabled: !!busy, onClick: props.onResetPrompt }),
              h('span', { className: 'gm-spacer' }),
              h(Btn, { label: tr('commit.promptSave'), small: true, variant: 'primary', disabled: !!busy, onClick: props.onSavePrompt })))
          : null,
        h('div', { className: 'gm-commit-head' },
          h(WhaleGlyph, { size: 22 }),
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
            className: busy === 'ai' ? 'gm-ai-busy' : undefined,
            disabled: !!busy || !state.cwd,
            onClick: props.onGenerate,
          }),
          h(Btn, {
            icon: 'gear',
            title: tr('commit.prompt'),
            disabled: !!busy || !state.cwd,
            onClick: props.onOpenPrompt,
          })),
        h('div', { className: 'gm-actions' },
          state.snapshot && state.snapshot.commitPrompt
            ? h('span', { className: 'gm-badge brand', title: state.snapshot.commitPrompt }, tr('commit.promptCustom'))
            : null,
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
            branch.name + (branch.ahead ? '  ↑' + branch.ahead : '') + (branch.behind ? '  ↓' + branch.behind : ''))
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
            h(WhaleGlyph, { size: 28 }),
            h('span', { className: 'gm-repo' }, tr('panel.title'))))
      }
      return h('div', { className: 'gm-top' },
        h('div', { className: 'gm-row' },
          h(WhaleGlyph, { size: 28 }),
          h('span', { className: 'gm-repo', title: repo.root }, repo.name || tr('panel.title')),
          h('span', { className: 'gm-repo-dot' }),
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
      if (state.graphLoading && lines.length === 0) return h(EmptyState, { spinner: true, title: tr('status.loading') })
      if (lines.length === 0) return h(EmptyState, { title: tr('graph.empty') })
      // A stable graph column keeps hash/refs/subject aligned across rows. Histories with
      // dozens of live lanes would otherwise push the text miles to the right, so the
      // column is capped and the overflowing lanes fade out instead.
      var GRAPH_MAX_COLS = 10
      var maxPrefix = 2
      for (var gi = 0; gi < lines.length; gi += 1) {
        if ((lines[gi].graph || '').length > maxPrefix) maxPrefix = (lines[gi].graph || '').length
      }
      var graphCols = Math.min(maxPrefix, GRAPH_MAX_COLS)
      return h('div', { className: 'gm-scroll' },
        h('div', { className: 'gm-content-inner gm-graph' },
          lines.map(function (line, index) {
            if (!line.full) {
              return h('div', { key: 'g:' + index, className: 'gm-grow' },
                h(GraphLane, {
                  graph: line.graph || '',
                  prev: index > 0 ? (lines[index - 1].graph || '') : '',
                  next: index + 1 < lines.length ? (lines[index + 1].graph || '') : '',
                  cols: graphCols,
                  colors: line.colors || [],
                }))
            }
            var selected = state.selected && state.selected.kind === 'commit' && state.selected.hash === line.full
            return h('div', {
              key: 'c:' + line.full + ':' + index,
              className: 'gm-grow' + (selected ? ' active' : ''),
              title: line.full,
              onClick: function () { props.onSelectCommit(line) },
            },
              h(GraphLane, {
                graph: line.graph || '',
                prev: index > 0 ? (lines[index - 1].graph || '') : '',
                next: index + 1 < lines.length ? (lines[index + 1].graph || '') : '',
                cols: graphCols,
                colors: line.colors || [],
              }),
              h('span', { className: 'gm-hash' }, line.hash),
              line.refs && line.refs.length > 0
                ? h('span', { className: 'gm-row', style: { gap: '4px', flex: 'none' } }, line.refs.map(function (ref, refIndex) {
                  var isHead = ref.indexOf('HEAD') === 0
                  // HEAD 用渐变主色强调；其余 ref 用分支自己的 lane 色，和左侧线条同色。
                  return h('span', {
                    key: 'r:' + refIndex,
                    className: 'gm-badge gm-ref' + (isHead ? ' brand' : ''),
                    style: isHead ? undefined : {
                      color: 'var(--gm-lane-' + (line.refColor !== undefined ? line.refColor : 0) + ')',
                      borderColor: 'color-mix(in srgb, var(--gm-lane-' + (line.refColor !== undefined ? line.refColor : 0) + ') 42%, transparent)',
                      background: 'color-mix(in srgb, var(--gm-lane-' + (line.refColor !== undefined ? line.refColor : 0) + ') 12%, transparent)',
                    },
                  }, ref)
                }))
                : null,
              h('span', { className: 'gm-subject' }, line.subject),
              h('span', { className: 'gm-meta' }, line.author + ' · ' + line.date))
          })))
    }

    var GRAPH_CELL = 8
    var GRAPH_ROW = 20

    function laneChar(text, lane) {
      return lane >= 0 && lane < text.length ? text[lane] : ' '
    }

    /** Does lane `lane` continue into this row from the row above? */
    function laneFromAbove(prev, lane) {
      var here = laneChar(prev, lane)
      if (here === '|' || here === '*') return true
      if (laneChar(prev, lane + 1) === '/') return true
      if (here === '\\') return true
      return false
    }

    /** Does lane `lane` continue into the next row? */
    function laneToBelow(next, lane) {
      var here = laneChar(next, lane)
      if (here === '|' || here === '*') return true
      if (here === '/') return true
      if (laneChar(next, lane + 1) === '\\') return true
      return false
    }

    /**
     * Draws one row of the commit graph as vector lanes, so vertical lines stay
     * continuous across rows (ASCII glyphs leave gaps at 20px row heights).
     */
    /** lane 色号 → CSS 变量名；-1（该格无连接）返回 undefined 让样式回退。 */
    function laneVar(color) {
      if (color === undefined || color === null || color < 0) return undefined
      return 'var(--gm-lane-' + color + ')'
    }

    function GraphLane(props) {
      var graph = props.graph || ''
      var prev = props.prev || ''
      var next = props.next || ''
      var cols = props.cols
      var cell = GRAPH_CELL
      var row = GRAPH_ROW
      var colors = props.colors || []
      var parts = []
      for (var i = 0; i < cols; i += 1) {
        var ch = laneChar(graph, i)
        var cx = (i + 0.5) * cell
        // 同一条分支线跨行保持同色：颜色由 Host 端 assignGraphColors 沿线段流动算出。
        var stroke = { stroke: laneVar(colors[i]) }
        if (ch === '|') {
          parts.push(h('line', { key: 'v' + i, x1: cx, y1: 0, x2: cx, y2: row, style: stroke }))
        } else if (ch === '/') {
          parts.push(h('line', { key: 's' + i, x1: cx, y1: 0, x2: cx - cell, y2: row, style: stroke }))
        } else if (ch === '\\') {
          parts.push(h('line', { key: 'b' + i, x1: cx - cell, y1: 0, x2: cx, y2: row, style: stroke }))
        } else if (ch === '_') {
          parts.push(h('line', { key: 'h' + i, x1: cx, y1: row - 1, x2: cx + cell, y2: row - 1, style: stroke }))
        } else if (ch === '*') {
          if (laneFromAbove(prev, i)) parts.push(h('line', { key: 'u' + i, x1: cx, y1: 0, x2: cx, y2: row / 2, style: stroke }))
          if (laneToBelow(next, i)) parts.push(h('line', { key: 'd' + i, x1: cx, y1: row / 2, x2: cx, y2: row, style: stroke }))
          parts.push(h('circle', { key: 'c' + i, cx: cx, cy: row / 2, r: 3.4,
            style: { fill: laneVar(colors[i]) } }))
        }
      }
      return h('svg', {
        className: 'gm-glane', width: cols * cell, height: row,
        viewBox: '0 0 ' + (cols * cell) + ' ' + row, 'aria-hidden': 'true',
      }, parts)
    }

    /**
     * 渲染一行的文本部分；Host 在解析 diff 时已算好词级片段（line.inline），
     * 有就只把变化的片段包成 span，没有就退回整段纯文本。
     */
    function inlineSpans(line) {
      if (!line.inline || line.inline.length === 0) return line.text
      return line.inline.map(function (part, index) {
        if (!part.changed) return part.text
        return h('span', { key: 'i:' + index, className: 'gm-dword' + (line.kind === 'del' ? ' del' : ' add') }, part.text)
      })
    }

    /**
     * 冲突解决视图。
     * 生成阶段完全不碰磁盘，只有点「应用」才写文件 —— 模型给错了最多白看一次。
     */
    function ResolutionView(props) {
      var state = props.state
      var resolution = state.resolution
      var busy = !!state.busy
      var suggested = resolution.suggested
      var lines = suggested ? suggested.replace(/\n$/, '').split('\n') : []
      var visible = lines.slice(0, 400)
      var actions = props.actions
      return h('div', { className: 'gm-scroll' },
        h('div', { className: 'gm-content-inner gm-resolution' },
          h('div', { className: 'gm-res-head' },
            h(Icon, { name: 'ai', size: 14 }),
            h('span', { className: 'gm-res-title' }, tr('conflict.title')),
            h('span', { className: 'gm-spacer' }),
            h('button', {
              type: 'button',
              className: 'gm-btn icon sm ghost',
              title: tr('conflict.discard'),
              onClick: function () { actions.closeResolution() },
            }, h(Icon, { name: 'close', size: 12 }))),
          h('div', { className: 'gm-res-path' }, resolution.path),
          resolution.loading
            ? h('div', { className: 'gm-res-note' }, tr('conflict.generating'))
            : suggested
              ? h('div', { className: 'gm-res-note' },
                tr('conflict.preview'),
                resolution.model ? ' · ' + tr('conflict.model', { model: resolution.model }) : '')
              : h('div', { className: 'gm-res-note' }, tr('conflict.empty')),
          h('input', {
            className: 'gm-input',
            value: state.conflictHint,
            placeholder: tr('conflict.hintPlaceholder'),
            disabled: busy,
            onChange: function (event) { actions.setConflictHint(event.target.value) },
            onKeyDown: function (event) { if (event.key === 'Enter') actions.aiResolve() },
          }),
          h('div', { className: 'gm-actions' },
            h(Btn, {
              icon: 'ai',
              label: suggested ? tr('conflict.regenerate') : tr('conflict.ai'),
              small: true,
              variant: 'primary',
              disabled: busy || resolution.loading,
              onClick: actions.aiResolve,
            }),
            h(Btn, {
              label: tr('conflict.takeOurs'),
              small: true,
              disabled: busy || resolution.loading,
              onClick: function () { actions.takeConflictSide('ours') },
            }),
            h(Btn, {
              label: tr('conflict.takeTheirs'),
              small: true,
              disabled: busy || resolution.loading,
              onClick: function () { actions.takeConflictSide('theirs') },
            })),
          suggested
            ? h('div', { className: 'gm-actions' },
              h(Btn, { label: tr('conflict.apply'), small: true, variant: 'primary', disabled: busy, onClick: actions.applyResolution }),
              h(Btn, { label: tr('conflict.discard'), small: true, ghost: true, disabled: busy, onClick: function () { actions.closeResolution() } }))
            : null,
          suggested
            ? h('div', { className: 'gm-res-code' }, visible.map(function (line, index) {
              return h('div', { key: 'rl:' + index, className: 'gm-res-line' },
                h('span', { className: 'no' }, String(index + 1)),
                h('span', { className: 'tx' }, line === '' ? ' ' : line))
            }))
            : null,
          suggested && lines.length > visible.length
            ? h('div', { className: 'gm-res-note' }, tr('diff.truncated'))
            : null))
    }

    function DiffView(props) {
      var state = props.state
      // 解决视图优先：它是「差异」页的一个特殊态，不额外占一个 tab。
      if (state.resolution) return h(ResolutionView, { state: state, actions: props.actions })
      var diff = state.diff
      if (state.diffLoading) return h(EmptyState, { spinner: true, title: tr('status.loading') })
      if (!diff) return h(EmptyState, { title: tr('diff.empty') })
      var title = diff.conflict
        ? tr('diff.conflict')
        : diff.mode === 'commit'
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
            diff.truncated ? h('span', { className: 'gm-badge warn' }, tr('diff.truncatedShort')) : null,
            diff.conflict
              ? h(Btn, {
                label: tr('conflict.resolve'),
                icon: 'ai',
                small: true,
                variant: 'primary',
                onClick: function () { props.actions.openResolution({ path: diff.path }) },
              })
              : null),
          diff.conflict && (!diff.oursExists || !diff.theirsExists)
            ? h(EmptyState, { title: tr('diff.conflictDeleted'), hint: tr('diff.conflictDeletedHint') })
            : diff.binary
              ? h(EmptyState, { title: tr('diff.binary') })
              : diff.hunks.length === 0
                ? h(EmptyState, { title: diff.conflict ? tr('diff.conflictSame') : tr('diff.noText') })
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
                      h('span', { className: 'gm-dtext' }, inlineSpans(line)))
                  })))
              })))
    }

    function BranchesView(props) {
      var state = props.state
      var branches = state.snapshot && state.snapshot.branches ? state.snapshot.branches : []
      var locals = branches.filter(function (branch) { return branch.kind === 'local' })
      var remotes = branches.filter(function (branch) { return branch.kind === 'remote' })
      var stashes = state.snapshot && state.snapshot.stashes ? state.snapshot.stashes : []
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
      // stash 放在分支页：它和分支一样是「当前工作放哪儿」的操作，
      // 而不是某次提交的内容。后端 snapshot 早就解析了 stashes，这里才真正用上。
      function stashSection() {
        return h('div', null,
          h('div', { className: 'gm-section' },
            h('span', null, tr('stash.title')),
            h('span', { className: 'gm-section-count' }, String(stashes.length))),
          h('div', { className: 'gm-row', style: { padding: '0 10px 6px' } },
            h('input', {
              className: 'gm-input',
              value: state.stashMessage,
              placeholder: tr('stash.placeholder'),
              onChange: function (event) { props.onStashMessage(event.target.value) },
              onKeyDown: function (event) { if (event.key === 'Enter') props.onStashSave() },
            }),
            h(Btn, { label: tr('stash.save'), small: true, disabled: !!state.busy, onClick: props.onStashSave })),
          stashes.length === 0
            ? h('div', { className: 'gm-hint', style: { padding: '0 12px 8px' } }, tr('stash.empty'))
            : stashes.map(function (item) {
              return h('div', { key: 'stash:' + item.index, className: 'gm-branch' },
                h(Icon, { name: 'stash', size: 12 }),
                h('span', { className: 'gm-badge' }, 'stash@{' + item.index + '}'),
                h('span', { className: 'gm-bmeta' }, item.message || ''),
                h('span', { className: 'gm-row gm-act', style: { gap: '4px', flex: 'none' } },
                  h(Btn, { label: tr('stash.pop'), small: true, disabled: !!state.busy, onClick: function () { props.onStashPop(item.index) } }),
                  h(Btn, { label: tr('stash.drop'), small: true, ghost: true, disabled: !!state.busy, onClick: function () { props.onStashDrop(item.index) } })))
            }))
      }
      return h('div', { className: 'gm-scroll' },
        h('div', { className: 'gm-content-inner' },
          group(tr('branch.local'), locals, true),
          group(tr('branch.remote'), remotes, false),
          locals.length === 0 && remotes.length === 0
            ? h(EmptyState, { title: tr('branch.empty') })
            : null,
          stashSection()))
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
      else if (state.activeTab === 'branches') content = h(BranchesView, {
        state: state,
        onSwitch: props.actions.switchBranch,
        onDelete: props.actions.deleteBranch,
        onStashSave: props.actions.stashSave,
        onStashPop: props.actions.stashPop,
        onStashDrop: props.actions.stashDrop,
        onStashMessage: props.actions.setStashMessage,
      })
      else content = h(DiffView, { state: state, actions: props.actions })
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
            onOpenPrompt: props.actions.openPrompt,
            onClosePrompt: props.actions.closePrompt,
            onPromptDraft: props.actions.setPromptDraft,
            onSavePrompt: props.actions.savePrompt,
            onResetPrompt: props.actions.resetPrompt,
          })
          : null)
    }

    function EmptyPanel(props) {
      return h('div', { className: 'gm-root' },
        panelStyle(),
        h('div', { className: 'gm-top' },
          h('div', { className: 'gm-row' },
            h(WhaleGlyph, { size: 28 }),
            h('span', { className: 'gm-repo' }, tr('panel.title')))),
        props.spinner
          ? h(EmptyState, { spinner: true, title: props.title, hint: props.hint })
          : h(EmptyState, { title: props.title, hint: props.hint, whaleSize: 86 }))
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

      if (!summary) return h(EmptyPanel, { title: tr('status.noSession'), hint: tr('panel.guide') })
      if (!cwd) return h(EmptyPanel, { title: tr('status.noCwd') })
      var repo = state.snapshot && state.snapshot.repo ? state.snapshot.repo : null
      if (state.error && state.errorCode === 'cwd-unavailable') {
        return h(EmptyPanel, { title: tr('status.cwdUnavailable', { path: cwd }) })
      }
      if (state.error && (!state.snapshot || (repo && repo.isRepo === false))) {
        return h(EmptyPanel, { title: tr('status.error', { message: state.error }) })
      }
      if (state.snapshot && repo && repo.isRepo === false) {
        return h(EmptyPanel, { title: tr('status.notRepoTitle'), hint: cwd })
      }
      if (!state.snapshot && state.loading) return h(EmptyPanel, { spinner: true, title: tr('status.loading') })
      return h(TabbedPanel, { state: state, actions: controller })
    }

    function GitIcon(props) {
      var size = props.size || 16
      var color = props.active ? '#2f49d6' : '#4d6bfe'
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
            icon: WhaleChanIcon,
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
