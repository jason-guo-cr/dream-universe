Page({
  data: {
    dreamList: [],
    loading: false,
    showTip: false,
    tipTitle: "",
    tipContent: ""
  },

  onLoad() {
    this.loadDreamList();
  },

  onShow() {
    this.loadDreamList();
  },

  async loadDreamList() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: "dreamFunctions",
        data: {
          type: "getDreamList",
          limit: 50
        }
      });

      if (result.result.success) {
        const dreamList = result.result.data.map(dream => ({
          ...dream,
          createTime: this.formatDate(dream.createTime)
        }));
        
        this.setData({
          dreamList
        });
      }
    } catch (e) {
      console.error("加载梦境列表失败:", e);
    } finally {
      this.setData({ loading: false });
    }
  },

  onAddDream() {
    wx.navigateTo({
      url: "/pages/dream-input/index"
    });
  },

  onDreamTap(e) {
    const { index } = e.currentTarget.dataset;
    const dream = this.data.dreamList[index];
    
    wx.showModal({
      title: dream.title,
      content: `${dream.summary}\n\n${dream.content}`,
      showCancel: false
    });
  },

  onLongPressDream(e) {
    const { index } = e.currentTarget.dataset;
    const dream = this.data.dreamList[index];

    wx.showModal({
      title: "提示",
      content: "确定要删除这个梦境吗？",
      success: (res) => {
        if (res.confirm) {
          this.deleteDream(dream._id);
        }
      }
    });
  },

  async deleteDream(_id) {
    wx.showLoading({
      title: "删除中...",
      mask: true
    });

    try {
      const result = await wx.cloud.callFunction({
        name: "dreamFunctions",
        data: {
          type: "deleteDream",
          data: {
            _id
          }
        }
      });

      if (result.result.success) {
        wx.showToast({
          title: "删除成功",
          icon: "success"
        });
        this.loadDreamList();
      } else {
        throw new Error(result.result.errMsg);
      }
    } catch (e) {
      console.error("删除失败:", e);
      wx.showToast({
        title: "删除失败",
        icon: "none"
      });
    } finally {
      wx.hideLoading();
    }
  },

  formatDate(serverDate) {
    if (!serverDate) return "";
    const date = new Date(serverDate.$date || serverDate);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hour}:${minute}`;
  }
});
