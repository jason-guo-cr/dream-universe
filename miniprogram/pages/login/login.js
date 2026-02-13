const app = getApp();

Page({
  data: {
    loading: false,
    redirect: '/pages/index/index'
  },

  onLoad(options) {
    const redirect = options && options.redirect ? decodeURIComponent(options.redirect) : '/pages/index/index';
    this.setData({ redirect });

    if (app.hasLogin()) {
      this.redirectAfterLogin();
    }
  },

  handleLogin() {
    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });

    app.login()
      .then(() => {
        this.setData({ loading: false });
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 700
        });

        setTimeout(() => {
          this.redirectAfterLogin();
        }, 700);
      })
      .catch((err) => {
        this.setData({ loading: false });
        console.error('登录失败:', err);
        wx.showToast({
          title: '登录失败，请稍后重试',
          icon: 'none'
        });
      });
  },

  redirectAfterLogin() {
    const redirect = this.data.redirect || '/pages/index/index';
    const tabPages = ['/pages/index/index', '/pages/profile/profile'];

    if (tabPages.includes(redirect)) {
      wx.switchTab({ url: redirect });
      return;
    }

    wx.redirectTo({
      url: redirect,
      fail: () => {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  }
});
