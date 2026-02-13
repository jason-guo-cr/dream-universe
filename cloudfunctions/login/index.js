// cloudfunctions/login/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    const userRes = await db.collection('users').where({
      openid: openid
    }).get();
    
    let user;
    if (userRes.data.length === 0) {
      const nicknames = ['梦旅人', '星空客', '云端者', '月下眠', '晨曦梦', '星河游'];
      const nickname = nicknames[Math.floor(Math.random() * nicknames.length)] + 
                       Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      
      user = {
        openid: openid,
        nickname: nickname,
        avatarUrl: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('users').add({
        data: user
      });
    } else {
      user = userRes.data[0];
    }
    
    return {
      success: true,
      data: user
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
