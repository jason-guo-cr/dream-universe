// pages/interpret/interpret.js
const app = getApp();

function stripMarkdownSyntax(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  return content
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Page({
  data: {
    dreams: [],
    selectedIds: [],
    interpretation: '',
    interpretedDreams: [],
    interpreting: false,
    loading: false,
    buttonText: '解梦'
  },

  onLoad(options) {
    if (!app.requireLogin('/pages/interpret/interpret')) {
      return;
    }

    if (options.ids) {
      this.setData({
        preselectedIds: options.ids.split(',')
      });
    }

    this.loadDreams();
  },

  loadDreams() {
    this.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'getDreams',
      data: {
        page: 1,
        pageSize: 100
      }
    }).then(res => {
      this.setData({ loading: false });

      if (res.result.success) {
        const dreams = res.result.data.map(d => ({
          ...d,
          selected: false
        }));

        if (this.data.preselectedIds) {
          dreams.forEach(d => {
            if (this.data.preselectedIds.includes(d._id)) {
              d.selected = true;
            }
          });
        }

        const selectedIds = dreams.filter(d => d.selected).map(d => d._id);
        this.setData({
          dreams,
          selectedIds,
          buttonText: `解梦（已选 ${selectedIds.length} 条）`
        });
      }
    }).catch(err => {
      this.setData({ loading: false });
      console.error('加载梦境列表失败:', err);
    });
  },

  toggleSelect(e) {
    const index = e.currentTarget.dataset.index;
    const dreams = this.data.dreams;

    if (!dreams[index].selected && this.data.selectedIds.length >= 3) {
      wx.showToast({
        title: '最多选择3条梦境',
        icon: 'none'
      });
      return;
    }

    dreams[index].selected = !dreams[index].selected;

    const selectedIds = dreams.filter(d => d.selected).map(d => d._id);

    this.setData({
      dreams,
      selectedIds,
      buttonText: `解梦（已选 ${selectedIds.length} 条）`
    });
  },

  startInterpret() {
    if (!app.requireLogin('/pages/interpret/interpret')) {
      return;
    }

    if (this.data.selectedIds.length === 0) {
      wx.showToast({
        title: '请选择要解梦的梦境',
        icon: 'none'
      });
      return;
    }

    this.setData({
      interpreting: true,
      buttonText: '解梦中...'
    });

    wx.cloud.callFunction({
      name: 'interpretDream',
      data: {
        dreamIds: this.data.selectedIds
      }
    }).then(res => {
      const requestId = res.requestID || res.requestId || '';
      const traceId = res.result && res.result.data ? res.result.data.traceId : '';
      const aiMeta = res.result && res.result.data ? res.result.data.aiMeta : null;

      console.log('[interpret] callFunction result', {
        success: !!(res.result && res.result.success),
        requestId,
        traceId,
        aiMeta
      });

      this.setData({ interpreting: false, buttonText: '解梦' });

      if (res.result.success) {
        const interpretationText = stripMarkdownSyntax(res.result.data.interpretation);
        this.setData({
          interpretation: interpretationText,
          interpretedDreams: res.result.data.dreams
        });

        if (aiMeta && aiMeta.ok === false) {
          console.warn('[interpret] AI fallback used', { requestId, traceId, aiMeta });
        }
      } else {
        wx.showToast({
          title: res.result.error || '解梦失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      this.setData({ interpreting: false, buttonText: '解梦' });
      console.error('解梦失败:', err);
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      });
    });
  },

  resetInterpret() {
    this.setData({
      interpretation: '',
      interpretedDreams: [],
      buttonText: '解梦'
    });

    this.loadDreams();
  }
});
