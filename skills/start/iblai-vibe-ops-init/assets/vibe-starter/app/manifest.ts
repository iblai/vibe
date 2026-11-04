import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My App",
    short_name: "My App",
    description: "Built on the ibl.ai platform",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0058cc",
    icons: [
      { src: "/icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
  };
}
