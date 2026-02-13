// cloudfunctions/createDream/index.js
const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MAX_SCENE_COUNT = 3;
const SINGLE_SCENE_MAX_LEN = 30;
const MULTI_SCENE_HINTS = [
  '然后',
  '接着',
  '随后',
  '后来',
  '同时',
  '突然',
  '先',
  '再',
  '最后',
  '场景',
  '画面',
  '切换',
  '来到',
  '变成',
  '之后',
  '与此同时'
];

function createAI(envId) {
  const app = envId ? tcb.init({ env: envId }) : tcb.init();
  return app.ai();
}

function normalizePromptText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u3000\s]+/g, ' ')
    .replace(/["'“”‘’`.,!?;:，。！？；：()（）\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeJaccardSimilarity(a, b) {
  const aSet = new Set(normalizePromptText(a).split(' ').filter(Boolean));
  const bSet = new Set(normalizePromptText(b).split(' ').filter(Boolean));
  if (aSet.size === 0 || bSet.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const item of aSet) {
    if (bSet.has(item)) {
      intersectionSize += 1;
    }
  }

  const unionSize = aSet.size + bSet.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

function dedupePromptList(promptList) {
  const deduped = [];
  for (const rawPrompt of promptList || []) {
    const prompt = String(rawPrompt || '').replace(/^[\-\d\.\s]+/, '').trim();
    if (!prompt) {
      continue;
    }

    const normalizedPrompt = normalizePromptText(prompt);
    const isDuplicate = deduped.some(existing => {
      const normalizedExisting = normalizePromptText(existing);
      if (!normalizedExisting || !normalizedPrompt) {
        return false;
      }
      if (
        normalizedPrompt === normalizedExisting ||
        normalizedPrompt.includes(normalizedExisting) ||
        normalizedExisting.includes(normalizedPrompt)
      ) {
        return true;
      }
      return computeJaccardSimilarity(existing, prompt) >= 0.82;
    });

    if (!isDuplicate) {
      deduped.push(prompt);
    }
  }
  return deduped;
}

function extractJsonBlock(rawText) {
  const text = String(rawText || '').trim();
  if (!text) {
    return '';
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim();
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return '';
}

function parseScenePlan(rawText) {
  const jsonBlock = extractJsonBlock(rawText);
  let sceneCount = 1;
  let prompts = [];

  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock);
      const maybeSceneCount = Number(parsed.sceneCount || parsed.scene_count || parsed.count);
      if (Number.isFinite(maybeSceneCount)) {
        sceneCount = Math.floor(maybeSceneCount);
      }

      if (Array.isArray(parsed.scenes)) {
        prompts = parsed.scenes
          .map(scene => {
            if (typeof scene === 'string') {
              return scene;
            }
            if (scene && typeof scene.prompt === 'string') {
              return scene.prompt;
            }
            return '';
          })
          .filter(Boolean);
      }

      if (Array.isArray(parsed.prompts)) {
        prompts = prompts.concat(parsed.prompts.filter(Boolean));
      }
    } catch (err) {
      console.error('解析分镜JSON失败:', err && err.message ? err.message : err);
    }
  }

  if (prompts.length === 0) {
    prompts = String(rawText || '')
      .split(/\r?\n+/)
      .map(line => line.replace(/^[\-\d\.\s]+/, '').trim())
      .filter(Boolean);
  }

  return {
    sceneCount: Math.min(MAX_SCENE_COUNT, Math.max(1, Number.isFinite(sceneCount) ? sceneCount : 1)),
    prompts: dedupePromptList(prompts)
  };
}

function shouldForceSingleScene(content) {
  const text = String(content || '').trim();
  if (!text) {
    return true;
  }

  const hintCount = MULTI_SCENE_HINTS.reduce((count, keyword) => {
    return text.includes(keyword) ? count + 1 : count;
  }, 0);

  if (text.length <= SINGLE_SCENE_MAX_LEN && hintCount <= 1) {
    return true;
  }

  return false;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const envId = wxContext.ENV || process.env.TCB_ENV;
  const { content, date } = event;
  
  try {
    let prompts = [];
    let images = [];
    
    try {
      const ai = createAI(envId);
      const textModel = ai.createModel('hunyuan-exp');
      const imageModel = ai.createImageModel('hunyuan-image');

      const promptResult = await textModel.generateText({
        model: 'hunyuan-2.0-instruct-20251111',
        messages: [{
          role: 'user',
          content: `你是梦境分镜策划师。请根据用户梦境内容决定需要生成几张图（1~3张），并输出严格JSON。\n\n梦境内容：${content}\n\n判定规则：\n1. 单一场景或极短描述（通常<=30字）默认1张。\n2. 存在明显前后转场/两个独立空间才用2张。\n3. 只有当确实存在三个不可合并的连续分镜时才用3张。\n4. 不要为了凑数生成多场景。\n\n输出格式（只允许JSON，不要解释）：\n{\n  "sceneCount": 1,\n  "scenes": [\n    { "id": 1, "prompt": "English prompt for image generation" }\n  ]\n}\n\n要求：\n- prompt必须是英文\n- 多个prompt必须在主体、构图、景别或光线上明显不同\n- 不要输出重复或近似重复prompt\n- sceneCount范围必须是1~3`
        }]
      });

      const promptText = (promptResult && promptResult.text ? promptResult.text : '');
      const plan = parseScenePlan(promptText);
      let sceneCount = plan.sceneCount;
      if (shouldForceSingleScene(content)) {
        sceneCount = 1;
      }

      prompts = plan.prompts.slice(0, sceneCount);

      if (prompts.length === 0) {
        prompts = [
          `surreal dreamscape inspired by ${String(content || '').slice(0, 80)}, ethereal atmosphere, cinematic lighting, high detail`
        ];
      }

      if (prompts.length > 0) {
        for (let index = 0; index < prompts.length; index += 1) {
          const prompt = prompts[index];
          try {
            const seed = Math.floor(Math.random() * 4294967295) + index + 1;
            const imageRes = await imageModel.generateImage({
              model: 'hunyuan-image',
              prompt,
              size: '1024x1024',
              version: 'v1.9',
              seed
            });

            const imageUrl = imageRes && imageRes.data && imageRes.data[0] && imageRes.data[0].url;
            if (imageUrl) {
              images.push(imageUrl);
            }
          } catch (imgErr) {
            console.error('生成图片失败:', imgErr);
          }
        }
      }
    } catch (aiErr) {
      console.error('AI服务调用失败:', aiErr && aiErr.message ? aiErr.message : aiErr, aiErr && aiErr.errCode ? `errCode=${aiErr.errCode}` : '');
    }
    
    const dream = {
      openid: openid,
      content: content,
      date: new Date(date || Date.now() - 86400000),
      images: images,
      imagePrompts: prompts,
      interpretation: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const addRes = await db.collection('dreams').add({
      data: dream
    });
    
    return {
      success: true,
      data: {
        _id: addRes._id,
        ...dream,
        dateStr: new Date(dream.date).toLocaleDateString('zh-CN', {
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
