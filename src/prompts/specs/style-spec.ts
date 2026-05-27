import type { ArtStyle } from "@/types/picturebook";
import type { StyleRuleSet } from "@/prompts/types";

const STYLE_SPECS: Record<string, StyleRuleSet> = {
  "水彩温暖风": {
    styleLabel: "水彩温暖风",
    styleMood: "柔和、治愈、通透明亮",
    coreStyleConstraints: ["保留水彩晕染与透明叠色感", "边缘柔和不过分锐利", "主色柔和温暖且避免高饱和冲突"],
    lightingRules: ["柔和漫射光，避免强烈硬阴影", "整体气氛温暖、明净、亲近"],
    textureRules: ["保留水彩晕染、透明叠色和纸面渗化感", "边缘不过分锐利，保持柔和手绘质感"],
    colorRules: ["主色偏奶油色、暖粉、浅蓝、柔和绿色", "避免高饱和霓虹色大面积冲突"],
    compositionRules: ["构图稳定、留白自然、适合温暖叙事", "背景层次要有空气感，不宜过满"],
  },
  "蜡笔童趣风": {
    styleLabel: "蜡笔童趣风",
    styleMood: "童真、手作、轻松可爱",
    coreStyleConstraints: ["保留明显蜡笔颗粒与自然涂抹痕迹", "手工绘制线条感清晰，轮廓可轻微不规整但主体明确", "颜色活泼柔和且主次分明"],
    lightingRules: ["光线明亮轻松，强调日常亲切感", "避免戏剧化冷暖强反差"],
    textureRules: ["保留蜡笔颗粒、涂抹痕迹和手工线条感", "允许轻微不规整轮廓，但主体仍需清晰"],
    colorRules: ["颜色活泼但不过于刺眼，适合儿童启蒙", "使用块面色彩时保持主次清楚"],
    compositionRules: ["以角色或单一事件为中心，强调易读性", "背景简单明确，突出童趣和动作感"],
  },
  "剪纸拼贴风": {
    styleLabel: "剪纸拼贴风",
    styleMood: "图形化、装饰性、手工层次感强",
    coreStyleConstraints: ["强调纸张纤维、毛边与拼贴层叠感", "元素边界清晰且适合图形化表达", "色块明确并保持主辅关系清楚"],
    lightingRules: ["使用均匀稳定的照明，不强调真实摄影光感", "通过层次和剪影而非复杂光影塑造主体"],
    textureRules: ["强调纸张纤维、毛边、拼贴层叠和手工感", "元素边界应清晰，适合图案化表达"],
    colorRules: ["色块明确、层次分明、主辅色关系清楚", "避免过度渐变，强调块面图形节奏"],
    compositionRules: ["适合平面化和层叠式构图，注意形状节奏", "前中后层应依靠图形大小与遮挡表达"],
  },
  "日系清新风": {
    styleLabel: "日系清新风",
    styleMood: "清爽、自然、明快、柔软",
    coreStyleConstraints: ["线条清爽且色块干净", "配色清新低饱和并保留自然过渡", "画面通透轻盈，保持日常生活气息"],
    lightingRules: ["自然光、逆光边缘光和轻空气透视", "避免油腻高对比和过度电影化厚重光效"],
    textureRules: ["线条清爽，色块干净，细节适中", "强调通透感和细腻生活气息"],
    colorRules: ["使用清新低饱和配色和自然过渡色", "保留少量高亮点缀增强生机"],
    compositionRules: ["构图自然、轻盈，适合成长与日常叙事", "镜头流动感可以稍强，但不要杂乱"],
  },
  "素描淡彩风": {
    styleLabel: "素描淡彩风",
    styleMood: "安静、温柔、带观察感",
    coreStyleConstraints: ["保留铅笔线与淡彩晕染感", "色彩轻淡低饱和并以局部点缀为主", "线条服务结构与表情且整体安静克制"],
    lightingRules: ["光影柔和，依靠明暗关系塑造体积", "避免高戏剧化灯光"],
    textureRules: ["保留铅笔线、淡彩晕染与手绘观察感", "线条应服务结构和表情，不宜凌乱"],
    colorRules: ["色彩轻淡、低饱和，以局部点缀为主", "避免浓重油彩式厚涂效果"],
    compositionRules: ["构图应稳定、克制，强调观察和情绪", "适合中近景与安静空间表达"],
  },
  "波普大胆风": {
    styleLabel: "波普大胆风",
    styleMood: "大胆、活泼、图形感强",
    coreStyleConstraints: ["边缘清晰且图形块面大胆", "高对比配色但控制刺激感", "主体与背景分离清楚，视觉焦点强烈"],
    lightingRules: ["整体采用扁平化明亮光感", "不依赖复杂真实光影，强调图形对比"],
    textureRules: ["边缘清晰，图形块面大胆，细节高概括", "适合趣味性强、节奏快的页面表达"],
    colorRules: ["允许更高对比度，但仍需避免儿童不适的强刺激冲突", "控制高纯度颜色的面积比例，保证阅读舒适"],
    compositionRules: ["支持大胆图形布局和强视觉焦点", "主体与背景要分离清楚，避免花哨失焦"],
  },
  "水墨东方风": {
    styleLabel: "水墨东方风",
    styleMood: "含蓄、留白、东方审美",
    coreStyleConstraints: ["表现墨色层次与笔触转折", "留白是画面结构的一部分", "色彩点缀克制并保持东方色系协调"],
    lightingRules: ["光感克制，强调虚实关系与意境", "避免现代舞台光和过度炫目特效"],
    textureRules: ["表现墨色层次、宣纸肌理、笔触转折", "留白必须成为画面的一部分而非空缺"],
    colorRules: ["以墨黑、灰、赭、藤黄、花青等东方色系为主", "彩色点缀应克制、协调，不要西式糖果色泛滥"],
    compositionRules: ["重视留白、呼吸感和东方平衡构图", "元素不要过满，强调意境和节奏"],
  },
  "极简线条风": {
    styleLabel: "极简线条风",
    styleMood: "干净、简洁、现代、可读性强",
    coreStyleConstraints: ["线条概括且轮廓清楚", "色彩收敛并保持主色明确", "背景简洁干净，减少多余噪声"],
    lightingRules: ["光感简洁统一，以清晰识别为优先", "避免复杂层层叠加的体积光和特效"],
    textureRules: ["弱纹理、线条概括、轮廓清楚", "尽量减少多余细节和背景噪声"],
    colorRules: ["色彩收敛、主色明确、对比清楚", "整页最多 2-3 个核心色群，保证清晰度"],
    compositionRules: ["构图强调秩序感、信息优先和版面清洁", "非常适合科普和低龄认知场景"],
  },
};

export function getStyleSpec(artStyle: ArtStyle): StyleRuleSet {
  if (artStyle === "auto") return STYLE_SPECS["水彩温暖风"];
  return STYLE_SPECS[artStyle] || STYLE_SPECS["水彩温暖风"];
}
