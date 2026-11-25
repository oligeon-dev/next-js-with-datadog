import type { Instrumentation } from "next";

// サーバー側で捕捉したエラーを Datadog Logs に送る。
// 本番ではクライアントにエラーの詳細が渡らないため、元のメッセージ・スタックは
// ここ(サーバー側)でしか取得できない。RUM 側のエラーとは digest で突き合わせる。
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const apiKey = process.env.DD_API_KEY;
  if (!apiKey) {
    console.warn("[datadog] DD_API_KEY is not set; skipping error log");
    return;
  }

  const site = process.env.DD_SITE ?? "ap1.datadoghq.com";
  const service = process.env.DD_SERVICE ?? "nextjs-datadog";
  const env = process.env.DD_ENV ?? "dev";

  const error = err instanceof Error ? err : undefined;
  const message = error?.message ?? String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String(err.digest)
      : undefined;

  const log = {
    ddsource: "nextjs",
    ddtags: `env:${env},service:${service}`,
    service,
    status: "error",
    message,
    error: {
      kind: error?.name,
      message,
      stack: error?.stack,
    },
    nextjs: {
      digest,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    },
    http: {
      method: request.method,
      // クエリ文字列にはトークン等が含まれ得るため、パスのみ送る。
      // ヘッダーも Cookie / Authorization を含むため送らない。
      url_details: { path: request.path.split("?")[0] },
    },
  };

  try {
    const res = await fetch(`https://http-intake.logs.${site}/api/v2/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": apiKey,
      },
      body: JSON.stringify([log]),
      signal: AbortSignal.timeout(3000),
    });
    // fetch は 4xx/5xx でも例外を投げないため、ステータスを確認する
    // (キー誤りの 403 などを見逃さないため)
    if (!res.ok) {
      console.error(
        `[datadog] log intake responded ${res.status} ${res.statusText}`,
      );
    }
  } catch (sendError) {
    // ログ送信の失敗でリクエスト処理に影響を出さない
    console.error("[datadog] failed to send error log", sendError);
  }
};
