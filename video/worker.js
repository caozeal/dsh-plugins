/**
 * dsh-next-git 站点 Worker。
 *
 * 站点挂在 https://dsh.caozeal.cn/next-git/ 这个**子路径**下。
 * Cloudflare 的静态资源是按站点根存放的，所以这里把 /next-git 前缀剥掉
 * 再交给 ASSETS，让站点内部（index.html、demo/、lib/）保持根相对引用，
 * 换挂载点只改 PREFIX 一处。
 *
 * 为什么不用 Cloudflare Pages：Pages 项目占据的是「主机名根」，无法只挂子路径；
 * Worker route 可以精确匹配 dsh.caozeal.cn/next-git/*。
 */

const PREFIX = '/next-git'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (!url.pathname.startsWith(PREFIX)) {
      return new Response('Not Found', { status: 404 })
    }

    let rest = url.pathname.slice(PREFIX.length)

    // /next-git → /next-git/（补斜杠，否则站点内相对路径会解析错）
    if (rest === '') {
      return Response.redirect(url.origin + PREFIX + '/', 308)
    }

    // 不要自己拼 index.html：Workers 静态资源默认 html_handling 是
    // auto-trailing-slash，会把 /demo/index.html 307 回 /demo/，而那个 Location
    // 是站点根的绝对路径、会丢掉 /next-git 前缀。所以反过来——显式请求 index.html
    // 时我们自己先折回目录，让 ASSETS 直接返回 200。
    if (rest.endsWith('/index.html')) rest = rest.slice(0, -'index.html'.length)

    const target = new URL(rest + url.search, url.origin)
    const response = await env.ASSETS.fetch(new Request(target.toString(), request))

    // 干净的 404（ASSETS 的默认 404 是纯文本）
    if (response.status === 404) {
      return new Response('404 Not Found: ' + url.pathname, {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    return response
  },
}