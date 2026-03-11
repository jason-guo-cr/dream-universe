const app = getApp();

function buildDateStr(date) {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function createDraftId() {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

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
    dreamId: '',
    draftId: '',
    date: '',
    dateStr: '',
    content: '',
    images: [],
    imageFileIds: [],
    imagePrompts: [],
    interpretation: '',
    loading: false,
    generatingText: '梦境生成中...',
    isNew: true,
    hasGenerated: false,
    useCustomSplit: false,
    imageCount: 1,
    imageCountIndex: 0,
    countOptions: [1, 2, 3],
    sceneInputs: ['']
  },

  onLoad(options) {
    if (!app.requireLogin('/pages/dream/dream')) {
      return;
    }

    this.initDate();
    this.setData({
      draftId: options.id || createDraftId()
    });

    if (options.id) {
      this.setData({
        dreamId: options.id,
        isNew: false
      });
      this.loadDream(options.id);
    }
  },

  initDate() {
    const yesterday = new Date(Date.now() - 86400000);
    this.setData({
      date: yesterday.toISOString().split('T')[0],
      dateStr: buildDateStr(yesterday)
    });
  },

  onDateChange(e) {
    const date = e.detail.value;
    this.setData({
      date,
      dateStr: buildDateStr(date)
    });
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  onToggleCustomSplit(e) {
    const useCustomSplit = !!e.detail.value;
    this.setData({ useCustomSplit });
  },

  onImageCountChange(e) {
    const index = Number(e.detail.value) || 0;
    const nextCount = this.data.countOptions[index] || 1;
    const sceneInputs = this.data.sceneInputs.slice(0, nextCount);

    while (sceneInputs.length < nextCount) {
      sceneInputs.push('');
    }

    this.setData({
      imageCount: nextCount,
      imageCountIndex: index,
      sceneInputs
    });
  },

  onSceneInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const value = e.detail.value;
    const sceneInputs = [...this.data.sceneInputs];
    sceneInputs[index] = value;
    this.setData({ sceneInputs });
  },

  loadDream(id) {
    wx.showLoading({ title: '加载中...' });

    wx.cloud.callFunction({
      name: 'getDreams',
      data: { dreamIds: [id] }
    }).then((res) => {
      wx.hideLoading();

      if (res.result && res.result.success && res.result.data.length > 0) {
        const dream = res.result.data[0];
        this.setData({
          content: dream.content || '',
          images: dream.images || [],
          imageFileIds: dream.imageFileIds || dream.images || [],
          imagePrompts: dream.imagePrompts || [],
          interpretation: stripMarkdownSyntax(dream.interpretation || ''),
          draftId: dream.draftId || id,
          date: new Date(dream.date).toISOString().split('T')[0],
          dateStr: dream.dateStr || buildDateStr(dream.date),
          hasGenerated: (dream.images || []).length > 0
        });
      }
    }).catch((err) => {
      wx.hideLoading();
      console.error('load dream failed:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  buildCustomScenes() {
    if (!this.data.useCustomSplit) {
      return [];
    }

    const scenes = this.data.sceneInputs
      .slice(0, this.data.imageCount)
      .map((item) => String(item || '').trim())
      .filter(Boolean);

    if (scenes.length !== this.data.imageCount) {
      wx.showToast({
        title: '请填写每张图对应的内容',
        icon: 'none'
      });
      return null;
    }

    return scenes;
  },

  generateDreamImages() {
    if (!app.requireLogin('/pages/dream/dream')) {
      return;
    }

    if (!String(this.data.content || '').trim()) {
      wx.showToast({ title: '请输入梦境内容', icon: 'none' });
      return;
    }

    const customScenes = this.buildCustomScenes();
    if (customScenes === null) {
      return;
    }

    this.setData({ loading: true, generatingText: '梦境生成中...' });

    wx.cloud.callFunction({
      name: 'createDream',
      data: {
        dreamId: this.data.dreamId || '',
        draftId: this.data.draftId,
        content: this.data.content,
        customScenes
      }
    }).then((res) => {
      this.setData({ loading: false });

      if (!res.result || !res.result.success) {
        wx.showToast({
          title: (res.result && res.result.error) || '生成失败',
          icon: 'none'
        });
        return;
      }

      const generated = res.result.data || {};
      this.setData({
        images: generated.images || [],
        imageFileIds: generated.images || [],
        imagePrompts: generated.imagePrompts || [],
        hasGenerated: true
      });

      wx.showToast({
        title: '已生成，可保存或重新生成',
        icon: 'none'
      });
    }).catch((err) => {
      this.setData({ loading: false });
      console.error('generate image failed:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  saveDream() {
    if (!app.requireLogin('/pages/dream/dream')) {
      return;
    }

    if (!String(this.data.content || '').trim()) {
      wx.showToast({ title: '请输入梦境内容', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...' });

    wx.cloud.callFunction({
      name: 'saveDream',
      data: {
        dreamId: this.data.dreamId || '',
        draftId: this.data.draftId,
        content: this.data.content,
        date: this.data.date,
        images: this.data.imageFileIds && this.data.imageFileIds.length > 0 ? this.data.imageFileIds : this.data.images,
        imagePrompts: this.data.imagePrompts,
        interpretation: stripMarkdownSyntax(this.data.interpretation || '')
      }
    }).then((res) => {
      wx.hideLoading();

      if (!res.result || !res.result.success) {
        wx.showToast({
          title: (res.result && res.result.error) || '保存失败',
          icon: 'none'
        });
        return;
      }

      const dream = res.result.data;
      this.setData({
        dreamId: dream._id,
        draftId: dream.draftId || this.data.draftId || dream._id,
        isNew: false,
        dateStr: dream.dateStr || this.data.dateStr
      });

      wx.showToast({ title: '保存成功', icon: 'success' });
    }).catch((err) => {
      wx.hideLoading();
      console.error('save dream failed:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    wx.previewImage({
      current: src,
      urls: this.data.images
    });
  },

  goToInterpret() {
    if (!this.data.dreamId) {
      wx.showToast({ title: '请先保存梦境', icon: 'none' });
      return;
    }

    if (this.data.interpretation) {
      wx.showModal({
        title: '已解梦',
        content: '这条梦境已经解梦过了，是否重新解梦？',
        confirmText: '重新解梦',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: `/pages/interpret/interpret?ids=${this.data.dreamId}`
            });
          }
        }
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/interpret/interpret?ids=${this.data.dreamId}`
    });
  }
});
