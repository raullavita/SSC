cmake_minimum_required(VERSION 3.21)
project(SSC_Desktop VERSION 0.4.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)

find_package(Qt6 REQUIRED COMPONENTS Core Gui Qml Quick Network QuickControls2 WebSockets)

set(SSC_CRYPTO_WORKER_DIR "${CMAKE_CURRENT_SOURCE_DIR}/crypto-worker")
set(SSC_MEDIA_WORKER_DIR "${CMAKE_CURRENT_SOURCE_DIR}/media-worker")
add_compile_definitions(
    SSC_CRYPTO_WORKER_DIR="${SSC_CRYPTO_WORKER_DIR}"
    SSC_MEDIA_WORKER_DIR="${SSC_MEDIA_WORKER_DIR}"
)

qt_add_executable(ssc_desktop
    src/main.cpp
    src/SscApiClient.cpp
    src/SscApiClient.h
    src/SscSession.cpp
    src/SscSession.h
    src/SscCryptoBridge.cpp
    src/SscCryptoBridge.h
    src/SscTurnstileHelper.cpp
    src/SscTurnstileHelper.h
    src/SscRealtime.cpp
    src/SscRealtime.h
    src/SscCallEngine.cpp
    src/SscCallEngine.h
)

qt_add_qml_module(ssc_desktop
    URI SuperSecureChat
    VERSION 1.0
    QML_FILES
        qml/Main.qml
        qml/LoginPage.qml
        qml/ChatListPage.qml
        qml/ChatThreadPage.qml
        qml/SettingsPage.qml
        qml/RecoveryPage.qml
        qml/Theme.qml
    RESOURCES
        qml/qmldir
)

target_link_libraries(ssc_desktop PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Qml
    Qt6::Quick
    Qt6::Network
    Qt6::QuickControls2
    Qt6::WebSockets
)

# Copy workers next to binary for runtime
add_custom_command(TARGET ssc_desktop POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/crypto-worker"
        "$<TARGET_FILE_DIR:ssc_desktop>/crypto-worker"
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/media-worker"
        "$<TARGET_FILE_DIR:ssc_desktop>/media-worker"
    COMMENT "Copy crypto-worker and media-worker"
)

install(TARGETS ssc_desktop RUNTIME DESTINATION bin)
install(DIRECTORY crypto-worker/ DESTINATION bin/crypto-worker)
install(DIRECTORY media-worker/ DESTINATION bin/media-worker)
