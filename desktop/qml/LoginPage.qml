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

    Flickable {
        anchors.fill: parent
        contentHeight: col.implicitHeight + 48
        clip: true
        ColumnLayout {
            id: col
            anchors.horizontalCenter: parent.horizontalCenter
            y: Math.max(24, (parent.height - implicitHeight) / 2)
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
                color: Theme.surfaceVariantFg
                font.pixelSize: 16
                Layout.alignment: Qt.AlignHCenter
                Layout.bottomMargin: 12
            }

            TextField {
                id: displayName
                visible: registerMode
                placeholderText: "Display name"
                Layout.fillWidth: true
                color: Theme.surfaceFg
                placeholderTextColor: Theme.surfaceVariantFg
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
                color: Theme.surfaceFg
                placeholderTextColor: Theme.surfaceVariantFg
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
                color: Theme.surfaceFg
                placeholderTextColor: Theme.surfaceVariantFg
                background: Rectangle {
                    color: Theme.surfaceVariant
                    radius: 8
                    border.color: Theme.outline
                }
            }

            // Turnstile (browser loopback — same check as Android WebView)
            ColumnLayout {
                visible: registerMode && sscApi.captchaRequired
                Layout.fillWidth: true
                spacing: 6
                Label {
                    text: sscTurnstile.token.length > 0
                          ? "Security check complete"
                          : "Security check required"
                    color: sscTurnstile.token.length > 0 ? Theme.primary : Theme.surfaceVariantFg
                    font.pixelSize: 12
                }
                Button {
                    text: sscTurnstile.token.length > 0 ? "Re-run security check" : "Complete security check"
                    Layout.fillWidth: true
                    Material.background: Theme.surfaceVariant
                    Material.foreground: Theme.surfaceFg
                    enabled: sscApi.captchaSiteKey.length > 0
                    onClicked: {
                        sscTurnstile.clearToken()
                        sscTurnstile.begin(sscApi.captchaSiteKey)
                    }
                }
                Label {
                    visible: sscTurnstile.listening && sscTurnstile.token.length === 0
                    text: "Browser opened — complete captcha, then return here."
                    wrapMode: Text.WordWrap
                    color: Theme.secondary
                    font.pixelSize: 11
                    Layout.fillWidth: true
                }
            }

            Label {
                text: sscApi.lastError || sscTurnstile.lastError
                color: Theme.error
                visible: (sscApi.lastError + sscTurnstile.lastError).length > 0
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
                         && (!registerMode || !sscApi.captchaRequired || sscTurnstile.token.length > 0)
                Material.background: Theme.primary
                Material.foreground: Theme.primaryFg
                onClicked: {
                    if (registerMode) {
                        sscApi.registerAccount(email.text, password.text,
                                               displayName.text.length ? displayName.text : email.text.split("@")[0],
                                               sscTurnstile.token)
                    } else {
                        sscApi.login(email.text, password.text)
                    }
                }
            }
            Button {
                text: "Continue with Google"
                Layout.fillWidth: true
                Material.background: Theme.surfaceVariant
                Material.foreground: Theme.surfaceFg
                onClicked: sscApi.openGoogleOAuth()
            }
            Button {
                text: registerMode ? "Have an account? Sign in" : "Need an account? Register"
                Layout.fillWidth: true
                flat: true
                Material.foreground: Theme.secondary
                onClicked: {
                    registerMode = !registerMode
                    sscTurnstile.clearToken()
                }
            }
            Button {
                text: "Account recovery"
                Layout.fillWidth: true
                flat: true
                Material.foreground: Theme.surfaceVariantFg
                onClicked: ApplicationWindow.window.openRecovery()
            }
        }
    }

    Component.onCompleted: sscApi.loadPublicConfig()
}
