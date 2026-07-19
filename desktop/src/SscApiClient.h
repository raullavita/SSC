#pragma once

#include <QObject>
#include <QNetworkAccessManager>
#include <QJsonArray>
#include <QJsonObject>
#include "SscSession.h"
#include "SscCryptoBridge.h"

/**
 * Production API client — mirrors Android Auth/Conversation flows.
 * Client identity: windows/0.4.0/15
 */
class SscApiClient : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QJsonArray conversations READ conversations NOTIFY conversationsChanged)
    Q_PROPERTY(QJsonArray messages READ messages NOTIFY messagesChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)
    Q_PROPERTY(QString activeConversationId READ activeConversationId NOTIFY activeConversationChanged)
    Q_PROPERTY(QString activePeerId READ activePeerId NOTIFY activeConversationChanged)
    Q_PROPERTY(QString captchaSiteKey READ captchaSiteKey NOTIFY configChanged)
    Q_PROPERTY(bool captchaRequired READ captchaRequired NOTIFY configChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(QString statusText READ statusText NOTIFY statusTextChanged)
    Q_PROPERTY(QJsonArray userSearchResults READ userSearchResults NOTIFY userSearchResultsChanged)
public:
    explicit SscApiClient(SscSession *session, SscCryptoBridge *crypto, QObject *parent = nullptr);

    QJsonArray conversations() const { return m_conversations; }
    QJsonArray messages() const { return m_messages; }
    QString lastError() const { return m_lastError; }
    QString activeConversationId() const { return m_activeConversationId; }
    QString activePeerId() const { return m_activePeerId; }
    QString captchaSiteKey() const { return m_captchaSiteKey; }
    bool captchaRequired() const { return m_captchaRequired; }
    bool busy() const { return m_busy; }
    QString statusText() const { return m_statusText; }
    QJsonArray userSearchResults() const { return m_userSearchResults; }

    Q_INVOKABLE void loadPublicConfig();
    Q_INVOKABLE void login(const QString &email, const QString &password);
    Q_INVOKABLE void registerAccount(const QString &email, const QString &password, const QString &displayName,
                                     const QString &captchaToken);
    Q_INVOKABLE void logout();
    Q_INVOKABLE void refreshConversations();
    Q_INVOKABLE void openConversation(const QString &conversationId, const QString &peerId = {});
    Q_INVOKABLE void sendMessage(const QString &conversationId, const QString &plaintext);
    Q_INVOKABLE void ensurePrekeys();
    Q_INVOKABLE void startNewDirect(const QString &peerUserId);
    /** Lookup by username or user id; fills userSearchResults. */
    Q_INVOKABLE void searchUsers(const QString &query);
    Q_INVOKABLE void createGroup(const QString &name, const QString &memberIdsCsv);
    Q_INVOKABLE void verifyRecovery(const QString &email, const QString &passphrase, const QString &captchaToken);
    Q_INVOKABLE void resetPassword(const QString &recoveryToken, const QString &newPassword);

signals:
    void conversationsChanged();
    void messagesChanged();
    void lastErrorChanged();
    void activeConversationChanged();
    void configChanged();
    void busyChanged();
    void statusTextChanged();
    void loginSucceeded();
    void loginFailed(const QString &detail);
    void registered();
    void userSearchResultsChanged();
    void recoveryTokenReady(const QString &token);

private:
    void setError(const QString &e);
    void setBusy(bool b);
    void setStatus(const QString &s);
    QNetworkRequest makeRequest(const QString &path) const;
    void applyAuth(const QJsonObject &obj);
    void uploadPrekeys(const QJsonObject &bundle);
    void fetchPeerBundleAndEncrypt(const QString &conversationId, const QString &peerId, const QString &plaintext);
    void postCiphertext(const QString &conversationId, const QString &ciphertext, const QString &plaintext);
    void decryptMessagesPipeline(const QJsonArray &raw);
    void decryptNext(int index);

    SscSession *m_session = nullptr;
    SscCryptoBridge *m_crypto = nullptr;
    QNetworkAccessManager m_nam;
    QJsonArray m_conversations;
    QJsonArray m_messages;
    QJsonArray m_rawMessages;
    QString m_lastError;
    QString m_activeConversationId;
    QString m_activePeerId;
    QString m_apiBase = QStringLiteral("https://api.supersecurechat.com");
    QString m_captchaSiteKey;
    bool m_captchaRequired = true;
    bool m_busy = false;
    QString m_statusText;
    int m_decryptIndex = 0;
    QJsonArray m_userSearchResults;
    QString m_recoveryToken;
};
