# 掼蛋教练

**简体中文** | [English](README.en.md)

[![CI](https://github.com/jchen0824/guandan-master/actions/workflows/ci.yml/badge.svg)](https://github.com/jchen0824/guandan-master/actions/workflows/ci.yml)

「掼蛋教练」是一个单机牌类练习游戏，适合刚入门的玩家。首页可以选掼蛋或德州扑克，在浏览器里和电脑玩家对局，教练会给提示并点评每一步。

在线试玩：https://guandan-playground.vercel.app

## 功能

- 掼蛋完整规则：全部牌型、逢人配、炸弹大小、升级、进贡与还贡、抗贡、接风，三次打 A 不过退回打 2
- 电脑玩家三档水平（新手 / 普通 / 进阶），对手和对家可以分别设置
- 教练：局面讲解、提示、每手牌的点评，可以隐藏
- 记牌器、花色筛选、找同花顺、理牌（自己组牌并调整顺序）
- 每局结束后复盘四家起手牌和出牌记录
- 进度保存在浏览器本地，不需要账号，也没有服务器
- 电脑和手机浏览器都能玩，横屏竖屏均可
- 牌桌可以在 2D（平面）和 3D（立体）之间切换
- 德州扑克：6 人桌无限注，盲注 10/20，使用练习筹码。教练给出胜率、底池赔率和建议，每手结束后逐个点评你的决定，也可以关掉；电脑对手有新手、普通、进阶三档

电脑玩家和教练都是基于规则的程序，没有使用大语言模型。

## 本地运行

需要 Node.js 22.12 或更高版本。

```bash
npm ci
npm run dev
```

## 其他命令

```bash
npm run check              # 提交前跑这一条：代码检查、约定检查、测试、构建、包体积
npm run test:e2e           # 改动界面后还要跑这一条：在真实浏览器里测试电脑和手机共四种屏幕尺寸
npm run test:e2e:install   # 首次运行浏览器测试前执行一次：下载 Chromium 和 WebKit
npm test                   # 规则引擎和界面测试
npm run bench              # 三档电脑玩家互相对打的基准测试
npm run test:levels        # 德州扑克三档电脑玩家互相对打，检查难度没有退步
npm run build              # 生产构建
```

`npm run check` 不包含浏览器测试。CI 两者都会跑，所以改了界面的话，提交前请把两条都跑一遍。

## 代码结构

- `src/engine`：掼蛋的规则引擎、对局流程和电脑玩家，不依赖界面
- `src/holdem`：德州扑克的规则、胜率估算、电脑玩家和教练，不依赖界面
- `src/ui`、`src/App.tsx`、`src/Root.tsx`：界面，使用 React 和 `@ui-sdk/react`
- `.agents/skills`：给编程智能体看的掼蛋规则、打法要点和界面开发约定

## 版本

当前版本号显示在游戏的“设置 → 关于”里。每个版本的改动见 [CHANGELOG.md](CHANGELOG.md)。

## 参与贡献

欢迎提交 Issue 和 Pull Request。流程和提交格式见 [CONTRIBUTING.md](CONTRIBUTING.md)，架构说明和 CI 检查项见 [AGENTS.md](AGENTS.md)。`main` 分支受保护，所有改动都通过 Pull Request 合并。

## 许可

[MIT](LICENSE)
