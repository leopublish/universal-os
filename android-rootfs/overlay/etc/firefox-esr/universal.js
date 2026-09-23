// Universal OS for Android: keep Firefox light, because Android limits how
// many background processes an app may run.
pref("dom.ipc.processCount", 2);
pref("dom.ipc.processCount.webIsolated", 1);
pref("fission.autostart", false);
pref("browser.startup.homepage", "https://www.google.com");
pref("browser.shell.checkDefaultBrowser", false);
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("toolkit.telemetry.enabled", false);
