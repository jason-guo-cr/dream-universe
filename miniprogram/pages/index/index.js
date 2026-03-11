const app = getApp();

Page({
  data: {
    dreams: [],
    groupedDreams: [],
    selectedMonth: '',
    selectedMonthStr: '',
    page: 1,
    pageSize: 10,
    loading: false,
    hasMore: true,
    interpretingId: ''
  },

  onLoad() {
    this.setDefaultMonth();
    if (!app.requireLogin('/pages/index/index')) {
      return;
    }
    this.loadDreams();
  },

  onShow() {
    if (!app.requireLogin('/pages/index/index')) {
      return;
    }

    this.syncTabBar();
    this.setData({
      page: 1,
      dreams: [],
      groupedDreams: []
    });
    this.loadDreams();
  },

  setDefaultMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    this.setData({
      selectedMonth: `${year}-${month.toString().padStart(2, '0')}`,
      selectedMonthStr: `${year}年${month}月`
    });
  },

  syncTabBar() {
    if (typeof this.getTabBar !== 'function') {
      return;
    }

    const tabBar = this.getTabBar();
    if (tabBar) {
      tabBar.setData({ selected: 0 });
    }
  },

  groupDreamsByDate(dreams) {
    const groups = [];
    let currentGroup = null;

    dreams.forEach((dream, index) => {
      const rawDate = dream.date || dream.createdAt || new Date().toISOString();
      const dateKey = typeof rawDate === 'string'
        ? rawDate.split('T')[0]
        : new Date(rawDate).toISOString().split('T')[0];

      const dateObj = new Date(rawDate);
      const dateStr = dream.dateStr || dateObj.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!currentGroup || currentGroup.dateKey !== dateKey) {
        currentGroup = {
          dateKey,
          dateStr,
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

  loadDreams() {
    if (this.data.loading) {
      return;
    }

    this.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'getDreams',
      data: {
        page: this.data.page,
        pageSize: this.data.pageSize,
        selectedMonth: this.data.selectedMonth
      }
    }).then((res) => {
      this.setData({ loading: false });

      if (res.result && res.result.success) {
        const dreams = res.result.data || [];
        const merged = this.data.page === 1 ? dreams : [...this.data.dreams, ...dreams];

        this.setData({
          dreams: merged,
          groupedDreams: this.groupDreamsByDate(merged),
          hasMore: dreams.length === this.data.pageSize
        });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    }).catch((err) => {
      this.setData({ loading: false });
      console.error('load dreams failed:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  onMonthChange(e) {
    const month = e.detail.value;
    if (!month) {
      return;
    }

    const year = month.split('-')[0];
    const monthNum = parseInt(month.split('-')[1], 10);

    this.setData({
      selectedMonth: month,
      selectedMonthStr: `${year}年${monthNum}月`,
      page: 1,
      dreams: [],
      groupedDreams: []
    });

    this.loadDreams();
  },

  goToCreateDream() {
    if (!app.requireLogin('/pages/dream/dream')) {
      return;
    }

    wx.navigateTo({ url: '/pages/dream/dream' });
  },

  viewDream(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/dream/dream?id=${id}` });
  },

  editDream(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/dream/dream?id=${id}` });
  },

  quickInterpret(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }

    if (!app.requireLogin('/pages/index/index')) {
      return;
    }

    const currentDream = this.data.dreams.find((item) => item._id === id);
    if (currentDream && currentDream.interpretation) {
      wx.showModal({
        title: '已解梦',
        content: '这条梦境已经解梦过了，是否重新解梦？',
        confirmText: '重新解梦',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.runQuickInterpret(id);
          }
        }
      });
      return;
    }

    this.runQuickInterpret(id);
  },

  runQuickInterpret(id) {
    if (!id) {
      return;
    }

    if (this.data.interpretingId) {
      return;
    }

    this.setData({ interpretingId: id });
    wx.showLoading({ title: '解梦中...' });

    wx.cloud.callFunction({
      name: 'interpretDream',
      data: {
        dreamIds: [id]
      }
    }).then((res) => {
      wx.hideLoading();
      this.setData({ interpretingId: '' });

      if (!res.result || !res.result.success) {
        wx.showToast({
          title: (res.result && res.result.error) || '解梦失败',
          icon: 'none'
        });
        return;
      }

      const interpretation = res.result.data && res.result.data.interpretation
        ? res.result.data.interpretation
        : '';

      const dreams = this.data.dreams.map((item) => {
        if (item._id !== id) {
          return item;
        }

        return {
          ...item,
          interpretation: interpretation || item.interpretation || ''
        };
      });

      this.setData({
        dreams,
        groupedDreams: this.groupDreamsByDate(dreams)
      });

      wx.showToast({ title: '已完成当前梦境解析', icon: 'none' });
    }).catch((err) => {
      wx.hideLoading();
      this.setData({ interpretingId: '' });
      console.error('quick interpret failed:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  deleteDream(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除梦境',
      content: '确认删除这条梦境记录吗？',
      confirmColor: '#ef5350',
      success: (modalRes) => {
        if (!modalRes.confirm) {
          return;
        }

        wx.showLoading({ title: '删除中...' });
        wx.cloud.callFunction({
          name: 'deleteDream',
          data: { dreamId: id }
        }).then((res) => {
          wx.hideLoading();
          if (!res.result || !res.result.success) {
            wx.showToast({
              title: (res.result && res.result.error) || '删除失败',
              icon: 'none'
            });
            return;
          }

          const dreams = this.data.dreams.filter((item) => item._id !== id);
          this.setData({
            dreams,
            groupedDreams: this.groupDreamsByDate(dreams)
          });
          wx.showToast({ title: '已删除', icon: 'success' });
        }).catch((err) => {
          wx.hideLoading();
          console.error('delete dream failed:', err);
          wx.showToast({ title: '网络错误', icon: 'none' });
        });
      }
    });
  },

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: this.data.dreams.find((dream) => Array.isArray(dream.images) && dream.images.includes(src))?.images || [src]
    });
  },

  noop() {},

  loadMore() {
    if (this.data.hasMore) {
      this.setData({ page: this.data.page + 1 });
      this.loadDreams();
    }
  },

  onPullDownRefresh() {
    this.setData({
      page: 1,
      dreams: [],
      groupedDreams: []
    });
    this.loadDreams();
    wx.stopPullDownRefresh();
  }
});
