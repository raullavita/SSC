import QtQuick
import QtQuick.Controls

// Placeholder for 1:1 / group thread UI + libsignal FFI.
Page {
    property string conversationId
    property string titleText: "Chat"

    header: ToolBar {
        Label {
            text: titleText
            anchors.centerIn: parent
            font.bold: true
        }
    }

    Label {
        anchors.centerIn: parent
        text: "Thread UI + libsignal next"
        color: "#8696A0"
    }
}
