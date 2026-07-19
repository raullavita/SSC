import QtQuick
import QtQuick.Controls
import QtQuick.Controls.Material

ApplicationWindow {
    id: root
    width: 1000
    height: 680
    minimumWidth: 720
    minimumHeight: 480
    visible: true
    title: "SSC — Super Secure Chat"
    color: Theme.background

    Material.theme: Material.Dark
    Material.accent: Theme.primary
    Material.primary: Theme.primary
    Material.background: Theme.background
    Material.foreground: Theme.onSurface

    // Exposed for child pages
    property alias stack: stack

    StackView {
        id: stack
        anchors.fill: parent
        initialItem: sscSession.loggedIn ? chatListComponent : loginComponent
    }

    Connections {
        target: sscSession
        function onChanged() {
            if (sscSession.loggedIn) {
                if (!(stack.currentItem && stack.currentItem.objectName === "chatList"))
                    stack.replace(chatListComponent)
            } else {
                stack.replace(loginComponent)
            }
        }
    }

    Connections {
        target: sscApi
        function onLoginSucceeded() {
            stack.replace(chatListComponent)
        }
    }

    Component {
        id: loginComponent
        LoginPage { objectName: "login" }
    }
    Component {
        id: chatListComponent
        ChatListPage { objectName: "chatList" }
    }
    Component {
        id: settingsComponent
        SettingsPage { objectName: "settings" }
    }
}
