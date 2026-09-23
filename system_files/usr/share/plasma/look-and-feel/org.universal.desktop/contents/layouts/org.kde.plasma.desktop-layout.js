// Universal OS default desktop layout (applied on a user's first login).
// Top bar: launcher, global menu, tray, clock.  Bottom: centred floating dock.

// --- Top bar -----------------------------------------------------------------
var bar = new Panel;
bar.location = "top";
bar.height = Math.round(gridUnit * 1.6);
bar.hiding = "none";

var launcher = bar.addWidget("org.kde.plasma.kickoff");
launcher.currentConfigGroup = ["General"];
launcher.writeConfig("icon", "universal-logo");

bar.addWidget("org.kde.plasma.appmenu");      // global menu of the focused app
bar.addWidget("org.kde.plasma.panelspacer");
bar.addWidget("org.kde.plasma.systemtray");
var clock = bar.addWidget("org.kde.plasma.digitalclock");
clock.currentConfigGroup = ["Appearance"];
clock.writeConfig("showDate", "true");
clock.writeConfig("dateDisplayFormat", "BesideTime");

// --- Dock --------------------------------------------------------------------
var dock = new Panel;
dock.location = "bottom";
dock.height = Math.round(gridUnit * 3.2);
dock.floating = true;
dock.hiding = "dodgewindows";
try { dock.lengthMode = "fit"; } catch (e) { dock.alignment = "center"; }
dock.alignment = "center";

var tasks = dock.addWidget("org.kde.plasma.icontasks");
tasks.currentConfigGroup = ["General"];
tasks.writeConfig("launchers", [
    "preferred://filemanager",
    "applications:com.google.Chrome.desktop",
    "applications:universal-web-claude.desktop",
    "applications:universal-web-chatgpt.desktop",
    "applications:universal-web-gemini.desktop",
    "applications:org.telegram.desktop.desktop",
    "applications:universal-web-whatsapp.desktop",
    "applications:universal-web-gmail.desktop",
    "applications:org.kde.konsole.desktop",
    "applications:org.kde.discover.desktop",
    "applications:systemsettings.desktop"
]);
tasks.writeConfig("showOnlyCurrentDesktop", "false");

// --- Wallpaper on every screen ----------------------------------------------
var all = desktops();
for (var i = 0; i < all.length; i++) {
    var d = all[i];
    d.wallpaperPlugin = "org.kde.image";
    d.currentConfigGroup = ["Wallpaper", "org.kde.image", "General"];
    d.writeConfig("Image", "file:///usr/share/wallpapers/Universal/");
}
