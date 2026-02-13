// app.js
App({
  onLaunch: function () {
    this.globalData = {
      env: "cloud1-3gzlpzydb805791e",
      userInfo: null,
      isLoggedIn: false
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
    this.db = wx.cloud.database();
    this.restoreSession();
  },

  restoreSession: function () {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      this.setUserSession(userInfo);
    }
  },

  setUserSession: function (userInfo) {
    this.globalData.userInfo = userInfo;
    this.globalData.isLoggedIn = !!(userInfo && userInfo.openid);
    if (this.globalData.isLoggedIn) {
      wx.setStorageSync('userInfo', userInfo);
    }
  },

  hasLogin: function () {
    return !!this.globalData.isLoggedIn;
  },

  getUserInfo: function () {
    return this.globalData.userInfo;
  },

  login: function () {
    return wx.cloud.callFunction({
      name: 'login'
    }).then(res => {
      if (res.result && res.result.success && res.result.data) {
        this.setUserSession(res.result.data);
        return res.result.data;
      }
      throw new Error((res.result && res.result.error) || '登录失败');
    });
  },

  logout: function () {
    this.globalData.userInfo = null;
    this.globalData.isLoggedIn = false;
    wx.removeStorageSync('userInfo');
  },

  requireLogin: function (redirectPath) {
    if (this.hasLogin()) {
      return true;
    }

    const pages = getCurrentPages();
    const currentRoute = pages.length ? `/${pages[pages.length - 1].route}` : '';
    if (currentRoute === '/pages/login/login') {
      return false;
    }

    const target = redirectPath || currentRoute || '/pages/index/index';
    wx.navigateTo({
      url: `/pages/login/login?redirect=${encodeURIComponent(target)}`
    });
    return false;
  },

  generateNickname: function() {
    const prefixes = ['梦旅人', '星空客', '云端者', '月下眠', '晨曦梦', '星河游'];
    const suffixs = ['001', '002', '003', '007', '123', '666', '888', '999'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixs[Math.floor(Math.random() * suffixs.length)];
    return prefix + suffix;
  }
});
