"""知乎个人数据只读探测脚本。

不会写入 InfoDigest、不会修改知乎数据，也不会输出 Cookie。
用法（PowerShell）：
  $env:ZHIHU_COOKIE = '...'; python zhihu_personal_poc.py
  python zhihu_personal_poc.py --cookie-file .\\zhihu.cookie
"""
import argparse
import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def load_cookie(args):
    if args.cookie_file:
        return Path(args.cookie_file).read_text(encoding="utf-8").strip()
    return os.environ.get("ZHIHU_COOKIE", "").strip()


def as_cookies(cookie):
    result = []
    for pair in cookie.split(";"):
        if "=" not in pair:
            continue
        name, value = pair.strip().split("=", 1)
        result.append({"name": name, "value": value, "domain": ".zhihu.com", "path": "/"})
    return result


def fetch_in_page(page, url):
    return page.evaluate(
        """async (url) => {
          try {
            const response = await fetch(url, {
              credentials: 'include',
              headers: {'x-api-version': '3.0.40', 'x-requested-with': 'fetch'}
            });
            const text = await response.text();
            return {ok: response.ok, status: response.status, text: text.slice(0, 20000)};
          } catch (error) {
            return {ok: false, status: 0, error: String(error)};
          }
        }""",
        url,
    )


def describe(label, response):
    if not response["ok"]:
        detail = response.get("error") or response.get("text", "")[:160]
        print(f"  {label}: 不可用（HTTP {response['status']}） {detail}")
        return None
    try:
        body = json.loads(response["text"])
        data = body.get("data", []) if isinstance(body, dict) else []
        count = len(data) if isinstance(data, list) else "非列表"
        print(f"  {label}: 可访问，data={count}")
        return data
    except json.JSONDecodeError:
        print(f"  {label}: HTTP 200，但不是 JSON 响应")
        return None


def main():
    parser = argparse.ArgumentParser(description="知乎个人数据只读探测")
    parser.add_argument("--cookie-file", help="包含完整 Cookie 的本地文件；优先于环境变量")
    parser.add_argument("--headed", action="store_true", help="显示浏览器，便于人工确认登录")
    args = parser.parse_args()
    cookie = load_cookie(args)
    if not cookie:
        print("未提供 ZHIHU_COOKIE 或 --cookie-file；未发起任何请求。")
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
            page.goto("https://www.zhihu.com", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(1500)
            logged_in = page.evaluate("""() => Boolean(document.cookie.match(/(?:^|; )(?:z_c0|d_c0|SESSIONID)=/))
              && !(document.body?.innerText || '').includes('登录后')""")
            print(f"登录态：{'疑似有效' if logged_in else '未确认（仍继续探测）'}")

            # 仅探测当前项目曾使用过的收藏接口及公开活动接口；不尝试签名逆向或绕过校验。
            collections = describe("收藏夹列表", fetch_in_page(
                page, "https://www.zhihu.com/api/v4/members/unlimited/collections?limit=20&offset=0"))
            describe("赞同/活动记录", fetch_in_page(
                page, "https://www.zhihu.com/api/v4/members/me/activities?limit=20&offset=0"))
            describe("浏览历史", fetch_in_page(
                page, "https://www.zhihu.com/api/v4/members/me/browsing_histories?limit=20&offset=0"))

            if collections:
                first = collections[0]
                collection_id = first.get("id") if isinstance(first, dict) else None
                if collection_id:
                    describe("首个收藏夹内容", fetch_in_page(
                        page, f"https://www.zhihu.com/api/v4/favlists/{collection_id}/contents?limit=20&offset=0"))
        finally:
            browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
