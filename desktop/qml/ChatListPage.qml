import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Controls.Material

Page {
    id: page
    background: Rectangle { color: Theme.background }

    header: ToolBar {
        Material.background: Theme.surface
        Material.foreground: Theme.onSurface
        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 12
            anchors.rightMargin: 8
            Label {
                text: "Chats"
                font.bold: true
                font.pixelSize: 18
                color: Theme.onSurface
            }
            Item { Layout.fillWidth: true }
            ToolButton {
                text: "⟳"
                onClicked: sscApi.refreshConversations()
            }
            ToolButton {
                text: "⚙"
                onClicked: stack.push(settingsComponent)
            }
            ToolButton {
                text: "⎋"
                onClicked: sscApi.logout()
            }
        }
    }

    footer: ToolBar {
        Material.background: Theme.surface
        visible: newChatRow.visible
        height: newChatRow.visible ? implicitHeight : 0
    }

    // New chat FAB-like bar
    Rectangle {
        id: newChatRow
        anchors.bottom: parent.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        height: 64
        color: Theme.surface
        visible: false
        RowLayout {
            anchors.fill: parent
            anchors.margins: 8
            TextField {
                id: peerIdField
                Layout.fillWidth: true
                placeholderText: "Peer user id"
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
            }
            Button {
                text: "Open"
                Material.background: Theme.primary
                onClicked: {
                    sscApi.startNewDirect(peerIdField.text)
                    newChatRow.visible = false
                }
            }
            Button {
                text: "Cancel"
                flat: true
                onClicked: newChatRow.visible = false
            }
        }
    }

    RoundButton {
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 20
        width: 56
        height: 56
        text: "+"
        font.pixelSize: 24
        Material.background: Theme.primary
        Material.foreground: Theme.onPrimary
        onClicked: newChatRow.visible = !newChatRow.visible
        z: 10
    }

    SplitView {
        anchors.fill: parent
        anchors.bottomMargin: newChatRow.visible ? 64 : 0
        orientation: Qt.Horizontal

        ListView {
            id: convList
            SplitView.preferredWidth: 300
            SplitView.minimumWidth: 220
            clip: true
            model: sscApi.conversations
            spacing: 0
            delegate: ItemDelegate {
                width: ListView.view.width
                height: 64
                background: Rectangle {
                    color: {
                        const id = modelData.id || modelData._id || ""
                        return id === sscApi.activeConversationId ? Theme.surfaceVariant : Theme.surface
                    }
                }
                contentItem: ColumnLayout {
                    spacing: 2
                    Label {
                        text: modelData.title || modelData.peer_id || modelData.id || "Chat"
                        color: Theme.onSurface
                        font.bold: true
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                    Label {
                        text: modelData.peer_id || modelData.type || ""
                        color: Theme.onSurfaceVariant
                        font.pixelSize: 12
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }
                onClicked: {
                    const id = modelData.id || modelData._id
                    const peer = modelData.peer_id || ""
                    sscApi.openConversation(id, peer)
                }
            }

            Label {
                anchors.centerIn: parent
                visible: convList.count === 0
                text: "No chats yet\nTap + to start"
                horizontalAlignment: Text.AlignHCenter
                color: Theme.onSurfaceVariant
            }
        }

        // Thread pane (Android ChatThreadScreen analogue)
        Page {
            background: Rectangle { color: Theme.background }
            header: ToolBar {
                Material.background: Theme.surface
                Label {
                    anchors.centerIn: parent
                    text: sscApi.activeConversationId ? (sscApi.activePeerId || sscApi.activeConversationId)
                                                      : "Select a chat"
                    color: Theme.onSurface
                    font.bold: true
                }
            }

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 8
                spacing: 8

                ListView {
                    id: msgList
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    model: sscApi.messages
                    spacing: 6
                    verticalLayoutDirection: ListView.BottomToTop

                    delegate: Item {
                        width: ListView.view.width
                        height: bubble.implicitHeight + 4
                        readonly property bool mine: !!(modelData.mine) || modelData.sender_id === sscSession.userId
                        Rectangle {
                            id: bubble
                            anchors.left: mine ? undefined : parent.left
                            anchors.right: mine ? parent.right : undefined
                            anchors.margins: 8
                            width: Math.min(parent.width * 0.75, msgText.implicitWidth + 24)
                            radius: 12
                            color: mine ? Theme.bubbleMine : Theme.bubblePeer
                            implicitHeight: msgText.implicitHeight + 16
                            Text {
                                id: msgText
                                anchors.fill: parent
                                anchors.margins: 10
                                wrapMode: Text.Wrap
                                color: Theme.onSurface
                                text: modelData.plaintext
                                      || (modelData.ciphertext ? "[encrypted]" : "")
                            }
                        }
                    }
                }

                RowLayout {
                    Layout.fillWidth: true
                    TextField {
                        id: draft
                        Layout.fillWidth: true
                        placeholderText: "Message"
                        enabled: sscApi.activeConversationId.length > 0
                        color: Theme.onSurface
                        placeholderTextColor: Theme.onSurfaceVariant
                        background: Rectangle {
                            color: Theme.surfaceVariant
                            radius: 20
                            border.color: Theme.outline
                        }
                        onAccepted: sendBtn.clicked()
                    }
                    Button {
                        id: sendBtn
                        text: "Send"
                        enabled: draft.text.length > 0 && sscApi.activeConversationId.length > 0 && !sscApi.busy
                        Material.background: Theme.primary
                        Material.foreground: Theme.onPrimary
                        onClicked: {
                            sscApi.sendMessage(sscApi.activeConversationId, draft.text)
                            draft.text = ""
                        }
                    }
                }

                Label {
                    text: sscApi.lastError
                    color: Theme.error
                    visible: sscApi.lastError.length > 0
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
                Label {
                    text: sscApi.statusText
                    color: Theme.onSurfaceVariant
                    font.pixelSize: 11
                    Layout.fillWidth: true
                }
            }
        }
    }

    Component.onCompleted: {
        if (sscSession.loggedIn)
            sscApi.refreshConversations()
    }
}
