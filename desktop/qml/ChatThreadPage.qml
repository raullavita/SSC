import QtQuick
import QtQuick.Controls

// Thread UI is embedded in ChatListPage (Android single-activity split).
// Kept for module compatibility / future stack navigation.
Item {
    Label {
        anchors.centerIn: parent
        text: "Use main chat split view"
        color: "#8696A0"
    }
}
