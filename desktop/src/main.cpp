#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QStandardPaths>
#include <QDir>

#include "SscApiClient.h"
#include "SscSession.h"
#include "SscCryptoBridge.h"

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    QCoreApplication::setOrganizationName(QStringLiteral("SuperSecureChat"));
    QCoreApplication::setApplicationName(QStringLiteral("SSC"));
    QCoreApplication::setApplicationVersion(QStringLiteral("0.4.0"));

    QQuickStyle::setStyle(QStringLiteral("Material"));

    SscSession session;
    SscCryptoBridge crypto;
    SscApiClient api(&session, &crypto);

    // Start crypto worker early (configure after login with user id)
    crypto.start(session.signalStorePath());

    QQmlApplicationEngine engine;
    engine.addImportPath(QStringLiteral("qrc:/qt/qml"));
    engine.rootContext()->setContextProperty(QStringLiteral("sscSession"), &session);
    engine.rootContext()->setContextProperty(QStringLiteral("sscApi"), &api);
    engine.rootContext()->setContextProperty(QStringLiteral("sscCrypto"), &crypto);

    // Theme singleton import path for filesystem load during dev
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
