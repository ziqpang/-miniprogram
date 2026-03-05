const cloud = require("../../utils/cloud.js");

Page({
  data: {
    weekDays: ["一", "二", "三", "四", "五", "六", "日"],
    months: [],
    covers: [],
    syncing: false
  },

  onLoad() {
    this.syncAndLoad();
  },

  onShow() {
    // 从日程页/企划页返回时刷新列表与月历（先尝试云端同步再渲染）
    this.syncAndLoad();
  },

  // 先从云端拉取最新数据并写入本地，再渲染
  syncAndLoad() {
    if (!cloud.isCloudEnabled()) {
      this.loadCoversFromStorage();
      this.initCalendar();
      return;
    }
    this.setData({ syncing: true });
    Promise.all([
      cloud.getProjectsFromCloud(),
      cloud.getSchedulesFromCloud()
    ])
      .then(() => {
        this.loadCoversFromStorage();
        this.initCalendar();
      })
      .catch(() => {
        this.loadCoversFromStorage();
        this.initCalendar();
      })
      .finally(() => this.setData({ syncing: false }));
  },

  // 比衬底深、比数字浅：衬底色按 ratio 加深，用作爱心色（数字为 #111827）
  darkenForHeart(hex, ratio) {
    if (!hex || hex === "transparent") return "#6b7280";
    hex = String(hex).replace(/^#/, "");
    if (hex.length !== 6) return "#6b7280";
    const k = ratio != null ? ratio : 0.72;
    const r = Math.floor(parseInt(hex.slice(0, 2), 16) * k);
    const g = Math.floor(parseInt(hex.slice(2, 4), 16) * k);
    const b = Math.floor(parseInt(hex.slice(4, 6), 16) * k);
    return "#" + [r, g, b].map((x) => Math.min(255, x).toString(16).padStart(2, "0")).join("");
  },

  // 节点进度与中文标签对应（与 new-project 的 nodes 一致）
  NODE_LABELS: {
    selectImage: "选图",
    design: "设计",
    sample: "打样",
    marketing: "宣发",
    launch: "上架",
    afterSale: "售后",
    soldOut: "完售"
  },

  // 从本地存储加载企划列表（统一数据源）
  loadCoversFromStorage() {
    let projects = wx.getStorageSync("projects") || [];
    projects = projects.map((p) => {
      if (!p.id) p.id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      return p;
    });
    if (projects.length > 0) wx.setStorageSync("projects", projects);

    const labels = this.NODE_LABELS;
    const covers = projects.map((p) => ({
      src: p.coverImage || "",
      label: p.projectName || (p.projectType === "activity" ? "活动" : "企划"),
      color: p.color || "",
      project: p,
      progressLabel: labels[p.currentNode] || "选图"
    }));
    this.setData({ covers });
  },

  initCalendar() {
    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth(); // 0-11

    const nextYear =
      currentMonthIndex === 11 ? currentYear + 1 : currentYear;
    const nextMonthIndex =
      currentMonthIndex === 11 ? 0 : currentMonthIndex + 1;

    const currentMonthData = this.generateMonthData(
      currentYear,
      currentMonthIndex,
      "本月",
      "当前月"
    );

    const nextMonthData = this.generateMonthData(
      nextYear,
      nextMonthIndex,
      "下月",
      "下个月"
    );

    // 根据已保存的日程：多企划日期用更淡的灰，单企划用该企划颜色；无关联企划的日程在日期下显示黑点
    const schedules = wx.getStorageSync("schedules") || {};
    const multiColorGray = "#e5e7eb"; /* 调淡的多企划灰色 */
    [currentMonthData, nextMonthData].forEach((monthData) => {
      (monthData.days || []).forEach((day) => {
        if (!day.fullDate) return;
        const schedule = schedules[day.fullDate];
        if (!schedule) return;
        const hasProjects = schedule.projectIds && schedule.projectIds.length > 0;
        if (hasProjects && schedule.projectColors && schedule.projectColors.length > 0) {
          day.dateBgColor = schedule.projectColors.length > 1 ? multiColorGray : schedule.projectColors[0];
        }
        if (!hasProjects) day.showNoProjectDot = true; // 有日程但未关联企划，显示黑点
        const hasCompleted = schedule.completedProjectIds && schedule.completedProjectIds.length > 0;
        if (hasCompleted) {
          day.showHeart = true;
          day.heartColor = this.darkenForHeart(day.dateBgColor || (day.isCurrentMonth ? "#f9fafb" : "#e5e7eb"), 0.72);
        }
      });
    });

    this.setData({
      months: [currentMonthData, nextMonthData]
    });
  },

  // 生成某年某月的 7x6 日历数据（按周一开始）
  generateMonthData(year, monthIndex, title, tag) {
    const monthNumber = monthIndex + 1;

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const firstDayIndex = (firstDay + 6) % 7; // 周一=0

    const days = [];
    const totalCells = 42;

    for (let i = 0; i < totalCells; i++) {
      const dateNum = i - firstDayIndex + 1;
      const isCurrentMonth = dateNum >= 1 && dateNum <= daysInMonth;

      let fullDate = "";
      if (isCurrentMonth) {
        const mm = String(monthNumber).padStart(2, "0");
        const dd = String(dateNum).padStart(2, "0");
        fullDate = `${year}-${mm}-${dd}`;
      }

      days.push({
        date: isCurrentMonth ? dateNum : "",
        isCurrentMonth,
        hasPlan: false,
        fullDate
      });
    }

    return {
      title,
      subtitle: `${year} 年 ${monthNumber} 月`,
      tag,
      days
    };
  },

  // 点击日期：跳到新建 / 查看日程
  onDayTap(e) {
    const dateStr = e.currentTarget.dataset.date;
    if (!dateStr) return; // 空白格子直接忽略

    const schedules = wx.getStorageSync("schedules") || {};
    const hasSchedule = !!schedules[dateStr];
    const mode = hasSchedule ? "view" : "create";

    wx.navigateTo({
      url: `/pages/schedule/schedule?date=${dateStr}&mode=${mode}`
    });
  },

  // 点击现有企划格子：查看 / 编辑
  onProjectTap(e) {
    const index = e.currentTarget.dataset.index;
    const covers = this.data.covers;
    const cover = covers[index];
    if (!cover || !cover.project) {
      return;
    }

    const that = this;

    wx.navigateTo({
      url: "/pages/new-project/new-project?mode=view",
      events: {
        projectSaved() {
          that.loadCoversFromStorage();
        }
      },
      success(res) {
        res.eventChannel.emit("initProject", cover.project);
      }
    });
  },

  // 点击唯一的 + 号：新建企划
  onAddProjectTap() {
    const that = this;

    wx.navigateTo({
      url: "/pages/new-project/new-project?mode=create",
      events: {
        projectSaved() {
          that.loadCoversFromStorage();
        }
      }
    });
  }
});