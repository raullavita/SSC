cmake_minimum_required(VERSION 3.21)
project(SSC_Desktop VERSION 0.4.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 REQUIRED COMPONENTS Core Gui Qml Quick Network WebSockets)

qt_add_executable(ssc_desktop
    src/main.cpp
    src/SscApiClient.cpp
    src/SscApiClient.h
    src/SscSession.cpp
    src/SscSession.h
)

qt_add_qml_module(ssc_desktop
    URI SuperSecureChat
    VERSION 1.0
    QML_FILES
        qml/Main.qml
        qml/LoginPage.qml
        qml/ChatListPage.qml
        qml/ChatThreadPage.qml
)

target_link_libraries(ssc_desktop PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Qml
    Qt6::Quick
    Qt6::Network
    Qt6::WebSockets
)

install(TARGETS ssc_desktop RUNTIME DESTINATION bin)
