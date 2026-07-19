#pragma once

#include <QObject>
#include <QNetworkAccessManager>
#include <QJsonArray>
#include <QJsonObject>
#include "SscSession.h"

class SscApiClient : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QJsonArray conversations READ conversations NOTIFY conversationsChanged)
    Q_PROPERTY(QJsonArray messages READ messages NOTIFY messagesChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)
    Q_PROPERTY(QString activeConversationId READ activeConversationId NOTIFY activeConversationChanged)
public:
    explicit SscApiClient(SscSession *session, QObject *parent = nullptr);

    QJsonArray conversations() const { return m_conversations; }
    QJsonArray messages() const { return m_messages; }
    QString lastError() const { return m_lastError; }
    QString activeConversationId() const { return m_activeConversationId; }

    Q_INVOKABLE void login(const QString &email, const QString &password);
    Q_INVOKABLE void logout();
    Q_INVOKABLE void refreshConversations();
    Q_INVOKABLE void openConversation(const QString &conversationId);
    Q_INVOKABLE void sendMessage(const QString &conversationId, const QString &plaintext);
    Q_INVOKABLE void setPlatform(const QString &platform); // windows | mac

signals:
    void conversationsChanged();
    void messagesChanged();
    void lastErrorChanged();
    void activeConversationChanged();
    void loginSucceeded();
    void loginFailed(const QString &detail);

private:
    void setError(const QString &e);
    QNetworkRequest makeRequest(const QString &path) const;

    SscSession *m_session = nullptr;
    QNetworkAccessManager m_nam;
    QJsonArray m_conversations;
    QJsonArray m_messages;
    QString m_lastError;
    QString m_activeConversationId;
    QString m_apiBase = QStringLiteral("https://api.supersecurechat.com");
    QString m_platform = QStringLiteral("windows");
};
