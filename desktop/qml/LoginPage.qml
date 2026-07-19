import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    ColumnLayout {
        anchors.centerIn: parent
        width: 320
        spacing: 12

        Label {
            text: "SSC"
            font.pixelSize: 36
            font.bold: true
            color: "#00A884"
            Layout.alignment: Qt.AlignHCenter
        }
        Label {
            text: "Native desktop · Qt Quick (no Electron)"
            color: "#8696A0"
            Layout.alignment: Qt.AlignHCenter
        }
        TextField {
            id: email
            placeholderText: "Email"
            Layout.fillWidth: true
        }
        TextField {
            id: password
            placeholderText: "Password"
            echoMode: TextInput.Password
            Layout.fillWidth: true
        }
        Label {
            text: sscApi.lastError
            color: "#EA4335"
            visible: sscApi.lastError.length > 0
            wrapMode: Text.WordWrap
            Layout.fillWidth: true
        }
        Button {
            text: "Sign in"
            Layout.fillWidth: true
            enabled: email.text.length > 0 && password.text.length >= 8
            onClicked: sscApi.login(email.text, password.text)
        }
    }
}
