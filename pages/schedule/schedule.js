const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
const cloud = require("../../utils/cloud.js");

Page({
  data: {
    date: "",
    displayDate: "",
    mode: "create", // create / view
    isReadOnly: false,
    hasSchedule: false, // 当日是否已有保存的日程（用于显示删除按钮）
    hasSelectedProject: false, // 是否有已关联项目（用于待办栏「点击完成」空态）

    todo: "",
    projects: [] // {id, projectName, projectType, color, selected, completed}
  },

  onLoad(options) {
    const date = options.date;
    const mode = options.mode || "create";

    const displayDate = this.formatDisplayDate(date);

    this.setData({
      date,
      displayDate,
      mode,
      isReadOnly: mode === "view"
    });

    // 先尝试从云端同步日程与企划，再加载本页
    if (cloud.isCloudEnabled()) {
      Promise.all([
        cloud.getProjectsFromCloud(),
        cloud.getSchedulesFromCloud()
      ]).then(() => this.loadProjectsAndSchedule()).catch(() => this.loadProjectsAndSchedule());
    } else {
      this.loadProjectsAndSchedule();
    }
  },

  formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map((n) => Number(n));
    const jsDate = new Date(y, m - 1, d);
    const dayName = DAY_NAMES[jsDate.getDay()];
    return `${y} 年 ${m} 月 ${d} 日（周${dayName}）`;
  },

  // 读取所有项目和当前日期的日程
  loadProjectsAndSchedule() {
    const { date, mode } = this.data;

    const allProjects = wx.getStorageSync("projects") || [];
    const schedules = wx.getStorageSync("schedules") || {};
    const schedule = schedules[date];

    let selectedIds = [];
    let todo = "";

    let completedIds = [];
    if (schedule) {
      selectedIds = schedule.projectIds || [];
      todo = schedule.todo || "";
      completedIds = schedule.completedProjectIds || [];
    }

    const projects = allProjects.map((p) => ({
      id: p.id,
      projectName: p.projectName,
      projectType: p.projectType,
      color: p.color,
      selected: selectedIds.includes(p.id),
      completed: completedIds.includes(p.id)
    }));

    this.setData({
      projects,
      todo,
      hasSchedule: !!schedule,
      hasSelectedProject: projects.some((p) => p.selected),
      isReadOnly: mode === "view" && !!schedule
    });
  },

  // 切换选择项目（彩色圆点）
  onToggleProject(e) {
    if (this.data.isReadOnly) return;

    const id = e.currentTarget.dataset.id;
    const projects = this.data.projects.map((p) =>
      p.id === id ? Object.assign({}, p, { selected: !p.selected }) : p
    );
    this.setData({
      projects,
      hasSelectedProject: projects.some((p) => p.selected)
    });
  },

  // 切换关联项目的「已完成」状态（查看/编辑模式下均可点击，查看模式下会立即写入存储）
  onToggleCompleted(e) {
    const id = e.currentTarget.dataset.id;
    const projects = this.data.projects.map((p) =>
      p.id === id ? Object.assign({}, p, { completed: !p.completed }) : p
    );
    this.setData({ projects });

    if (this.data.isReadOnly && this.data.date) {
      const selected = projects.filter((p) => p.selected);
      const completedProjectIds = selected.filter((p) => p.completed).map((p) => p.id);
      const schedules = wx.getStorageSync("schedules") || {};
      const existing = schedules[this.data.date] || {};
      const updated = {
        ...existing,
        date: this.data.date,
        completedProjectIds
      };
      schedules[this.data.date] = updated;
      wx.setStorageSync("schedules", schedules);
      cloud.saveScheduleToCloud(this.data.date, updated).catch(() => {});
      wx.showToast({ title: "已更新", icon: "success" });
    }
  },

  onTodoInput(e) {
    if (this.data.isReadOnly) return;
    this.setData({ todo: e.detail.value });
  },

  onEditTap() {
    this.setData({ isReadOnly: false, mode: "edit" });
  },

  onSaveTap() {
    const { date, todo, projects } = this.data;
    if (!date) return;

    const selected = projects.filter((p) => p.selected);
    const projectIds = selected.map((p) => p.id);
    const projectColors = selected.map((p) => p.color);
    const completedProjectIds = selected.filter((p) => p.completed).map((p) => p.id);

    const schedules = wx.getStorageSync("schedules") || {};
    schedules[date] = {
      date,
      todo,
      projectIds,
      projectColors,
      completedProjectIds
    };

    wx.setStorageSync("schedules", schedules);

    cloud.saveScheduleToCloud(date, schedules[date]).catch(() => {});

    wx.showToast({
      title: "已保存",
      icon: "success"
    });

    setTimeout(() => {
      wx.navigateBack();
    }, 600);
  },

  // 删除当日日程
  onDeleteTap() {
    const { date } = this.data;
    if (!date) return;

    wx.showModal({
      title: "删除日程",
      content: "确定要删除该日期的日程吗？",
      confirmText: "删除",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;

        const schedules = wx.getStorageSync("schedules") || {};
        delete schedules[date];
        wx.setStorageSync("schedules", schedules);

        cloud.deleteScheduleFromCloud(date).catch(() => {});

        wx.showToast({ title: "已删除", icon: "success" });
        setTimeout(() => wx.navigateBack(), 600);
      }
    });
  }
});