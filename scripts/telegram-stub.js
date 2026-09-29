/* Minimal Telegram WebApp SDK stub for local testing. Expects window.__TG_INIT__ (signed initData). */
(function () {
  var data = window.__TG_INIT__;
  var params = new URLSearchParams(data);
  var noop = function () {};
  var btn = {
    text: "",
    isVisible: false,
    isActive: true,
    setText: function () { return btn; },
    setParams: function (p) {
      if (p.text) btn.text = p.text;
      if (p.is_visible !== undefined) btn.isVisible = p.is_visible;
      render();
      return btn;
    },
    onClick: function () { return btn; },
    offClick: function () { return btn; },
    show: function () { btn.isVisible = true; render(); return btn; },
    hide: function () { btn.isVisible = false; render(); return btn; },
    enable: function () { return btn; },
    disable: function () { return btn; },
    showProgress: function () { return btn; },
    hideProgress: function () { return btn; },
  };
  function render() {
    var el = document.getElementById("tg-main-btn");
    if (!el && document.body) {
      el = document.createElement("div");
      el.id = "tg-main-btn";
      el.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:58px;padding-bottom:10px;background:#D4F25C;color:#0D0D0F;display:flex;align-items:center;justify-content:center;font:600 16px system-ui;z-index:99999";
      document.body.appendChild(el);
    }
    if (el) { el.textContent = btn.text; el.style.display = btn.isVisible ? "flex" : "none"; }
  }
  window.Telegram = {
    WebApp: {
      initData: data,
      initDataUnsafe: { user: JSON.parse(params.get("user")), start_param: params.get("start_param") },
      version: "8.0", platform: "ios", colorScheme: "dark",
      themeParams: { bg_color: "#17212b", secondary_bg_color: "#0e1621", section_bg_color: "#17212b", text_color: "#f5f5f5", hint_color: "#708499", button_color: "#5288c1" },
      safeAreaInset: { top: 47, bottom: 34, left: 0, right: 0 },
      contentSafeAreaInset: { top: 44, bottom: 0, left: 0, right: 0 },
      ready: noop, expand: noop, close: noop, isVersionAtLeast: function () { return true; },
      setHeaderColor: noop, setBackgroundColor: noop, setBottomBarColor: noop, disableVerticalSwipes: noop,
      enableClosingConfirmation: noop, disableClosingConfirmation: noop, onEvent: noop, offEvent: noop,
      openLink: noop, openTelegramLink: noop, showAlert: noop, showConfirm: noop,
      BackButton: { isVisible: false, show: function () { document.documentElement.dataset.tgBack = "1"; }, hide: function () { document.documentElement.dataset.tgBack = "0"; }, onClick: noop, offClick: noop },
      MainButton: btn,
      HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
    },
  };
})();
