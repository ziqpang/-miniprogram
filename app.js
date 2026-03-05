// app.js
App({
  onLaunch() {
    // 云开发初始化：数据将保存在云端，每次打开可同步
    if (typeof wx.cloud !== "undefined") {
      wx.cloud.init({
        env: "your-env-id", // 在微信开发者工具中开通云开发后，替换为你的环境 ID
        traceUser: true
      });
    }
  }
})
