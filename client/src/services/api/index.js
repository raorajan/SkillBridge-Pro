import axios from "axios";
import { getToken } from "../utils";

const fetchFromApiServer = (requestType, url, data, options, Authorization) => {
  return fetchApiWrapper(url, requestType, data, options, Authorization);
};

function getHeaderConfig(requestType, options, Authorization) {
  const token = getToken();

  const config = {
    headers: {
      "Content-Type":
      requestType === "MULTIPART" || requestType === "MULTIPART_PUT"
          ? "multipart/form-data"
          : "application/json",
      ...(Authorization
        ? { Authorization }
        : token
        ? { Authorization: "Bearer " + token }
        : {}),
      Accept: "*/*",
      // Prevent caching for GET requests to ensure fresh data
      ...(requestType === "GET" ? {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      } : {}),
    },
    params: { ...options },
    timeout: 60 * 10 * 1000,
  };
  return config;
}
const fetchApiWrapper = (
  uri,
  requestType,
  data,
  options = {},
  Authorization,
) => {
  // Ensure proper URL construction
  let baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
  // Remove trailing slash from baseUrl
  baseUrl = baseUrl.replace(/\/+$/, "");
  // Ensure uri starts with a slash
  const normalizedUri = uri.startsWith("/") ? uri : `/${uri}`;
  const url = `${baseUrl}${normalizedUri}`;
  
  const config = getHeaderConfig(requestType, options, Authorization);
  if (requestType === "GET") {
    return axios({ url, method: "get", ...config });
  } else if (requestType === "POST") {
    return axios({ url, method: "post", data, ...config });
  } else if (requestType === "DELETE") {
    return axios({ url, method: "delete", data, ...config });
  } else if (requestType === "PUT") {
    return axios({ url, method: "put", data, ...config });
  } else if (requestType === "PATCH") {
    return axios({ url, method: "patch", data, ...config });
  } else if (requestType === "MULTIPART") {
    return axios({ url, method: "post", data, ...config });
  } else if (requestType === "MULTIPART_PUT") {
    return axios({ url, method: "put", data, ...config });
  } else if (requestType === "JSON") {
    return axios.get(url);
  }
};

export default fetchFromApiServer;
