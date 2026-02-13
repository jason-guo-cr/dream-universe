// cloudfunctions/interpretDream/index.js
const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function createAI(envId) {
  const app = envId ? tcb.init({ env: envId }) : tcb.init();
  return app.ai();
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const envId = wxContext.ENV || process.env.TCB_ENV;
  const { dreamIds } = event;
  
  try {
    const dreamsRes = await db.collection('dreams')
      .where({
        _id: db.command.in(dreamIds),
        openid: openid
      })
      .get();
    
    if (dreamsRes.data.length === 0) {
      throw new Error('未找到相关梦境记录');
    }
    
    const dreams = dreamsRes.data;
    
    const dreamContents = dreams.map((d, i) => 
      `梦境${i + 1}（${new Date(d.date).toLocaleDateString('zh-CN')}）：${d.content}`
    ).join('\n\n');
    
    let interpretation = '';

    try {
      const ai = createAI(envId);
      const textModel = ai.createModel('hunyuan-exp');
      const interpretResult = await textModel.generateText({
        model: 'hunyuan-2.0-instruct-20251111',
        messages: [{
          role: 'user',
          content: `请类比周公解梦，为以下梦境进行解析：\n\n${dreamContents}\n\n请从心理学、潜意识、象征意义等角度进行分析，给出温暖、鼓励、富有洞察力的解读。格式要求：\n1. 先总结梦境中的主要元素和情感\n2. 分别解读各梦境的可能含义\n3. 给出积极的生活建议\n4. 语言要温暖、富有诗意`
        }]
      });

      interpretation = interpretResult && interpretResult.text ? interpretResult.text : '';
    } catch (aiErr) {
      console.error('AI解梦失败:', aiErr && aiErr.message ? aiErr.message : aiErr, aiErr && aiErr.errCode ? `errCode=${aiErr.errCode}` : '');
      interpretation = '抱歉，解梦服务暂时不可用。请稍后再试。';
    }
    
    await db.collection('dreams').where({
      _id: db.command.in(dreamIds),
      openid: openid
    }).update({
      data: {
        interpretation: interpretation,
        updatedAt: new Date()
      }
    });
    
    return {
      success: true,
      data: {
        interpretation: interpretation,
        dreams: dreams.map(d => ({
          _id: d._id,
          date: d.date,
          content: d.content,
          images: d.images,
          dateStr: new Date(d.date).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        }))
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
