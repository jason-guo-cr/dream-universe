// cloudfunctions/getDreams/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { page = 1, pageSize = 10, dreamIds } = event;
  
  try {
    let query;
    
    if (dreamIds) {
      query = db.collection('dreams').where({
        _id: db.command.in(dreamIds),
        openid: openid
      });
    } else {
      query = db.collection('dreams').where({
        openid: openid
      });
    }
    
    const res = await query
      .orderBy('date', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    const dreams = res.data.map(dream => ({
      ...dream,
      dateStr: new Date(dream.date).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }));
    
    return {
      success: true,
      data: dreams
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
