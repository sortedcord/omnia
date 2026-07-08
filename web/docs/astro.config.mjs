import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://omnia.omniasimulation.com",
  base: "/docs",
  integrations: [
    starlight({
      title: "Omnia Docs",
      logo: {
        src: "./src/assets/img/logo.png",
      },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/sortedcord/omnia" }],
      sidebar: [
        {
          label: "Introduction",
          slug: "intro",
        },
        {
          label: "Architecture",
          items: [{ autogenerate: { directory: "architecture" } }],
        },
        {
          label: "Guides",
          items: [{ autogenerate: { directory: "guides" } }],
        },
      ],
      editLink: {
        baseUrl: "https://github.com/sortedcord/omnia/edit/main/web/docs/",
      },
    }),
  ],
});
