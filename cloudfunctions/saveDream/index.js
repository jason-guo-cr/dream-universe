const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function parseDateInput(date) {
  if (!date) {
    return new Date(Date.now() - 86400000);
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? new Date(Date.now() - 86400000) : parsed;
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const {
    dreamId,
    draftId,
    content,
    date,
    images = [],
    imagePrompts = [],
    interpretation
  } = event;

  const normalizedContent = String(content || '').trim();
  const normalizedDraftId = String(draftId || '').trim();
  if (!normalizedContent) {
    return {
      success: false,
      error: 'content is required'
    };
  }

  const payload = {
    content: normalizedContent,
    date: parseDateInput(date),
    images: Array.isArray(images) ? images : [],
    imagePrompts: Array.isArray(imagePrompts) ? imagePrompts : [],
    updatedAt: new Date()
  };

  if (normalizedDraftId) {
    payload.draftId = normalizedDraftId;
  }

  try {
    if (dreamId) {
      const docRes = await db.collection('dreams').where({
        _id: dreamId,
        openid
      }).limit(1).get();

      if (!docRes.data.length) {
        return {
          success: false,
          error: 'dream not found'
        };
      }

      if (typeof interpretation === 'string') {
        payload.interpretation = interpretation;
      }

      await db.collection('dreams').doc(dreamId).update({ data: payload });

      const updated = { ...docRes.data[0], ...payload, _id: dreamId };
      return {
        success: true,
        data: {
          ...updated,
          dateStr: new Date(updated.date).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        }
      };
    }

    if (normalizedDraftId) {
      const draftRes = await db.collection('dreams').where({
        openid,
        draftId: normalizedDraftId
      }).limit(1).get();

      if (draftRes.data.length) {
        const existingDream = draftRes.data[0];

        if (typeof interpretation === 'string') {
          payload.interpretation = interpretation;
        }

        await db.collection('dreams').doc(existingDream._id).update({ data: payload });

        const updated = { ...existingDream, ...payload, _id: existingDream._id };
        return {
          success: true,
          data: {
            ...updated,
            dateStr: new Date(updated.date).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          }
        };
      }
    }

    const record = {
      openid,
      ...payload,
      interpretation: typeof interpretation === 'string' ? interpretation : '',
      createdAt: new Date()
    };

    const addRes = await db.collection('dreams').add({ data: record });

    return {
      success: true,
      data: {
        ...record,
        _id: addRes._id,
        dateStr: new Date(record.date).toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
