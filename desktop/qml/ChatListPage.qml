import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Controls.Material
import QtQuick.Dialogs

Page {
    id: page
    background: Rectangle { color: Theme.background }
    property string replyToId: ""
    property string replyPreview: ""

    header: ToolBar {
        Material.background: Theme.surface
        Material.foreground: Theme.onSurface
        ColumnLayout {
            anchors.fill: parent
            anchors.leftMargin: 12
            anchors.rightMargin: 8
            spacing: 0
            RowLayout {
                Layout.fillWidth: true
                Label {
                    text: "Chats"
                    font.bold: true
                    font.pixelSize: 18
                    color: Theme.onSurface
                }
                Item { Layout.fillWidth: true }
                ToolButton {
                    text: "⟳"
                    onClicked: {
                        sscApi.refreshConversations()
                        sscApi.refreshStories()
                    }
                }
                ToolButton {
                    text: "⚙"
                    onClicked: ApplicationWindow.window.openSettings()
                }
                ToolButton {
                    text: "⎋"
                    onClicked: {
                        sscApi.logout()
                        ApplicationWindow.window.openLogin()
                    }
                }
            }
            // Connection banner (Android parity)
            Rectangle {
                visible: sscApi.connectionState !== "online"
                Layout.fillWidth: true
                height: 22
                color: sscApi.connectionState === "connecting" ? "#3B4A54" : "#5C2B2B"
                Label {
                    anchors.centerIn: parent
                    text: sscApi.connectionState === "connecting" ? "Connecting…" : "Offline — messages will sync when back"
                    color: Theme.onSurface
                    font.pixelSize: 11
                }
            }
            TextField {
                id: searchField
                Layout.fillWidth: true
                placeholderText: "Search messages"
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 6 }
                onTextChanged: sscApi.searchLocalMessages(text)
            }
        }
    }

    // Stories strip
    Rectangle {
        id: storiesBar
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        height: 48
        color: Theme.surface
        RowLayout {
            anchors.fill: parent
            anchors.margins: 8
            Label {
                text: sscApi.stories.length ? ("Stories: " + sscApi.stories.length) : "Stories"
                color: Theme.primary
                font.pixelSize: 12
            }
            Item { Layout.fillWidth: true }
            Button {
                text: "Add"
                flat: true
                Material.foreground: Theme.primary
                onClicked: storyDialog.open()
            }
        }
    }

    // New chat / group panel
    Rectangle {
        id: newChatRow
        anchors.bottom: parent.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        height: visible ? panelCol.implicitHeight + 16 : 0
        color: Theme.surface
        visible: false
        z: 5
        ColumnLayout {
            id: panelCol
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: parent.top
            anchors.margins: 8
            spacing: 8
            Label {
                text: panelMode.currentIndex === 0 ? "New chat" : "New group"
                color: Theme.primary
                font.bold: true
            }
            TabBar {
                id: panelMode
                Layout.fillWidth: true
                TabButton { text: "Direct" }
                TabButton { text: "Group" }
            }
            TextField {
                id: peerQuery
                visible: panelMode.currentIndex === 0
                Layout.fillWidth: true
                placeholderText: "Username or user id"
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
                onTextChanged: if (text.length >= 2) sscApi.searchUsers(text)
            }
            TextField {
                id: groupName
                visible: panelMode.currentIndex === 1
                Layout.fillWidth: true
                placeholderText: "Group name"
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
            }
            TextField {
                id: groupMembers
                visible: panelMode.currentIndex === 1
                Layout.fillWidth: true
                placeholderText: "Member user ids (comma-separated)"
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
            }
            Repeater {
                model: panelMode.currentIndex === 0 ? sscApi.userSearchResults : []
                delegate: Button {
                    Layout.fillWidth: true
                    text: (modelData.display_name || modelData.username || modelData.id || "") +
                          (modelData.username ? " @" + modelData.username : "")
                    onClicked: {
                        const id = modelData.id || modelData._id || peerQuery.text
                        sscApi.startNewDirect(id)
                        newChatRow.visible = false
                    }
                }
            }
            RowLayout {
                Layout.fillWidth: true
                Button {
                    text: panelMode.currentIndex === 0 ? "Open chat" : "Create group"
                    Material.background: Theme.primary
                    Material.foreground: Theme.onPrimary
                    onClicked: {
                        if (panelMode.currentIndex === 0)
                            sscApi.startNewDirect(peerQuery.text)
                        else
                            sscApi.createGroup(groupName.text, groupMembers.text)
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
    }

    RoundButton {
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.margins: 20
        anchors.bottomMargin: newChatRow.visible ? newChatRow.height + 20 : 20
        width: 56; height: 56
        text: "+"
        font.pixelSize: 24
        Material.background: Theme.primary
        Material.foreground: Theme.onPrimary
        onClicked: newChatRow.visible = !newChatRow.visible
        z: 10
    }

    SplitView {
        anchors.top: storiesBar.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        anchors.bottomMargin: newChatRow.visible ? newChatRow.height : 0
        orientation: Qt.Horizontal

        ListView {
            id: convList
            SplitView.preferredWidth: 300
            SplitView.minimumWidth: 220
            clip: true
            model: searchField.text.length >= 2 ? sscApi.searchHits : sscApi.conversations
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
                        text: searchField.text.length >= 2
                              ? (modelData.snippet || "")
                              : ((modelData.pinned ? "📌 " : "") + (modelData.title || modelData.peer_id || modelData.id || "Chat"))
                        color: Theme.onSurface
                        font.bold: true
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                    Label {
                        text: searchField.text.length >= 2
                              ? (modelData.conversationId || "")
                              : ((modelData.muted ? "🔇 " : "") + (modelData.peer_id || modelData.type || modelData.group_id || ""))
                        color: Theme.onSurfaceVariant
                        font.pixelSize: 12
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }
                onClicked: {
                    if (searchField.text.length >= 2) {
                        sscApi.openConversation(modelData.conversationId || "", "", "")
                        searchField.text = ""
                    } else {
                        const id = modelData.id || modelData._id
                        sscApi.openConversation(id, modelData.peer_id || "", modelData.group_id || "")
                    }
                    replyToId = ""
                    replyPreview = ""
                }
                onPressAndHold: convMenu.open()
                Menu {
                    id: convMenu
                    MenuItem {
                        text: modelData.pinned ? "Unpin" : "Pin"
                        onTriggered: sscApi.setPinned(modelData.id || modelData._id, !modelData.pinned)
                    }
                    MenuItem {
                        text: modelData.muted ? "Unmute" : "Mute"
                        onTriggered: sscApi.setMuted(modelData.id || modelData._id, !modelData.muted)
                    }
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

        // Thread pane
        Page {
            background: Rectangle { color: Theme.background }
            header: ToolBar {
                Material.background: Theme.surface
                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 4
                    Label {
                        text: sscApi.activeConversationId
                              ? (sscApi.activePeerId || sscApi.activeGroupId || sscApi.activeConversationId)
                              : "Select a chat"
                        color: Theme.onSurface
                        font.bold: true
                        Layout.fillWidth: true
                        elide: Text.ElideRight
                    }
                    Label {
                        text: sscApi.typingLabel
                        color: Theme.secondary
                        font.pixelSize: 11
                        visible: sscApi.typingLabel.length > 0
                    }
                    ToolButton {
                        text: "📞"
                        ToolTip.visible: hovered
                        ToolTip.text: "Audio call"
                        visible: sscApi.activeConversationId.length > 0 && sscApi.activePeerId.length > 0
                        onClicked: sscCalls.startOutgoing(sscApi.activeConversationId, sscApi.activePeerId, false)
                    }
                    ToolButton {
                        text: "📹"
                        ToolTip.visible: hovered
                        ToolTip.text: "Video call"
                        visible: sscApi.activeConversationId.length > 0 && sscApi.activePeerId.length > 0
                        onClicked: sscCalls.startOutgoing(sscApi.activeConversationId, sscApi.activePeerId, true)
                    }
                    Label {
                        text: sscCalls.callState + (sscCalls.videoEnabled ? " · video" : "")
                        color: Theme.secondary
                        font.pixelSize: 11
                        visible: sscCalls.inCall
                    }
                    ToolButton {
                        text: "Hangup"
                        visible: sscCalls.inCall
                        Material.foreground: Theme.error
                        onClicked: sscCalls.hangup()
                    }
                    ToolButton {
                        text: "👥"
                        visible: sscApi.activeGroupId.length > 0
                        onClicked: membersDialog.open()
                    }
                    ToolButton {
                        text: "📊"
                        visible: sscApi.activeConversationId.length > 0
                        onClicked: pollDialog.open()
                    }
                    ToolButton {
                        text: "🔐"
                        visible: sscApi.activePeerId.length > 0
                        onClicked: {
                            sscApi.computeSafetyNumber(sscApi.activePeerId)
                            safetyDialog.open()
                        }
                    }
                    ToolButton {
                        text: "SFU"
                        visible: sscApi.activeGroupId.length > 0 || sscApi.activeConversationId.length > 0
                        onClicked: sscApi.startSfuGroupCall(sscApi.activeConversationId, 6)
                    }
                }
            }

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 8
                spacing: 6

                ListView {
                    id: msgList
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    model: sscApi.messages
                    spacing: 6
                    delegate: Item {
                        width: ListView.view.width
                        height: bubbleCol.implicitHeight + 4
                        readonly property bool mine: !!(modelData.mine) || modelData.sender_id === sscSession.userId
                        readonly property string mid: modelData.id || ""
                        ColumnLayout {
                            id: bubbleCol
                            anchors.left: mine ? undefined : parent.left
                            anchors.right: mine ? parent.right : undefined
                            anchors.margins: 8
                            width: Math.min(parent.width * 0.78, Math.max(120, msgText.implicitWidth + 28))
                            Rectangle {
                                Layout.fillWidth: true
                                radius: 12
                                color: mine ? Theme.bubbleMine : Theme.bubblePeer
                                implicitHeight: msgText.implicitHeight + (rxLabel.visible ? 28 : 16)
                                Column {
                                    anchors.fill: parent
                                    anchors.margins: 10
                                    spacing: 4
                                    Text {
                                        id: msgText
                                        width: parent.width
                                        wrapMode: Text.Wrap
                                        color: Theme.onSurface
                                        text: modelData.plaintext || (modelData.ciphertext ? "[encrypted]" : "")
                                    }
                                    Label {
                                        id: rxLabel
                                        visible: (sscApi.reactionSummary[mid] || 0) > 0
                                        text: "❤ " + (sscApi.reactionSummary[mid] || "")
                                        color: Theme.secondary
                                        font.pixelSize: 11
                                    }
                                }
                            }
                            Row {
                                spacing: 4
                                visible: mid.length > 0 && !String(mid).startsWith("local-")
                                Button {
                                    text: "Reply"
                                    flat: true
                                    font.pixelSize: 10
                                    onClicked: {
                                        replyToId = mid
                                        replyPreview = (modelData.plaintext || "").slice(0, 40)
                                    }
                                }
                                Button {
                                    text: "❤"
                                    flat: true
                                    font.pixelSize: 10
                                    onClicked: sscApi.addReaction(mid, "❤️")
                                }
                                Button {
                                    text: "Del"
                                    flat: true
                                    font.pixelSize: 10
                                    Material.foreground: Theme.error
                                    onClicked: sscApi.deleteMessage(mid, "me")
                                }
                                Button {
                                    text: "Del all"
                                    flat: true
                                    font.pixelSize: 10
                                    visible: mine
                                    Material.foreground: Theme.error
                                    onClicked: sscApi.deleteMessage(mid, "everyone")
                                }
                                Button {
                                    text: "Edit"
                                    flat: true
                                    font.pixelSize: 10
                                    visible: mine
                                    onClicked: {
                                        editDialog.messageId = mid
                                        editDialog.draft = modelData.plaintext || ""
                                        editDialog.open()
                                    }
                                }
                                Button {
                                    text: "Open file"
                                    flat: true
                                    font.pixelSize: 10
                                    visible: {
                                        const t = modelData.plaintext || ""
                                        return t.indexOf("[file]") === 0 || t.indexOf("[voice:") === 0
                                    }
                                    onClicked: {
                                        const t = modelData.plaintext || ""
                                        let id = ""
                                        const voice = t.match(/\[voice:([^\]]+)\]/)
                                        if (voice) id = voice[1]
                                        else {
                                            const m = t.match(/id=([^\s]+)/)
                                            if (m) id = m[1]
                                        }
                                        if (id) sscApi.downloadAndOpenFile(id)
                                    }
                                }
                            }
                        }
                    }
                    onCountChanged: if (count > 0) positionViewAtEnd()
                }

                Label {
                    visible: replyToId.length > 0
                    text: "Replying: " + replyPreview
                    color: Theme.secondary
                    font.pixelSize: 11
                    Layout.fillWidth: true
                }

                RowLayout {
                    Layout.fillWidth: true
                    Button {
                        text: "📎"
                        enabled: sscApi.activeConversationId.length > 0
                        flat: true
                        onClicked: fileDialog.open()
                    }
                    Button {
                        text: sscVoice.recording ? "⏹" : "🎤"
                        enabled: sscApi.activeConversationId.length > 0 && !sscApi.busy
                        flat: true
                        Material.foreground: sscVoice.recording ? Theme.error : Theme.onSurface
                        onClicked: {
                            if (sscVoice.recording) {
                                const path = sscVoice.stop()
                                if (path && path.length)
                                    sscApi.sendVoiceNote(sscApi.activeConversationId, path)
                            } else {
                                if (!sscVoice.start())
                                    console.log("voice start failed")
                            }
                        }
                    }
                    TextField {
                        id: draft
                        Layout.fillWidth: true
                        placeholderText: sscVoice.recording ? "Recording voice note…" : "Message"
                        enabled: sscApi.activeConversationId.length > 0 && !sscVoice.recording
                        color: Theme.onSurface
                        placeholderTextColor: Theme.onSurfaceVariant
                        background: Rectangle {
                            color: Theme.surfaceVariant
                            radius: 20
                            border.color: sscVoice.recording ? Theme.error : Theme.outline
                        }
                        onTextChanged: {
                            if (sscApi.activeConversationId.length)
                                sscApi.sendTyping(sscApi.activeConversationId, text.length > 0)
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
                            sscApi.sendMessage(sscApi.activeConversationId, draft.text, replyToId)
                            draft.text = ""
                            replyToId = ""
                            replyPreview = ""
                        }
                    }
                }

                FileDialog {
                    id: fileDialog
                    title: "Send file"
                    fileMode: FileDialog.OpenFile
                    onAccepted: {
                        const p = selectedFile.toString().replace("file:///", "").replace("file://", "")
                        sscApi.sendFile(sscApi.activeConversationId, p)
                    }
                }

                Label {
                    text: sscApi.lastError
                    color: Theme.error
                    visible: sscApi.lastError.length > 0
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }
            }
        }
    }

    Dialog {
        id: storyDialog
        title: "New story"
        modal: true
        standardButtons: Dialog.Ok | Dialog.Cancel
        TextField {
            id: storyText
            width: 320
            placeholderText: "Story text"
        }
        onAccepted: {
            sscApi.createStory(storyText.text)
            storyText.text = ""
        }
    }

    Dialog {
        id: editDialog
        property string messageId: ""
        property alias draft: editField.text
        title: "Edit message"
        modal: true
        standardButtons: Dialog.Ok | Dialog.Cancel
        TextField {
            id: editField
            width: 320
            placeholderText: "New text"
        }
        onAccepted: {
            if (messageId.length) sscApi.editMessage(messageId, editField.text)
        }
    }

    Dialog {
        id: safetyDialog
        title: "Safety number"
        modal: true
        standardButtons: Dialog.Ok
        Label {
            width: 360
            wrapMode: Text.Wrap
            text: sscApi.safetyNumber.length
                  ? sscApi.safetyNumber
                  : "Computing… compare this number with your contact out-of-band."
            color: Theme.onSurface
        }
    }

    Connections {
        target: sscApi
        function onSfuRoomReady(roomId, wsUrl, joinToken) {
            sfuDialog.roomId = roomId
            sfuDialog.wsUrl = wsUrl
            sfuDialog.joinToken = joinToken || ""
            sfuInfo.text = "Room " + roomId + "\nWS: " + wsUrl
                           + "\n" + (sscCalls.sfuState || "joining…")
            sfuDialog.open()
            // Auto-join mediasoup (Android CallCoordinator parity)
            if (roomId.length && wsUrl.length)
                sscCalls.joinSfuRoom(wsUrl, roomId, joinToken || "")
        }
    }
    Connections {
        target: sscCalls
        function onSfuJoined(roomId, existingProducers) {
            sfuInfo.text = "Joined " + roomId
                           + "\nKnown producers: " + existingProducers
                           + "\n" + (sscCalls.sfuState || "")
                           + "\n(audio produce + consume active)"
        }
    }
    Dialog {
        id: sfuDialog
        property string roomId: ""
        property string wsUrl: ""
        property string joinToken: ""
        title: "SFU group call"
        modal: true
        standardButtons: Dialog.Close
        Label {
            id: sfuInfo
            width: 400
            wrapMode: Text.WrapAnywhere
            color: Theme.onSurface
        }
        footer: DialogButtonBox {
            Button {
                text: "Join"
                DialogButtonBox.buttonRole: DialogButtonBox.AcceptRole
                enabled: sfuDialog.roomId.length > 0 && sfuDialog.wsUrl.length > 0
                onClicked: sscCalls.joinSfuRoom(sfuDialog.wsUrl, sfuDialog.roomId, sfuDialog.joinToken)
            }
            Button {
                text: "Leave SFU"
                DialogButtonBox.buttonRole: DialogButtonBox.ActionRole
                onClicked: sscCalls.leaveSfuRoom()
            }
            Button {
                text: "End room"
                DialogButtonBox.buttonRole: DialogButtonBox.DestructiveRole
                onClicked: {
                    sscCalls.leaveSfuRoom()
                    sscApi.endSfuRoom()
                    sfuDialog.close()
                }
            }
            Button {
                text: "Close"
                DialogButtonBox.buttonRole: DialogButtonBox.RejectRole
                onClicked: sfuDialog.close()
            }
        }
    }

    Dialog {
        id: pollDialog
        title: "Create poll"
        modal: true
        standardButtons: Dialog.Ok | Dialog.Cancel
        ColumnLayout {
            width: 320
            TextField { id: pollQ; placeholderText: "Question"; Layout.fillWidth: true }
            TextField { id: pollOpts; placeholderText: "Options (comma or | separated)"; Layout.fillWidth: true }
        }
        onAccepted: sscApi.createPoll(sscApi.activeConversationId, pollQ.text, pollOpts.text)
    }

    Dialog {
        id: membersDialog
        title: "Group members"
        modal: true
        standardButtons: Dialog.Close
        width: 360
        ColumnLayout {
            width: parent ? parent.width - 20 : 340
            Repeater {
                model: sscApi.groupMembers
                delegate: RowLayout {
                    Layout.fillWidth: true
                    Label {
                        text: (modelData.display_name || modelData.username || modelData.id || "")
                        color: Theme.onSurface
                        Layout.fillWidth: true
                    }
                    Button {
                        text: "Remove"
                        flat: true
                        onClicked: sscApi.removeGroupMember(sscApi.activeGroupId, modelData.id || modelData._id)
                    }
                }
            }
            TextField {
                id: addMem
                placeholderText: "Add member user id"
                Layout.fillWidth: true
            }
            Button {
                text: "Add members"
                onClicked: sscApi.addGroupMembers(sscApi.activeGroupId, addMem.text)
            }
            Button {
                text: "Leave group"
                Material.foreground: Theme.error
                onClicked: { sscApi.leaveGroup(sscApi.activeGroupId); membersDialog.close() }
            }
            Button {
                text: "Dissolve group"
                Material.background: Theme.error
                Material.foreground: "#fff"
                onClicked: { sscApi.dissolveGroup(sscApi.activeGroupId); membersDialog.close() }
            }
        }
        onOpened: sscApi.refreshGroupMembers(sscApi.activeGroupId)
    }

    Connections {
        target: sscApi
        function onIncomingCall(callId, fromUserId, video) {
            callDialog.callId = callId
            callDialog.fromUserId = fromUserId
            callDialog.video = video
            callDialog.text = "Incoming " + (video ? "video" : "audio") + " call from " + fromUserId
            callDialog.open()
        }
    }
    Connections {
        target: sscCalls
        function onCallError(detail) {
            // surface via API status
            console.log("call error", detail)
        }
    }

    Dialog {
        id: callDialog
        property string callId: ""
        property string fromUserId: ""
        property bool video: false
        property string text: ""
        title: "Call"
        modal: true
        standardButtons: Dialog.Yes | Dialog.No
        Label { text: callDialog.text; wrapMode: Text.WordWrap; width: 300 }
        onRejected: {
            if (callId) sscApi.endCall(callId, "declined")
        }
        onAccepted: {
            sscCalls.acceptIncoming(callId, fromUserId, video)
        }
    }

    Component.onCompleted: {
        if (sscSession.loggedIn) {
            sscApi.refreshConversations()
            sscApi.refreshStories()
        }
    }
}
