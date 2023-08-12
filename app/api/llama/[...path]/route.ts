import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";

const LammaCppServerPath = {
  ChatPath: "completion",
  ModelInfoPath: "model.json",
};
const ALLOWD_PATH = new Set(Object.values(LammaCppServerPath));
const LlamaCppServer_URL = "127.0.0.1";
const DEFAULT_PROTOCOL = "https";
const BASE_URL = process.env.LLAMA_CPP_SERVER_URL || LlamaCppServer_URL;

async function requestLlamaCppServer(req: NextRequest, path: string) {
  const controller = new AbortController();
  const authValue = req.headers.get("Authorization") ?? "";
  let baseUrl = BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `${DEFAULT_PROTOCOL}://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[LlamaCpp Server Url]", baseUrl);

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10 * 60 * 1000);

  const fetchUrl = `${baseUrl}/${path}`;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Authorization: authValue,
    },
    method: req.method,
    body: req.body,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  try {
    const res = await fetch(fetchUrl, fetchOptions);

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[Llama Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {
    console.log("[Llama Route] forbidden path ", subpath);
    return NextResponse.json(
      {
        error: true,
        msg: "[Llama Route] you are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  const authResult = auth(req);
  if (authResult.error) {
    return NextResponse.json(authResult, {
      status: 401,
    });
  }

  try {
    const response = await requestLlamaCppServer(req, subpath);
    return response;
  } catch (e) {
    console.error("[Llama Route] ", e);
    return NextResponse.json(prettyObject(e));
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
