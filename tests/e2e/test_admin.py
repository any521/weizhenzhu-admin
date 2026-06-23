"""
weizhenzu-admin E2E 自动化测试
使用 Python Playwright 验证管理后台核心流程。
"""

import os
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCREENSHOT_DIR = PROJECT_ROOT / "screenshots" / "e2e"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

# 启动端口与 URL
BASE_URL = os.environ.get("ADMIN_BASE_URL", "http://localhost:5175")
CHROME_EXECUTABLE = Path(
    os.environ.get(
        "PLAYWRIGHT_CHROME_EXECUTABLE",
        r"C:\Users\15418\AppData\Local\ms-playwright\chromium-1228\chrome-win64\chrome.exe",
    )
)


def screenshot(page, name: str):
    """保存截图"""
    path = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    print(f"[截图] {path}")


def fill_login(page, username: str, password: str = "123456", captcha: str = "A7K9"):
    """填写登录表单"""
    page.locator('input[placeholder*="请输入账号"]').fill(username)
    page.locator('input[placeholder="请输入密码"]').fill(password)
    page.locator('input[placeholder="请输入验证码"]').fill(captcha)
    page.locator("button:has-text('立即登录')").click()


def login_as(page, username: str, expected_path: str, expected_text: str):
    """通用登录并校验"""
    print(f"[测试] 以 {username} 登录")
    login_path = "/admin/login" if expected_path.startswith("/admin/") else "/merchant/login"
    page.goto(f"{BASE_URL}{login_path}")
    page.wait_for_load_state("networkidle")
    fill_login(page, username)
    page.wait_for_url(f"**{expected_path}", timeout=10000)
    page.wait_for_load_state("networkidle")
    expect(page.locator(f"text={expected_text}").first).to_be_visible()


def navigate_menu(page, menu_text: str, submenu_text: str | None, expected_path: str, expected_text: str):
    """点击侧边栏菜单并校验页面"""
    if submenu_text:
        page.locator(f".el-sub-menu__title:has-text('{menu_text}')").click()
        page.locator(f".el-menu-item:has-text('{submenu_text}')").click()
    else:
        page.locator(f".el-menu-item:has-text('{menu_text}')").click()
    page.wait_for_url(f"**{expected_path}", timeout=10000)
    page.wait_for_load_state("networkidle")
    expect(page.locator(f"text={expected_text}").first).to_be_visible()


def test_admin_login_and_navigation():
    """测试管理员登录及核心页面导航"""
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=str(CHROME_EXECUTABLE),
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        try:
            print(f"[测试] 访问登录页 {BASE_URL}/login")
            page.goto(f"{BASE_URL}/login")
            page.wait_for_load_state("networkidle")
            expect(page.locator(".brand-title").first).to_be_visible()
            expect(page.locator("text=商家登录").first).to_be_visible()
            screenshot(page, "01_login_page")

            login_as(page, "admin", "/admin/dashboard", "管理控制台")
            screenshot(page, "02_admin_dashboard")

            navigate_menu(page, "用户管理", None, "/admin/users", "用户管理")
            screenshot(page, "03_admin_user")

            navigate_menu(page, "商家管理", "商家列表", "/admin/merchants", "商家列表")
            screenshot(page, "04_admin_merchant")

            navigate_menu(page, "订单管理", None, "/admin/orders", "订单管理")
            screenshot(page, "05_admin_order")

            navigate_menu(page, "财务管理", None, "/admin/finance", "财务管理")
            screenshot(page, "06_admin_finance")

            navigate_menu(page, "系统设置", None, "/admin/system", "系统设置")
            screenshot(page, "07_admin_system")

            print("[测试] 退出登录")
            page.locator(".user-avatar, .user-name").first.click()
            page.locator("text=退出登录").click()
            page.wait_for_url("**/login", timeout=10000)
            expect(page.locator("text=立即登录").first).to_be_visible()
            screenshot(page, "08_logout")

            print("[通过] 管理员登录及导航测试全部通过")
        finally:
            context.close()
            browser.close()


def test_merchant_login_and_navigation():
    """测试商家登录及核心页面导航"""
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path=str(CHROME_EXECUTABLE),
            args=["--no-sandbox", "--disable-setuid-sandbox"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        try:
            login_as(page, "merchant001", "/merchant/dashboard", "今日订单数")
            screenshot(page, "11_merchant_dashboard")

            navigate_menu(page, "订单管理", "订单列表", "/merchant/orders", "订单列表")
            screenshot(page, "12_merchant_order_list")

            navigate_menu(page, "菜品管理", "菜品列表", "/merchant/dishes", "菜品管理")
            screenshot(page, "13_merchant_dish")

            navigate_menu(page, "财务中心", None, "/merchant/finance", "财务中心")
            screenshot(page, "14_merchant_finance")

            print("[通过] 商家登录及导航测试全部通过")
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    print("=" * 60)
    print("weizhenzu-admin E2E 测试开始")
    print("=" * 60)
    test_admin_login_and_navigation()
    test_merchant_login_and_navigation()
    print("=" * 60)
    print("所有测试通过")
    print("=" * 60)
