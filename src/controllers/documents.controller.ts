// controllers/documentsController.ts
import { Context } from "hono";
import courseMapData from '../public/coursemap.json' assert { type: 'json' };

const MANIFEST_URL = "https://d1q2pjcdrkfe73.cloudfront.net/manifest.json";
let cachedManifest: any = null;
let lastFetched: number = 0;

const courseMap: any[] = courseMapData;

async function getManifest() {
  const now = Date.now();
  if (!cachedManifest || now - lastFetched > 60_000) {
    const res = await fetch(MANIFEST_URL);
    cachedManifest = await res.json();
    lastFetched = now;
  }
  return cachedManifest;
}

function buildFileTree(baseUrl: string, node: any) {
  if (!node) return [];
  const files: any[] = [];

  for (const [name, meta] of Object.entries(node)) {
    if (meta && typeof meta === "object" && "key" in meta) {
      files.push({
        name,
        type: "file",
        url: `${baseUrl}/${(meta as any).key}`,
        lastModified: (meta as any).lastModified,
      });
    } else if (meta && typeof meta === "object") {
      const children = buildFileTree(baseUrl, meta);
      if (children.length > 0) {
        files.push({
          name,
          type: "folder",
          children,
        });
      }
    }
  }
  return files;
}

function buildLightweightTreeWithCourseCodes(node: any, courseMap: any[]) {
  if (!node) return [];
  const folders: any[] = [];

  for (const [name, meta] of Object.entries(node)) {
    if (meta && typeof meta === "object" && "key" in meta) {
      continue;
    } else if (meta && typeof meta === "object") {
      const hasChildren = Object.keys(meta).length > 0;
      if (hasChildren) {
        const courseInfo = courseMap.find(course => 
          course.folderNames.some((folderName: string) => 
            folderName.toLowerCase() === name.toLowerCase()
          )
        );
        folders.push({
          name,
          type: "folder",
          courseCode: courseInfo?.courseCode || null,
        });
      }
    }
  }
  return folders;
}

export const DocumentsController = {
  listRoot: async (c: Context) => {
    const manifest = await getManifest();
    const tree = buildLightweightTreeWithCourseCodes(manifest.files, courseMap);
    return c.json({ 
      lastUpdated: manifest.lastUpdated, 
      tree,
      courseMapLoaded: courseMap.length > 0,
      courseMapCount: courseMap.length
    });
  },

  listByPath: async (c: Context) => {
    const manifest = await getManifest();
    const { path } = c.req.param();
    const parts = path.split("/").filter(Boolean);
    let node: any = manifest.files;
    for (const part of parts) {
      if (node[part]) {
        node = node[part];
      } else {
        return c.json({ error: "Not found" }, 404);
      }
    }

    const tree = buildFileTree("https://d1q2pjcdrkfe73.cloudfront.net", node);
    return c.json({ tree });
  }
};
