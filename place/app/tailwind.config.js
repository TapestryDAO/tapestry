module.exports = {
    content: ["./public/**/*.html", "./src/**/*.{js,jsx,ts,tsx,vue}"],
    theme: {
        extend: {
            minHeight: (theme) => ({
                ...theme("spacing"),
            }),
        },
    },
    plugins: [],
};
