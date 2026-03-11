// cloudfunctions/interpretDream/index.js
const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MAX_DREAM_IDS = 3;
const MAX_CONTENT_LEN_PER_DREAM = 180;
const MAX_OUTPUT_LEN = 2000;
const RETRY_DELAY_MS = 1200;

const MODEL_CANDIDATES = [
  { provider: 'hunyuan-exp', model: 'hunyuan-2.0-instruct-20251111' },
  { provider: 'deepseek', model: 'deepseek-v3.2' }
];

function createAI(envId) {
  const app = envId ? tcb.init({ env: envId }) : tcb.init();
  return app.ai();
}

function formatDateCN(dateLike) {
  const date = new Date(dateLike || Date.now());
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function compactText(text, maxLen) {
  return String(text || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function buildDreamContents(dreams) {
  return dreams
    .slice(0, MAX_DREAM_IDS)
    .map((d, i) => `梦境${i + 1}（${formatDateCN(d.date)}）：${compactText(d.content, MAX_CONTENT_LEN_PER_DREAM)}`)
    .join('\n\n');
}

function buildMessages(dreamContents) {
  return [{
    role: 'system',
    content: '你是一位温暖、专业、克制的解梦顾问，避免绝对化判断，不制造焦虑。'
  }, {
    role: 'user',
    content: `请分析以下梦境：\n\n${dreamContents}\n\n请按结构输出：\n1) 核心元素与情绪总结\n2) 分别解读每个梦境可能含义\n3) 给出2-3条积极、可执行建议\n要求：语言自然、简洁，不超过800字。`
  }];
}

async function streamGenerate(modelClient, modelName, messages) {
  const streamResult = await modelClient.streamText({
    model: modelName,
    messages
  });

  let text = '';
  for await (const chunk of streamResult.textStream) {
    text += chunk;
    if (text.length >= MAX_OUTPUT_LEN) {
      break;  
    }
  }

  return text.trim();
}

async function generateWithRetry(ai, messages, traceId) {
  const errorHistory = [];

  for (const candidate of MODEL_CANDIDATES) {
    const modelClient = ai.createModel(candidate.provider);

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        console.log('[interpretDream] AI attempt start', {
          traceId,
          provider: candidate.provider,
          model: candidate.model,
          attempt
        });

        const interpretation = await streamGenerate(modelClient, candidate.model, messages);

        if (!interpretation) {
          throw new Error('empty interpretation from streamText');
        }

        console.log('[interpretDream] AI attempt success', {
          traceId,
          provider: candidate.provider,
          model: candidate.model,
          attempt,
          interpretationLength: interpretation.length
        });

        return {
          interpretation,
          aiMeta: {
            ok: true,
            provider: candidate.provider,
            model: candidate.model,
            attempt
          }
        };
      } catch (err) {
        const message = err && err.message ? err.message : String(err || '');
        errorHistory.push(`${candidate.provider}/${candidate.model}#${attempt}: ${message}`);

        console.error('[interpretDream] AI attempt failed', {
          traceId,
          provider: candidate.provider,
          model: candidate.model,
          attempt,
          message,
          stack: err && err.stack ? err.stack : ''
        });

        if (attempt < 2) {
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }
  }

  throw new Error(`all model attempts failed: ${errorHistory.join(' | ')}`);
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const envId = wxContext.ENV || process.env.TCB_ENV;
  const dreamIds = Array.isArray(event && event.dreamIds) ? event.dreamIds.slice(0, MAX_DREAM_IDS) : [];
  const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  console.log('[interpretDream] request start', {
    traceId,
    envId,
    openid: openid ? `${openid.slice(0, 6)}***` : '',
    dreamIdsCount: dreamIds.length
  });

  try {
    if (dreamIds.length === 0) {
      throw new Error('dreamIds is required');
    }

    const dreamsRes = await db.collection('dreams')
      .where({
        _id: db.command.in(dreamIds),
        openid
      })
      .get();

    if (!dreamsRes.data || dreamsRes.data.length === 0) {
      throw new Error('未找到相关梦境记录');
    }

    const dreams = dreamsRes.data;
    const dreamContents = buildDreamContents(dreams);
    const messages = buildMessages(dreamContents);

    let interpretation = '';
    let aiMeta = { ok: true };

    try {
      const ai = createAI(envId);
      const result = await generateWithRetry(ai, messages, traceId);
      interpretation = result.interpretation;
      aiMeta = result.aiMeta;
    } catch (aiErr) {
      aiMeta = {
        ok: false,
        message: aiErr && aiErr.message ? aiErr.message : String(aiErr || '')
      };

      console.error('[interpretDream] AI failed finally', {
        traceId,
        message: aiMeta.message,
        stack: aiErr && aiErr.stack ? aiErr.stack : ''
      });

      interpretation = '抱歉，解梦服务暂时不可用。请稍后再试。';
    }

    await db.collection('dreams')
      .where({
        _id: db.command.in(dreamIds),
        openid
      })
      .update({
        data: {
          interpretation,
          updatedAt: new Date()
        }
      });

    console.log('[interpretDream] request success', {
      traceId,
      aiOk: aiMeta.ok,
      dreamsCount: dreams.length
    });

    return {
      success: true,
      data: {
        traceId,
        aiMeta,
        interpretation,
        dreams: dreams.map(d => ({
          _id: d._id,
          date: d.date,
          content: d.content,
          images: d.images,
          dateStr: formatDateCN(d.date)
        }))
      }
    };
  } catch (err) {
    console.error('[interpretDream] request failed', {
      traceId,
      message: err && err.message ? err.message : String(err || ''),
      stack: err && err.stack ? err.stack : ''
    });

    return {
      success: false,
      error: err && err.message ? err.message : '解梦失败',
      traceId
    };
  }
};
