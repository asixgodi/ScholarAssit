import createNextIntlPlugin from "next-intl/plugin";

// 按照request中定义的路径规则生成国际化插件
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: "50mb",
        },
    },
};

export default withNextIntl(nextConfig);
