// pages/dream/dream.js
const app = getApp();

Page({
  data: {
    dreamId: '',
    date: '',
    dateStr: '',
    content: '',
    images: [],
    imagePrompts: [],
    interpretation: '',
    loading: false,
    generatingText: '正在调用AI生成图片...',
    isNew: true
  },

  onLoad: function (options) {
    if (!app.requireLogin('/pages/dream/dream')) {
      return;
    }
    this.initDate();
    
    if (options.id) {
      this.setData({
        dreamId: options.id,
        isNew: false
      });
      this.loadDream(options.id);
    }
  },

  initDate: function () {
    const yesterday = new Date(Date.now() - 86400000);
    const dateStr = yesterday.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const date = yesterday.toISOString().split('T')[0];
    
    this.setData({
      date: date,
      dateStr: dateStr
    });
  },

  onDateChange: function (e) {
    const date = e.detail.value;
    const dateObj = new Date(date);
    const dateStr = dateObj.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    this.setData({
      date: date,
      dateStr: dateStr
    });
  },

  onContentInput: function (e) {
    this.setData({
      content: e.detail.value
    });
  },

  loadDream: function (id) {
    wx.showLoading({ title: '加载中...' });
    
    wx.cloud.callFunction({
      name: 'getDreams',
      data: {
        dreamIds: [id]
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result.success && res.result.data.length > 0) {
        const dream = res.result.data[0];
        this.setData({
          content: dream.content,
          images: dream.images,
          imagePrompts: dream.imagePrompts,
          interpretation: dream.interpretation,
          date: new Date(dream.date).toISOString().split('T')[0],
          dateStr: dream.dateStr
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载梦境失败:', err);
    });
  },

  createDream: function () {
    if (!app.requireLogin('/pages/dream/dream')) {
      return;
    }
    if (!this.data.content.trim()) {
      wx.showToast({
        title: '请输入梦境内容',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      loading: true,
      generatingText: '正在优化图片提示词...'
    });
    
    wx.cloud.callFunction({
      name: 'createDream',
      data: {
        content: this.data.content,
        date: this.data.date
      }
    }).then(res => {
      this.setData({ loading: false });
      
      if (res.result.success) {
        const dream = res.result.data;
        this.setData({
          dreamId: dream._id,
          images: dream.images,
          imagePrompts: dream.imagePrompts,
          isNew: false
        });

        wx.showToast({
          title: '创建成功，返回时间线',
          icon: 'success',
          duration: 900
        });

        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }, 900);
      } else {
        wx.showToast({
          title: res.result.error || '生成失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      this.setData({ loading: false });
      console.error('创建梦境失败:', err);
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      });
    });
  },

  previewImage: function (e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: this.data.images
    });
  },

  goToInterpret: function () {
    wx.navigateTo({
      url: `/pages/interpret/interpret?ids=${this.data.dreamId}`
    });
  }
});
