import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Controls.Material
import QtQuick.Dialogs

// Telegram / WhatsApp-style layout:
// left: chat list + search + FAB new chat
// right: header (name + actions) / messages / composer (only when a chat is open)

Page {
    id: page
    background: Rectangle { color: Theme.background }
    property string replyToId: ""
    property string replyPreview: ""
    property bool chatOpen: sscApi.activeConversationId.length > 0

    function convTitle(c) {
        if (!c) return "Chat"
        const t = c.title || c.peer_username || ""
        if (t && t !== "…" && !String(t).startsWith("u_")) return t
        if (c.group_id) return c.name || "Group"
        return c.peer_id ? ("Contact") : "Chat"
    }

    function convSubtitle(c) {
        if (!c) return ""
        if (c.muted) return "Muted"
        if (c.type === "group" || c.group_id) return "Group"
        return "Tap to open"
    }

    // —— Top app bar (list side context) ——
    header: ToolBar {
        Material.background: Theme.surface
        Material.foreground: Theme.surfaceFg
        height: 56
        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 16
            anchors.rightMargin: 8
            Label {
                text: "Chats"
                font.bold: true
                font.pixelSize: 20
                color: Theme.surfaceFg
            }
            Item { Layout.fillWidth: true }
            ToolButton {
                text: "↻"
                font.pixelSize: 18
                ToolTip.text: "Refresh"
                ToolTip.visible: hovered
                onClicked: {
                    sscApi.refreshConversations()
                    sscApi.refreshStories()
                }
            }
            ToolButton {
                text: "⚙"
                font.pixelSize: 18
                ToolTip.text: "Settings"
                ToolTip.visible: hovered
                onClicked: ApplicationWindow.window.openSettings()
            }
            ToolButton {
                text: "⎋"
                font.pixelSize: 16
                ToolTip.text: "Sign out"
                ToolTip.visible: hovered
                onClicked: {
                    sscApi.logout()
                    ApplicationWindow.window.openLogin()
                }
            }
        }
    }

    // Offline banner
    Rectangle {
        id: offlineBar
        anchors.top: parent.top
        anchors.left: parent.left
        anchors.right: parent.right
        height: sscApi.connectionState !== "online" ? 26 : 0
        visible: height > 0
        color: sscApi.connectionState === "connecting" ? "#3B4A54" : "#6B2B2B"
        z: 20
        Label {
            anchors.centerIn: parent
            text: sscApi.connectionState === "connecting" ? "Connecting…" : "Offline — will sync when back"
            color: Theme.surfaceFg
            font.pixelSize: 12
        }
    }

    SplitView {
        anchors.top: offlineBar.bottom
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        orientation: Qt.Horizontal

        // ========== LEFT: conversation list ==========
        Rectangle {
            id: listPane
            SplitView.preferredWidth: 340
            SplitView.minimumWidth: 260
            color: Theme.surface

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                // Search (Telegram-style pill)
                Item {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 52
                    TextField {
                        id: searchField
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.margins: 10
                        height: 36
                        placeholderText: "Search chats & messages"
                        color: Theme.surfaceFg
                        placeholderTextColor: Theme.surfaceVariantFg
                        leftPadding: 14
                        background: Rectangle {
                            radius: 18
                            color: Theme.surfaceVariant
                            border.color: searchField.activeFocus ? Theme.primary : "transparent"
                            border.width: 1
                        }
                        onTextChanged: {
                            if (text.length >= 2) sscApi.searchLocalMessages(text)
                        }
                    }
                }

                Rectangle { Layout.fillWidth: true; height: 1; color: Theme.outline }

                ListView {
                    id: convList
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    model: searchField.text.length >= 2 ? sscApi.searchHits : sscApi.conversations
                    spacing: 0
                    delegate: ItemDelegate {
                        width: ListView.view.width
                        height: 72
                        padding: 0
                        background: Rectangle {
                            color: {
                                const id = modelData.id || modelData._id || modelData.conversationId || ""
                                if (id === sscApi.activeConversationId) return Theme.surfaceVariant
                                return hovered ? "#162229" : Theme.surface
                            }
                        }
                        contentItem: RowLayout {
                            anchors.fill: parent
                            anchors.leftMargin: 12
                            anchors.rightMargin: 12
                            spacing: 12
                            // Avatar circle
                            Rectangle {
                                width: 48; height: 48; radius: 24
                                color: Theme.primary
                                Layout.alignment: Qt.AlignVCenter
                                Label {
                                    anchors.centerIn: parent
                                    text: {
                                        const t = page.convTitle(modelData)
                                        return t.length ? t.charAt(0).toUpperCase() : "?"
                                    }
                                    color: Theme.primaryFg
                                    font.bold: true
                                    font.pixelSize: 18
                                }
                            }
                            ColumnLayout {
                                Layout.fillWidth: true
                                spacing: 2
                                Label {
                                    text: searchField.text.length >= 2
                                          ? (modelData.snippet || "Message match")
                                          : ((modelData.pinned ? "📌 " : "") + page.convTitle(modelData))
                                    color: Theme.surfaceFg
                                    font.bold: true
                                    font.pixelSize: 15
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
                                Label {
                                    text: searchField.text.length >= 2
                                          ? "Open conversation"
                                          : page.convSubtitle(modelData)
                                    color: Theme.surfaceVariantFg
                                    font.pixelSize: 13
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }
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
                    }

                    Label {
                        anchors.centerIn: parent
                        visible: convList.count === 0
                        horizontalAlignment: Text.AlignHCenter
                        text: searchField.text.length ? "No results" : "No chats yet\n\nTap ＋ to message someone"
                        color: Theme.surfaceVariantFg
                        font.pixelSize: 14
                    }
                }
            }

            // FAB new chat (bottom-right of list — Telegram style)
            RoundButton {
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                anchors.margins: 16
                width: 56; height: 56
                text: "＋"
                font.pixelSize: 26
                Material.background: Theme.primary
                Material.foreground: Theme.primaryFg
                ToolTip.text: "New chat"
                ToolTip.visible: hovered
                onClicked: newChatDialog.open()
            }
        }

        // ========== RIGHT: thread ==========
        Rectangle {
            color: Theme.background
            SplitView.fillWidth: true

            // Empty state when no chat selected
            Column {
                anchors.centerIn: parent
                spacing: 12
                visible: !page.chatOpen
                width: parent.width * 0.6
                Label {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "SSC"
                    font.pixelSize: 42
                    font.bold: true
                    color: Theme.primary
                }
                Label {
                    width: parent.width
                    horizontalAlignment: Text.AlignHCenter
                    wrapMode: Text.Wrap
                    text: "Select a chat on the left\nor start a new one with ＋"
                    color: Theme.surfaceVariantFg
                    font.pixelSize: 15
                }
            }

            ColumnLayout {
                anchors.fill: parent
                spacing: 0
                visible: page.chatOpen

                // Thread header (WhatsApp/Telegram)
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 56
                    color: Theme.surface
                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 12
                        anchors.rightMargin: 4
                        spacing: 8
                        Rectangle {
                            width: 40; height: 40; radius: 20
                            color: Theme.primary
                            Label {
                                anchors.centerIn: parent
                                text: {
                                    const t = sscApi.activeChatTitle || "?"
                                    return t.charAt(0).toUpperCase()
                                }
                                color: Theme.primaryFg
                                font.bold: true
                            }
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 0
                            Label {
                                text: sscApi.activeChatTitle.length ? sscApi.activeChatTitle : "Chat"
                                color: Theme.surfaceFg
                                font.bold: true
                                font.pixelSize: 15
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                            Label {
                                text: sscApi.typingLabel.length ? sscApi.typingLabel
                                      : (sscCalls.inCall ? ("In call · " + sscCalls.callState) : "online")
                                color: Theme.secondary
                                font.pixelSize: 12
                                visible: true
                            }
                        }
                        // Compact action cluster — text labels, no random emoji soup
                        ToolButton {
                            text: "Call"
                            visible: sscApi.activePeerId.length > 0
                            onClicked: sscCalls.startOutgoing(sscApi.activeConversationId, sscApi.activePeerId, false)
                        }
                        ToolButton {
                            text: "Video"
                            visible: sscApi.activePeerId.length > 0
                            onClicked: sscCalls.startOutgoing(sscApi.activeConversationId, sscApi.activePeerId, true)
                        }
                        ToolButton {
                            text: "End"
                            visible: sscCalls.inCall
                            Material.foreground: Theme.error
                            onClicked: sscCalls.hangup()
                        }
                        ToolButton {
                            text: "⋮"
                            font.pixelSize: 20
                            onClicked: threadMenu.open()
                            Menu {
                                id: threadMenu
                                MenuItem {
                                    text: "Safety number"
                                    visible: sscApi.activePeerId.length > 0
                                    onTriggered: {
                                        sscApi.computeSafetyNumber(sscApi.activePeerId)
                                        safetyDialog.open()
                                    }
                                }
                                MenuItem {
                                    text: "Group members"
                                    visible: sscApi.activeGroupId.length > 0
                                    onTriggered: membersDialog.open()
                                }
                                MenuItem {
                                    text: "Create poll"
                                    onTriggered: pollDialog.open()
                                }
                                MenuItem {
                                    text: "Group call (SFU)"
                                    visible: sscApi.activeGroupId.length > 0
                                    onTriggered: sscApi.startSfuGroupCall(sscApi.activeConversationId, 6)
                                }
                            }
                        }
                    }
                    Rectangle {
                        anchors.bottom: parent.bottom
                        width: parent.width; height: 1
                        color: Theme.outline
                    }
                }

                // Messages
                ListView {
                    id: msgList
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    clip: true
                    model: sscApi.messages
                    spacing: 4
                    topMargin: 12
                    bottomMargin: 12
                    delegate: Item {
                        width: ListView.view.width
                        height: bubble.implicitHeight + 8
                        readonly property bool mine: !!(modelData.mine) || modelData.sender_id === sscSession.userId
                        readonly property string mid: modelData.id || ""
                        readonly property string body: modelData.plaintext || (modelData.ciphertext ? "Encrypted message" : "")

                        Rectangle {
                            id: bubble
                            anchors.left: mine ? undefined : parent.left
                            anchors.right: mine ? parent.right : undefined
                            anchors.leftMargin: 12
                            anchors.rightMargin: 12
                            width: Math.min(parent.width * 0.72, Math.max(80, msgLabel.implicitWidth + 28))
                            radius: 10
                            color: mine ? Theme.bubbleMine : Theme.bubblePeer
                            implicitHeight: msgCol.implicitHeight + 16

                            Column {
                                id: msgCol
                                anchors.left: parent.left
                                anchors.right: parent.right
                                anchors.top: parent.top
                                anchors.margins: 10
                                spacing: 4
                                Text {
                                    id: msgLabel
                                    width: parent.width
                                    wrapMode: Text.Wrap
                                    color: Theme.surfaceFg
                                    font.pixelSize: 14
                                    text: body
                                }
                                Row {
                                    spacing: 8
                                    visible: mid.length > 0 && !String(mid).startsWith("local-")
                                    Text {
                                        text: "Reply"
                                        color: Theme.secondary
                                        font.pixelSize: 11
                                        font.underline: true
                                        MouseArea {
                                            anchors.fill: parent
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: {
                                                replyToId = mid
                                                replyPreview = body.slice(0, 40)
                                            }
                                        }
                                    }
                                    Text {
                                        text: "❤"
                                        color: Theme.secondary
                                        font.pixelSize: 11
                                        MouseArea {
                                            anchors.fill: parent
                                            onClicked: sscApi.addReaction(mid, "❤️")
                                        }
                                    }
                                    Text {
                                        text: "Open"
                                        color: Theme.secondary
                                        font.pixelSize: 11
                                        font.underline: true
                                        visible: body.indexOf("[file]") === 0 || body.indexOf("[voice:") === 0
                                        MouseArea {
                                            anchors.fill: parent
                                            onClicked: {
                                                let id = ""
                                                const voice = body.match(/\[voice:([^\]]+)\]/)
                                                if (voice) id = voice[1]
                                                else {
                                                    const m = body.match(/id=([^\s]+)/)
                                                    if (m) id = m[1]
                                                }
                                                if (id) sscApi.downloadAndOpenFile(id)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    onCountChanged: if (count > 0) Qt.callLater(function() { positionViewAtEnd() })
                }

                // Reply strip
                Rectangle {
                    Layout.fillWidth: true
                    height: replyToId.length ? 36 : 0
                    visible: height > 0
                    color: Theme.surfaceVariant
                    RowLayout {
                        anchors.fill: parent
                        anchors.margins: 8
                        Label {
                            text: "Replying: " + replyPreview
                            color: Theme.surfaceVariantFg
                            font.pixelSize: 12
                            Layout.fillWidth: true
                            elide: Text.ElideRight
                        }
                        ToolButton {
                            text: "✕"
                            onClicked: { replyToId = ""; replyPreview = "" }
                        }
                    }
                }

                // Composer (only when chat open — WhatsApp bar)
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 60
                    color: Theme.surface
                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 8
                        anchors.rightMargin: 8
                        anchors.topMargin: 8
                        anchors.bottomMargin: 8
                        spacing: 6

                        ToolButton {
                            text: "📎"
                            font.pixelSize: 18
                            ToolTip.text: "Attach file"
                            ToolTip.visible: hovered
                            onClicked: fileDialog.open()
                        }
                        ToolButton {
                            text: sscVoice.recording ? "⏹" : "🎤"
                            font.pixelSize: 18
                            Material.foreground: sscVoice.recording ? Theme.error : Theme.surfaceFg
                            ToolTip.text: sscVoice.recording ? "Stop & send voice" : "Voice note"
                            ToolTip.visible: hovered
                            onClicked: {
                                if (sscVoice.recording) {
                                    const path = sscVoice.stop()
                                    if (path && path.length)
                                        sscApi.sendVoiceNote(sscApi.activeConversationId, path)
                                } else {
                                    sscVoice.start()
                                }
                            }
                        }
                        TextField {
                            id: draft
                            Layout.fillWidth: true
                            Layout.preferredHeight: 40
                            placeholderText: sscVoice.recording ? "Recording…" : "Type a message"
                            enabled: !sscVoice.recording
                            color: Theme.surfaceFg
                            placeholderTextColor: Theme.surfaceVariantFg
                            leftPadding: 16
                            rightPadding: 16
                            background: Rectangle {
                                radius: 20
                                color: Theme.surfaceVariant
                                border.color: draft.activeFocus ? Theme.primary : Theme.outline
                                border.width: 1
                            }
                            onTextChanged: {
                                if (sscApi.activeConversationId.length)
                                    sscApi.sendTyping(sscApi.activeConversationId, text.length > 0)
                            }
                            onAccepted: sendBtn.clicked()
                        }
                        RoundButton {
                            id: sendBtn
                            width: 44; height: 44
                            text: "➤"
                            font.pixelSize: 16
                            enabled: draft.text.trim().length > 0 && !sscApi.busy
                            Material.background: enabled ? Theme.primary : Theme.surfaceVariant
                            Material.foreground: enabled ? Theme.primaryFg : Theme.surfaceVariantFg
                            onClicked: {
                                const t = draft.text.trim()
                                if (!t.length) return
                                sscApi.sendMessage(sscApi.activeConversationId, t, replyToId)
                                draft.text = ""
                                replyToId = ""
                                replyPreview = ""
                            }
                        }
                    }
                }

                Label {
                    Layout.fillWidth: true
                    Layout.leftMargin: 12
                    Layout.rightMargin: 12
                    Layout.bottomMargin: 4
                    text: sscApi.lastError
                    color: Theme.error
                    visible: sscApi.lastError.length > 0
                    wrapMode: Text.Wrap
                    font.pixelSize: 11
                }
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

    // —— New chat dialog (not a floating panel under + overlapping send) ——
    Dialog {
        id: newChatDialog
        title: "New chat"
        modal: true
        anchors.centerIn: parent
        width: 400
        standardButtons: Dialog.Close
        onOpened: {
            sscApi.refreshConversations()
            sscApi.refreshFriendRequests()
            peerQuery.forceActiveFocus()
        }
        ColumnLayout {
            width: parent ? parent.width - 24 : 360
            spacing: 10
            Label {
                text: "Type the exact username (privacy: no public directory)."
                color: Theme.surfaceVariantFg
                wrapMode: Text.Wrap
                Layout.fillWidth: true
                font.pixelSize: 12
            }
            TextField {
                id: peerQuery
                Layout.fillWidth: true
                placeholderText: "e.g. dots or @dots"
                color: Theme.surfaceFg
                onTextChanged: if (text.length >= 2) sscApi.searchUsers(text)
                onAccepted: lookupChatBtn.clicked()
            }
            Button {
                id: lookupChatBtn
                text: "Find & chat"
                Layout.fillWidth: true
                Material.background: Theme.primary
                Material.foreground: Theme.primaryFg
                enabled: peerQuery.text.length >= 2
                onClicked: {
                    if (sscApi.userSearchResults.length > 0) {
                        const u = sscApi.userSearchResults[0]
                        const id = u.id || u._id || ""
                        if (id) {
                            sscApi.startNewDirect(id)
                            newChatDialog.close()
                            peerQuery.text = ""
                        }
                    } else {
                        sscApi.searchUsers(peerQuery.text)
                        // second click after results, or username path
                        sscApi.startNewDirect(peerQuery.text)
                        newChatDialog.close()
                    }
                }
            }
            Repeater {
                model: sscApi.userSearchResults
                delegate: Button {
                    Layout.fillWidth: true
                    text: (modelData.display_name || "") +
                          (modelData.username ? (" @" + modelData.username) : "") +
                          " — Chat"
                    Material.background: Theme.surfaceVariant
                    onClicked: {
                        sscApi.startNewDirect(modelData.id || modelData._id)
                        newChatDialog.close()
                        peerQuery.text = ""
                    }
                }
            }
            Label {
                text: "Or create a group"
                color: Theme.secondary
                font.pixelSize: 12
            }
            TextField {
                id: groupName
                Layout.fillWidth: true
                placeholderText: "Group name"
                color: Theme.surfaceFg
            }
            TextField {
                id: groupMembers
                Layout.fillWidth: true
                placeholderText: "Member user ids (comma-separated)"
                color: Theme.surfaceFg
            }
            Button {
                text: "Create group"
                Layout.fillWidth: true
                enabled: groupName.text.length > 0
                onClicked: {
                    sscApi.createGroup(groupName.text, groupMembers.text)
                    newChatDialog.close()
                }
            }
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
            color: Theme.surfaceFg
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
                        color: Theme.surfaceFg
                        Layout.fillWidth: true
                    }
                    Button {
                        text: "Remove"
                        flat: true
                        onClicked: sscApi.removeGroupMember(sscApi.activeGroupId, modelData.id || modelData._id)
                    }
                }
            }
            Button {
                text: "Leave group"
                Material.foreground: Theme.error
                onClicked: { sscApi.leaveGroup(sscApi.activeGroupId); membersDialog.close() }
            }
        }
        onOpened: sscApi.refreshGroupMembers(sscApi.activeGroupId)
    }

    Connections {
        target: sscApi
        function onSfuRoomReady(roomId, wsUrl, joinToken) {
            sfuDialog.roomId = roomId
            sfuDialog.wsUrl = wsUrl
            sfuDialog.joinToken = joinToken || ""
            sfuInfo.text = "Group call ready.\nRoom: " + roomId
            sfuDialog.open()
            if (roomId.length && wsUrl.length)
                sscCalls.joinSfuRoom(wsUrl, roomId, joinToken || "")
        }
        function onIncomingCall(callId, fromUserId, video) {
            callDialog.callId = callId
            callDialog.fromUserId = fromUserId
            callDialog.video = video
            callDialog.text = "Incoming " + (video ? "video" : "voice") + " call"
            callDialog.open()
        }
    }
    Connections {
        target: sscCalls
        function onSfuJoined(roomId, existingProducers) {
            sfuInfo.text = "Joined group call\nProducers: " + existingProducers
        }
    }

    Dialog {
        id: sfuDialog
        property string roomId: ""
        property string wsUrl: ""
        property string joinToken: ""
        title: "Group call"
        modal: true
        Label {
            id: sfuInfo
            width: 360
            wrapMode: Text.Wrap
            color: Theme.surfaceFg
        }
        footer: DialogButtonBox {
            Button {
                text: "Leave"
                onClicked: { sscCalls.leaveSfuRoom(); sscApi.endSfuRoom(); sfuDialog.close() }
            }
            Button {
                text: "Close"
                onClicked: sfuDialog.close()
            }
        }
    }

    Dialog {
        id: callDialog
        property string callId: ""
        property string fromUserId: ""
        property bool video: false
        property string text: ""
        title: "Incoming call"
        modal: true
        standardButtons: Dialog.Yes | Dialog.No
        Label { text: callDialog.text; wrapMode: Text.Wrap; width: 300 }
        onRejected: { if (callId) sscApi.endCall(callId, "declined") }
        onAccepted: sscCalls.acceptIncoming(callId, fromUserId, video)
    }

    Component.onCompleted: {
        if (sscSession.loggedIn) {
            sscApi.refreshConversations()
            sscApi.refreshStories()
        }
    }
}
