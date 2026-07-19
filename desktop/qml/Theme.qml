pragma Singleton
import QtQuick

QtObject {
    // Match Android SscTheme dark palette.
    // Never use property names starting with "on" + capital letter — QML treats those as signal handlers.
    readonly property color primary: "#00A884"
    readonly property color primaryFg: "#041510"
    readonly property color secondary: "#53BDEB"
    readonly property color background: "#0B141A"
    readonly property color backgroundFg: "#E9EDEF"
    readonly property color surface: "#111B21"
    readonly property color surfaceFg: "#E9EDEF"
    readonly property color surfaceVariant: "#202C33"
    readonly property color surfaceVariantFg: "#8696A0"
    readonly property color outline: "#3B4A54"
    readonly property color error: "#EA4335"
    readonly property color bubbleMine: "#005C4B"
    readonly property color bubblePeer: "#202C33"
}
