# next-js-with-datadog

Next.js (App Router) のエラーを Datadog で確認できるようにするための検証用リポジトリです。

## セットアップ

```bash
pnpm install
# .env.local を作成して、下の環境変数を設定する
pnpm dev        # 本番相当の確認は pnpm build && pnpm start
```

`.env.local` に設定する環境変数:

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_DD_APPLICATION_ID` | RUM のアプリケーション ID |
| `NEXT_PUBLIC_DD_CLIENT_TOKEN` | RUM の clientToken(ブラウザに公開される前提の値) |
| `NEXT_PUBLIC_DD_REMOTE_CONFIG_ID` | RUM のリモート設定 ID |
| `NEXT_PUBLIC_DD_SITE` | Datadog のサイト(例: `ap1.datadoghq.com`) |
| `NEXT_PUBLIC_DD_SERVICE` | サービス名(例: `nextjs-datadog`) |
| `NEXT_PUBLIC_DD_ENV` | 環境名(例: `dev`、`prod`) |
| `NEXT_PUBLIC_DD_VERSION` | バージョン(例: `1.0.0`) |
| `DD_API_KEY` | サーバー側のログ送信用の API キー(サーバー側ログを使う場合のみ) |

- `NEXT_PUBLIC_` の値は、**ビルド時に埋め込まれ、ブラウザに公開されます。** 変更したら、再ビルドが必要です。
- `DD_API_KEY` は Datadog の **API キー**です。RUM の `clientToken` とは別物です。サーバー専用の値なので、`NEXT_PUBLIC_` を付けず、コミットもしないでください。
- `.env.local` を変更したら、サーバーを再起動してください。

## ファイルの役割(RUM の基本設定)

| ファイル | 役割 |
|---|---|
| `package.json`、`pnpm-lock.yaml` | Datadog の依存パッケージ(`@datadog/browser-rum`、`@datadog/browser-rum-nextjs`)を追加している |
| `instrumentation-client.js` | ブラウザ側で最初に実行され、`datadogRum.init` で RUM を初期化する。設定値は `NEXT_PUBLIC_DD_*` の環境変数から読む。`nextjsPlugin()` で Next.js のルーティングを RUM のビューとして記録する |
| `app/layout.tsx` | ルートレイアウトに `<DatadogAppRouter />` を置き、App Router の画面遷移を RUM のビューとして記録する |
| `app/error.tsx` | ルート配下で起きたエラーの共通エラー画面。`addNextjsError` で、エラー(と `digest`)を RUM に送る |
| `app/global-error.tsx` | ルートレイアウト自体のエラー用の共通エラー画面。`error.tsx` と同様に `addNextjsError` で RUM に送る |

## 構成

| 対象 | 仕組み | ファイル |
|---|---|---|
| ブラウザ側のエラー | Datadog RUM (`@datadog/browser-rum`, `@datadog/browser-rum-nextjs`) | `instrumentation-client.js`, `app/layout.tsx` |
| エラー画面に遷移したエラー | `error.tsx` / `global-error.tsx` で `addNextjsError` を呼ぶ | `app/error.tsx`, `app/global-error.tsx` |
| サーバー側のエラー | `onRequestError` から Datadog Logs へ直接送信 | `instrumentation.ts` |

サーバー側のログは、`https://http-intake.logs.<DD_SITE>/api/v2/logs` に送ります。
`service` と `env` は RUM と揃えています(`DD_SERVICE` / `DD_ENV`)。
ヘッダーとクエリ文字列は、Cookie やトークンを含み得るため送りません。

## 検出できる範囲

| エラー | 検出 | 備考 |
|---|---|---|
| クライアントのレンダリングエラー | できる | `error.tsx` 経由 |
| イベントハンドラの例外、Promise rejection、`console.error` | できる | RUM が自動収集 |
| fetch が 500 | Errors には出ない | Resources (Fetch) に記録される |
| Server Component のサーバーエラー | できる | RUM には圧縮されたエラーコードのみ。詳細は Logs |
| Server Action のエラー | できる | RUM にはクライアントの Promise rejection として届き、メッセージは圧縮されたコード。詳細は Logs |
| Route Handler のエラー | Logs のみ | RUM の Errors には出ない(fetch の 500 として Resources に記録)。詳細は Logs |
| `throw` を書かない実行時エラー(`TypeError`、`JSON.parse` の失敗など) | できる | `throw` と同じ扱い。下の「実行時エラーの検証結果」を参照 |
| `safeParse` の失敗、`try/catch` で握ったエラー | できない | 自分で `addError` やログ送信が必要 |
| `parse` が投げた `ZodError`(握られない場合) | できる | クライアントは RUM、サーバーは Logs |
| `satisfies`、zod の `toZod` | 対象外 | 型チェックのみで、実行時には何もしない |

## dev と本番ビルドの違い

| 項目 | dev | 本番ビルド |
|---|---|---|
| 同じエラーの件数 | 重複する(React の二重実行) | 1回 |
| クライアントのエラー | メッセージが読める | メッセージは読める。スタックは圧縮される |
| サーバーのエラー(RUM 側) | 元のメッセージ | `Minified React error #441` のみ |

本番で伏せられるのは、**サーバーで起きたエラー**のメッセージです。
ブラウザで起きたエラーは、本番でも元のメッセージが RUM で確認できます。

## 実行時エラーの検証結果

`throw` や `console.error` を書かず、実行時に自然に起きるエラー(`TypeError`、`JSON.parse` の失敗)でも検証しました(本番ビルド)。
JavaScript エンジンが投げる例外も、`throw` と同じ扱いで検出されます。検出できるかは、どこで起きたかと、握られたかで決まります。

| 場所 | 起こし方 | RUM(Errors) | Logs |
|---|---|---|---|
| クライアントのレンダリング中 | `undefined` のプロパティを読む | 届く。メッセージは元のまま(`Cannot read properties of undefined (reading 'name')`) | なし |
| クライアントのイベントハンドラ | 同上 | 届く。メッセージは元のまま | なし |
| Server Component | 同上 | 届く。`Minified React error #441` に伏せられる | 元のメッセージが届く |
| Server Action | 同上 | 届く(Promise rejection)。`Minified React error #441` に伏せられる | 元のメッセージが届く |
| Route Handler | `JSON.parse` の失敗 | **届かない**(Errors に出ない) | 元のメッセージが届く(`Expected property name or '}' in JSON at position 1`) |

- クライアントのエラーは、元のメッセージが RUM に残ります。サーバーのエラーは、RUM では伏せられ、Logs に元のメッセージが残ります。
- Route Handler のエラーは、Logs でしか見えません。
- Logs の `service` は `nextjs-datadog` で、RUM と揃っています。
- Logs の3件が、それぞれどの `nextjs.routeType`(`render` / `action` / `route`)になっているか、Route Handler と Server Action に `digest` が付くかは、**未確認**です。

検出できない場合:

- `try/catch` で握ったエラー(自分で記録しない限り、どこにも出ない)。
- リクエストの外で起きるサーバーのエラー(`setTimeout` やバックグラウンド処理など、レスポンスを返した後に起きるもの)。`onRequestError` の対象外と考えられるが、未検証です。
- 例外が出ない不具合(値が間違っているだけの場合など)。
- 別のドメインのスクリプトのエラー(ブラウザの仕様で、詳細が届かない)。

## サーバーエラーの原因を追う手順

1. RUM のエラーから `digest` を得る(`context.nextjs.digest`)。
   - `addNextjsError` が、`error.digest` を `context.nextjs.digest` として送ります。
   - RUM Explorer で `@context.nextjs.digest:<値>` を検索して確認できます。**検索の対象は `In Errors` にしてください。** `In Sessions` のままだとヒットしません(`context` はエラーイベントの属性のため)。
2. Datadog の Logs で `@nextjs.digest:<値>` を検索する。
3. 元のメッセージ、スタック、ルート、メソッドが見つかる。

確認できていること(本番ビルド、`digest` は `3884010495`):
- クライアントの `error.digest` に値が入る。
- RUM Explorer(In Errors)で `@context.nextjs.digest:3884010495` がヒットする。
- サーバーのログ(Logs)の `nextjs.digest` に同じ値が入る。

つまり、RUM のエラーとサーバーのログが、`digest` で突き合わせられます。

`digest` は、同じエラーなら同じ値になります。発生1回ごとの識別子ではなく、エラーの種類を識別する値です。
1件ずつ突き合わせたい場合は、発生時刻と RUM のセッションで絞ってください。

## 動作確認用のページ

`/debug-error` に、エラーを意図的に起こすページがあります。

- 1〜5: `throw` を書いたもの(レンダリングエラー、イベントハンドラの例外、Promise rejection)、`console.error`、fetch の 500
- 6〜9: `throw` を書かない実行時エラー(レンダリング中の `TypeError`、イベントハンドラの `TypeError`、Route Handler の `JSON.parse` 失敗、Server Action の `TypeError`)
- `/debug-error/server`: Server Component で `throw`(`digest` の確認に使う)
- `/debug-error/natural-server`: Server Component の `TypeError`(`throw` を書かない)

検証用なので、本番に載せる場合は `app/debug-error/` を削除してください。

## 注意点・今後の課題

- **ソースマップ**: クライアントもサーバーも、スタックの場所はコンパイル後のファイルです。元のコードの位置で見るには、ソースマップの対応が必要です(未対応)。
- **SSR 中の Client Component のエラー**: サーバー側で起きるため、伏せられる側になるはずですが、未検証です。
- **`global-error.tsx` に遷移するエラー**(ルートレイアウトでのエラー)は、未検証です。
- **Route Handler と Server Action の `digest`、`routeType`**: Logs には届いていますが、これらの値は未確認です。
- **本番デプロイ**: `DD_API_KEY` をデプロイ先の環境変数に設定し、`env` と `version` を本番用の値に変える。
- **通知**: 新しいエラーが出たときの Datadog のモニターは、未設定です。
- **`safeParse` の失敗の記録**: 不具合として扱いたい箇所には、ログ用の関数を入れる(個人情報が入らない形にする)。未実装です。
- **`components/datadog-init.tsx`**: レイアウトが `DatadogAppRouter` に変わったため、現在は使われていません。

## 設計の考え方

- 本番で伏せられるサーバーエラーのメッセージは、クライアントに出さないのが正しい挙動です。サーバー側のログで補います。
- 想定内のエラー(ユーザーの入力ミスなど)は、投げずに処理し、記録しません。
- 想定外のスキーマ不一致は、`parse` で投げるか、明示的に記録します。
- スキーマのずれは、検知よりも、型とスキーマの自動生成と CI での差分検出で、本番に出る前に防ぐのが理想です。
