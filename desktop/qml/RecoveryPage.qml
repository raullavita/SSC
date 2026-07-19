import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Controls.Material

Page {
    id: page
    background: Rectangle { color: Theme.background }
    property string recoveryToken: ""

    header: ToolBar {
        Material.background: Theme.surface
        RowLayout {
            anchors.fill: parent
            ToolButton {
                text: "←"
                onClicked: ApplicationWindow.window.goBack()
            }
            Label {
                text: "Recovery"
                font.bold: true
                color: Theme.onSurface
            }
        }
    }

    ColumnLayout {
        anchors.centerIn: parent
        width: Math.min(parent.width - 48, 400)
        spacing: 12

        Label {
            text: recoveryToken.length === 0
                  ? "Verify recovery passphrase"
                  : "Set a new password"
            color: Theme.onSurfaceVariant
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
        }

        TextField {
            id: email
            visible: recoveryToken.length === 0
            placeholderText: "Email"
            Layout.fillWidth: true
            color: Theme.onSurface
            background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
        }
        TextField {
            id: pass
            visible: recoveryToken.length === 0
            placeholderText: "Recovery passphrase"
            echoMode: TextInput.Password
            Layout.fillWidth: true
            color: Theme.onSurface
            background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
        }
        TextField {
            id: newPass
            visible: recoveryToken.length > 0
            placeholderText: "New password (min 8)"
            echoMode: TextInput.Password
            Layout.fillWidth: true
            color: Theme.onSurface
            background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
        }

        Button {
            visible: recoveryToken.length === 0 && sscApi.captchaRequired
            text: sscTurnstile.token.length > 0 ? "Captcha OK — re-run?" : "Complete security check"
            Layout.fillWidth: true
            onClicked: sscTurnstile.begin(sscApi.captchaSiteKey)
        }

        Label {
            text: sscApi.lastError
            color: Theme.error
            visible: sscApi.lastError.length > 0
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        Button {
            text: recoveryToken.length === 0 ? "Verify" : "Reset password"
            Layout.fillWidth: true
            Material.background: Theme.primary
            Material.foreground: Theme.onPrimary
            enabled: !sscApi.busy
            onClicked: {
                if (recoveryToken.length === 0) {
                    sscApi.verifyRecovery(email.text, pass.text, sscTurnstile.token)
                } else {
                    sscApi.resetPassword(recoveryToken, newPass.text)
                }
            }
        }
    }

    Connections {
        target: sscApi
        function onRecoveryTokenReady(token) {
            recoveryToken = token
        }
        function onLoginSucceeded() {
            ApplicationWindow.window.openChats()
        }
    }

    Component.onCompleted: sscApi.loadPublicConfig()
}
