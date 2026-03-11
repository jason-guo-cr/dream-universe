const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function normalizeImageRef(image) {
  if (typeof image !== 'string') {
    return '';
  }

  if (image.startsWith('cloud://')) {
    return image;
  }

  try {
    const parsed = new URL(image);
    const host = parsed.hostname || '';
    const isCloudbaseTempUrl = host.endsWith('.tcb.qcloud.la') || host.endsWith('.tcloudbaseapp.com');
    if (!isCloudbaseTempUrl) {
      return image;
    }

    const bucket = host.split('.')[0];
    const cloudPath = parsed.pathname.replace(/^\/+/, '');
    const envId = process.env.TCB_ENV || cloud.DYNAMIC_CURRENT_ENV;

    if (!bucket || !cloudPath || !envId) {
      return image;
    }

    return `cloud://${envId}.${bucket}/${cloudPath}`;
  } catch (err) {
    return image;
  }
}

async function resolveImageUrls(dreams) {
  const fileIds = [];

  dreams.forEach((dream) => {
    const images = Array.isArray(dream.images) ? dream.images : [];
    images.forEach((image) => {
      const normalized = normalizeImageRef(image);
      if (normalized.startsWith('cloud://')) {
        fileIds.push(normalized);
      }
    });
  });

  const uniqueFileIds = Array.from(new Set(fileIds));
  const tempUrlMap = new Map();

  if (uniqueFileIds.length > 0) {
    const tempRes = await cloud.getTempFileURL({
      fileList: uniqueFileIds
    });

    (tempRes.fileList || []).forEach((item) => {
      const fileId = item.fileID || item.fileId;
      const tempUrl = item.tempFileURL || item.tempFileUrl || '';
      if (fileId && tempUrl) {
        tempUrlMap.set(fileId, tempUrl);
      }
    });
  }

  return dreams.map((dream) => {
    const originalImages = Array.isArray(dream.images) ? dream.images : [];
    const imageFileIds = originalImages.map(normalizeImageRef);
    const images = imageFileIds.map((image) => {
      if (image.startsWith('cloud://')) {
        return tempUrlMap.get(image) || image;
      }
      return image;
    });

    return {
      ...dream,
      imageFileIds,
      images
    };
  });
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { page = 1, pageSize = 10, dreamIds, selectedMonth } = event;

  try {
    let query;

    if (Array.isArray(dreamIds) && dreamIds.length > 0) {
      query = db.collection('dreams').where({
        _id: db.command.in(dreamIds),
        openid
      });
    } else {
      const where = { openid };

      if (typeof selectedMonth === 'string' && /^\d{4}-\d{2}$/.test(selectedMonth)) {
        const [yearText, monthText] = selectedMonth.split('-');
        const year = Number(yearText);
        const month = Number(monthText);

        if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
          const monthStart = new Date(year, month - 1, 1);
          const monthEnd = new Date(year, month, 1);
          where.date = db.command.gte(monthStart).and(db.command.lt(monthEnd));
        }
      }

      query = db.collection('dreams').where(where);
    }

    const res = await query
      .orderBy('date', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const dreamsWithDate = res.data.map((dream) => ({
      ...dream,
      dateStr: new Date(dream.date).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }));

    const dreams = await resolveImageUrls(dreamsWithDate);

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
