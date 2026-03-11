const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');
const https = require('https');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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
    .replace(/["'“”‘’.,!?;:，。！？；：（）\[\]{}<>]/g, ' ')
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
      console.error('parse scene plan failed:', err && err.message ? err.message : err);
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

function getImageExtension(url) {
  try {
    const parsedUrl = new URL(url);
    const match = parsedUrl.pathname.match(/\.(png|jpg|jpeg|webp)$/i);
    return match && match[1] ? match[1].toLowerCase() : 'png';
  } catch (err) {
    return 'png';
  }
}

function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`download image failed, status: ${res.statusCode}`));
        res.resume();
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.setTimeout(15000, () => {
      req.destroy(new Error('download image timeout'));
    });
    req.on('error', reject);
  });
}

async function persistImageToCloudStorage(imageUrl, openid, index) {
  const fileContent = await downloadImageBuffer(imageUrl);
  const ext = getImageExtension(imageUrl);
  const fileKey = crypto.randomBytes(6).toString('hex');
  const cloudPath = `dreams/${openid}/${Date.now()}-${index + 1}-${fileKey}.${ext}`;

  const uploadRes = await cloud.uploadFile({
    cloudPath,
    fileContent
  });

  return uploadRes && uploadRes.fileID ? uploadRes.fileID : '';
}

function normalizeCustomScenes(customScenes) {
  if (!Array.isArray(customScenes)) {
    return [];
  }
  return dedupePromptList(
    customScenes
      .map(scene => String(scene || '').trim())
      .filter(Boolean)
  ).slice(0, MAX_SCENE_COUNT);
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const envId = wxContext.ENV || process.env.TCB_ENV;
  const { content, customScenes } = event;

  if (!String(content || '').trim()) {
    return {
      success: false,
      error: 'content is required'
    };
  }

  try {
    let prompts = [];
    const images = [];

    try {
      const ai = createAI(envId);
      const imageModel = ai.createImageModel('hunyuan-image');
      prompts = normalizeCustomScenes(customScenes);

      if (prompts.length === 0) {
        const textModel = ai.createModel('hunyuan-exp');
        const promptResult = await textModel.generateText({
          model: 'hunyuan-2.0-instruct-20251111',
          messages: [{
            role: 'user',
            content: `You are a storyboard planner for dream visualization.
Given the dream content below, decide whether to generate 1-3 images and split scenes only when necessary.

Dream content: ${content}

Rules:
1. Use 1 image for single short scene (typically <= 30 Chinese chars).
2. Use 2 images only when there is clear scene transition.
3. Use 3 images only when all 3 scenes are necessary and distinct.
4. Never split just to hit a higher count.

Output strict JSON only:
{
  "sceneCount": 1,
  "scenes": [
    { "id": 1, "prompt": "English prompt for image generation" }
  ]
}

Constraints:
- prompt must be in English
- prompts must be visually distinct
- no duplicated or near-duplicate prompts
- sceneCount must be 1-3`
          }]
        });

        const promptText = (promptResult && promptResult.text ? promptResult.text : '');
        const plan = parseScenePlan(promptText);
        let sceneCount = plan.sceneCount;
        if (shouldForceSingleScene(content)) {
          sceneCount = 1;
        }
        prompts = plan.prompts.slice(0, sceneCount);
      }

      if (prompts.length === 0) {
        prompts = [
          `surreal dreamscape inspired by ${String(content || '').slice(0, 80)}, ethereal atmosphere, cinematic lighting, high detail`
        ];
      }

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
            const fileId = await persistImageToCloudStorage(imageUrl, openid, index);
            if (fileId) {
              images.push(fileId);
            }
          }
        } catch (imgErr) {
          console.error('generate image failed:', imgErr && imgErr.message ? imgErr.message : imgErr);
        }
      }
    } catch (aiErr) {
      console.error('AI generation failed:', aiErr && aiErr.message ? aiErr.message : aiErr, aiErr && aiErr.errCode ? `errCode=${aiErr.errCode}` : '');
    }

    return {
      success: true,
      data: {
        images,
        imagePrompts: prompts
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
};
