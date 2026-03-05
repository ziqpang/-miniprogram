const cloud = require("../../utils/cloud.js");

Page({
  data: {
    mode: "create",       // create / view / edit
    isReadOnly: false,    // 详情只读，编辑/新建可修改
    projectId: "",       // 编辑/查看时用于保存与删除

    coverImage: "",
    projectType: "plan",  // plan=企划, activity=活动
    projectName: "",
    projectIntro: "",
    projectNote: "",

    /* 自由选色：HSL 色盘（色相 0–360，饱和度/明度 0–100） */
    pickerHue: 330,
    pickerSat: 75,
    pickerLight: 78,
    projectColor: "#fdbad0",

    nodes: [
      { value: "selectImage", label: "选图" },
      { value: "design", label: "设计" },
      { value: "sample", label: "打样" },
      { value: "marketing", label: "宣发" },
      { value: "launch", label: "上架" },
      { value: "afterSale", label: "售后" },
      { value: "soldOut", label: "完售" }
    ],
    currentNode: "selectImage",
    products: [],
    productProgressOptions: ["设计中", "打样中", "已完成"]
  },

  onLoad(options) {
    const mode = options.mode || "create";
    const [h, s, l] = this.hexToHsl(this.data.projectColor);
    this.setData({
      mode,
      isReadOnly: mode === "view",
      pickerHue: h,
      pickerSat: s,
      pickerLight: l
    });

    const eventChannel =
      this.getOpenerEventChannel && this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on("initProject", (data) => {
        if (!data) return;
        const color = data.color || data.projectColor || "#fdbad0";
        const [h, s, l] = this.hexToHsl(color);
        this.setData({
          projectId: data.id || "",
          coverImage: data.coverImage || "",
          projectType: data.projectType || "plan",
          projectName: data.projectName || "",
          projectIntro: data.projectIntro || "",
          projectNote: data.projectNote || "",
          projectColor: color,
          color: color,
          pickerHue: h,
          pickerSat: s,
          pickerLight: l,
          currentNode: data.currentNode || "selectImage",
          products: data.products || []
        });
      });
    }
  },

  // 自由选色：hex ↔ HSL 转换
  hexToHsl(hex) {
    hex = (hex || "").replace(/^#/, "");
    if (hex.length !== 6) return [330, 75, 78];
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) h = s = 0;
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        default: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  },

  hslToHex(h, s, l) {
    h = Number(h) || 0;
    s = (Number(s) || 0) / 100;
    l = (Number(l) || 0) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    const r = Math.round(f(0) * 255), g = Math.round(f(8) * 255), b = Math.round(f(4) * 255);
    return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  },

  onPickerHueChange(e) {
    const h = Number(e.detail.value) || 0;
    const { pickerSat, pickerLight } = this.data;
    const hex = this.hslToHex(h, pickerSat, pickerLight);
    this.setData({ pickerHue: h, projectColor: hex, color: hex });
  },
  onPickerSatChange(e) {
    const s = Number(e.detail.value) || 0;
    const { pickerHue, pickerLight } = this.data;
    const hex = this.hslToHex(pickerHue, s, pickerLight);
    this.setData({ pickerSat: s, projectColor: hex, color: hex });
  },
  onPickerLightChange(e) {
    const l = Number(e.detail.value) || 0;
    const { pickerHue, pickerSat } = this.data;
    const hex = this.hslToHex(pickerHue, pickerSat, l);
    this.setData({ pickerLight: l, projectColor: hex, color: hex });
  },

  // 进入编辑模式
  onEditTap() {
    this.setData({
      isReadOnly: false,
      mode: "edit"
    });
  },

  onChooseCover() {
    if (this.data.isReadOnly) return;

    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success(res) {
        const src = res.tempFilePaths[0];
        // 支持裁剪时先裁剪为 1:1 再设为封面（基础库 2.26.0+）
        if (typeof wx.cropImage === "function") {
          wx.cropImage({
            src,
            cropScale: "1:1",
            success(cropRes) {
              that.setData({ coverImage: cropRes.tempFilePath });
            },
            fail(err) {
              that.setData({ coverImage: src });
              wx.showToast({
                title: "当前环境不支持裁剪，已使用原图",
                icon: "none"
              });
            }
          });
        } else {
          that.setData({ coverImage: src });
        }
      }
    });
  },

  onTypeChange(e) {
    if (this.data.isReadOnly) return;
    const type = e.currentTarget.dataset.type;
    this.setData({ projectType: type });
  },


  onNameInput(e) {
    if (this.data.isReadOnly) return;
    this.setData({ projectName: e.detail.value });
  },

  onIntroInput(e) {
    if (this.data.isReadOnly) return;
    this.setData({ projectIntro: e.detail.value });
  },

  onNoteInput(e) {
    if (this.data.isReadOnly) return;
    this.setData({ projectNote: e.detail.value });
  },

  onNodeTap(e) {
    if (this.data.isReadOnly) return;
    const value = e.currentTarget.dataset.value;
    this.setData({ currentNode: value });
  },

  onAddProduct() {
    if (this.data.isReadOnly) return;

    const { products } = this.data;
    if (products.length >= 8) return;
    products.push({
      image: "",
      progress: "",
      progressIndex: 0
    });
    this.setData({ products });
  },

  onChooseProductImage(e) {
    if (this.data.isReadOnly) return;

    const index = e.currentTarget.dataset.index;
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success(res) {
        const products = that.data.products.slice();
        products[index].image = res.tempFilePaths[0];
        that.setData({ products });
      }
    });
  },

  onProductProgressChange(e) {
    if (this.data.isReadOnly) return;

    const index = e.currentTarget.dataset.index;
    const selectedIndex = Number(e.detail.value);
    const { productProgressOptions, products } = this.data;

    const newProducts = products.slice();
    newProducts[index].progressIndex = selectedIndex;
    newProducts[index].progress =
      productProgressOptions[selectedIndex];

    this.setData({ products: newProducts });
  },

  // 点击保存按钮：写入本地 projects，并通知首页刷新
  onSaveTap() {
    const {
      projectId,
      projectName,
      projectType,
      coverImage,
      projectIntro,
      projectNote,
      projectColor,
      currentNode,
      products
    } = this.data;

    if (!projectName.trim()) {
      wx.showToast({
        title: "请先填写项目名称",
        icon: "none"
      });
      return;
    }

    const id = projectId || "p_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const project = {
      id,
      projectName,
      projectType,
      color: projectColor,
      coverImage,
      projectIntro,
      projectNote,
      currentNode,
      products: products || []
    };

    let list = wx.getStorageSync("projects") || [];
    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) list[idx] = project;
    else {
      if (list.length >= 9) {
        wx.showToast({ title: "最多 9 个企划", icon: "none" });
        return;
      }
      list.push(project);
    }
    wx.setStorageSync("projects", list);

    // 同步到云端，便于多端/下次打开保留
    cloud.saveProjectToCloud(project).catch(() => {});

    const eventChannel =
      this.getOpenerEventChannel && this.getOpenerEventChannel();
    if (eventChannel) eventChannel.emit("projectSaved", project);

    wx.showToast({
      title: "已保存",
      icon: "success"
    });

    setTimeout(() => {
      wx.navigateBack();
    }, 600);
  },

  // 删除企划：从 projects 移除，并清除所有关联该企划的日程
  onDeleteProjectTap() {
    const { projectId } = this.data;
    if (!projectId) return;

    wx.showModal({
      title: "确认删除",
      content: "删除后，该企划在所有日期的日程关联也会被移除。确定删除？",
      success: (res) => {
        if (!res.confirm) return;

        let list = wx.getStorageSync("projects") || [];
        list = list.filter((p) => p.id !== projectId);
        wx.setStorageSync("projects", list);

        const schedules = wx.getStorageSync("schedules") || {};
        let changed = false;
        Object.keys(schedules).forEach((date) => {
          const s = schedules[date];
          const ids = s.projectIds || [];
          const colors = s.projectColors || [];
          const i = ids.indexOf(projectId);
          if (i < 0) return;
          const newIds = ids.filter((_, idx) => idx !== i);
          const newColors = colors.filter((_, idx) => idx !== i);
          if (newIds.length === 0) {
            delete schedules[date];
            changed = true;
          } else {
            schedules[date] = {
              ...s,
              projectIds: newIds,
              projectColors: newColors
            };
            changed = true;
          }
        });
        if (changed) wx.setStorageSync("schedules", schedules);

        cloud.deleteProjectFromCloud(projectId).catch(() => {});

        wx.showToast({ title: "已删除", icon: "success" });
        setTimeout(() => wx.navigateBack(), 400);
      }
    });
  }
});