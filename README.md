# OmniReasoning interactive artwork

展示全屏交互式封面，副标题下方提供 GitHub、arXiv、Hugging Face 和 Qwen 四个品牌图标链接。无框架、无构建步骤，图标和封面资源均在本地加载。

从仓库根目录运行：

```bash
python -m http.server 8000 --directory docs
```

打开 `http://localhost:8000`。也可直接打开 `index.html`，或把整个 `docs` 目录部署到任意静态托管服务。GitHub Pages 可选择从 `main` 分支的 `/docs` 目录发布。

- 拼贴覆盖整个屏幕，不留横幅边框或空白。背景和字母内部来自同一张连续图层，以相同方向、速度、位移同步滚动；字形和副标题固定，默认完整显示。
- 滚轮、拖动或方向键移动拼贴；单击或空格暂停 / 继续。
- 双击、双指捏合或 `+` / `-` 缩放，放大后拖动平移；`Esc` / `Home` 复位。
- 鼠标移动轻微带动整张拼贴，始终保持全屏覆盖；系统开启“减少动态效果”时默认暂停并关闭视差。
- 不支持 JavaScript 或图层加载失败时显示全屏静态封面。

四个链接直接在 `index.html` 的 `resource-links` 导航中维护。Qwen 指向 `https://qwen.ai/blog?id=qwen3.8-omni-flash`。GitHub、arXiv 和 Hugging Face 的具体项目地址尚未提供，目前分别指向平台官网；项目地址确定后替换对应 `href` 即可。图标来源及许可见 `assets/icons/NOTICE.txt`。

动画拼贴、文字蒙版、副标题和静态字标均为 **7680 × 2420** 像素，直接由封面的原始视频帧、原始字形蒙版及字体重新导出，不是放大旧的 1920 像素版本。统一采用原字内拼贴的排列种子 931；蒙版仅控制明暗。`assets/hero.jpg` 从原始封面导出为 3840 × 1300 像素，用于分享预览。原始素材来源记录见 `../assets/readme/provenance.json`。

画布按设备像素比渲染，最高 3×、总计 16,777,216 像素，覆盖常见 4K / 5K 显示分辨率。固定的文字及明暗图层只在缩放、平移、窗口大小改变时重新绘制，滚动期间直接复用，以减少高分屏开销。四个品牌图标使用 SVG。
