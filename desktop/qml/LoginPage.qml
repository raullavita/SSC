import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Controls.Material

Item {
    id: root
    property bool registerMode: false

    Rectangle {
        anchors.fill: parent
        color: Theme.background
    }

    ColumnLayout {
        anchors.centerIn: parent
        width: Math.min(parent.width - 48, 400)
        spacing: 12

        Label {
            text: "SSC"
            font.pixelSize: 40
            font.bold: true
            color: Theme.primary
            Layout.alignment: Qt.AlignHCenter
        }
        Label {
            text: registerMode ? "Create account" : "Sign in"
            color: Theme.onSurfaceVariant
            font.pixelSize: 16
            Layout.alignment: Qt.AlignHCenter
            Layout.bottomMargin: 12
        }

        TextField {
            id: displayName
            visible: registerMode
            placeholderText: "Display name"
            Layout.fillWidth: true
            color: Theme.onSurface
            placeholderTextColor: Theme.onSurfaceVariant
            background: Rectangle {
                color: Theme.surfaceVariant
                radius: 8
                border.color: Theme.outline
            }
        }
        TextField {
            id: email
            placeholderText: "Email"
            Layout.fillWidth: true
            inputMethodHints: Qt.ImhEmailCharactersOnly
            color: Theme.onSurface
            placeholderTextColor: Theme.onSurfaceVariant
            background: Rectangle {
                color: Theme.surfaceVariant
                radius: 8
                border.color: Theme.outline
            }
        }
        TextField {
            id: password
            placeholderText: "Password (min 8)"
            echoMode: TextInput.Password
            Layout.fillWidth: true
            color: Theme.onSurface
            placeholderTextColor: Theme.onSurfaceVariant
            background: Rectangle {
                color: Theme.surfaceVariant
                radius: 8
                border.color: Theme.outline
            }
        }
        TextField {
            id: captchaToken
            visible: registerMode && sscApi.captchaRequired
            placeholderText: sscApi.captchaSiteKey
                             ? "Turnstile token (complete captcha in browser if needed)"
                             : "Captcha token"
            Layout.fillWidth: true
            color: Theme.onSurface
            placeholderTextColor: Theme.onSurfaceVariant
            background: Rectangle {
                color: Theme.surfaceVariant
                radius: 8
                border.color: Theme.outline
            }
        }
        Label {
            visible: registerMode && sscApi.captchaRequired
            text: "Production requires Cloudflare Turnstile. Open sitekey page or paste token from test harness."
            wrapMode: Text.WordWrap
            color: Theme.onSurfaceVariant
            font.pixelSize: 11
            Layout.fillWidth: true
        }

        Label {
            text: sscApi.lastError
            color: Theme.error
            visible: sscApi.lastError.length > 0
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }

        BusyIndicator {
            visible: sscApi.busy
            Layout.alignment: Qt.AlignHCenter
            running: sscApi.busy
        }

        Button {
            text: registerMode ? "Register" : "Sign in"
            Layout.fillWidth: true
            enabled: !sscApi.busy && email.text.length > 0 && password.text.length >= 8
                     && (!registerMode || !sscApi.captchaRequired || captchaToken.text.length > 0)
            Material.background: Theme.primary
            Material.foreground: Theme.onPrimary
            onClicked: {
                if (registerMode) {
                    sscApi.registerAccount(email.text, password.text,
                                           displayName.text.length ? displayName.text : email.text.split("@")[0],
                                           captchaToken.text)
                } else {
                    sscApi.login(email.text, password.text)
                }
            }
        }
        Button {
            text: registerMode ? "Have an account? Sign in" : "Need an account? Register"
            Layout.fillWidth: true
            flat: true
            Material.foreground: Theme.secondary
            onClicked: {
                registerMode = !registerMode
                sscApi.lastError // keep
            }
        }
    }

    Component.onCompleted: sscApi.loadPublicConfig()
}
