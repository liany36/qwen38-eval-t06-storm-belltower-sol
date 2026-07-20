# Sol｜T06 交付清单

## 来源

- 来源模型：ChatGPT 5.6 Sol
- 模型文件标识：Sol
- 测试题目：T06｜Coding：风暴钟塔
- 项目名称：《风暴钟塔》
- 任务执行时长：约 00:17:00（2026-07-21 00:51 至 01:08，Asia/Shanghai）
- Token 用量：当前执行环境未提供可读取的精确 Token 计量；为避免伪造数据，未作估算。

## 运行结果

- `npm test`：通过；4 个测试文件，11 项测试全部通过。
- `npm run build`：通过；TypeScript project build 与 Vite production build 均成功。
- 生产构建：14 个模块；主 JavaScript 35.44 kB（gzip 12.97 kB）。
- 浏览器实测：通过；首屏、Space 开始、游戏循环、风区场景、结算界面、R 快速重开均正常。
- 响应式检查：通过；默认 1280×720 与 900×900 视口画面保持比例、居中且 HUD 无坐标错位。
- 浏览器控制台：实测期间无 warning / error。
- 截图：由本项目在应用内浏览器中的真实 Canvas 运行画面生成。

## 功能覆盖

- 5 个连续向上区域与纵向跟随摄像机。
- 普通、移动、碎裂、弹簧、单向、结冰、检查点平台。
- 横风、旋转钟摆、结冰惯性三类环境机制。
- 12 个收集物、2 个中途检查点、明确终点与结算界面。
- 用时、坠落、最高高度、收集数量与 localStorage 最佳成绩。
- 固定时间步物理、有限空中修正、落地/墙面/平台底部/单向平台碰撞。
- 深度坠落、异常数值和严重越界自动恢复；坠落保留次数并增加 8 秒惩罚。
- 三层以上视差、程序化雨幕与闪电、原创角色动画、全套事件反馈及本地合成音效。

## 文件清单

### 项目与配置

- `README.md`
- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `vite.config.ts`

### 原创源代码

- `src/audio.ts`
- `src/checkpoint.ts`
- `src/config.ts`
- `src/game.ts`
- `src/input.ts`
- `src/level.ts`
- `src/main.ts`
- `src/math.ts`
- `src/physics.ts`
- `src/render.ts`
- `src/storage.ts`
- `src/style.css`
- `src/types.ts`

### 测试

- `tests/charge.test.ts`
- `tests/collision.test.ts`
- `tests/checkpoint.test.ts`
- `tests/storage.test.ts`

### 生产构建

- `dist/index.html`
- `dist/assets/index-BLnXzJzu.css`
- `dist/assets/index-SYczsI_p.js`

### 交付证据

- `Sol__T06__gameplay.png`
- `Sol__T06__result.png`
- `Sol__T06__build-and-test.log`
- `Sol__T06__manifest.md`

`node_modules/` 未纳入交付清单，可通过 `npm install` 依据锁文件恢复。

## 已知问题

- 受浏览器自动播放策略限制，程序化音效会在首次键盘或点击交互后启用；不影响无声状态下的玩法。
- 游戏面向键盘操作；触屏仅支持点击开始，未实现虚拟方向键。
