import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, buildOutputs, buildConfigs } from "@/lib/db/schema";

const PUBLISH_DOMAIN = process.env.PUBLISH_DOMAIN || "calypso.build";

// Allow up to 2 minutes for deployment + polling
export const maxDuration = 120;

/* ─── Access-gate script (runs synchronously before page renders) ─────────── */

function makeGateScript(token: string) {
  // This script runs at the top of <head> before any content is visible.
  // It checks for __pv_token in URL params or localStorage.
  // If valid: saves to localStorage, strips from URL, continues loading.
  // If missing/invalid: replaces the page with an access-denied message.
  return `(function(){
  var T='${token}',K='__pv_token';
  var p=new URLSearchParams(window.location.search).get(K);
  if(p===T){try{localStorage.setItem(K,T)}catch(e){}
    var u=new URL(window.location);u.searchParams.delete(K);
    window.history.replaceState(null,'',u.toString());return}
  try{if(localStorage.getItem(K)===T)return}catch(e){}
  document.documentElement.innerHTML='<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#71717a"><div style="text-align:center"><h1 style="font-size:18px;font-weight:600;color:#18181b;margin:0 0 8px">Preview not available</h1><p style="font-size:14px;margin:0">This preview link is private.</p></div></body>';
  window.stop();
})();`;
}

/* ─── Banner script injected into the preview site ────────────────────────── */

function makeBannerScript(projectId: string, appDomain: string) {
  return `(function(){
  if(window.__pvBanner)return;window.__pvBanner=true;
  var d=document,b=d.createElement('div');
  b.setAttribute('style','position:fixed;top:0;left:0;right:0;z-index:999999;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#18181b;color:#fff;font-family:system-ui,-apple-system,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.15);');
  b.innerHTML='<div style="display:flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.6"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span style="opacity:.7">Preview</span><span style="background:rgba(245,158,11,.15);color:#f59e0b;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:500">Not published</span></div><a href="'+appDomain+'/project/${projectId}/build" style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;background:#fff;color:#18181b;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;transition:opacity .15s" onmouseover="this.style.opacity=\\'0.9\\'" onmouseout="this.style.opacity=\\'1\\'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>Publish</a>';
  d.body.prepend(b);
  d.body.style.paddingTop='40px';
})();`;
}

/* ─── POST: Create preview deployment ─────────────────────────────────────── */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = session.user.id;

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      columns: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get latest completed build
    const output = await db.query.buildOutputs.findFirst({
      where: and(
        eq(buildOutputs.projectId, projectId),
        eq(buildOutputs.status, "complete"),
      ),
      orderBy: [desc(buildOutputs.createdAt)],
    });

    if (!output?.files || output.files.length === 0) {
      return NextResponse.json(
        { error: "No completed build found." },
        { status: 404 },
      );
    }

    // If this build already has a working preview, return it with its token
    if (output.previewUrl && output.previewToken) {
      try {
        const check = await fetch(output.previewUrl, {
          method: "HEAD",
          redirect: "follow",
        });
        if (check.ok) {
          return NextResponse.json({
            url: output.previewUrl,
            token: output.previewToken,
            ready: true,
          });
        }
      } catch {
        // Stale — recreate below
      }

      await db
        .update(buildOutputs)
        .set({
          previewUrl: null,
          previewToken: null,
          previewDeploymentId: null,
          previewVercelProjectId: null,
        })
        .where(eq(buildOutputs.id, output.id));
    }

    // Get framework for Vercel project settings
    const config = await db.query.buildConfigs.findFirst({
      where: eq(buildConfigs.projectId, projectId),
      columns: { framework: true },
    });

    let framework: string | null = null;
    if (config) {
      switch (config.framework) {
        case "nextjs":
          framework = "nextjs";
          break;
        case "vite_react":
          framework = "vite";
          break;
        default:
          framework = null;
      }
    }

    const token = process.env.VERCEL_PUBLISH_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Preview is not available right now." },
        { status: 503 },
      );
    }

    const teamId = process.env.VERCEL_TEAM_ID;
    const teamQuery = teamId ? `?teamId=${teamId}` : "";

    // Generate preview token for access gating
    const previewToken = randomBytes(32).toString("hex");

    // Random preview slug for calypso.build domain
    const previewSlug = `pv-${randomBytes(8).toString("hex")}`;
    const customDomain = `${previewSlug}.${PUBLISH_DOMAIN}`;
    const previewUrl = `https://${customDomain}`;
    const vercelProjectName = `calypso-pv-${projectId.slice(0, 8)}-${randomBytes(4).toString("hex")}`;

    // Determine the app origin for the banner "Publish" link
    const appDomain =
      process.env.NEXT_PUBLIC_APP_URL ||
      (PUBLISH_DOMAIN === "calypso.build"
        ? "https://calypso.build"
        : "https://localhost:3000");

    // Prepare injected scripts
    const buildFiles = output.files as { path: string; content: string }[];
    const gateJs = makeGateScript(previewToken);
    const bannerJs = makeBannerScript(projectId, appDomain);

    const injectedFiles = [...buildFiles];

    // Add gate + banner JS to public directory
    injectedFiles.push({
      path: "public/__preview_gate.js",
      content: gateJs,
    });
    injectedFiles.push({
      path: "public/__preview_banner.js",
      content: bannerJs,
    });

    // For Next.js: inject script tags into root layout
    const layoutIdx = injectedFiles.findIndex((f) =>
      /^(src\/)?app\/layout\.(tsx|jsx|ts|js)$/.test(f.path),
    );
    if (layoutIdx !== -1) {
      const layout = injectedFiles[layoutIdx];
      let content = layout.content;
      if (!content.includes("next/script")) {
        content = `import Script from "next/script";\n${content}`;
      }
      // Inject gate script (beforeInteractive = runs in <head> before hydration)
      // and banner script (afterInteractive = runs after page is interactive)
      content = content.replace(
        /<\/body>/i,
        `<Script src="/__preview_gate.js" strategy="beforeInteractive" />\n<Script src="/__preview_banner.js" strategy="afterInteractive" />\n</body>`,
      );
      injectedFiles[layoutIdx] = { ...layout, content };
    }

    // For HTML builds: inject script into each HTML file
    if (layoutIdx === -1) {
      for (let i = 0; i < injectedFiles.length; i++) {
        if (injectedFiles[i].path.endsWith(".html")) {
          let html = injectedFiles[i].content;
          // Inject gate script at the very start of <head> (blocks before content)
          const headOpen = html.indexOf("<head>");
          const gateTag = `<script src="/__preview_gate.js"></script>`;
          if (headOpen !== -1) {
            const insertAt = headOpen + "<head>".length;
            html = html.slice(0, insertAt) + gateTag + html.slice(insertAt);
          }
          // Inject banner script before </body>
          const bodyClose = html.lastIndexOf("</body>");
          const bannerTag = `<script src="/__preview_banner.js"></script>`;
          if (bodyClose !== -1) {
            html =
              html.slice(0, bodyClose) + bannerTag + html.slice(bodyClose);
          } else {
            html += bannerTag;
          }
          injectedFiles[i] = { ...injectedFiles[i], content: html };
        }
      }
    }

    // Upload files to Vercel
    const fileRefs: { file: string; sha: string; size: number }[] = [];

    for (const file of injectedFiles) {
      const content = Buffer.from(file.content, "utf-8");
      const sha = createHash("sha1").update(content).digest("hex");

      const uploadRes = await fetch(
        `https://api.vercel.com/v2/files${teamQuery}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
            "Content-Length": String(content.length),
            "x-vercel-digest": sha,
          },
          body: content,
        },
      );

      if (!uploadRes.ok && uploadRes.status !== 409) {
        console.error("Preview file upload failed:", uploadRes.status);
        return NextResponse.json(
          { error: "Failed to create preview." },
          { status: 500 },
        );
      }

      fileRefs.push({ file: file.path, sha, size: content.length });
    }

    // Create deployment (same as publish — target: production)
    const deployRes = await fetch(
      `https://api.vercel.com/v13/deployments${teamQuery}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: vercelProjectName,
          files: fileRefs,
          projectSettings: { framework },
          target: "production",
        }),
      },
    );

    if (!deployRes.ok) {
      const errData = await deployRes.json().catch(() => ({}));
      console.error("Preview deployment failed:", deployRes.status, errData);
      return NextResponse.json(
        { error: errData?.error?.message || "Preview failed." },
        { status: 500 },
      );
    }

    const deployment = await deployRes.json();
    const deployId = deployment.id;
    const vercelProjectId = deployment.projectId ?? vercelProjectName;

    // Poll for deployment ready (every 2s, up to 90s)
    if (deployId) {
      const maxWait = 90_000;
      const interval = 2_000;
      const start = Date.now();

      while (Date.now() - start < maxWait) {
        await new Promise((r) => setTimeout(r, interval));

        try {
          const statusRes = await fetch(
            `https://api.vercel.com/v13/deployments/${deployId}${teamQuery}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );

          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.readyState === "READY") break;
            if (statusData.readyState === "ERROR") {
              return NextResponse.json(
                { error: "Preview deployment failed." },
                { status: 500 },
              );
            }
          }
        } catch {
          // Continue polling
        }
      }
    }

    // Assign calypso.build subdomain (same as publish)
    try {
      const domainRes = await fetch(
        `https://api.vercel.com/v10/projects/${vercelProjectId}/domains${teamQuery}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: customDomain }),
        },
      );

      if (!domainRes.ok && domainRes.status !== 409) {
        console.error(
          "Preview domain assignment failed:",
          domainRes.status,
          await domainRes.json().catch(() => ({})),
        );
        // Non-fatal — fall back to Vercel URL
      }
    } catch {
      // Non-fatal
    }

    // Save preview info (including token)
    await db
      .update(buildOutputs)
      .set({
        previewUrl,
        previewToken,
        previewDeploymentId: deployId,
        previewVercelProjectId: vercelProjectId,
      })
      .where(eq(buildOutputs.id, output.id));

    return NextResponse.json({
      url: previewUrl,
      token: previewToken,
      ready: true,
    });
  } catch (error) {
    console.error("Preview error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}

/* ─── GET: Check preview status ───────────────────────────────────────────── */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.userId, session.user.id),
      ),
      columns: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const output = await db.query.buildOutputs.findFirst({
      where: and(
        eq(buildOutputs.projectId, projectId),
        eq(buildOutputs.status, "complete"),
      ),
      orderBy: [desc(buildOutputs.createdAt)],
      columns: { previewUrl: true, previewToken: true },
    });

    if (output?.previewUrl && output?.previewToken) {
      return NextResponse.json({
        url: output.previewUrl,
        token: output.previewToken,
        ready: true,
      });
    }

    return NextResponse.json({ ready: false });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
