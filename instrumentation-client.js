import { datadogRum } from '@datadog/browser-rum';
import { nextjsPlugin } from '@datadog/browser-rum-nextjs';

datadogRum.init({
  // NEXT_PUBLIC_ の値はビルド時にブラウザ向けコードへ埋め込まれる(.env.local を参照)
  applicationId: process.env.NEXT_PUBLIC_DD_APPLICATION_ID,
  clientToken: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN,
  remoteConfiguration: {
    id: process.env.NEXT_PUBLIC_DD_REMOTE_CONFIG_ID,
  },
  site: process.env.NEXT_PUBLIC_DD_SITE,
  service: process.env.NEXT_PUBLIC_DD_SERVICE,
  env: process.env.NEXT_PUBLIC_DD_ENV, // e.g. 'prod', 'staging-1', 'dev'
  version: process.env.NEXT_PUBLIC_DD_VERSION, // e.g. '1.0.0'
  sessionSampleRate: 100, // capture 100% of sessions
  sessionReplaySampleRate: 20, // capture 20% of sessions with replay
  trackResources: true, // Enable Resource tracking
  trackUserInteractions: true, // Enable Action tracking
  trackLongTasks: true, // Enable Long Tasks tracking

  // ----- Recommended Options -----
  // allowedTracingUrls: '<BACKEND_URL>',		// Enable distributed tracing
  // defaultPrivacyLevel: 'mask-user-input',	// 'mask-user-input' | 'allow' | 'mask'
  plugins: [nextjsPlugin()],
});
export { onRouterTransitionStart } from '@datadog/browser-rum-nextjs';
