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
#include "SscCallEngine.h"
#include "SscLocalCache.h"
#include "SscVoiceRecorder.h"

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
    SscLocalCache cache;
    SscApiClient api(&session, &crypto, &realtime, &cache);
    SscTurnstileHelper turnstile;
    SscCallEngine calls(&session, &api, &crypto);
    SscVoiceRecorder voice;

    crypto.start(session.signalStorePath());

    // Presence heartbeat while logged in
    QTimer heartbeat;
    heartbeat.setInterval(60'000);
    QObject::connect(&heartbeat, &QTimer::timeout, &api, [&api, &session]() {
        if (session.loggedIn()) api.heartbeat();
    });
    heartbeat.start();

    // Decrypt call signals from realtime and feed media engine
    QObject::connect(&api, &SscApiClient::realtimeEvent, &calls, [&](const QString &) {
        // detailed payload handling below via custom connection
    });
    QObject::connect(&realtime, &SscRealtime::eventReceived, &app,
                     [&](const QString &type, const QJsonObject &payload) {
                         if (type == QLatin1String("call_signal") || type == QLatin1String("signal")) {
                             const QString ct = payload.value(QStringLiteral("ciphertext")).toString();
                             const QString st = payload.value(QStringLiteral("signal_type")).toString();
                             const QString from = payload.value(QStringLiteral("from_user_id")).toString(
                                 payload.value(QStringLiteral("sender_id")).toString());
                             if (ct.isEmpty() || from.isEmpty()) return;
                             crypto.call(QStringLiteral("decryptMessage"),
                                         QJsonObject{{QStringLiteral("ciphertext"), ct},
                                                     {QStringLiteral("peerId"), from},
                                                     {QStringLiteral("deviceId"), QStringLiteral("1")}},
                                         [&calls, st](bool ok, const QJsonObject &result, const QString &) {
                                             if (!ok) return;
                                             calls.onSignalPayload(st, result.value(QStringLiteral("plaintext")).toString());
                                         });
                         }
                         if (type == QLatin1String("call") || type == QLatin1String("call_invite")
                             || type == QLatin1String("incoming_call")) {
                             // UI listens to sscApi.incomingCall
                         }
                     });

    QQmlApplicationEngine engine;
    engine.addImportPath(QStringLiteral("qrc:/qt/qml"));
    engine.rootContext()->setContextProperty(QStringLiteral("sscSession"), &session);
    engine.rootContext()->setContextProperty(QStringLiteral("sscApi"), &api);
    engine.rootContext()->setContextProperty(QStringLiteral("sscCrypto"), &crypto);
    engine.rootContext()->setContextProperty(QStringLiteral("sscTurnstile"), &turnstile);
    engine.rootContext()->setContextProperty(QStringLiteral("sscRealtime"), &realtime);
    engine.rootContext()->setContextProperty(QStringLiteral("sscCalls"), &calls);
    engine.rootContext()->setContextProperty(QStringLiteral("sscVoice"), &voice);
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
