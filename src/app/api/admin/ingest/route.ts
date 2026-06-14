import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
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

    // Call GitHub Repository Dispatch API
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
