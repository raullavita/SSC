#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QTimer>

#include "SscApiClient.h"
#include "SscSession.h"
#include "SscCryptoBridge.h"
#include "SscTurnstileHelper.h"
#include "SscRealtime.h"

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    QCoreApplication::setOrganizationName(QStringLiteral("SuperSecureChat"));
    QCoreApplication::setApplicationName(QStringLiteral("SSC"));
    QCoreApplication::setApplicationVersion(QStringLiteral("0.4.0"));

    QQuickStyle::setStyle(QStringLiteral("Material"));

    SscSession session;
    SscCryptoBridge crypto;
    SscRealtime realtime;
    SscApiClient api(&session, &crypto, &realtime);
    SscTurnstileHelper turnstile;

    crypto.start(session.signalStorePath());

    // Presence heartbeat while logged in
    QTimer heartbeat;
    heartbeat.setInterval(60'000);
    QObject::connect(&heartbeat, &QTimer::timeout, &api, [&api, &session]() {
        if (session.loggedIn()) api.heartbeat();
    });
    heartbeat.start();

    QQmlApplicationEngine engine;
    engine.addImportPath(QStringLiteral("qrc:/qt/qml"));
    engine.rootContext()->setContextProperty(QStringLiteral("sscSession"), &session);
    engine.rootContext()->setContextProperty(QStringLiteral("sscApi"), &api);
    engine.rootContext()->setContextProperty(QStringLiteral("sscCrypto"), &crypto);
    engine.rootContext()->setContextProperty(QStringLiteral("sscTurnstile"), &turnstile);
    engine.rootContext()->setContextProperty(QStringLiteral("sscRealtime"), &realtime);
    engine.addImportPath(QCoreApplication::applicationDirPath() + QStringLiteral("/qml"));

    const QUrl url(QStringLiteral("qrc:/qt/qml/SuperSecureChat/qml/Main.qml"));
    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);
    engine.load(url);

    return app.exec();
}
