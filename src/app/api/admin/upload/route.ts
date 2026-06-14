import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Configure Cloudflare R2 Client
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || "https://placeholder-url.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "placeholder-access-key",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "placeholder-secret-key",
  },
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mangaId = formData.get("mangaId") as string | null;
    const chapterId = formData.get("chapterId") as string | null;
    const chapterTitle = formData.get("chapterTitle") as string | null;

    if (!file || !mangaId || !chapterId || !chapterTitle) {
      return NextResponse.json({ error: "Missing required fields (file, mangaId, chapterId, chapterTitle)" }, { status: 400 });
    }

    // Convert file to buffer for uploading
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const timestamp = Date.now();
    const zipFilename = `temp/${mangaId}-${chapterId}-${timestamp}.zip`;

    // 1. Upload raw ZIP to Cloudflare R2 in the "temp/" folder
    const bucketName = process.env.R2_BUCKET_NAME || "placeholder-bucket";
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: zipFilename,
        Body: buffer,
        ContentType: file.type || "application/zip",
      })
    );

    // 2. Dispatch GitHub Actions Workflow
    const githubPat = process.env.GITHUB_PAT;
    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;

    if (!githubPat || !repoOwner || !repoName) {
      return NextResponse.json({ 
        success: true, 
        message: "ZIP uploaded to R2. GitHub Actions trigger skipped because GITHUB_PAT, GITHUB_REPO_OWNER, or GITHUB_REPO_NAME env variables are not configured." 
      });
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
          zipFilename,
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
      message: "ZIP uploaded to R2 temp storage and GitHub Actions workflow dispatched successfully.",
      zipFilename
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
