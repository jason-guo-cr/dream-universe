// pages/index/index.js
const app = getApp();

Page({
  data: {
    dreams: [],
    groupedDreams: [], // 按日期分组的梦境
    selectedMonth: '',
    selectedMonthStr: '',
    page: 1,
    pageSize: 10,
    loading: false,
    hasMore: true
  },

  onLoad: function () {
    this.setDefaultMonth();
    if (!app.requireLogin('/pages/index/index')) {
      return;
    }
    this.loadDreams();
  },

  onShow: function () {
    if (!app.requireLogin('/pages/index/index')) {
      return;
    }
    this.setData({
      page: 1,
      dreams: [],
      groupedDreams: []
    });
    this.loadDreams();
  },

  setDefaultMonth: function () {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = `${year}年${month}月`;
    this.setData({
      selectedMonth: `${year}-${month.toString().padStart(2, '0')}`,
      selectedMonthStr: monthStr
    });
  },

  loadDreams: function () {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    wx.cloud.callFunction({
      name: 'getDreams',
      data: {
        page: this.data.page,
        pageSize: this.data.pageSize
      }
    }).then(res => {
      this.setData({ loading: false });
      
      if (res.result.success) {
        const dreams = res.result.data;
        const newDreams = this.data.page === 1 ? dreams : [...this.data.dreams, ...dreams];
        const groupedDreams = this.groupDreamsByDate(newDreams);
        
        this.setData({
          dreams: newDreams,
          groupedDreams: groupedDreams,
          hasMore: dreams.length === this.data.pageSize
        });
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      this.setData({ loading: false });
      console.error('加载梦境列表失败:', err);
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      });
    });
  },

  // 按日期分组梦境
  groupDreamsByDate: function (dreams) {
    const groups = [];
    let currentGroup = null;
    
    dreams.forEach((dream, index) => {
      // 防御性处理：确保 date 字段存在
      const rawDate = dream.date || dream.createdAt || new Date().toISOString();
      const dateKey = typeof rawDate === 'string' 
        ? rawDate.split('T')[0] 
        : new Date(rawDate).toISOString().split('T')[0];
      
      // 生成日期显示字符串
      const dateObj = new Date(rawDate);
      const dateStr = dream.dateStr || dateObj.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        currentGroup = {
          dateKey: dateKey,
          dateStr: dateStr,
          dreams: [],
          isFirst: groups.length === 0
        };
        groups.push(currentGroup);
      }
      
      currentGroup.dreams.push({
        ...dream,
        index: index + 1
      });
    });
    
    return groups;
  },

  onMonthChange: function (e) {
    const month = e.detail.value;
    if (!month) return;
    
    const year = month.split('-')[0];
    const monthNum = parseInt(month.split('-')[1]);
    
    this.setData({
      selectedMonth: month,
      selectedMonthStr: `${year}年${monthNum}月`,
      page: 1,
      dreams: [],
      groupedDreams: []
    });
    
    this.loadDreams();
  },

  goToCreateDream: function () {
    if (!app.requireLogin('/pages/dream/dream')) {
      return;
    }
    wx.navigateTo({
      url: '/pages/dream/dream'
    });
  },

  goToInterpret: function () {
    if (!app.requireLogin('/pages/interpret/interpret')) {
      return;
    }
    if (this.data.dreams.length === 0) {
      wx.showToast({
        title: '请先记录梦境',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/interpret/interpret'
    });
  },

  viewDream: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/dream/dream?id=${id}`
    });
  },

  previewImage: function (e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: this.data.dreams.find(d => d.images.includes(src))?.images || [src]
    });
  },

  loadMore: function () {
    if (this.data.hasMore) {
      this.setData({
        page: this.data.page + 1
      });
      this.loadDreams();
    }
  },

  onPullDownRefresh: function () {
    this.setData({
      page: 1,
      dreams: [],
      groupedDreams: []
    });
    this.loadDreams();
    wx.stopPullDownRefresh();
  }
});
