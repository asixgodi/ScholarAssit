

## i18n AST 迁移工具

本项目包含一个基于 AST 的 i18n 迁移 CLI，使用 Babel AST + recast 实现尽可能无损的源码更新。

### 命令

```bash
# 仅扫描（dry-run）
npm run i18n:migrate:scan

# 执行替换并写入消息文件
npm run i18n:migrate:write
```

### 当前能力


- 三层过滤：
	- AST 上下文过滤
	- 中文内容正则过滤
	- 注释标记过滤（`i18n-ignore`、`@i18n-ignore-file`）
- 支持 TS/TSX 解析，并使用 recast 打印代码（尽可能保持原有风格）
- 自动生成翻译 key，并写入：
	- `messages/zh.json`
	- `messages/en.json`（默认回填相同文案）
- 在支持的上下文中支持模板字符串变量提取

### 当前支持的转换上下文

- JSX 文本节点
- JSX 字符串属性：`title`、`placeholder`、`aria-label`、`label`、`alt`、`description`、`helperText`
- `alert/confirm/prompt` 的调用参数

### 说明

- CLI 仅会改写检测到翻译函数变量的文件（例如 `const t = useTranslations()`）。
- 在 dry-run 模式下，如果发现候选项，进程会以退出码 `2` 结束，便于 CI 门禁校验。
