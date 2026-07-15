import requests
import time
import qrcode

def bilibili_qr_login_and_fetch_history():
    # 核心：使用 requests.Session()，它会像浏览器一样自动保存登录成功后的 Cookie
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    session.headers.update(headers)

    # ================= 1. 申请扫码登录二维码 =================
    print("1. 正在向 B 站请求登录二维码...")
    generate_api = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate"
    resp = session.get(generate_api).json()
    
    if resp.get('code') != 0:
        print("获取二维码失败:", resp)
        return
    
    qr_url = resp['data']['url']
    qrcode_key = resp['data']['qrcode_key']

    # 在控制台直接渲染二维码（黑底白字）供你使用手机扫描
    qr = qrcode.QRCode()
    qr.add_data(qr_url)
    qr.print_ascii(invert=True)
    print("📱 请打开手机 Bilibili App，扫描上方的二维码")

    # ================= 2. 轮询扫码状态 =================
    poll_api = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll"
    print("\n2. 等待扫码中...")
    
    while True:
        # 带着刚才的 qrcode_key 去问 B 站：用户扫了吗？
        poll_resp = session.get(poll_api, params={"qrcode_key": qrcode_key}).json()
        poll_data = poll_resp.get('data', {})
        code = poll_data.get('code')
        
        if code == 0:
            print("\n✅ 登录成功！Session 已自动截获并保存了您的 Cookie。")
            break
        elif code == 86090:
            print("⏳ 二维码已扫描，等待您在手机上点击确认登录...")
        elif code == 86038:
            print("❌ 二维码已失效，请重新运行程序。")
            return
        # code == 86101 表示未扫码，保持静默继续轮询
        
        # ⚠️ 注意：必须休眠，频繁请求会被 B 站封杀 IP
        time.sleep(2) 

    # ================= 3. 携带 Cookie 拉取浏览历史 =================
    print("\n3. 正在拉取您的 B 站最近浏览记录...")
    
    # 此时的 session 已经自动带上了刚刚登录成功获取的 Cookie (SESSDATA 等)
    history_api = "https://api.bilibili.com/x/web-interface/history/cursor"
    history_resp = session.get(history_api).json()
    
    if history_resp.get('code') == 0:
        history_list = history_resp['data']['list']
        print(f"\n🎉 成功拉取到 {len(history_list)} 条记录\n")
        
        for idx, item in enumerate(history_list):
            print(f"{'='*60}")
            print(f"📌 第 {idx+1} 条记录 - 完整信息：")
            print(f"{'='*60}")
            for key, value in item.items():
                if key == 'stat' and isinstance(value, dict):
                    print(f"  📊 统计信息:")
                    for sk, sv in value.items():
                        print(f"      {sk}: {sv}")
                # 时间戳字段转换为可读时间
                elif key in ('view_at', 'pubdate', 'ctime', 'mtime') and isinstance(value, (int, float)) and value > 1000000000:
                    readable = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(value))
                    print(f"  {key}: {value} ({readable})")
                else:
                    print(f"  {key}: {value}")
    else:
        print("获取历史记录失败:", history_resp)

if __name__ == "__main__":
    bilibili_qr_login_and_fetch_history()