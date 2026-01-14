const { createProxyMiddleware } = require("http-proxy-middleware");
const { createProxyMiddleware: proxy } = require("http-proxy-middleware");
const { Buffer } = require("buffer");

const SERVICE_URLS = {
  USER: process.env.API_USER_URL,
};

const proxyConfig = {
  user: createProxyMiddleware({
    target: SERVICE_URLS.USER,
    changeOrigin: true,
    pathRewrite: {
      "^/api/v1/users": "",
    },
    onProxyReq: (proxyReq, req, res) => {
      if (
        ["POST", "PUT", "PATCH"].includes(req.method.toUpperCase()) &&
        req.body
      ) {
        const bodyData = JSON.stringify(req.body);

        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));

        proxyReq.write(bodyData);
      }
    },
  }),
};

const routes = [
  {
    path: "/api/v1/users",
    proxy: "user",
  },
];

module.exports = {
  proxyConfig,
  routes,
};
