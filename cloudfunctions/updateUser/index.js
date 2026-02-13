// cloudfunctions/updateUser/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { nickname } = event;
  
  try {
    await db.collection('users').where({
      openid: openid
    }).update({
      data: {
        nickname: nickname,
        updatedAt: new Date()
      }
    });
    
    return {
      success: true,
      data: {
        openid: openid,
        nickname: nickname
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
