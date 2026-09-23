// Universal OS start-up splash (shown while Plasma loads after login).
import QtQuick

Rectangle {
    id: root
    color: "#0b1420"

    // ksplash raises stage from 1 to 6 as the desktop starts.
    property int stage

    Image {
        anchors.fill: parent
        source: "file:///usr/share/wallpapers/Universal/contents/images_dark/1920x1080.png"
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
    }

    Column {
        id: content
        anchors.centerIn: parent
        spacing: 22
        opacity: root.stage >= 1 ? 1 : 0
        Behavior on opacity { NumberAnimation { duration: 600; easing.type: Easing.OutCubic } }

        Image {
            anchors.horizontalCenter: parent.horizontalCenter
            source: "file:///usr/share/icons/hicolor/scalable/apps/universal-logo.svg"
            sourceSize.width: 112
            sourceSize.height: 112
            scale: root.stage >= 2 ? 1 : 0.85
            Behavior on scale { NumberAnimation { duration: 700; easing.type: Easing.OutBack } }
        }

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: "Universal OS"
            color: "#e6edf1"
            font.pixelSize: 26
            font.weight: Font.DemiBold
            font.letterSpacing: 1
        }

        Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            width: 180; height: 3; radius: 2
            color: "#26ffffff"
            Rectangle {
                height: parent.height; radius: 2
                color: "#2bb3a3"
                width: parent.width * Math.min(1, root.stage / 6)
                Behavior on width { NumberAnimation { duration: 400; easing.type: Easing.OutCubic } }
            }
        }
    }
}
