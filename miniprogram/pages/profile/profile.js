const app = getApp();

Page({
  data: {
    userInfo: null,
    tempNickname: '',
    editingNickname: false,
    showAbout: false,
    showFeedback: false,
    feedbackContent: '',
    feedbackContact: '',
    submittingFeedback: false,
    stats: {
      totalDreams: 0,
      interpretedDreams: 0,
      totalImages: 0
    }
  },

  onShow() {
    if (!app.requireLogin('/pages/profile/profile')) {
      return;
    }

    this.syncTabBar();
    this.loadUserInfo();
    this.loadStats();
  },

  syncTabBar() {
    if (typeof this.getTabBar !== 'function') {
      return;
    }

    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 1 });
    }
  },

  loadUserInfo() {
    const userInfo = app.getUserInfo() || wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
      return;
    }

    app.login().then((info) => {
      this.setData({ userInfo: info });
    }).catch(() => {
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    });
  },

  loadStats() {
    wx.cloud.callFunction({
      name: 'getDreams',
      data: {
        page: 1,
        pageSize: 1000
      }
    }).then((res) => {
      if (res.result && res.result.success) {
        const dreams = res.result.data || [];
        const stats = {
          totalDreams: dreams.length,
          interpretedDreams: dreams.filter((dream) => dream.interpretation).length,
          totalImages: dreams.reduce((sum, dream) => sum + (dream.images?.length || 0), 0)
        };
        this.setData({ stats });
      }
    });
  },

  editNickname() {
    this.setData({
      tempNickname: this.data.userInfo.nickname,
      editingNickname: true
    });
  },

  onNicknameInput(e) {
    this.setData({
      tempNickname: e.detail.value
    });
  },

  saveNickname() {
    const nickname = this.data.tempNickname.trim();
    if (!nickname) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      });
      return;
    }

    wx.cloud.callFunction({
      name: 'updateUser',
      data: {
        nickname
      }
    }).then((res) => {
      if (res.result && res.result.success) {
        const userInfo = {
          ...this.data.userInfo,
          nickname
        };

        this.setData({
          userInfo,
          editingNickname: false
        });
        wx.setStorageSync('userInfo', userInfo);
        wx.showToast({
          title: '修改成功',
          icon: 'success'
        });
      }
    });
  },

  cancelEdit() {
    this.setData({
      editingNickname: false
    });
  },

  onFeedbackInput(e) {
    this.setData({
      feedbackContent: e.detail.value
    });
  },

  onContactInput(e) {
    this.setData({
      feedbackContact: e.detail.value
    });
  },

  submitFeedback() {
    const content = String(this.data.feedbackContent || '').trim();
    const contact = String(this.data.feedbackContact || '').trim();

    if (!content) {
      wx.showToast({
        title: '请输入反馈内容',
        icon: 'none'
      });
      return;
    }

    if (this.data.submittingFeedback) {
      return;
    }

    this.setData({ submittingFeedback: true });

    wx.cloud.callFunction({
      name: 'saveFeedback',
      data: {
        content,
        contact,
        nickname: this.data.userInfo?.nickname || '',
        source: 'profile'
      }
    }).then((res) => {
      this.setData({ submittingFeedback: false });

      if (!res.result || !res.result.success) {
        wx.showToast({
          title: (res.result && res.result.error) || '提交失败',
          icon: 'none'
        });
        return;
      }

      this.setData({
        feedbackContent: '',
        feedbackContact: '',
        showFeedback: false
      });
      wx.showToast({
        title: '反馈已提交',
        icon: 'success'
      });
    }).catch((err) => {
      this.setData({ submittingFeedback: false });
      console.error('submit feedback failed:', err);
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      });
    });
  },

  goToAllDreams() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除本地缓存吗？',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        app.logout();
        wx.showToast({
          title: '已退出登录',
          icon: 'success'
        });
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/login/login?redirect=%2Fpages%2Findex%2Findex'
          });
        }, 600);
      }
    });
  },

  showAbout() {
    this.setData({ showAbout: true });
  },

  hideAbout() {
    this.setData({ showAbout: false });
  },

  showFeedback() {
    this.setData({ showFeedback: true });
  },

  hideFeedback() {
    if (this.data.submittingFeedback) {
      return;
    }

    this.setData({ showFeedback: false });
  }
});
