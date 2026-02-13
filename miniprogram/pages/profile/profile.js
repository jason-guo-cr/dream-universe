// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    tempNickname: '',
    editingNickname: false,
    showAbout: false,
    stats: {
      totalDreams: 0,
      interpretedDreams: 0,
      totalImages: 0
    }
  },

  onShow: function () {
    if (!app.requireLogin('/pages/profile/profile')) {
      return;
    }
    this.loadUserInfo();
    this.loadStats();
  },

  loadUserInfo: function () {
    const userInfo = app.getUserInfo() || wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    } else {
      app.login().then(info => {
        this.setData({ userInfo: info });
      }).catch(() => {
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      });
    }
  },

  loadStats: function () {
    wx.cloud.callFunction({
      name: 'getDreams',
      data: {
        page: 1,
        pageSize: 1000
      }
    }).then(res => {
      if (res.result.success) {
        const dreams = res.result.data;
        const stats = {
          totalDreams: dreams.length,
          interpretedDreams: dreams.filter(d => d.interpretation).length,
          totalImages: dreams.reduce((sum, d) => sum + (d.images?.length || 0), 0)
        };
        this.setData({ stats });
      }
    });
  },

  editNickname: function () {
    this.setData({
      tempNickname: this.data.userInfo.nickname,
      editingNickname: true
    });
  },

  onNicknameInput: function (e) {
    this.setData({
      tempNickname: e.detail.value
    });
  },

  saveNickname: function () {
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
        nickname: nickname
      }
    }).then(res => {
      if (res.result.success) {
        const userInfo = this.data.userInfo;
        userInfo.nickname = nickname;
        this.setData({
          userInfo: userInfo,
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

  cancelEdit: function () {
    this.setData({
      editingNickname: false
    });
  },

  goToAllDreams: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  clearCache: function () {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除本地缓存吗？',
      success: (res) => {
        if (res.confirm) {
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
      }
    });
  },

  showAbout: function () {
    this.setData({ showAbout: true });
  },

  hideAbout: function () {
    this.setData({ showAbout: false });
  }
});
