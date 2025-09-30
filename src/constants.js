export const apiUrl =
  import.meta.env.VITE_NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://dino-server.open-elements.cloud/";
