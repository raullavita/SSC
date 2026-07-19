import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Controls.Material

Page {
    id: page
    background: Rectangle { color: Theme.background }

    header: ToolBar {
        Material.background: Theme.surface
        RowLayout {
            anchors.fill: parent
            ToolButton {
                text: "←"
                onClicked: stack.pop()
            }
            Label {
                text: "Settings"
                font.bold: true
                color: Theme.onSurface
            }
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 16

        Label {
            text: "Account"
            color: Theme.primary
            font.bold: true
        }
        Label {
            text: "Name: " + (sscSession.displayName || "—")
            color: Theme.onSurface
        }
        Label {
            text: "User id: " + (sscSession.userId || "—")
            color: Theme.onSurfaceVariant
            wrapMode: Text.WrapAnywhere
            Layout.fillWidth: true
        }
        Label {
            text: "Device: " + sscSession.deviceId
            color: Theme.onSurfaceVariant
        }

        Label {
            text: "Security"
            color: Theme.primary
            font.bold: true
            Layout.topMargin: 12
        }
        Label {
            text: "E2EE: libsignal-client 0.96.4 (same target as Android)\nClient: windows/0.4.0/15\nNative Qt Quick UI (no Electron)"
            color: Theme.onSurfaceVariant
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        Button {
            text: "Re-upload prekeys"
            Layout.fillWidth: true
            Material.background: Theme.surfaceVariant
            Material.foreground: Theme.onSurface
            onClicked: sscApi.ensurePrekeys()
        }
        Button {
            text: "Log out"
            Layout.fillWidth: true
            Material.background: Theme.error
            Material.foreground: "#FFFFFF"
            onClicked: {
                sscApi.logout()
                stack.pop(null)
            }
        }
        Item { Layout.fillHeight: true }
        Label {
            text: "SSC Super Secure Chat · v0.4.0 (build 15)"
            color: Theme.onSurfaceVariant
            font.pixelSize: 11
            Layout.alignment: Qt.AlignHCenter
        }
    }
}
