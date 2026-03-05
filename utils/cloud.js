/**
 * 云开发数据层：企划与日程的云端读写，并同步到本地缓存（离线可用）
 */

function getDb() {
  try {
    return wx.cloud.database();
  } catch (e) {
    return null;
  }
}

/**
 * 是否已启用云开发（需在 app.js 中 wx.cloud.init）
 */
function isCloudEnabled() {
  return typeof wx.cloud !== "undefined" && wx.cloud.database;
}

// --------------- 企划 projects ---------------

/**
 * 从云端拉取企划列表，并写入本地缓存
 * @returns {Promise<Array>} 企划列表
 */
function getProjectsFromCloud() {
  const db = getDb();
  if (!db) return Promise.resolve(wx.getStorageSync("projects") || []);

  return db
    .collection("projects")
    .get()
    .then((res) => {
      const list = (res.data || []).map((doc) => ({
        id: doc.projectId || doc._id,
        projectName: doc.projectName,
        projectType: doc.projectType,
        color: doc.color,
        coverImage: doc.coverImage || "",
        projectIntro: doc.projectIntro || "",
        projectNote: doc.projectNote || "",
        currentNode: doc.currentNode || "selectImage",
        products: doc.products || []
      }));
      if (list.length > 0) wx.setStorageSync("projects", list);
      return list;
    })
    .catch(() => wx.getStorageSync("projects") || []);
}

/**
 * 保存单个企划到云端（新增或更新），并更新本地
 * @param {Object} project 企划对象，含 id
 */
function saveProjectToCloud(project) {
  const db = getDb();
  if (!db) {
    return Promise.resolve();
  }
  const id = project.id || project.projectId;
  const record = {
    projectId: id,
    projectName: project.projectName,
    projectType: project.projectType,
    color: project.color,
    coverImage: project.coverImage || "",
    projectIntro: project.projectIntro || "",
    projectNote: project.projectNote || "",
    currentNode: project.currentNode || "selectImage",
    products: project.products || []
  };
  return db
    .collection("projects")
    .where({ projectId: id })
    .get()
    .then((res) => {
      if (res.data && res.data.length > 0) {
        return db.collection("projects").doc(res.data[0]._id).update({ data: record });
      }
      return db.collection("projects").add({ data: { ...record, projectId: id } });
    })
    .catch(() => {});
}

/**
 * 从云端删除企划，并同步清理本地
 * @param {string} projectId
 */
function deleteProjectFromCloud(projectId) {
  const db = getDb();
  if (!db) return Promise.resolve();
  return db
    .collection("projects")
    .where({ projectId })
    .get()
    .then((res) => {
      if (res.data && res.data.length > 0) {
        return db.collection("projects").doc(res.data[0]._id).remove();
      }
    })
    .catch(() => {});
}

// --------------- 日程 schedules ---------------

/**
 * 从云端拉取所有日程，并写入本地缓存
 * @returns {Promise<Object>} { "2025-03-04": { date, todo, projectIds, ... }, ... }
 */
function getSchedulesFromCloud() {
  const db = getDb();
  if (!db) return Promise.resolve(wx.getStorageSync("schedules") || {});

  return db
    .collection("schedules")
    .get()
    .then((res) => {
      const schedules = {};
      (res.data || []).forEach((doc) => {
        if (doc.date) schedules[doc.date] = doc;
      });
      wx.setStorageSync("schedules", schedules);
      return schedules;
    })
    .catch(() => wx.getStorageSync("schedules") || {});
}

/**
 * 保存某日日程到云端，并写本地
 * @param {string} date 日期 "YYYY-MM-DD"
 * @param {Object} data { date, todo, projectIds, projectColors, completedProjectIds }
 */
function saveScheduleToCloud(date, data) {
  const db = getDb();
  if (!db) return Promise.resolve();
  const record = {
    date: data.date || date,
    todo: data.todo || "",
    projectIds: data.projectIds || [],
    projectColors: data.projectColors || [],
    completedProjectIds: data.completedProjectIds || []
  };
  return db
    .collection("schedules")
    .where({ date })
    .get()
    .then((res) => {
      if (res.data && res.data.length > 0) {
        return db.collection("schedules").doc(res.data[0]._id).update({ data: record });
      }
      return db.collection("schedules").add({ data: record });
    })
    .catch(() => {});
}

/**
 * 从云端删除某日日程
 * @param {string} date
 */
function deleteScheduleFromCloud(date) {
  const db = getDb();
  if (!db) return Promise.resolve();
  return db
    .collection("schedules")
    .where({ date })
    .get()
    .then((res) => {
      if (res.data && res.data.length > 0) {
        return db.collection("schedules").doc(res.data[0]._id).remove();
      }
    })
    .catch(() => {});
}

module.exports = {
  isCloudEnabled,
  getProjectsFromCloud,
  saveProjectToCloud,
  deleteProjectFromCloud,
  getSchedulesFromCloud,
  saveScheduleToCloud,
  deleteScheduleFromCloud
};
