# Multi-levelDonutChart 多圈圆环图

纯前端多层级数据占比可视化工具。通过嵌套圆环表达多级指标的占比情况，支持层级深度不一致时的留白展示。

> 在线演示：https://wangjiati.github.io/Multi-levelDonutChart/

## 技术栈

- 纯前端 HTML + CSS + Vanilla JavaScript
- Canvas 2D 渲染
- 零外部依赖
- 无构建工具

## 项目结构

```
Multi-levelDonutChart/
├── index.html              # 首页 - 示例数据卡片选择器
├── chart.html              # 图表查看页
├── editor.html             # 数据编辑器（树形编辑 + 实时预览）
├── js/
│   ├── donut-chart.js      # 核心引擎：布局计算 + Canvas 渲染 + 交互
│   ├── main.js             # 图表页逻辑：工具栏/图例/主题/设置
│   └── editor.js           # 编辑器逻辑：树编辑/配置/预览
├── data/
│   ├── supermarket.json    # 超市销售占比（含3级不均层级）
│   └── budget.json         # 公司预算分配（含3级不均层级）
└── README.md
```

## 功能清单

| 功能 | 说明 |
|------|------|
| **多圈嵌套渲染** | 从内到外逐层绘制圆环，扇区角度按父级比例继承切分 |
| **空白层级** | 深度不一致的分类在对应外层显示虚线留白 |
| **悬停提示** | 显示名称、数值、同级占比、层级 |
| **点击下钻** | 聚焦分类子树，非相关扇区淡化，中心+面包屑导航 |
| **图例切换** | 层级树形图例，展开/收起子级，切换分类显示/隐藏 |
| **主题切换** | 暗色 / 亮色 / 蓝色 / 墨绿 / 暖棕 五种预设 |
| **属性设置** | 圆环直径、环宽、间隙、标签字号、标签颜色 |
| **Ctrl+滚轮缩放** | 鼠标在画布上时 Ctrl+滚轮缩放图表 (0.3x ~ 3x) |
| **SVG/PNG导出** | 工具栏一键导出 |
| **数据编辑器** | 树形添加/删除/修改节点，配置面板，实时预览 |
| **HSL色彩方案** | 子级从父级色调自动派生，逐层变亮 |

## 数据结构

```json
{
  "title": "超市销售占比",
  "config": {
    "centerRadius": 55,
    "ringWidth": 38,
    "gapWidth": 8
  },
  "categories": [
    {
      "name": "粮油",
      "value": 45000,
      "color": "#4A90D9",
      "children": [
        { "name": "米", "value": 20000,
          "children": [
            { "name": "东北大米", "value": 12000 },
            { "name": "泰国香米", "value": 8000 }
          ]
        }
      ]
    }
  ]
}
```

- `value` 用于计算同级占比
- `color` 可选，未指定时自动从父级色调派生
- `children` 可选，不存在时外层显示空白
- `config` 可选，覆盖默认图表配置

## 启动方式

使用任意 HTTP 服务器托管该目录：

```bash
cd Multi-levelDonutChart
python -m http.server 8080
```

浏览器打开 `http://localhost:8080`。

> 如果直接双击 HTML 文件打开（`file://` 协议），页面会使用内嵌的默认数据渲染。

## 交互说明

| 操作 | 效果 |
|------|------|
| 悬停扇区 | 显示 tooltip 详情 |
| 点击扇区 | 下钻聚焦该分类子树 |
| 再次点击 / 点击中心 | 返回上级 |
| 点击空白区域 | 返回全景 |
| Ctrl + 滚轮 | 缩放图表 |
| 图例行点击 | 切换显示/隐藏 |
| 图例箭头 ▸ | 展开/收起子级 |
| 全部显示 | 重置隐藏 + 下钻状态 |

## 配置项

```js
{
  ringWidth: 36,        // 圆环宽度 (px)
  gapWidth: 6,          // 环间间隙 (px)
  centerRadius: 60,     // 中心圆半径 (px)
  segmentGap: 1.5,      // 扇区间隙 (度)
  labelShow: true,      // 是否显示标签
  labelMinAngle: 15,    // 最小标签角度 (度)
  labelFont: '12px ...',// 标签字体
  labelColor: '#e0e0e0',// 标签颜色
  backgroundColor: '#0f0f23', // 背景色
  blankColor: '#1a1a2e', // 留白颜色
  dimOpacity: 0.2,       // 非聚焦扇区透明度
  colors: [...],         // 默认色板
}
```

## License

MIT
