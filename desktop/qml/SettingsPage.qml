import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtQuick.Controls.Material

Page {
    id: page
    background: Rectangle { color: Theme.background }

    header: ToolBar {
        Material.background: Theme.surface
        RowLayout {
            anchors.fill: parent
            ToolButton { text: "←"; onClicked: ApplicationWindow.window.goBack() }
            Label { text: "Settings"; font.bold: true; color: Theme.onSurface }
            Item { Layout.fillWidth: true }
            ToolButton { text: "⟳"; onClicked: refreshAll() }
        }
    }

    function refreshAll() {
        sscApi.refreshDevices()
        sscApi.refreshFriendRequests()
        sscApi.refreshPrivacy()
        sscApi.refreshBroadcastLists()
        sscApi.ensurePrekeys()
    }

    Flickable {
        anchors.fill: parent
        contentHeight: col.implicitHeight + 40
        clip: true
        ColumnLayout {
            id: col
            width: parent.width - 32
            x: 16
            y: 16
            spacing: 10

            Label { text: "Account"; color: Theme.primary; font.bold: true; font.pixelSize: 16 }
            Label { text: "Name: " + (sscSession.displayName || "—"); color: Theme.onSurface }
            Label {
                text: "User id: " + (sscSession.userId || "—")
                color: Theme.onSurfaceVariant
                wrapMode: Text.WrapAnywhere
                Layout.fillWidth: true
            }
            Label { text: "Device: " + sscSession.deviceId; color: Theme.onSurfaceVariant }
            Label {
                visible: sscSession.username.length > 0
                text: "Invite: https://www.supersecurechat.com/add/" + sscSession.username
                color: Theme.secondary
                wrapMode: Text.WrapAnywhere
                Layout.fillWidth: true
            }

            TextField {
                id: usernameField
                visible: !sscSession.username || sscSession.username.length === 0
                placeholderText: "Choose username"
                Layout.fillWidth: true
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
            }
            Button {
                visible: usernameField.visible
                text: "Save username"
                Layout.fillWidth: true
                Material.background: Theme.primary
                Material.foreground: Theme.onPrimary
                onClicked: sscApi.setUsername(usernameField.text)
            }

            Label { text: "Security"; color: Theme.primary; font.bold: true; Layout.topMargin: 12 }
            Label {
                text: sscApi.prekeyInfo + "\nE2EE libsignal 0.96.4 · windows/0.4.0/15\nWS: " + sscApi.connectionState
                color: Theme.onSurfaceVariant
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }
            Button {
                text: "Re-upload prekeys"
                Layout.fillWidth: true
                onClicked: sscApi.ensurePrekeys()
            }
            TextField {
                id: recoveryPass
                placeholderText: "Set recovery passphrase (min 8)"
                echoMode: TextInput.Password
                Layout.fillWidth: true
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
            }
            Button {
                text: "Save recovery passphrase"
                Layout.fillWidth: true
                enabled: recoveryPass.text.length >= 8
                onClicked: sscApi.setupRecovery(recoveryPass.text)
            }

            Label { text: "Privacy"; color: Theme.primary; font.bold: true; Layout.topMargin: 12 }
            Switch {
                id: swLastSeen
                text: "Last seen visible"
                checked: sscApi.privacy.last_seen_visible !== false
                contentItem: Text {
                    text: swLastSeen.text
                    color: Theme.onSurface
                    leftPadding: swLastSeen.indicator.width + 8
                    verticalAlignment: Text.AlignVCenter
                }
            }
            Switch {
                id: swReceipts
                text: "Read receipts"
                checked: sscApi.privacy.read_receipts !== false
                contentItem: Text {
                    text: swReceipts.text
                    color: Theme.onSurface
                    leftPadding: swReceipts.indicator.width + 8
                    verticalAlignment: Text.AlignVCenter
                }
            }
            Switch {
                id: swPush
                text: "Rich push labels"
                checked: !!sscApi.privacy.push_rich_labels
                contentItem: Text {
                    text: swPush.text
                    color: Theme.onSurface
                    leftPadding: swPush.indicator.width + 8
                    verticalAlignment: Text.AlignVCenter
                }
            }
            Button {
                text: "Save privacy"
                Layout.fillWidth: true
                onClicked: sscApi.patchPrivacy(swLastSeen.checked, swReceipts.checked, swPush.checked)
            }

            Label { text: "Devices"; color: Theme.primary; font.bold: true; Layout.topMargin: 12 }
            Repeater {
                model: sscApi.devices
                delegate: RowLayout {
                    Layout.fillWidth: true
                    Label {
                        text: (modelData.name || "Device") + " · " + (modelData.platform || "") + " · " + (modelData.device_id || modelData.id || "")
                        color: Theme.onSurface
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                    Button {
                        text: "Revoke"
                        flat: true
                        Material.foreground: Theme.error
                        onClicked: sscApi.revokeDevice(modelData.device_id || modelData.id)
                    }
                }
            }
            Button {
                text: "Create device link"
                Layout.fillWidth: true
                onClicked: sscApi.createDeviceLink()
            }
            Label {
                id: linkInfo
                color: Theme.secondary
                wrapMode: Text.WrapAnywhere
                Layout.fillWidth: true
            }
            Connections {
                target: sscApi
                function onDeviceLinkReady(token, deepLink) {
                    linkInfo.text = deepLink || token
                }
            }

            Label { text: "Friend requests"; color: Theme.primary; font.bold: true; Layout.topMargin: 12 }
            Repeater {
                model: sscApi.friendRequests
                delegate: RowLayout {
                    Layout.fillWidth: true
                    Label {
                        text: "From " + (modelData.from_user_id || modelData.fromUserId || "?")
                        color: Theme.onSurface
                        Layout.fillWidth: true
                    }
                    Button {
                        text: "Accept"
                        onClicked: sscApi.acceptFriendRequest(modelData.id || modelData._id)
                    }
                    Button {
                        text: "Decline"
                        flat: true
                        onClicked: sscApi.declineFriendRequest(modelData.id || modelData._id)
                    }
                }
            }
            TextField {
                id: friendId
                placeholderText: "Send friend request to user id"
                Layout.fillWidth: true
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
            }
            Button {
                text: "Send friend request"
                Layout.fillWidth: true
                onClicked: sscApi.sendFriendRequest(friendId.text)
            }

            Label { text: "Cloud backup"; color: Theme.primary; font.bold: true; Layout.topMargin: 12 }
            TextField {
                id: backupPass
                placeholderText: "Backup passphrase (min 8)"
                echoMode: TextInput.Password
                Layout.fillWidth: true
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
            }
            RowLayout {
                Layout.fillWidth: true
                Button {
                    text: "Upload"
                    enabled: backupPass.text.length >= 8
                    onClicked: sscApi.uploadCloudBackup(backupPass.text)
                }
                Button {
                    text: "Download"
                    enabled: backupPass.text.length >= 8
                    onClicked: sscApi.downloadCloudBackup(backupPass.text)
                }
                Button {
                    text: "Delete cloud"
                    flat: true
                    Material.foreground: Theme.error
                    onClicked: sscApi.deleteCloudBackup()
                }
            }

            Label { text: "Broadcast lists"; color: Theme.primary; font.bold: true; Layout.topMargin: 12 }
            TextField {
                id: bcName
                placeholderText: "List name"
                Layout.fillWidth: true
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
            }
            TextField {
                id: bcMembers
                placeholderText: "Recipient user ids (comma)"
                Layout.fillWidth: true
                color: Theme.onSurface
                background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
            }
            Button {
                text: "Create broadcast list"
                Layout.fillWidth: true
                onClicked: sscApi.createBroadcastList(bcName.text, bcMembers.text)
            }
            Repeater {
                model: sscApi.broadcastLists
                delegate: ColumnLayout {
                    Layout.fillWidth: true
                    Label {
                        text: (modelData.name || "List") + " (" + ((modelData.recipient_ids || []).length || "?") + ")"
                        color: Theme.onSurface
                    }
                    RowLayout {
                        TextField {
                            id: bcMsg
                            placeholderText: "Message"
                            Layout.fillWidth: true
                            color: Theme.onSurface
                            background: Rectangle { color: Theme.surfaceVariant; radius: 8 }
                        }
                        Button {
                            text: "Send"
                            onClicked: sscApi.sendBroadcast(modelData.id || modelData._id, bcMsg.text)
                        }
                        Button {
                            text: "Del"
                            flat: true
                            Material.foreground: Theme.error
                            onClicked: sscApi.deleteBroadcastList(modelData.id || modelData._id)
                        }
                    }
                }
            }

            Label { text: "Danger zone"; color: Theme.error; font.bold: true; Layout.topMargin: 16 }
            Button {
                text: "Panic wipe (server + local crypto)"
                Layout.fillWidth: true
                Material.background: Theme.error
                Material.foreground: "#FFFFFF"
                onClicked: panicDialog.open()
            }
            Button {
                text: "Log out"
                Layout.fillWidth: true
                onClicked: {
                    sscApi.logout()
                    ApplicationWindow.window.openLogin()
                }
            }

            Label {
                text: sscApi.statusText
                color: Theme.primary
                visible: sscApi.statusText.length > 0
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
            }
            Label {
                text: sscApi.lastError
                color: Theme.error
                visible: sscApi.lastError.length > 0
                Layout.fillWidth: true
                wrapMode: Text.WordWrap
            }
            Label {
                text: "SSC Desktop Qt · v0.4.0 (build 15) · Android parity track"
                color: Theme.onSurfaceVariant
                font.pixelSize: 11
                Layout.alignment: Qt.AlignHCenter
                Layout.topMargin: 12
            }
        }
    }

    Dialog {
        id: panicDialog
        title: "Panic wipe?"
        modal: true
        standardButtons: Dialog.Yes | Dialog.No
        Label {
            text: "This wipes server session data and local Signal keys. You will be logged out."
            wrapMode: Text.WordWrap
            width: 320
        }
        onAccepted: sscApi.panicWipe()
    }

    Component.onCompleted: refreshAll()
}
