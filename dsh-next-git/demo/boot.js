/**
 * Demo 启动脚本：加载 fixture → 启动假宿主 → 渲染真实面板。
 *
 * 刻意不 import 任何东西：Demo 要能直接打开，所以全部走 <script> 顺序加载 + 全局变量。
 */
(function () {
  var root = document.getElementById('panel-root')
  var localeButton = document.getElementById('toggle-locale')
  var fixtures = null
  var demo = null
  var locale = 'zh'

  function fail(message) {
    root.innerHTML = '<div class="demo-fallback">Demo 启动失败：' + message
      + '<br />请确认 <code>demo/fixtures.json</code> 存在，且通过 HTTP 打开本页'
      + '（<code>file://</code> 下浏览器会拦 fetch）。</div>'
  }

  function render() {
    window.ReactDOM.render(
      window.React.createElement(demo.Panel, { sessionId: 'demo-session' }),
      root,
    )
  }

  function start() {
    demo = window.startGitDemo({
      fixtures: fixtures,
      cwd: fixtures.snapshot.repo.root,
      sessionTitle: 'whale-notes',
      locale: locale,
    })
    render()
  }

  fetch('./fixtures.json')
    .then(function (response) {
      if (!response.ok) throw new Error('fixtures.json HTTP ' + response.status)
      return response.json()
    })
    .then(function (loaded) {
      fixtures = loaded
      start()
    })
    .catch(function (error) {
      fail(error && error.message ? error.message : String(error))
    })

  localeButton.addEventListener('click', function () {
    if (!demo) return
    locale = locale === 'zh' ? 'en' : 'zh'
    localeButton.textContent = locale === 'zh' ? 'English' : '中文'
    // 字典在 apply 时注册，切语言要重新 apply 一遍（模块本身已缓存，不会重复加载）。
    // 必须先让 React 自己卸载，不能手动清 DOM：ReactDOM.render 会去 removeChild
    // 它记录的旧节点，手动清空后那个节点已不在树里，直接抛 NotFoundError。
    window.ReactDOM.unmountComponentAtNode(root)
    start()
  })
})()