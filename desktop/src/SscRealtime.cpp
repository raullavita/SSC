#include "SscRealtime.h"

#include <QJsonDocument>
#include <QAbstractSocket>
#include <QUrl>

SscRealtime::SscRealtime(QObject *parent)
    : QObject(parent)
{
    m_reconnect.setSingleShot(true);
    connect(&m_reconnect, &QTimer::timeout, this, [this]() {
        if (m_want) {
            connectWs(m_url);
        }
    });

    connect(&m_ws, &QWebSocket::connected, this, [this]() {
        QJsonObject auth{{QStringLiteral("type"), QStringLiteral("auth")},
                         {QStringLiteral("token"), m_token}};
        m_ws.sendTextMessage(QString::fromUtf8(QJsonDocument(auth).toJson(QJsonDocument::Compact)));
        setState(QStringLiteral("online"));
        resubscribe();
        emit eventReceived(QStringLiteral("connected"), {});
    });

    connect(&m_ws, &QWebSocket::disconnected, this, [this]() {
        setState(QStringLiteral("offline"));
        emit eventReceived(QStringLiteral("disconnected"), {});
        scheduleReconnect();
    });

    connect(&m_ws, &QWebSocket::textMessageReceived, this, [this](const QString &msg) {
        const auto doc = QJsonDocument::fromJson(msg.toUtf8());
        if (!doc.isObject()) {
            return;
        }
        const auto obj = doc.object();
        const QString type = obj.value(QStringLiteral("type")).toString(QStringLiteral("event"));
        emit eventReceived(type, obj);
    });

    connect(&m_ws, &QWebSocket::errorOccurred, this, [this](QAbstractSocket::SocketError) {
        setState(QStringLiteral("offline"));
        emit eventReceived(QStringLiteral("error"),
                           QJsonObject{{QStringLiteral("detail"), m_ws.errorString()}});
        scheduleReconnect();
    });
}

void SscRealtime::setState(const QString &s)
{
    if (m_state == s) {
        return;
    }
    m_state = s;
    emit connectionStateChanged();
}

void SscRealtime::setAccessToken(const QString &token)
{
    m_token = token;
}

void SscRealtime::setTopics(const QStringList &topics)
{
    m_topics = topics;
    if (m_ws.state() == QAbstractSocket::ConnectedState) {
        resubscribe();
    }
}

void SscRealtime::connectWs(const QString &wsUrl)
{
    m_url = wsUrl;
    m_want = true;
    if (m_token.isEmpty()) {
        return;
    }
    if (m_ws.state() == QAbstractSocket::ConnectedState) {
        m_ws.close();
    }
    setState(QStringLiteral("connecting"));
    m_ws.open(QUrl(wsUrl));
}

void SscRealtime::disconnectWs()
{
    m_want = false;
    m_reconnect.stop();
    m_ws.close();
    setState(QStringLiteral("offline"));
}

void SscRealtime::sendJson(const QJsonObject &obj)
{
    if (m_ws.state() != QAbstractSocket::ConnectedState) {
        return;
    }
    m_ws.sendTextMessage(QString::fromUtf8(QJsonDocument(obj).toJson(QJsonDocument::Compact)));
}

void SscRealtime::resubscribe()
{
    for (const auto &t : m_topics) {
        sendJson(QJsonObject{
            {QStringLiteral("type"), QStringLiteral("subscribe")},
            {QStringLiteral("topic"), t},
        });
    }
}

void SscRealtime::scheduleReconnect()
{
    if (!m_want || m_reconnect.isActive()) {
        return;
    }
    m_reconnect.start(2500);
}
