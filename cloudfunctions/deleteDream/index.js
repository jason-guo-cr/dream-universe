const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { dreamId } = event;

  if (!dreamId) {
    return {
      success: false,
      error: 'dreamId is required'
    };
  }

  try {
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

    await db.collection('dreams').doc(dreamId).remove();
    return {
      success: true,
      data: { dreamId }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
