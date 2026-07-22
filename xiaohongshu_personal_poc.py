"""小红书个人数据只读探测脚本。

不会写入 InfoDigest、不会修改小红书数据，也不会输出 Cookie。
用法（PowerShell）：
  $env:XIAOHONGSHU_COOKIE = '...'; python xiaohongshu_personal_poc.py
  python xiaohongshu_personal_poc.py --cookie-file .\\xiaohongshu.cookie --headed
"""
import argparse
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def load_cookie(args):
    if args.cookie_file:
        return Path(args.cookie_file).read_text(encoding="utf-8").strip()
    return os.environ.get("XIAOHONGSHU_COOKIE", "").strip()


def as_cookies(cookie):
    parsed = []
    for pair in cookie.split(";"):
        if "=" not in pair:
            continue
        name, value = pair.strip().split("=", 1)
        parsed.append({"name": name, "value": value, "domain": ".xiaohongshu.com", "path": "/"})
    return parsed


def main():
    parser = argparse.ArgumentParser(description="小红书个人数据只读探测")
    parser.add_argument("--cookie-file", help="包含完整 Cookie 的本地文件；优先于环境变量")
    parser.add_argument("--headed", action="store_true", help="显示浏览器，便于人工确认登录")
    args = parser.parse_args()
    cookie = load_cookie(args)
    if not cookie:
        print("未提供 XIAOHONGSHU_COOKIE 或 --cookie-file；未发起任何请求。")
        return 2

    with sync_playwright() as playwright:
        # 使用本机 Chrome，避免 Python Playwright 与项目 Node Playwright 的浏览器版本不一致。
        browser = playwright.chromium.launch(channel="chrome", headless=not args.headed)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900}, locale="zh-CN",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        )
        context.add_cookies(as_cookies(cookie))
        page = context.new_page()
        try:
            page.goto("https://www.xiaohongshu.com/explore", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(5000)
            snapshot = page.evaluate("""() => {
              const text = document.body?.innerText || '';
              const links = [...document.querySelectorAll('header a, nav a, aside a, [class*=sidebar] a, [class*=menu] a')]
                .map(a => ({text: (a.innerText || '').trim(), href: a.href}))
                .filter(x => /^(收藏|我的收藏|赞和收藏|点赞|浏览历史|历史记录|我的)$/.test(x.text)
                  || /\/(?:user|profile|collection|favorites|history)(?:\/|$)/.test(x.href))
                .slice(0, 20);
              return {url: location.href, title: document.title, links,
                loginHint: /登录|注册/.test(text.slice(0, 1200)),
                guestHint: /游客|guest/i.test(text.slice(0, 1200))};
            }""")
            print(f"当前页面：{snapshot['url']}")
            print(f"登录提示：{'存在' if snapshot['loginHint'] else '未发现'}；游客提示：{'存在' if snapshot['guestHint'] else '未发现'}")
            if snapshot["links"]:
                print("页面暴露的个人数据入口：")
                for link in snapshot["links"]:
                    print(f"  - {link['text'][:30]} -> {link['href']}")
            else:
                print("页面未暴露可供 Web 端访问的收藏、点赞或浏览历史入口。")
        finally:
            browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
