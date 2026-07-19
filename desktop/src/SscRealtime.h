#pragma once

#include <QObject>
#include <QWebSocket>
#include <QTimer>
#include <QStringList>
#include <QJsonObject>

/**
 * Realtime WS — same auth pattern as Android SscRealtime:
 * connect → first frame { type: "auth", token } → subscribe topics.
 */
class SscRealtime : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString connectionState READ connectionState NOTIFY connectionStateChanged)
public:
    explicit SscRealtime(QObject *parent = nullptr);

    QString connectionState() const { return m_state; }

    Q_INVOKABLE void setAccessToken(const QString &token);
    Q_INVOKABLE void setTopics(const QStringList &topics);
    Q_INVOKABLE void connectWs(const QString &wsUrl = QStringLiteral("wss://api.supersecurechat.com/api/ws"));
    Q_INVOKABLE void disconnectWs();
    Q_INVOKABLE void sendJson(const QJsonObject &obj);

signals:
    void connectionStateChanged();
    void eventReceived(const QString &type, const QJsonObject &payload);

private:
    void setState(const QString &s);
    void resubscribe();
    void scheduleReconnect();

    QWebSocket m_ws;
    QTimer m_reconnect;
    QString m_token;
    QStringList m_topics;
    QString m_state = QStringLiteral("offline");
    QString m_url;
    bool m_want = false;
};
