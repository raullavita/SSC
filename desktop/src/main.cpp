#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QQuickStyle>
#include <QTimer>
#include <QWindow>

#include "SscApiClient.h"
#include "SscSession.h"
#include "SscCryptoBridge.h"
#include "SscTurnstileHelper.h"
#include "SscRealtime.h"
#include "SscCallEngine.h"
#include "SscLocalCache.h"
#include "SscVoiceRecorder.h"
#include "SscDeepLink.h"

static void raiseMainWindow(QQmlApplicationEngine &engine)
{
    const auto roots = engine.rootObjects();
    if (roots.isEmpty()) return;
    if (auto *w = qobject_cast<QWindow *>(roots.first())) {
        w->show();
        w->raise();
        w->requestActivate();
    }
}

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    QCoreApplication::setOrganizationName(QStringLiteral("SuperSecureChat"));
    QCoreApplication::setApplicationName(QStringLiteral("SSC"));
    QCoreApplication::setApplicationVersion(QStringLiteral("0.4.0"));

    SscDeepLink deepLink;
    if (!deepLink.claimPrimaryInstance(QCoreApplication::arguments())) {
        // Another instance is running; URL already forwarded.
        return 0;
    }

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

    QTimer heartbeat;
    heartbeat.setInterval(60'000);
    QObject::connect(&heartbeat, &QTimer::timeout, &api, [&api, &session]() {
        if (session.loggedIn()) api.heartbeat();
    });
    heartbeat.start();

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
                     });

    QQmlApplicationEngine engine;
    engine.addImportPath(QStringLiteral("qrc:/"));
    engine.addImportPath(QCoreApplication::applicationDirPath());
    engine.rootContext()->setContextProperty(QStringLiteral("sscSession"), &session);
    engine.rootContext()->setContextProperty(QStringLiteral("sscApi"), &api);
    engine.rootContext()->setContextProperty(QStringLiteral("sscCrypto"), &crypto);
    engine.rootContext()->setContextProperty(QStringLiteral("sscTurnstile"), &turnstile);
    engine.rootContext()->setContextProperty(QStringLiteral("sscRealtime"), &realtime);
    engine.rootContext()->setContextProperty(QStringLiteral("sscCalls"), &calls);
    engine.rootContext()->setContextProperty(QStringLiteral("sscVoice"), &voice);

    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);

    engine.load(QUrl(QStringLiteral("qrc:/SuperSecureChat/qml/Main.qml")));
    if (engine.rootObjects().isEmpty()) {
        engine.load(QUrl(QStringLiteral("qrc:/qt/qml/SuperSecureChat/qml/Main.qml")));
    }
    if (engine.rootObjects().isEmpty()) {
        return -1;
    }

    // Google OAuth / deep links
    QObject::connect(&deepLink, &SscDeepLink::oauthCodeReceived, &api, [&api, &engine](const QString &code) {
        if (!code.isEmpty()) {
            api.exchangeGoogleCode(code);
            raiseMainWindow(engine);
        }
    });
    QObject::connect(&deepLink, &SscDeepLink::deepLinkReceived, &app, [&engine](const QString &) {
        raiseMainWindow(engine);
    });

    // Cold-start args also handled in claimPrimaryInstance via queued oauthCodeReceived
    for (const QString &a : QCoreApplication::arguments()) {
        const QString code = SscDeepLink::extractOAuthCode(a);
        if (!code.isEmpty()) {
            QTimer::singleShot(300, &api, [&api, code]() { api.exchangeGoogleCode(code); });
            break;
        }
    }

    return app.exec();
}
