import fs from "node:fs";
import path from "node:path";
import * as recast from "recast";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const babelTsParser = require("recast/parsers/babel-ts");

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

type CandidateKind = "jsx-text" | "jsx-attr" | "string" | "template";

type Candidate = {
    key: string;
    value: string;
    filePath: string;
    kind: CandidateKind;
    line: number;
};

type ParsedArgs = {
    rootDir: string;
    sourceDir: string;
    zhMessagesPath: string;
    enMessagesPath: string;
    write: boolean;
    dryRun: boolean;
    include: string[];
};

const CHINESE_RE = /[\u3400-\u9FFF]/;
const IGNORE_NODE_MARKER = "i18n-ignore";
const IGNORE_FILE_MARKER = "@i18n-ignore-file";
const JSX_I18N_ATTRS = new Set([
    "title",
    "placeholder",
    "aria-label",
    "label",
    "alt",
    "description",
    "helperText",
]);

const b = recast.types.builders;
const n = recast.types.namedTypes;

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(): ParsedArgs {
    const argv = process.argv.slice(2);
    const rootDir = process.cwd();

    const hasWrite = argv.includes("--write");
    const hasDryRun = argv.includes("--dry-run");

    const includeArg = readArgValue(argv, "--include") || "src";
    const zhMessagesArg = readArgValue(argv, "--zh") || "messages/zh.json";
    const enMessagesArg = readArgValue(argv, "--en") || "messages/en.json";

    return {
        rootDir,
        sourceDir: path.resolve(rootDir, includeArg),
        zhMessagesPath: path.resolve(rootDir, zhMessagesArg),
        enMessagesPath: path.resolve(rootDir, enMessagesArg),
        write: hasWrite,
        dryRun: hasDryRun || !hasWrite,
        include: includeArg.split(",").map((item) => item.trim()).filter(Boolean),
    };
}

function readArgValue(argv: string[], key: string): string | null {
    const inline = argv.find((item) => item.startsWith(`${key}=`));
    if (inline) return inline.slice(key.length + 1);

    const index = argv.indexOf(key);
    if (index >= 0 && argv[index + 1]) return argv[index + 1];

    return null;
}

// ─── JSON helpers ────────────────────────────────────────────────────────────

function readJson(filePath: string): Record<string, JsonValue> {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Record<string, JsonValue>;
}

function writeJson(filePath: string, value: Record<string, JsonValue>): void {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 4)}\n`, "utf8");
}

function flattenObject(obj: Record<string, JsonValue>, parentKey = ""): Record<string, string> {
    const out: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
        const next = parentKey ? `${parentKey}.${key}` : key;
        if (typeof value === "string") {
            out[next] = value;
            continue;
        }

        if (value && typeof value === "object" && !Array.isArray(value)) {
            Object.assign(out, flattenObject(value as Record<string, JsonValue>, next));
        }
    }

    return out;
}

function unflattenObject(flat: Record<string, string>): Record<string, JsonValue> {
    const root: Record<string, JsonValue> = {};

    for (const [fullKey, value] of Object.entries(flat)) {
        const parts = fullKey.split(".");
        let cursor: Record<string, JsonValue> = root;

        for (let i = 0; i < parts.length; i += 1) {
            const part = parts[i];
            const isLast = i === parts.length - 1;

            if (isLast) {
                cursor[part] = value;
                continue;
            }

            if (!cursor[part] || typeof cursor[part] !== "object" || Array.isArray(cursor[part])) {
                cursor[part] = {};
            }

            cursor = cursor[part] as Record<string, JsonValue>;
        }
    }

    return root;
}

// ─── File collection ─────────────────────────────────────────────────────────

function collectSourceFiles(root: string): string[] {
    const all: string[] = [];

    function walk(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") {
                    continue;
                }
                walk(full);
                continue;
            }

            if (!entry.isFile()) continue;
            if (!/\.(ts|tsx)$/.test(entry.name)) continue;
            if (/\.d\.ts$/.test(entry.name)) continue;
            all.push(full);
        }
    }

    walk(root);
    return all;
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function slugifyText(input: string): string {
    return input
        .replace(/\{[^}]+\}/g, "")
        .replace(/[\s\W]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase()
        .slice(0, 40) || "text";
}

function hasChinese(input: string): boolean {
    return CHINESE_RE.test(input);
}

function normalizeText(input: string): string {
    return input.replace(/\s+/g, " ").trim();
}

// ─── Template literal extraction ──────────────────────────────────────────────

function extractTemplateInfo(node: any): {
    message: string;
    values: Array<{ name: string; expr: any }>;
} {
    const values: Array<{ name: string; expr: any }> = [];
    const parts: string[] = [];

    for (let i = 0; i < node.quasis.length; i += 1) {
        const quasi = node.quasis[i];
        parts.push(quasi.value.cooked ?? "");

        if (i >= node.expressions.length) continue;

        const expr = node.expressions[i];
        if (!n.Expression.check(expr)) continue;

        let name = `value${i + 1}`;
        if (n.Identifier.check(expr)) {
            name = expr.name;
        } else if (n.MemberExpression.check(expr) && n.Identifier.check(expr.property) && !expr.computed) {
            name = (expr.property as any).name;
        }

        if (values.some((item) => item.name === name)) {
            let suffix = 2;
            while (values.some((item) => item.name === `${name}${suffix}`)) {
                suffix += 1;
            }
            name = `${name}${suffix}`;
        }

        values.push({ name, expr });
        parts.push(`{${name}}`);
    }

    return {
        message: normalizeText(parts.join("")),
        values,
    };
}

// ─── Layer 3: Comment marker filter ──────────────────────────────────────────

function nodeHasIgnoreComment(pathValue: any): boolean {
    const commentsFromNode = ((pathValue.node as any)?.comments ?? []) as Array<{ value?: string }>;
    if (commentsFromNode.some((comment) => comment.value?.includes(IGNORE_NODE_MARKER))) {
        return true;
    }

    const parentNode = (pathValue.parentPath?.node ?? null) as any;
    const parentComments = (parentNode?.comments ?? []) as Array<{ value?: string }>;
    return parentComments.some((comment) => comment.value?.includes(IGNORE_NODE_MARKER));
}

function isInsideTranslationCall(pathValue: any, translatorNames: Set<string>): boolean {
    let current: any = pathValue;

    while (current?.parentPath) {
        current = current.parentPath;
        const node = current?.node;
        if (!node) continue;
        if (!n.CallExpression.check(node)) continue;

        if (n.Identifier.check(node.callee) && translatorNames.has(node.callee.name)) {
            return true;
        }
    }

    return false;
}

// ─── AST builders ────────────────────────────────────────────────────────────

function buildTranslatorCall(
    key: string,
    translatorName: string,
    values?: Array<{ name: string; expr: any }>,
): any {
    const args: any[] = [b.stringLiteral(key)];

    if (values?.length) {
        args.push(
            b.objectExpression(
                values.map((item) => b.objectProperty(b.identifier(item.name), item.expr)),
            ),
        );
    }

    return b.callExpression(b.identifier(translatorName), args);
}

// ─── Layer 1: AST context filter ─────────────────────────────────────────────

function canTranslateCallArgument(pathValue: any): boolean {
    const parent = pathValue.parentPath?.node;
    if (!parent || !n.CallExpression.check(parent)) return false;

    const callee = parent.callee;
    if (n.Identifier.check(callee)) {
        return ["alert", "confirm", "prompt"].includes(callee.name);
    }

    if (n.MemberExpression.check(callee) && n.Identifier.check(callee.property) && !callee.computed) {
        return ["alert", "confirm", "prompt"].includes((callee.property as any).name);
    }

    return false;
}

/**
 * 判断当前 path 是否在可翻译的 JSX 属性位置。
 * 同时处理两种写法：
 *   title="中文"         → parent 是 JSXAttribute
 *   title={"中文"}       → parent 是 JSXExpressionContainer，grandParent 是 JSXAttribute
 */
function canTranslateJsxAttribute(pathValue: any): boolean {
    let parent = pathValue.parentPath?.node;

    // 穿透 JSXExpressionContainer: title={"中文"}
    if (n.JSXExpressionContainer.check(parent)) {
        parent = pathValue.parentPath?.parentPath?.node;
    }

    if (!parent || !n.JSXAttribute.check(parent)) return false;
    if (!n.JSXIdentifier.check(parent.name)) return false;
    return JSX_I18N_ATTRS.has((parent.name as any).name);
}

function contextAllows(pathValue: any, kind: CandidateKind): boolean {
    if (kind === "jsx-text") {
        return (
            n.JSXElement.check(pathValue.parentPath?.node) ||
            n.JSXFragment.check(pathValue.parentPath?.node)
        );
    }

    if (kind === "jsx-attr") {
        return canTranslateJsxAttribute(pathValue);
    }

    if (kind === "template" || kind === "string") {
        // <div>{"中文"}</div> — 字符串在 JSXExpressionContainer 里作为 JSX 子节点
        if (n.JSXExpressionContainer.check(pathValue.parentPath?.node)) {
            const grandParent = pathValue.parentPath?.parentPath?.node;
            if (n.JSXElement.check(grandParent) || n.JSXFragment.check(grandParent)) {
                return true;
            }
        }

        return canTranslateCallArgument(pathValue) || canTranslateJsxAttribute(pathValue);
    }

    return false;
}

// ─── Translator detection ─────────────────────────────────────────────────────

function detectTranslatorNames(ast: any): Set<string> {
    const names = new Set<string>();

    recast.types.visit(ast, {
        visitVariableDeclarator(pathValue) {
            const node = pathValue.node;
            if (!n.Identifier.check(node.id) || !node.init) {
                this.traverse(pathValue);
                return;
            }

            if (n.CallExpression.check(node.init) && n.Identifier.check(node.init.callee)) {
                if (["useTranslations", "getTranslations"].includes(node.init.callee.name)) {
                    names.add((node.id as any).name);
                }
            }

            if (
                n.AwaitExpression.check(node.init) &&
                n.CallExpression.check(node.init.argument) &&
                n.Identifier.check((node.init.argument as any).callee)
            ) {
                if ((node.init.argument as any).callee.name === "getTranslations") {
                    names.add((node.id as any).name);
                }
            }

            this.traverse(pathValue);
        },
    });

    return names;
}

// ─── Auto-inject translator ───────────────────────────────────────────────────

/** 文件是否有 "use client" 指令 */
function hasUseClientDirective(ast: any): boolean {
    const body = (ast.program?.body ?? []) as any[];
    return body.some(
        (node) =>
            n.ExpressionStatement.check(node) &&
            n.StringLiteral.check(node.expression) &&
            node.expression.value === "use client",
    );
}

/** 文件是否包含 JSX（用于判断是否是组件文件） */
function hasJSX(ast: any): boolean {
    let found = false;
    recast.types.visit(ast, {
        visitJSXElement() {
            found = true;
            return false;
        },
        visitJSXFragment() {
            found = true;
            return false;
        },
    });
    return found;
}

/** 判断函数节点是否像 React 组件（导出或 PascalCase 命名） */
function isLikelyComponent(p: any): boolean {
    const node = p.node as any;
    const parent = p.parentPath?.node as any;
    const grandParent = p.parentPath?.parentPath?.node as any;

    if (n.ExportDefaultDeclaration.check(parent)) return true;
    if (n.ExportNamedDeclaration.check(parent)) return true;
    if (n.FunctionDeclaration.check(node) && node.id && /^[A-Z]/.test((node.id as any).name)) return true;

    // export const Foo = () => {}
    if (
        n.VariableDeclarator.check(parent) &&
        n.Identifier.check(parent.id) &&
        /^[A-Z]/.test(parent.id.name) &&
        n.VariableDeclaration.check(grandParent) &&
        n.ExportNamedDeclaration.check(p.parentPath?.parentPath?.parentPath?.node)
    ) {
        return true;
    }

    // const Foo = () => {}（非导出但 PascalCase）
    if (
        n.VariableDeclarator.check(parent) &&
        n.Identifier.check(parent.id) &&
        /^[A-Z]/.test(parent.id.name)
    ) {
        return true;
    }

    return false;
}

function hasDeclarationInBlock(block: any, name: string): boolean {
    return (block.body as any[]).some(
        (stmt) =>
            n.VariableDeclaration.check(stmt) &&
            stmt.declarations.some(
                (d: any) => n.Identifier.check(d.id) && d.id.name === name,
            ),
    );
}

/** 确保 AST 中已有指定 import，没有则插入到最后一条 import 之后 */
function ensureImport(ast: any, specifier: string, source: string): void {
    const body = ast.program.body as any[];
    let lastImportIdx = -1;

    for (let i = 0; i < body.length; i++) {
        if (!n.ImportDeclaration.check(body[i])) continue;
        lastImportIdx = i;
        const decl = body[i];
        if (decl.source.value !== source) continue;

        const hasSpec = (decl.specifiers ?? []).some(
            (s: any) =>
                n.ImportSpecifier.check(s) &&
                n.Identifier.check(s.imported) &&
                s.imported.name === specifier,
        );
        if (hasSpec) return; // 已存在，无需重复添加
    }

    const importDecl = b.importDeclaration(
        [b.importSpecifier(b.identifier(specifier))],
        b.stringLiteral(source),
    );
    body.splice(lastImportIdx + 1, 0, importDecl);
}

/**
 * 向文件 AST 注入 translator 变量声明，并补充对应 import。
 * 客户端组件注入 `const t = useTranslations()`，
 * 服务端组件注入 `const t = await getTranslations()`（仅限 async 函数）。
 * 返回注入的变量名，注入失败返回 null。
 */
function injectTranslatorIntoFile(ast: any, isClient: boolean): string | null {
    const hookName = isClient ? "useTranslations" : "getTranslations";
    const importSrc = isClient ? "next-intl" : "next-intl/server";
    const varName = "t";

    ensureImport(ast, hookName, importSrc);

    let injected = false;

    recast.types.visit(ast, {
        visitFunction(p) {
            if (injected) {
                this.traverse(p);
                return;
            }

            const fn = p.node as any;
            if (!n.BlockStatement.check(fn.body)) {
                this.traverse(p);
                return;
            }

            // 服务端组件：getTranslations 必须 await，函数本身必须是 async
            if (!isClient && !fn.async) {
                this.traverse(p);
                return;
            }

            if (!isLikelyComponent(p)) {
                this.traverse(p);
                return;
            }

            // 已经有 t 声明，不重复注入
            if (hasDeclarationInBlock(fn.body, varName)) {
                this.traverse(p);
                return;
            }

            const call = b.callExpression(b.identifier(hookName), []);
            const init = isClient ? call : b.awaitExpression(call);
            const decl = b.variableDeclaration("const", [
                b.variableDeclarator(b.identifier(varName), init),
            ]);

            (fn.body.body as any[]).unshift(decl);
            injected = true;
            this.traverse(p);
        },
    });

    return injected ? varName : null;
}

// ─── Per-file migration ───────────────────────────────────────────────────────

function migrateFile(args: {
    filePath: string;
    source: string;
    flatZh: Record<string, string>;
    usedKeys: Set<string>;
}): {
    changed: boolean;
    code: string;
    candidates: Candidate[];
    added: Record<string, string>;
} {
    const relativePath = path.relative(process.cwd(), args.filePath).replace(/\\/g, "/");
    const noOp = { changed: false, code: args.source, candidates: [], added: {} };

    if (args.source.includes(IGNORE_FILE_MARKER)) return noOp;

    const ast = recast.parse(args.source, { parser: babelTsParser });
    let translatorNames = detectTranslatorNames(ast);

    // 文件没有 translator 时，尝试自动注入
    if (translatorNames.size === 0) {
        if (!hasJSX(ast)) {
            // 纯逻辑文件（无 JSX）且无 translator，跳过
            return noOp;
        }

        const isClient = hasUseClientDirective(ast);
        const injected = injectTranslatorIntoFile(ast, isClient);

        if (!injected) {
            console.warn(`[skip] ${relativePath}: 含中文但无法自动注入 translator（请手动添加 useTranslations）`);
            return noOp;
        }

        translatorNames = new Set([injected]);
    }

    const translatorName = Array.from(translatorNames)[0];
    const added: Record<string, string> = {};
    const candidates: Candidate[] = [];

    function allocateKey(value: string): string {
        const folder = path
            .dirname(relativePath)
            .replace(/\\/g, "/")
            .replace(/^src\//, "")
            .replace(/\//g, ".");
        const base = `auto.${folder}.${slugifyText(value)}`.replace(/\.{2,}/g, ".");

        if (!args.usedKeys.has(base)) {
            args.usedKeys.add(base);
            return base;
        }

        let index = 2;
        while (args.usedKeys.has(`${base}_${index}`)) {
            index += 1;
        }

        const next = `${base}_${index}`;
        args.usedKeys.add(next);
        return next;
    }

    function upsertMessage(value: string): string {
        const exist = Object.entries(args.flatZh).find(([, text]) => text === value)?.[0];
        if (exist) return exist;

        const key = allocateKey(value);
        args.flatZh[key] = value;
        added[key] = value;
        return key;
    }

    recast.types.visit(ast, {
        visitJSXText(pathValue) {
            const node = pathValue.node;
            const text = normalizeText(node.value);

            if (!text || !hasChinese(text)) {
                this.traverse(pathValue);
                return;
            }

            if (nodeHasIgnoreComment(pathValue) || isInsideTranslationCall(pathValue, translatorNames)) {
                this.traverse(pathValue);
                return;
            }

            if (!contextAllows(pathValue, "jsx-text")) {
                this.traverse(pathValue);
                return;
            }

            const key = upsertMessage(text);
            candidates.push({ key, value: text, filePath: relativePath, kind: "jsx-text", line: node.loc?.start.line ?? 0 });

            pathValue.replace(b.jsxExpressionContainer(buildTranslatorCall(key, translatorName)));
            return false;
        },

        visitStringLiteral(pathValue) {
            const node = pathValue.node;
            const text = normalizeText(node.value);

            if (!text || !hasChinese(text)) {
                this.traverse(pathValue);
                return;
            }

            if (nodeHasIgnoreComment(pathValue) || isInsideTranslationCall(pathValue, translatorNames)) {
                this.traverse(pathValue);
                return;
            }

            const isJsxAttr = canTranslateJsxAttribute(pathValue);
            const kind: CandidateKind = isJsxAttr ? "jsx-attr" : "string";

            if (!contextAllows(pathValue, kind)) {
                this.traverse(pathValue);
                return;
            }

            const key = upsertMessage(text);
            candidates.push({ key, value: text, filePath: relativePath, kind, line: node.loc?.start.line ?? 0 });

            const call = buildTranslatorCall(key, translatorName);
            // JSX 属性位置或 JSXExpressionContainer 子节点位置都需要包一层 {}
            const needsContainer =
                isJsxAttr ||
                n.JSXExpressionContainer.check(pathValue.parentPath?.node);
            if (needsContainer) {
                pathValue.replace(b.jsxExpressionContainer(call));
            } else {
                pathValue.replace(call);
            }
            return false;
        },

        visitTemplateLiteral(pathValue) {
            const node = pathValue.node;
            const info = extractTemplateInfo(node);

            if (!info.message || !hasChinese(info.message)) {
                this.traverse(pathValue);
                return;
            }

            if (nodeHasIgnoreComment(pathValue) || isInsideTranslationCall(pathValue, translatorNames)) {
                this.traverse(pathValue);
                return;
            }

            if (!contextAllows(pathValue, "template")) {
                this.traverse(pathValue);
                return;
            }

            const key = upsertMessage(info.message);
            candidates.push({ key, value: info.message, filePath: relativePath, kind: "template", line: node.loc?.start.line ?? 0 });

            const call = buildTranslatorCall(key, translatorName, info.values);
            const needsContainer =
                canTranslateJsxAttribute(pathValue) ||
                (n.JSXExpressionContainer.check(pathValue.parentPath?.node) &&
                    (n.JSXElement.check(pathValue.parentPath?.parentPath?.node) ||
                        n.JSXFragment.check(pathValue.parentPath?.parentPath?.node)));
            if (needsContainer) {
                pathValue.replace(b.jsxExpressionContainer(call));
            } else {
                pathValue.replace(call);
            }
            return false;
        },
    });

    const code = recast.print(ast).code;
    return { changed: code !== args.source, code, candidates, added };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function main(): void {
    const args = parseArgs();
    const zhRaw = readJson(args.zhMessagesPath);
    const enRaw = readJson(args.enMessagesPath);

    const flatZh = flattenObject(zhRaw);
    const flatEn = flattenObject(enRaw);
    const usedKeys = new Set<string>(Object.keys(flatZh));

    const files = collectSourceFiles(args.sourceDir);

    let changedFiles = 0;
    let replacedCount = 0;
    const allCandidates: Candidate[] = [];
    const addedMessages: Record<string, string> = {};

    for (const filePath of files) {
        const source = fs.readFileSync(filePath, "utf8");
        const result = migrateFile({ filePath, source, flatZh, usedKeys });

        if (!result.candidates.length) continue;

        changedFiles += result.changed ? 1 : 0;
        replacedCount += result.candidates.length;
        allCandidates.push(...result.candidates);
        Object.assign(addedMessages, result.added);

        if (args.write && result.changed) {
            fs.writeFileSync(filePath, result.code, "utf8");
        }
    }

    for (const [key, value] of Object.entries(addedMessages)) {
        if (!flatEn[key]) {
            flatEn[key] = value;
        }
    }

    if (args.write && Object.keys(addedMessages).length > 0) {
        writeJson(args.zhMessagesPath, unflattenObject(flatZh));
        writeJson(args.enMessagesPath, unflattenObject(flatEn));
    }

    const mode = args.write ? "WRITE" : "DRY-RUN";
    console.log(`\n[i18n-migrate] mode=${mode}`);
    console.log(`[i18n-migrate] scanned files=${files.length}`);
    console.log(`[i18n-migrate] changed files=${changedFiles}`);
    console.log(`[i18n-migrate] replacements=${replacedCount}`);
    console.log(`[i18n-migrate] new keys=${Object.keys(addedMessages).length}`);

    if (allCandidates.length) {
        console.log("\n[i18n-migrate] sample findings:");
        for (const item of allCandidates.slice(0, 20)) {
            console.log(`  ${item.filePath}:${item.line} [${item.kind}] "${item.value}" → ${item.key}`);
        }
    }

    if (args.dryRun && replacedCount > 0) {
        process.exitCode = 2;
    }
}

main();
