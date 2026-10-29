/**
 * Demo 假宿主：让真实的 lib/client.js 在一个普通网页里跑起来。
 *
 * 关键取舍——**不重写 UI**。这里只补齐 client.js 依赖的宿主能力：
 *   - window.__ModuleLoader__  : 模块加载器（client.js 用它注册自己）
 *   - React                    : 从 CDN 取，和宿主用同一个版本
 *   - ctx.slots / locale / sessions / sidebarRight / sidebarRightTabs / effect
 *   - fetch('/api/git-manager') : 用预录的 fixture 应答，不连后端
 *
 * 因此 Demo 里渲染的就是 npm 上那份 client.js，不存在「Demo 一套、插件另一套」。
 */

/** 把 client.js 的 require('react') 指向全局 React。 */
window.__ModuleLoader__ = {
  registry: {},
  load: function (entry) {
    var exports = entry.factory(function (id) {
      if (id === 'react') return window.React
      throw new Error('Demo 宿主未提供模块：' + id)
    })
    this.registry[entry.id] = exports
    if (typeof this.onload === 'function') this.onload(entry.id, exports)
  },
}

/** 极简事件订阅器，模拟宿主的响应式 store。 */
function createEmitter(initial) {
  var value = initial
  var listeners = []
  return {
    getSnapshot: function () { return value },
    subscribe: function (listener) {
      listeners.push(listener)
      return function () {
        listeners = listeners.filter(function (item) { return item !== listener })
      }
    },
    set: function (next) {
      value = next
      for (var index = 0; index < listeners.length; index += 1) listeners[index](value)
    },
  }
}

/** 假 ctx：只实现 client.js 真正用到的那几个方法。 */
function createFakeContext(demo) {
  var disposers = []
  var localeStore = {}
  var slots = {}
  var tabs = []
  var effects = []

  var ctx = {
    effect: function (fn, label) {
      var dispose = fn()
      effects.push({ label: label, dispose: dispose })
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },

    locale: {
      register: function (namespace, dictionaries) {
        localeStore[namespace] = dictionaries
        return function () { delete localeStore[namespace] }
      },
      bind: function (namespace) {
        return function (key, params) {
          var dict = localeStore[namespace] || {}
          var table = dict[demo.locale] || dict.zh || {}
          var text = table[key]
          if (text === undefined) text = key
          if (!params) return text
          return String(text).replace(/\{(\w+)\}/g, function (match, name) {
            return params[name] === undefined ? match : String(params[name])
          })
        }
      },
    },

    slots: {
      inject: function (name, register) {
        var dispose = register()
        slots[name] = slots[name] || []
        return function () {
          if (typeof dispose === 'function') dispose()
        }
      },
      register: function (definition, component) {
        var list = slots[definition.name] = slots[definition.name] || []
        var entry = { definition: definition, component: component }
        list.push(entry)
        return function () {
          slots[definition.name] = list.filter(function (item) { return item !== entry })
        }
      },
      /** Demo 专用：取出注册到某个 slot 的组件。 */
      __lookup: function (name, key) {
        var list = slots[name] || []
        for (var index = 0; index < list.length; index += 1) {
          var definition = list[index].definition
          if (key === undefined || definition.key === key || definition.id === key) return list[index].component
        }
        return null
      },
    },

    sessions: {
      list: createEmitter({
        byId: {
          'demo-session': {
            id: 'demo-session',
            cwd: demo.cwd,
            title: demo.sessionTitle,
          },
        },
      }),
    },

    sidebarRight: {
      openTab: function (kind) {
        if (typeof demo.onOpenTab === 'function') demo.onOpenTab(kind)
      },
    },

    sidebarRightTabs: {
      register: function (definition) {
        tabs.push(definition)
        return function () {
          tabs = tabs.filter(function (item) { return item !== definition })
        }
      },
      __all: function () { return tabs },
    },
  }

  return ctx
}

/**
 * 用 fixture 应答 /api/git-manager。
 *
 * 只读 op（snapshot / graph / diff）直接返回预录数据；
 * 写操作在 Demo 里不落盘，统一返回「演示模式」提示，避免误导。
 */
function createFakeFetch(fixtures) {
  return function fakeFetch(url, options) {
    if (String(url).indexOf('/api/git-manager') < 0) {
      return Promise.reject(new Error('Demo 只实现了 /api/git-manager'))
    }
    var body = {}
    try {
      body = JSON.parse(options && options.body ? options.body : '{}')
    } catch (error) {
      body = {}
    }
    var payload = resolveOp(fixtures, body)
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function () { return Promise.resolve(payload) },
      text: function () { return Promise.resolve(JSON.stringify(payload)) },
    })
  }
}

function ok(data) {
  return { ok: true, data: data }
}

function fail(code, message) {
  return { ok: false, error: { code: code, message: message } }
}

function resolveOp(fixtures, body) {
  var op = body.op
  if (op === 'snapshot') return ok(fixtures.snapshot)
  if (op === 'graph') return ok(fixtures.graph)
  if (op === 'diff') {
    if (body.mode === 'commit') {
      // 面板传的是 40 位完整 hash，fixture 按短 hash 存，这里按前缀匹配。
      var wanted = String(body.hash || '')
      var short = Object.keys(fixtures.commitDiffs).find(function (key) {
        return wanted === key || wanted.indexOf(key) === 0
      })
      var commit = short ? fixtures.commitDiffs[short] : null
      return commit ? ok(commit) : fail('git-failed', '演示数据里没有这个提交')
    }
    var key = body.mode + ':' + body.path
    var diff = fixtures.diffs[key]
    return diff ? ok(diff) : fail('git-failed', '演示数据里没有这份 diff')
  }
  // 冲突解决：这两个 op 不写盘，所以 Demo 里可以真的走一遍「生成 → 预览」。
  // 数据来自 fixtures.conflicts（录制快照），applyConflict / takeSide 仍然拒绝。
  if (op === 'conflictInfo' || op === 'aiConflict') {
    var record = fixtures.conflicts && fixtures.conflicts[body.path]
    if (!record) return fail('git-failed', '演示数据里没有这个冲突文件')
    if (op === 'conflictInfo') {
      return ok({
        path: record.path,
        branch: record.branch,
        incoming: record.incoming,
        hasBase: record.hasBase,
        oursExists: record.oursExists,
        theirsExists: record.theirsExists,
        ours: record.ours,
        theirs: record.theirs,
        base: record.base
      })
    }
    // 新协议多了「删除」这一种解决结果：record.delete 为真时没有 suggested。
    return ok({
      path: record.path,
      suggested: record.delete ? null : record.suggested,
      delete: Boolean(record.delete),
      deterministic: Boolean(record.deterministic),
      model: record.model,
      hasBase: record.hasBase,
      oursExists: record.oursExists !== false,
      theirsExists: record.theirsExists !== false
    })
  }
  // pull：演示「无上游 → 选远端分支 → 建立跟踪」的交互。
  // 不传 remote/branch 时模拟真实的 no tracking 失败，触发面板的拉取选项；
  // 传了就假装拉取成功（只读演示，不联网）。
  if (op === 'pull') {
    if (!body.remote && !body.branch) {
      return fail('git-failed', 'There is no tracking information for the current branch.\nPlease specify which branch you want to rebase against.')
    }
    return ok({
      branch: fixtures.snapshot.repo.branch,
      output: '演示：已从 ' + String(body.remote || 'origin') + '/' + String(body.branch || '') + ' 拉取（只读演示，未联网）'
    })
  }
  // 写操作：Demo 里不真的改仓库，明确告知而不是假装成功。
  // 文案要短：这条提示渲染在面板底部那一行状态条里，太长会被截断。
  return fail('demo-readonly', '演示模式为只读快照，写操作请本地安装后体验')
}

/** 启动：等 client.js 注册完，取出面板组件并渲染。 */
window.startGitDemo = function startGitDemo(options) {
  var demo = {
    locale: options.locale || 'zh',
    cwd: options.cwd,
    sessionTitle: options.sessionTitle || 'demo',
    onOpenTab: options.onOpenTab,
  }

  var ctx = createFakeContext(demo)
  window.fetch = createFakeFetch(options.fixtures)

  var exports = window.__ModuleLoader__.registry['@caozeal/dsh-next-git']
  if (!exports) throw new Error('client.js 还没注册')
  exports.apply(ctx)

  var Panel = ctx.slots.__lookup('sidebar.right.pane.tab', 'git-manager')
  if (!Panel) throw new Error('没有找到 git-manager 面板组件')

  return {
    ctx: ctx,
    Panel: Panel,
    headerButton: ctx.slots.__lookup('conversation.session.header.utilities', 'git-manager'),
    tabs: ctx.sidebarRightTabs.__all(),
    setLocale: function (locale) {
      demo.locale = locale
    },
  }
}