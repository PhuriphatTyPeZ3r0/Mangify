import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user and verify Admin privileges
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized: Missing authentication token" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
    }

    // Check app_metadata.role or environment ADMIN_EMAILS
    let isAdmin = user.app_metadata?.role === "admin";
    const adminEmailsEnv = process.env.ADMIN_EMAILS;
    if (!isAdmin && adminEmailsEnv && user.email) {
      const allowedEmails = adminEmailsEnv.split(",").map(e => e.trim().toLowerCase());
      isAdmin = allowedEmails.includes(user.email.toLowerCase());
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    // 2. Validate input body
    const body = await request.json();
    const { mangaId, chapterId, chapterTitle, zipUrl } = body;

    if (!mangaId || !chapterId || !chapterTitle || !zipUrl) {
      return NextResponse.json({ error: "Missing required fields (mangaId, chapterId, chapterTitle, zipUrl)" }, { status: 400 });
    }

    const githubPat = process.env.GITHUB_PAT;
    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;

    if (!githubPat || !repoOwner || !repoName) {
      return NextResponse.json({ 
        error: "Server configuration error: GITHUB_PAT, GITHUB_REPO_OWNER, or GITHUB_REPO_NAME is not configured." 
      }, { status: 500 });
    }

    // 3. Call GitHub Repository Dispatch API
    const dispatchUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`;
    const response = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubPat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "ingest_manga",
        client_payload: {
          mangaId,
          chapterId,
          chapterTitle,
          zipUrl,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: `GitHub repository dispatch failed: ${errorText}` 
      }, { status: 502 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "GitHub Actions workflow dispatched successfully for ingestion.",
      mangaId,
      chapterId
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
