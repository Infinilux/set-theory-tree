import { defineConfig } from "vite";

// base 必须是相对路径：站点要部署在 https://<user>.github.io/set-theory-tree/ 这样的
// 子路径下，绝对路径 /assets/... 会 404（页面空白）。'./' 让资源按文档相对定位。
export default defineConfig({
  base: "./",
  server: { port: 5173, open: false },
});