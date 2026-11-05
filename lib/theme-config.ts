/**
 * 主题配置模型（通用机制，字段为最小通用集）
 *
 * 读取链：core 后台 Snippet（reference='theme'、name=THEME_NAME、公开、YAML）
 * → GET /aggregate?theme=<THEME_NAME> 的 theme 字段。
 * 做自己的主题时在 interface 上扩展自己的字段，并同步更新消费方。
 */
export interface ThemeConfig {
  /** 背景图 URL，SSR 以 body:before 背景输出，不填则无背景 */
  background?: string
  /** 自定义 CSS，以 <style> 注入 <head> 末尾（在自带样式之后） */
  custom_css?: string
  /** 自定义 JS，以 <script> 注入 <body> 末尾 */
  custom_script?: string
}

/** 默认值 */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  background: '',
  custom_css: '',
  custom_script: '',
}

/** 把 Snippet / aggregate 读到的配置与默认值合并 */
export function mergeThemeConfig(
  partial?: Partial<ThemeConfig>,
): ThemeConfig {
  return { ...DEFAULT_THEME_CONFIG, ...partial }
}
