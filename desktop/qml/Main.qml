import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: root
    width: 960
    height: 640
    visible: true
    title: "SSC — Super Secure Chat"
    color: "#0B141A"

    StackView {
        id: stack
        anchors.fill: parent
        initialItem: sscSession.loggedIn ? chatListComponent : loginComponent
    }

    Connections {
        target: sscSession
        function onChanged() {
            if (sscSession.loggedIn)
                stack.replace(chatListComponent)
            else
                stack.replace(loginComponent)
        }
    }

    Component {
        id: loginComponent
        LoginPage {}
    }
    Component {
        id: chatListComponent
        ChatListPage {}
    }
}
