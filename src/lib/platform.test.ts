import { test } from "node:test";
import assert from "node:assert/strict";
import { platformCatalog, loadPlatformReports, platformFilter, reportPlatforms } from "./platform";

test("plataformas futuras têm apresentação própria sem habilitar integração incompleta", () => {
  assert.equal(platformCatalog.tiktok.label, "TikTok Ads");
  assert.equal(platformCatalog.linkedin.label, "LinkedIn Ads");
  assert.equal(platformCatalog.tiktok.available, false);
  assert.equal(platformCatalog.linkedin.available, false);
  assert.deepEqual(reportPlatforms("all"), ["meta", "google"]);
  assert.equal(platformFilter("tiktok"), "all");
  assert.equal(platformFilter("linkedin"), "all");
});

test("carregamento mantém séries atuais e anteriores independentes por plataforma", async () => {
  const calls: string[] = [];
  const reports = await loadPlatformReports("all", async platform => {
    calls.push(platform);
    return { series: [{ spend: platform === "meta" ? 10 : 100 }], previous: [{ spend: platform === "meta" ? 5 : 80 }] };
  });
  assert.deepEqual(calls.sort(), ["google", "meta"]);
  assert.deepEqual(reports, [
    { platform: "meta", series: [{ spend: 10 }], previous: [{ spend: 5 }] },
    { platform: "google", series: [{ spend: 100 }], previous: [{ spend: 80 }] },
  ]);
  const focused = await loadPlatformReports("google", async platform => ({ source: platform }));
  assert.deepEqual(focused, [{ platform: "google", source: "google" }]);
});
