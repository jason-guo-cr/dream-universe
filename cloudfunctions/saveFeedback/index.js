const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const {
    content,
    contact = '',
    nickname = '',
    source = 'profile'
  } = event;

  const normalizedContent = String(content || '').trim();
  if (!normalizedContent) {
    return {
      success: false,
      error: 'content is required'
    };
  }

  const record = {
    openid,
    nickname: String(nickname || '').trim(),
    content: normalizedContent,
    contact: String(contact || '').trim(),
    source: String(source || 'profile').trim(),
    status: 'new',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    const res = await db.collection('feedbacks').add({
      data: record
    });

    return {
      success: true,
      data: {
        ...record,
        _id: res._id
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
