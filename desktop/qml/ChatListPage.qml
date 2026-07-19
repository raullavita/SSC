import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Page {
    id: page

    header: ToolBar {
        RowLayout {
            anchors.fill: parent
            Label {
                text: "Chats"
                font.bold: true
                Layout.leftMargin: 12
            }
            Item { Layout.fillWidth: true }
            ToolButton {
                text: "Refresh"
                onClicked: sscApi.refreshConversations()
            }
            ToolButton {
                text: "Log out"
                onClicked: sscApi.logout()
            }
        }
    }

    SplitView {
        anchors.fill: parent
        orientation: Qt.Horizontal

        ListView {
            SplitView.preferredWidth: 280
            SplitView.minimumWidth: 200
            model: sscApi.conversations
            clip: true
            delegate: ItemDelegate {
                width: ListView.view.width
                text: modelData.peer_id || modelData.id || "Chat"
                highlighted: modelData.id === sscApi.activeConversationId
                onClicked: sscApi.openConversation(modelData.id || modelData._id)
            }
        }

        Page {
            header: ToolBar {
                Label {
                    text: sscApi.activeConversationId || "Select a chat"
                    anchors.centerIn: parent
                    font.bold: true
                }
            }

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 8

                ListView {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    model: sscApi.messages
                    clip: true
                    delegate: ItemDelegate {
                        width: ListView.view.width
                        text: modelData.ciphertext
                              ? ("[enc] " + String(modelData.ciphertext).slice(0, 40) + "…")
                              : (modelData.id || "msg")
                    }
                }

                RowLayout {
                    Layout.fillWidth: true
                    TextField {
                        id: draft
                        Layout.fillWidth: true
                        placeholderText: "Message (libsignal FFI next for real E2EE)"
                        enabled: sscApi.activeConversationId.length > 0
                    }
                    Button {
                        text: "Send"
                        enabled: draft.text.length > 0 && sscApi.activeConversationId.length > 0
                        onClicked: {
                            sscApi.sendMessage(sscApi.activeConversationId, draft.text)
                            draft.text = ""
                        }
                    }
                }

                Label {
                    text: sscApi.lastError
                    color: "#EA4335"
                    visible: sscApi.lastError.length > 0
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
            }
        }
    }

    Component.onCompleted: sscApi.refreshConversations()
}
