#pragma once

#include <QObject>
#include <QNetworkAccessManager>
#include <QJsonArray>
#include <QJsonObject>
#include <QStringList>
#include <functional>
#include "SscSession.h"
#include "SscCryptoBridge.h"
#include "SscRealtime.h"

/**
 * Full native API facade — parity with Android repositories (auth, chat, groups,
 * social, devices, privacy, stories, reactions, polls, presence, backup, panic).
 * Client: windows/0.4.0/15
 */
class SscApiClient : public QObject
{
    Q_OBJECT
    // Chat
    Q_PROPERTY(QJsonArray conversations READ conversations NOTIFY conversationsChanged)
    Q_PROPERTY(QJsonArray messages READ messages NOTIFY messagesChanged)
    Q_PROPERTY(QString activeConversationId READ activeConversationId NOTIFY activeConversationChanged)
    Q_PROPERTY(QString activePeerId READ activePeerId NOTIFY activeConversationChanged)
    Q_PROPERTY(QString activeGroupId READ activeGroupId NOTIFY activeConversationChanged)
    Q_PROPERTY(QString typingLabel READ typingLabel NOTIFY typingLabelChanged)
    Q_PROPERTY(QJsonObject reactionSummary READ reactionSummary NOTIFY reactionSummaryChanged)
    // Config / status
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)
    Q_PROPERTY(QString captchaSiteKey READ captchaSiteKey NOTIFY configChanged)
    Q_PROPERTY(bool captchaRequired READ captchaRequired NOTIFY configChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(QString statusText READ statusText NOTIFY statusTextChanged)
    Q_PROPERTY(QString connectionState READ connectionState NOTIFY connectionStateChanged)
    // Search / social / devices / stories
    Q_PROPERTY(QJsonArray userSearchResults READ userSearchResults NOTIFY userSearchResultsChanged)
    Q_PROPERTY(QJsonArray devices READ devices NOTIFY devicesChanged)
    Q_PROPERTY(QJsonArray friendRequests READ friendRequests NOTIFY friendRequestsChanged)
    Q_PROPERTY(QJsonArray stories READ stories NOTIFY storiesChanged)
    Q_PROPERTY(QJsonArray groupMembers READ groupMembers NOTIFY groupMembersChanged)
    Q_PROPERTY(QJsonObject privacy READ privacy NOTIFY privacyChanged)
    Q_PROPERTY(QString prekeyInfo READ prekeyInfo NOTIFY prekeyInfoChanged)
    Q_PROPERTY(QJsonArray broadcastLists READ broadcastLists NOTIFY broadcastListsChanged)

public:
    explicit SscApiClient(SscSession *session, SscCryptoBridge *crypto, SscRealtime *realtime,
                          QObject *parent = nullptr);

    QJsonArray conversations() const { return m_conversations; }
    QJsonArray messages() const { return m_messages; }
    QString activeConversationId() const { return m_activeConversationId; }
    QString activePeerId() const { return m_activePeerId; }
    QString activeGroupId() const { return m_activeGroupId; }
    QString typingLabel() const { return m_typingLabel; }
    QJsonObject reactionSummary() const { return m_reactionSummary; }
    QString lastError() const { return m_lastError; }
    QString captchaSiteKey() const { return m_captchaSiteKey; }
    bool captchaRequired() const { return m_captchaRequired; }
    bool busy() const { return m_busy; }
    QString statusText() const { return m_statusText; }
    QString connectionState() const { return m_realtime ? m_realtime->connectionState() : QStringLiteral("offline"); }
    QJsonArray userSearchResults() const { return m_userSearchResults; }
    QJsonArray devices() const { return m_devices; }
    QJsonArray friendRequests() const { return m_friendRequests; }
    QJsonArray stories() const { return m_stories; }
    QJsonArray groupMembers() const { return m_groupMembers; }
    QJsonObject privacy() const { return m_privacy; }
    QString prekeyInfo() const { return m_prekeyInfo; }
    QJsonArray broadcastLists() const { return m_broadcastLists; }

    // Auth
    Q_INVOKABLE void loadPublicConfig();
    Q_INVOKABLE void login(const QString &email, const QString &password);
    Q_INVOKABLE void registerAccount(const QString &email, const QString &password, const QString &displayName,
                                     const QString &captchaToken);
    Q_INVOKABLE void logout();
    Q_INVOKABLE void me();
    Q_INVOKABLE void verifyRecovery(const QString &email, const QString &passphrase, const QString &captchaToken);
    Q_INVOKABLE void resetPassword(const QString &recoveryToken, const QString &newPassword);
    Q_INVOKABLE void setupRecovery(const QString &passphrase);
    Q_INVOKABLE void openGoogleOAuth();
    Q_INVOKABLE void exchangeGoogleCode(const QString &oauthCode);

    // Conversations / messages
    Q_INVOKABLE void refreshConversations();
    Q_INVOKABLE void openConversation(const QString &conversationId, const QString &peerId = {},
                                      const QString &groupId = {});
    Q_INVOKABLE void sendMessage(const QString &conversationId, const QString &plaintext,
                                 const QString &replyTo = {});
    Q_INVOKABLE void editMessage(const QString &messageId, const QString &plaintext);
    Q_INVOKABLE void deleteMessage(const QString &messageId, const QString &scope = QStringLiteral("me"));
    Q_INVOKABLE void markRead(const QString &conversationId, const QString &lastMessageId = {});
    Q_INVOKABLE void sendTyping(const QString &conversationId, bool active);
    Q_INVOKABLE void setPinned(const QString &conversationId, bool pinned);
    Q_INVOKABLE void setMuted(const QString &conversationId, bool muted);
    Q_INVOKABLE void setChatPrivacy(const QString &conversationId, bool readReceipts, bool typingVisible,
                                    int disappearingSeconds);
    Q_INVOKABLE void startNewDirect(const QString &peerUserId);
    Q_INVOKABLE void searchUsers(const QString &query);
    Q_INVOKABLE void addReaction(const QString &messageId, const QString &emoji);
    Q_INVOKABLE void refreshReactions(const QString &conversationId);

    // Groups
    Q_INVOKABLE void createGroup(const QString &name, const QString &memberIdsCsv);
    Q_INVOKABLE void refreshGroupMembers(const QString &groupId);
    Q_INVOKABLE void addGroupMembers(const QString &groupId, const QString &memberIdsCsv);
    Q_INVOKABLE void removeGroupMember(const QString &groupId, const QString &memberId);
    Q_INVOKABLE void leaveGroup(const QString &groupId);
    Q_INVOKABLE void dissolveGroup(const QString &groupId);

    // Social
    Q_INVOKABLE void refreshFriendRequests();
    Q_INVOKABLE void sendFriendRequest(const QString &toUserId, const QString &note = {});
    Q_INVOKABLE void acceptFriendRequest(const QString &requestId);
    Q_INVOKABLE void declineFriendRequest(const QString &requestId);
    Q_INVOKABLE void blockUser(const QString &userId);
    Q_INVOKABLE void reportUser(const QString &userId, const QString &reason);

    // Devices / prekeys
    Q_INVOKABLE void ensurePrekeys();
    Q_INVOKABLE void registerDevice();
    Q_INVOKABLE void refreshDevices();
    Q_INVOKABLE void revokeDevice(const QString &deviceId);
    Q_INVOKABLE void createDeviceLink();

    // Privacy / account
    Q_INVOKABLE void refreshPrivacy();
    Q_INVOKABLE void patchPrivacy(bool lastSeenVisible, bool readReceipts, bool pushRichLabels);
    Q_INVOKABLE void setUsername(const QString &username);
    Q_INVOKABLE void panicWipe();
    Q_INVOKABLE void heartbeat();

    // Stories
    Q_INVOKABLE void refreshStories();
    Q_INVOKABLE void createStory(const QString &text);
    Q_INVOKABLE void deleteStory(const QString &storyId);

    // Polls
    Q_INVOKABLE void createPoll(const QString &conversationId, const QString &question,
                                const QString &optionsCsv);
    Q_INVOKABLE void votePoll(const QString &conversationId, const QString &pollId, int optionIndex);

    // Backup (cloud ciphertext envelope)
    Q_INVOKABLE void uploadCloudBackup(const QString &passphrase);
    Q_INVOKABLE void downloadCloudBackup(const QString &passphrase);
    Q_INVOKABLE void deleteCloudBackup();

    // Broadcast
    Q_INVOKABLE void refreshBroadcastLists();
    Q_INVOKABLE void createBroadcastList(const QString &name, const QString &recipientIdsCsv);
    Q_INVOKABLE void deleteBroadcastList(const QString &listId);
    Q_INVOKABLE void sendBroadcast(const QString &listId, const QString &plaintext);

    // Calls (signaling API; media path can attach later)
    Q_INVOKABLE void startCall(const QString &conversationId, bool video);
    Q_INVOKABLE void endCall(const QString &callId, const QString &reason = QStringLiteral("ended"));

    // Files / attachments (encrypted via crypto-worker encryptBytes)
    Q_INVOKABLE void sendFile(const QString &conversationId, const QString &localPath);

    // Boot after login
    Q_INVOKABLE void onLoggedInBootstrap();

signals:
    void conversationsChanged();
    void messagesChanged();
    void activeConversationChanged();
    void typingLabelChanged();
    void reactionSummaryChanged();
    void lastErrorChanged();
    void configChanged();
    void busyChanged();
    void statusTextChanged();
    void connectionStateChanged();
    void userSearchResultsChanged();
    void devicesChanged();
    void friendRequestsChanged();
    void storiesChanged();
    void groupMembersChanged();
    void privacyChanged();
    void prekeyInfoChanged();
    void broadcastListsChanged();
    void loginSucceeded();
    void loginFailed(const QString &detail);
    void registered();
    void recoveryTokenReady(const QString &token);
    void deviceLinkReady(const QString &token, const QString &deepLink);
    void incomingCall(const QString &callId, const QString &fromUserId, bool video);
    void realtimeEvent(const QString &type);

private:
    void setError(const QString &e);
    void setBusy(bool b);
    void setStatus(const QString &s);
    QNetworkRequest makeRequest(const QString &path) const;
    void applyAuth(const QJsonObject &obj);
    void uploadPrekeys(const QJsonObject &bundle);
    void fetchPeerBundleAndEncrypt(const QString &conversationId, const QString &peerId, const QString &plaintext,
                                   const QString &replyTo);
    void encryptForDevices(const QString &conversationId, const QString &peerId, const QStringList &deviceIds,
                           int index, const QString &plaintext, const QString &replyTo, QJsonObject deviceMap);
    void postCiphertext(const QString &conversationId, const QString &ciphertext, const QString &plaintext,
                        const QString &replyTo, const QJsonObject &deviceCiphertexts = {});
    void establishThenEncryptDevice(const QString &peerId, const QString &deviceId, const QString &plaintext,
                                    const std::function<void(bool, QString, QString)> &done);
    void decryptNext(int index);
    void handleRealtime(const QString &type, const QJsonObject &payload);
    void httpJson(const QString &method, const QString &path, const QJsonObject &body,
                  const std::function<void(bool, QJsonObject, QString)> &cb);

    SscSession *m_session = nullptr;
    SscCryptoBridge *m_crypto = nullptr;
    SscRealtime *m_realtime = nullptr;
    QNetworkAccessManager m_nam;

    QJsonArray m_conversations;
    QJsonArray m_messages;
    QJsonArray m_rawMessages;
    QJsonArray m_userSearchResults;
    QJsonArray m_devices;
    QJsonArray m_friendRequests;
    QJsonArray m_stories;
    QJsonArray m_groupMembers;
    QJsonArray m_broadcastLists;
    QJsonObject m_privacy;
    QJsonObject m_reactionSummary;

    QString m_lastError;
    QString m_activeConversationId;
    QString m_activePeerId;
    QString m_activeGroupId;
    QString m_typingLabel;
    QString m_apiBase = QStringLiteral("https://api.supersecurechat.com");
    QString m_captchaSiteKey;
    QString m_statusText;
    QString m_prekeyInfo = QStringLiteral("Prekeys: …");
    QString m_recoveryToken;
    QString m_pendingReplyTo;
    bool m_captchaRequired = true;
    bool m_busy = false;
    int m_decryptIndex = 0;
};
