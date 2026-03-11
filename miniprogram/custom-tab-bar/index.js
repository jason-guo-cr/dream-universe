const app = getApp();

const tabList = [
  {
    pagePath: 'pages/index/index',
    text: '梦境',
    iconPath: '/images/icons/dream.png',
    selectedIconPath: '/images/icons/dream-active.png'
  },
  {
    pagePath: 'pages/profile/profile',
    text: '我的',
    iconPath: '/images/icons/user.png',
    selectedIconPath: '/images/icons/user-active.png'
  }
];

Component({
  data: {
    selected: 0,
    list: tabList
  },

  lifetimes: {
    attached() {
      this.updateSelected();
    }
  },

  methods: {
    updateSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];

      if (!current) {
        return;
      }

      const index = this.data.list.findIndex((item) => item.pagePath === current.route);
      if (index >= 0) {
        this.setData({ selected: index });
      }
    },

    switchTab(e) {
      const { path, index } = e.currentTarget.dataset;
      if (typeof index === 'number' && index === this.data.selected) {
        return;
      }

      wx.switchTab({
        url: `/${path}`
      });
    },

    createDream() {
      if (!app.requireLogin('/pages/dream/dream')) {
        return;
      }

      wx.navigateTo({
        url: '/pages/dream/dream'
      });
    }
  }
});
