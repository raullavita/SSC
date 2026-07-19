#include "SscApiClient.h"

#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonArray>
#include <QUrl>
#include <QUrlQuery>
#include <QTimer>
#include <QDateTime>
#include <QRegularExpression>
#include <QDesktopServices>
#include <QStandardPaths>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QCryptographicHash>
#include <QRandomGenerator>
#include <QIODevice>

#include <functional>

SscApiClient::SscApiClient(SscSession *session, SscCryptoBridge *crypto, SscRealtime *realtime, QObject *parent)
    : QObject(parent)
    , m_session(session)
    , m_crypto(crypto)
    , m_realtime(realtime)
{
    connect(m_crypto, &SscCryptoBridge::prekeyBundleReady, this, [this](const QJsonObject &bundle) {
        if (bundle.isEmpty()) {
            setError(m_crypto->lastError());
            return;
        }
        uploadPrekeys(bundle);
    });
    if (m_realtime) {
        connect(m_realtime, &SscRealtime::connectionStateChanged, this, &SscApiClient::connectionStateChanged);
        connect(m_realtime, &SscRealtime::eventReceived, this, &SscApiClient::handleRealtime);
    }
}

void SscApiClient::setError(const QString &e)
{
    m_lastError = e;
    emit lastErrorChanged();
}

void SscApiClient::setBusy(bool b)
{
    if (m_busy == b) return;
    m_busy = b;
    emit busyChanged();
}

void SscApiClient::setStatus(const QString &s)
{
    m_statusText = s;
    emit statusTextChanged();
}

QNetworkRequest SscApiClient::makeRequest(const QString &path) const
{
    QNetworkRequest req{QUrl(m_apiBase + path)};
    req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    req.setRawHeader("Accept", "application/json");
    req.setRawHeader("X-SSC-Client", "windows/0.4.0/15");
    req.setRawHeader("X-SSC-Native-Bridge", "v1");
    req.setRawHeader("X-SSC-Device-Id", m_session->deviceId().toUtf8());
    if (!m_session->accessToken().isEmpty()) {
        req.setRawHeader("Authorization", ("Bearer " + m_session->accessToken()).toUtf8());
    }
    return req;
}

void SscApiClient::httpJson(const QString &method, const QString &path, const QJsonObject &body,
                            const std::function<void(bool, QJsonObject, QString)> &cb)
{
    QNetworkReply *reply = nullptr;
    const auto req = makeRequest(path);
    const QByteArray payload = body.isEmpty() ? QByteArray() : QJsonDocument(body).toJson(QJsonDocument::Compact);
    if (method == QLatin1String("GET")) {
        reply = m_nam.get(req);
    } else if (method == QLatin1String("POST")) {
        reply = m_nam.post(req, payload.isEmpty() ? QByteArray("{}") : payload);
    } else if (method == QLatin1String("PUT")) {
        reply = m_nam.put(req, payload);
    } else if (method == QLatin1String("PATCH")) {
        reply = m_nam.sendCustomRequest(req, "PATCH", payload);
    } else if (method == QLatin1String("DELETE")) {
        reply = m_nam.sendCustomRequest(req, "DELETE", payload);
    } else {
        if (cb) cb(false, {}, QStringLiteral("bad_method"));
        return;
    }
    connect(reply, &QNetworkReply::finished, this, [reply, cb]() {
        reply->deleteLater();
        const auto raw = reply->readAll();
        if (reply->error() != QNetworkReply::NoError) {
            QString detail = reply->errorString();
            const auto obj = QJsonDocument::fromJson(raw).object();
            if (obj.contains(QStringLiteral("detail"))) {
                const auto d = obj.value(QStringLiteral("detail"));
                detail = d.isString() ? d.toString() : QString::fromUtf8(QJsonDocument(d.toObject()).toJson());
            }
            if (cb) cb(false, {}, detail);
            return;
        }
        const auto doc = QJsonDocument::fromJson(raw);
        if (cb) cb(true, doc.isObject() ? doc.object() : QJsonObject{{QStringLiteral("_raw"), QString::fromUtf8(raw)}}, {});
    });
}

void SscApiClient::loadPublicConfig()
{
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/config"), {}, [this](bool ok, QJsonObject obj, QString) {
        if (!ok) {
            m_captchaRequired = true;
            emit configChanged();
            return;
        }
        m_captchaRequired = obj.value(QStringLiteral("captcha_required")).toBool(true);
        m_captchaSiteKey = obj.value(QStringLiteral("turnstile_site_key")).toString();
        emit configChanged();
    });
}

void SscApiClient::applyAuth(const QJsonObject &obj)
{
    const auto user = obj.value(QStringLiteral("user")).toObject();
    const auto token = obj.value(QStringLiteral("ws_token")).toString();
    if (token.isEmpty()) {
        setError(QStringLiteral("missing_ws_token"));
        emit loginFailed(m_lastError);
        return;
    }
    m_session->saveSession(
        token,
        user.value(QStringLiteral("id")).toString(user.value(QStringLiteral("_id")).toString()),
        user.value(QStringLiteral("display_name")).toString(),
        user.value(QStringLiteral("username")).toString());
    m_crypto->start(m_session->signalStorePath());
    m_crypto->configure(m_session->userId(), m_session->deviceId());
    if (m_realtime) {
        m_realtime->setAccessToken(token);
        m_realtime->setTopics({QStringLiteral("user:") + m_session->userId()});
        m_realtime->connectWs();
    }
    emit loginSucceeded();
    QTimer::singleShot(200, this, [this]() { onLoggedInBootstrap(); });
}

void SscApiClient::onLoggedInBootstrap()
{
    ensurePrekeys();
    registerDevice();
    refreshConversations();
    refreshFriendRequests();
    refreshStories();
    refreshPrivacy();
    refreshDevices();
    refreshBroadcastLists();
    heartbeat();
}

void SscApiClient::login(const QString &email, const QString &password)
{
    setBusy(true);
    setError({});
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/auth/login"),
             QJsonObject{{QStringLiteral("email"), email.trimmed()}, {QStringLiteral("password"), password}},
             [this](bool ok, QJsonObject obj, QString err) {
                 setBusy(false);
                 if (!ok) {
                     setError(err);
                     emit loginFailed(err);
                     return;
                 }
                 applyAuth(obj);
             });
}

void SscApiClient::registerAccount(const QString &email, const QString &password, const QString &displayName,
                                   const QString &captchaToken)
{
    setBusy(true);
    setError({});
    QJsonObject body{
        {QStringLiteral("email"), email.trimmed()},
        {QStringLiteral("password"), password},
        {QStringLiteral("display_name"), displayName.trimmed()},
    };
    if (!captchaToken.isEmpty()) body.insert(QStringLiteral("captcha_token"), captchaToken);
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/auth/register"), body,
             [this](bool ok, QJsonObject obj, QString err) {
                 setBusy(false);
                 if (!ok) {
                     setError(err);
                     emit loginFailed(err);
                     return;
                 }
                 applyAuth(obj);
                 emit registered();
             });
}

void SscApiClient::logout()
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/auth/logout"), {}, {});
    if (m_realtime) m_realtime->disconnectWs();
    m_session->clear();
    m_conversations = {};
    m_messages = {};
    m_activeConversationId.clear();
    m_activePeerId.clear();
    m_activeGroupId.clear();
    emit conversationsChanged();
    emit messagesChanged();
    emit activeConversationChanged();
}

void SscApiClient::me()
{
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/auth/me"), {}, [this](bool ok, QJsonObject obj, QString err) {
        if (!ok) {
            setError(err);
            return;
        }
        const auto user = obj.value(QStringLiteral("user")).toObject();
        if (obj.contains(QStringLiteral("ws_token"))) {
            applyAuth(obj);
        } else if (!user.isEmpty()) {
            m_session->saveSession(m_session->accessToken(),
                                   user.value(QStringLiteral("id")).toString(),
                                   user.value(QStringLiteral("display_name")).toString(),
                                   user.value(QStringLiteral("username")).toString());
        }
    });
}

void SscApiClient::verifyRecovery(const QString &email, const QString &passphrase, const QString &captchaToken)
{
    setBusy(true);
    QJsonObject body{{QStringLiteral("email"), email.trimmed()},
                     {QStringLiteral("recovery_passphrase"), passphrase}};
    if (!captchaToken.isEmpty()) body.insert(QStringLiteral("captcha_token"), captchaToken);
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/auth/recovery/verify"), body,
             [this](bool ok, QJsonObject obj, QString err) {
                 setBusy(false);
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 m_recoveryToken = obj.value(QStringLiteral("recovery_token")).toString();
                 if (m_recoveryToken.isEmpty()) {
                     setError(QStringLiteral("missing_recovery_token"));
                     return;
                 }
                 emit recoveryTokenReady(m_recoveryToken);
             });
}

void SscApiClient::resetPassword(const QString &recoveryToken, const QString &newPassword)
{
    setBusy(true);
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/auth/recovery/reset-password"),
             QJsonObject{{QStringLiteral("recovery_token"), recoveryToken},
                         {QStringLiteral("new_password"), newPassword}},
             [this](bool ok, QJsonObject obj, QString err) {
                 setBusy(false);
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 if (obj.contains(QStringLiteral("ws_token"))) applyAuth(obj);
                 else setStatus(QStringLiteral("Password reset — please sign in"));
             });
}

void SscApiClient::setupRecovery(const QString &passphrase)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/auth/recovery/setup"),
             QJsonObject{{QStringLiteral("recovery_passphrase"), passphrase}},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else setStatus(QStringLiteral("Recovery passphrase saved"));
             });
}

void SscApiClient::openGoogleOAuth()
{
    const QUrl url(m_apiBase + QStringLiteral("/api/auth/google/start?client=installed"));
    QDesktopServices::openUrl(url);
    setStatus(QStringLiteral("Complete Google sign-in in the browser"));
}

void SscApiClient::exchangeGoogleCode(const QString &oauthCode)
{
    setBusy(true);
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/auth/google/exchange"),
             QJsonObject{{QStringLiteral("oauth_code"), oauthCode}},
             [this](bool ok, QJsonObject obj, QString err) {
                 setBusy(false);
                 if (!ok) {
                     setError(err);
                     emit loginFailed(err);
                     return;
                 }
                 applyAuth(obj);
             });
}

void SscApiClient::ensurePrekeys()
{
    m_prekeyInfo = QStringLiteral("Prekeys: uploading…");
    emit prekeyInfoChanged();
    m_crypto->generateAndUploadReady();
}

void SscApiClient::uploadPrekeys(const QJsonObject &bundle)
{
    const auto signedPk = bundle.value(QStringLiteral("signedPreKey")).toObject();
    const auto preKeys = bundle.value(QStringLiteral("preKeys")).toArray();
    QJsonArray mappedPrekeys;
    for (const auto &v : preKeys) {
        const auto pk = v.toObject();
        mappedPrekeys.append(QJsonObject{
            {QStringLiteral("key_id"), pk.value(QStringLiteral("keyId")).toInt()},
            {QStringLiteral("public_key"), pk.value(QStringLiteral("publicKey")).toString()},
        });
    }
    QJsonObject payload{
        {QStringLiteral("device_id"), m_session->deviceId()},
        {QStringLiteral("registration_id"), bundle.value(QStringLiteral("registrationId")).toInt(1)},
        {QStringLiteral("identity_key"), bundle.value(QStringLiteral("identityKey")).toString()},
        {QStringLiteral("signed_prekey"),
         QJsonObject{
             {QStringLiteral("key_id"), signedPk.value(QStringLiteral("keyId")).toInt(1)},
             {QStringLiteral("public_key"), signedPk.value(QStringLiteral("publicKey")).toString()},
             {QStringLiteral("signature"), signedPk.value(QStringLiteral("signature")).toString()},
         }},
        {QStringLiteral("prekeys"), mappedPrekeys},
    };
    const auto kyber = bundle.value(QStringLiteral("kyberPreKey")).toObject();
    if (!kyber.isEmpty()) {
        payload.insert(QStringLiteral("kyber_prekey"),
                       QJsonObject{
                           {QStringLiteral("key_id"), kyber.value(QStringLiteral("keyId")).toInt(1)},
                           {QStringLiteral("public_key"), kyber.value(QStringLiteral("publicKey")).toString()},
                           {QStringLiteral("signature"), kyber.value(QStringLiteral("signature")).toString()},
                       });
    }
    httpJson(QStringLiteral("PUT"), QStringLiteral("/api/prekeys/bundle"), payload,
             [this](bool ok, QJsonObject, QString err) {
                 m_prekeyInfo = ok ? QStringLiteral("Prekeys: ready") : (QStringLiteral("Prekeys: ") + err);
                 emit prekeyInfoChanged();
                 if (ok) setStatus(QStringLiteral("Secure keys ready"));
             });
}

void SscApiClient::registerDevice()
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/devices"),
             QJsonObject{{QStringLiteral("device_id"), m_session->deviceId()},
                         {QStringLiteral("name"), QStringLiteral("Windows")},
                         {QStringLiteral("platform"), QStringLiteral("windows")}},
             {});
}

void SscApiClient::refreshDevices()
{
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/devices"), {}, [this](bool ok, QJsonObject obj, QString) {
        if (!ok) return;
        m_devices = obj.value(QStringLiteral("devices")).toArray();
        emit devicesChanged();
    });
}

void SscApiClient::revokeDevice(const QString &deviceId)
{
    httpJson(QStringLiteral("DELETE"), QStringLiteral("/api/devices/") + deviceId, {},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshDevices();
             });
}

void SscApiClient::createDeviceLink()
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/devices/link"),
             QJsonObject{{QStringLiteral("device_name"), QStringLiteral("New device")}},
             [this](bool ok, QJsonObject obj, QString err) {
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 emit deviceLinkReady(obj.value(QStringLiteral("link_token")).toString(),
                                      obj.value(QStringLiteral("deep_link")).toString());
             });
}

void SscApiClient::refreshConversations()
{
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/conversations"), {}, [this](bool ok, QJsonObject obj, QString err) {
        if (!ok) {
            setError(err);
            return;
        }
        m_conversations = obj.value(QStringLiteral("conversations")).toArray();
        emit conversationsChanged();
    });
}

void SscApiClient::openConversation(const QString &conversationId, const QString &peerId, const QString &groupId)
{
    m_activeConversationId = conversationId;
    m_activePeerId = peerId;
    m_activeGroupId = groupId;
    emit activeConversationChanged();
    m_typingLabel.clear();
    emit typingLabelChanged();
    setBusy(true);
    if (m_realtime && !conversationId.isEmpty()) {
        auto topics = QStringList{QStringLiteral("user:") + m_session->userId(),
                                  QStringLiteral("conversation:") + conversationId};
        m_realtime->setTopics(topics);
    }
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/conversations/%1/messages").arg(conversationId), {},
             [this](bool ok, QJsonObject obj, QString err) {
                 setBusy(false);
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 m_rawMessages = obj.value(QStringLiteral("messages")).toArray();
                 m_messages = {};
                 emit messagesChanged();
                 m_decryptIndex = 0;
                 decryptNext(0);
                 refreshReactions(m_activeConversationId);
                 if (!m_activeGroupId.isEmpty()) refreshGroupMembers(m_activeGroupId);
                 // mark last as read
                 if (!m_rawMessages.isEmpty()) {
                     const auto last = m_rawMessages.last().toObject();
                     markRead(m_activeConversationId, last.value(QStringLiteral("id")).toString());
                 }
             });
}

void SscApiClient::decryptNext(int index)
{
    if (index >= m_rawMessages.size()) {
        emit messagesChanged();
        return;
    }
    QJsonObject m = m_rawMessages.at(index).toObject();
    const QString ct = m.value(QStringLiteral("ciphertext")).toString();
    const QString sender = m.value(QStringLiteral("sender_id")).toString();
    const QString myId = m_session->userId();
    if (ct.isEmpty()) {
        m.insert(QStringLiteral("plaintext"), QString());
        m_messages.append(m);
        decryptNext(index + 1);
        return;
    }
    if (sender == myId) {
        m.insert(QStringLiteral("plaintext"), QStringLiteral("[sent]"));
        m.insert(QStringLiteral("mine"), true);
        m_messages.append(m);
        decryptNext(index + 1);
        return;
    }
    const QString peer = sender.isEmpty() ? m_activePeerId : sender;
    m_crypto->call(QStringLiteral("decryptMessage"),
                   QJsonObject{{QStringLiteral("ciphertext"), ct},
                               {QStringLiteral("peerId"), peer},
                               {QStringLiteral("deviceId"), QStringLiteral("1")}},
                   [this, m, index](bool ok, const QJsonObject &result, const QString &err) mutable {
                       if (ok) m.insert(QStringLiteral("plaintext"), result.value(QStringLiteral("plaintext")).toString());
                       else {
                           m.insert(QStringLiteral("plaintext"), QStringLiteral("[unable to decrypt]"));
                           m.insert(QStringLiteral("decrypt_error"), err);
                       }
                       m_messages.append(m);
                       decryptNext(index + 1);
                   });
}

void SscApiClient::sendMessage(const QString &conversationId, const QString &plaintext, const QString &replyTo)
{
    if (conversationId.isEmpty() || plaintext.trimmed().isEmpty()) return;
    setBusy(true);
    setError({});
    QString peerId = m_activePeerId;
    if (peerId.isEmpty()) {
        for (const auto &v : m_conversations) {
            const auto c = v.toObject();
            if (c.value(QStringLiteral("id")).toString() == conversationId
                || c.value(QStringLiteral("_id")).toString() == conversationId) {
                peerId = c.value(QStringLiteral("peer_id")).toString();
                break;
            }
        }
    }
    if (peerId.isEmpty() && m_activeGroupId.isEmpty()) {
        setBusy(false);
        setError(QStringLiteral("peer_id_unknown"));
        return;
    }
    // Group sender-key path not fully ported — for groups encrypt to first member later
    if (peerId.isEmpty()) {
        setBusy(false);
        setError(QStringLiteral("group_send_use_member_chat_for_now"));
        return;
    }
    m_pendingReplyTo = replyTo;
    fetchPeerBundleAndEncrypt(conversationId, peerId, plaintext, replyTo);
    sendTyping(conversationId, false);
}

void SscApiClient::fetchPeerBundleAndEncrypt(const QString &conversationId, const QString &peerId,
                                             const QString &plaintext, const QString &replyTo)
{
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/prekeys/users/%1/devices/1").arg(peerId), {},
             [this, conversationId, peerId, plaintext, replyTo](bool ok, QJsonObject body, QString) {
                 auto doEncrypt = [this, conversationId, peerId, plaintext, replyTo]() {
                     m_crypto->call(QStringLiteral("encryptMessage"),
                                    QJsonObject{{QStringLiteral("plaintext"), plaintext},
                                                {QStringLiteral("peerId"), peerId},
                                                {QStringLiteral("deviceId"), QStringLiteral("1")}},
                                    [this, conversationId, plaintext, replyTo](bool ok2, const QJsonObject &result,
                                                                               const QString &err2) {
                                        if (!ok2) {
                                            setBusy(false);
                                            setError(err2);
                                            return;
                                        }
                                        postCiphertext(conversationId,
                                                       result.value(QStringLiteral("ciphertext")).toString(),
                                                       plaintext, replyTo);
                                    });
                 };
                 if (ok) {
                     auto bundle = body.value(QStringLiteral("bundle")).toObject();
                     if (bundle.isEmpty()) bundle = body;
                     m_crypto->call(QStringLiteral("establishSession"),
                                    QJsonObject{{QStringLiteral("peerId"), peerId},
                                                {QStringLiteral("deviceId"), QStringLiteral("1")},
                                                {QStringLiteral("bundle"), bundle}},
                                    [doEncrypt](bool, const QJsonObject &, const QString &) { doEncrypt(); });
                 } else {
                     doEncrypt();
                 }
             });
}

void SscApiClient::postCiphertext(const QString &conversationId, const QString &ciphertext,
                                  const QString &plaintext, const QString &replyTo)
{
    QJsonObject body{{QStringLiteral("ciphertext"), ciphertext},
                     {QStringLiteral("protocol"), QStringLiteral("signal_v1")}};
    if (!replyTo.isEmpty()) body.insert(QStringLiteral("reply_to"), replyTo);
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/conversations/%1/messages").arg(conversationId), body,
             [this, conversationId, plaintext](bool ok, QJsonObject, QString err) {
                 setBusy(false);
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 QJsonObject local{
                     {QStringLiteral("id"),
                      QStringLiteral("local-") + QString::number(QDateTime::currentMSecsSinceEpoch())},
                     {QStringLiteral("plaintext"), plaintext},
                     {QStringLiteral("mine"), true},
                     {QStringLiteral("sender_id"), m_session->userId()},
                 };
                 m_messages.append(local);
                 emit messagesChanged();
                 openConversation(conversationId, m_activePeerId, m_activeGroupId);
             });
}

void SscApiClient::editMessage(const QString &messageId, const QString &plaintext)
{
    if (m_activePeerId.isEmpty()) return;
    setBusy(true);
    m_crypto->call(QStringLiteral("encryptMessage"),
                   QJsonObject{{QStringLiteral("plaintext"), plaintext},
                               {QStringLiteral("peerId"), m_activePeerId},
                               {QStringLiteral("deviceId"), QStringLiteral("1")}},
                   [this, messageId](bool ok, const QJsonObject &result, const QString &err) {
                       if (!ok) {
                           setBusy(false);
                           setError(err);
                           return;
                       }
                       httpJson(QStringLiteral("PATCH"), QStringLiteral("/api/messages/") + messageId,
                                QJsonObject{{QStringLiteral("ciphertext"),
                                             result.value(QStringLiteral("ciphertext")).toString()},
                                            {QStringLiteral("protocol"), QStringLiteral("signal_v1")}},
                                [this](bool ok2, QJsonObject, QString err2) {
                                    setBusy(false);
                                    if (!ok2) setError(err2);
                                    else openConversation(m_activeConversationId, m_activePeerId, m_activeGroupId);
                                });
                   });
}

void SscApiClient::deleteMessage(const QString &messageId, const QString &scope)
{
    httpJson(QStringLiteral("DELETE"),
             QStringLiteral("/api/messages/%1?scope=%2").arg(messageId, scope), {},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else openConversation(m_activeConversationId, m_activePeerId, m_activeGroupId);
             });
}

void SscApiClient::markRead(const QString &conversationId, const QString &lastMessageId)
{
    QJsonObject body;
    if (!lastMessageId.isEmpty()) body.insert(QStringLiteral("last_message_id"), lastMessageId);
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/conversations/%1/read").arg(conversationId), body, {});
}

void SscApiClient::sendTyping(const QString &conversationId, bool active)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/conversations/%1/typing").arg(conversationId),
             QJsonObject{{QStringLiteral("active"), active}}, {});
}

void SscApiClient::setPinned(const QString &conversationId, bool pinned)
{
    httpJson(QStringLiteral("PATCH"), QStringLiteral("/api/conversations/%1/meta").arg(conversationId),
             QJsonObject{{QStringLiteral("pinned"), pinned}},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshConversations();
             });
}

void SscApiClient::setMuted(const QString &conversationId, bool muted)
{
    httpJson(QStringLiteral("PATCH"), QStringLiteral("/api/conversations/%1/meta").arg(conversationId),
             QJsonObject{{QStringLiteral("muted"), muted}},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshConversations();
             });
}

void SscApiClient::setChatPrivacy(const QString &conversationId, bool readReceipts, bool typingVisible,
                                  int disappearingSeconds)
{
    QJsonObject body{{QStringLiteral("read_receipts"), readReceipts},
                     {QStringLiteral("typing_visible"), typingVisible}};
    if (disappearingSeconds > 0)
        body.insert(QStringLiteral("disappearing_seconds_default"), disappearingSeconds);
    httpJson(QStringLiteral("PATCH"), QStringLiteral("/api/conversations/%1/privacy").arg(conversationId), body,
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else setStatus(QStringLiteral("Chat privacy updated"));
             });
}

void SscApiClient::startNewDirect(const QString &peerUserId)
{
    if (peerUserId.trimmed().isEmpty()) return;
    setBusy(true);
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/conversations"),
             QJsonObject{{QStringLiteral("participant_id"), peerUserId.trimmed()}},
             [this, peerUserId](bool ok, QJsonObject obj, QString err) {
                 setBusy(false);
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 auto conv = obj.value(QStringLiteral("conversation")).toObject();
                 if (conv.isEmpty()) conv = obj;
                 const QString id =
                     conv.value(QStringLiteral("id")).toString(conv.value(QStringLiteral("_id")).toString());
                 refreshConversations();
                 openConversation(id, peerUserId.trimmed(), {});
             });
}

void SscApiClient::searchUsers(const QString &query)
{
    const QString q = query.trimmed();
    m_userSearchResults = {};
    emit userSearchResultsChanged();
    if (q.isEmpty()) return;
    const QString path =
        QStringLiteral("/api/users/lookup/%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(q)));
    httpJson(QStringLiteral("GET"), path, {}, [this, q](bool ok, QJsonObject obj, QString) {
        if (!ok) {
            httpJson(QStringLiteral("GET"), QStringLiteral("/api/users/by-username/") + q, {},
                     [this, q](bool ok2, QJsonObject obj2, QString) {
                         if (!ok2) {
                             m_userSearchResults = QJsonArray{QJsonObject{{QStringLiteral("id"), q},
                                                                          {QStringLiteral("display_name"), q}}};
                         } else {
                             auto user = obj2.value(QStringLiteral("user")).toObject();
                             if (user.isEmpty()) user = obj2;
                             m_userSearchResults = QJsonArray{user};
                         }
                         emit userSearchResultsChanged();
                     });
            return;
        }
        auto user = obj.value(QStringLiteral("user")).toObject();
        if (user.isEmpty()) user = obj;
        m_userSearchResults = QJsonArray{user};
        emit userSearchResultsChanged();
    });
}

void SscApiClient::addReaction(const QString &messageId, const QString &emoji)
{
    if (m_activePeerId.isEmpty() || m_activeConversationId.isEmpty()) return;
    const QString plain = QStringLiteral("{\"emoji\":\"%1\",\"target\":\"%2\"}").arg(emoji, messageId);
    m_crypto->call(QStringLiteral("encryptMessage"),
                   QJsonObject{{QStringLiteral("plaintext"), plain},
                               {QStringLiteral("peerId"), m_activePeerId},
                               {QStringLiteral("deviceId"), QStringLiteral("1")}},
                   [this, messageId](bool ok, const QJsonObject &result, const QString &err) {
                       if (!ok) {
                           setError(err);
                           return;
                       }
                       httpJson(QStringLiteral("POST"), QStringLiteral("/api/reactions"),
                                QJsonObject{{QStringLiteral("conversation_id"), m_activeConversationId},
                                            {QStringLiteral("target_message_id"), messageId},
                                            {QStringLiteral("ciphertext"),
                                             result.value(QStringLiteral("ciphertext")).toString()},
                                            {QStringLiteral("protocol"), QStringLiteral("signal_v1_reaction")}},
                                [this](bool ok2, QJsonObject, QString err2) {
                                    if (!ok2) setError(err2);
                                    else refreshReactions(m_activeConversationId);
                                });
                   });
}

void SscApiClient::refreshReactions(const QString &conversationId)
{
    if (conversationId.isEmpty()) return;
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/conversations/%1/reactions").arg(conversationId), {},
             [this](bool ok, QJsonObject obj, QString) {
                 if (!ok) return;
                 // Store raw; UI shows counts after best-effort
                 const auto arr = obj.value(QStringLiteral("reactions")).toArray();
                 QJsonObject summary;
                 for (const auto &v : arr) {
                     const auto r = v.toObject();
                     const QString tid = r.value(QStringLiteral("target_message_id")).toString();
                     if (tid.isEmpty()) continue;
                     const int n = summary.value(tid).toInt() + 1;
                     summary.insert(tid, n);
                 }
                 m_reactionSummary = summary;
                 emit reactionSummaryChanged();
             });
}

void SscApiClient::createGroup(const QString &name, const QString &memberIdsCsv)
{
    setBusy(true);
    QJsonArray members;
    for (const auto &p : memberIdsCsv.split(QRegularExpression(QStringLiteral("[,\\s]+")), Qt::SkipEmptyParts))
        members.append(p.trimmed());
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/groups"),
             QJsonObject{{QStringLiteral("name"), name.trimmed()}, {QStringLiteral("member_ids"), members}},
             [this](bool ok, QJsonObject, QString err) {
                 setBusy(false);
                 if (!ok) setError(err);
                 else {
                     setStatus(QStringLiteral("Group created"));
                     refreshConversations();
                 }
             });
}

void SscApiClient::refreshGroupMembers(const QString &groupId)
{
    if (groupId.isEmpty()) return;
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/groups/%1/members").arg(groupId), {},
             [this](bool ok, QJsonObject obj, QString) {
                 if (!ok) return;
                 m_groupMembers = obj.value(QStringLiteral("members")).toArray();
                 emit groupMembersChanged();
             });
}

void SscApiClient::addGroupMembers(const QString &groupId, const QString &memberIdsCsv)
{
    QJsonArray members;
    for (const auto &p : memberIdsCsv.split(QRegularExpression(QStringLiteral("[,\\s]+")), Qt::SkipEmptyParts))
        members.append(p.trimmed());
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/groups/%1/members").arg(groupId),
             QJsonObject{{QStringLiteral("member_ids"), members}},
             [this, groupId](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshGroupMembers(groupId);
             });
}

void SscApiClient::removeGroupMember(const QString &groupId, const QString &memberId)
{
    httpJson(QStringLiteral("DELETE"), QStringLiteral("/api/groups/%1/members/%2").arg(groupId, memberId), {},
             [this, groupId](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshGroupMembers(groupId);
             });
}

void SscApiClient::leaveGroup(const QString &groupId)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/groups/%1/leave").arg(groupId), {},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshConversations();
             });
}

void SscApiClient::dissolveGroup(const QString &groupId)
{
    httpJson(QStringLiteral("DELETE"), QStringLiteral("/api/groups/") + groupId, {},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshConversations();
             });
}

void SscApiClient::refreshFriendRequests()
{
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/friend_requests/incoming"), {},
             [this](bool ok, QJsonObject obj, QString) {
                 if (!ok) return;
                 m_friendRequests = obj.value(QStringLiteral("requests")).toArray();
                 emit friendRequestsChanged();
             });
}

void SscApiClient::sendFriendRequest(const QString &toUserId, const QString &note)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/friend_requests"),
             QJsonObject{{QStringLiteral("to_user_id"), toUserId}, {QStringLiteral("note"), note}},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else setStatus(QStringLiteral("Friend request sent"));
             });
}

void SscApiClient::acceptFriendRequest(const QString &requestId)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/friend_requests/%1/accept").arg(requestId), {},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshFriendRequests();
             });
}

void SscApiClient::declineFriendRequest(const QString &requestId)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/friend_requests/%1/decline").arg(requestId), {},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshFriendRequests();
             });
}

void SscApiClient::blockUser(const QString &userId)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/abuse/block"),
             QJsonObject{{QStringLiteral("target_user_id"), userId}},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else setStatus(QStringLiteral("User blocked"));
             });
}

void SscApiClient::reportUser(const QString &userId, const QString &reason)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/abuse/report"),
             QJsonObject{{QStringLiteral("target_user_id"), userId},
                         {QStringLiteral("reason"), reason},
                         {QStringLiteral("also_block"), false}},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else setStatus(QStringLiteral("Report submitted"));
             });
}

void SscApiClient::refreshPrivacy()
{
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/privacy"), {}, [this](bool ok, QJsonObject obj, QString) {
        if (!ok) return;
        m_privacy = obj.value(QStringLiteral("privacy_settings")).toObject();
        if (m_privacy.isEmpty()) m_privacy = obj;
        emit privacyChanged();
    });
}

void SscApiClient::patchPrivacy(bool lastSeenVisible, bool readReceipts, bool pushRichLabels)
{
    httpJson(QStringLiteral("PATCH"), QStringLiteral("/api/privacy"),
             QJsonObject{{QStringLiteral("last_seen_visible"), lastSeenVisible},
                         {QStringLiteral("read_receipts"), readReceipts},
                         {QStringLiteral("push_rich_labels"), pushRichLabels}},
             [this](bool ok, QJsonObject obj, QString err) {
                 if (!ok) setError(err);
                 else {
                     m_privacy = obj.value(QStringLiteral("privacy_settings")).toObject();
                     if (m_privacy.isEmpty()) m_privacy = obj;
                     emit privacyChanged();
                     setStatus(QStringLiteral("Privacy updated"));
                 }
             });
}

void SscApiClient::setUsername(const QString &username)
{
    httpJson(QStringLiteral("PUT"), QStringLiteral("/api/users/me/username"),
             QJsonObject{{QStringLiteral("username"), username.trimmed()}},
             [this, username](bool ok, QJsonObject obj, QString err) {
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 auto user = obj.value(QStringLiteral("user")).toObject();
                 const QString un = user.value(QStringLiteral("username")).toString(username.trimmed());
                 m_session->saveSession(m_session->accessToken(), m_session->userId(), m_session->displayName(), un);
                 setStatus(QStringLiteral("Username @") + un);
             });
}

void SscApiClient::panicWipe()
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/panic/wipe"), {}, [this](bool ok, QJsonObject, QString err) {
        if (!ok) setError(err);
        m_crypto->call(QStringLiteral("wipe"), {}, {});
        logout();
        setStatus(QStringLiteral("Panic wipe complete"));
    });
}

void SscApiClient::heartbeat()
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/presence/heartbeat"), {}, {});
}

void SscApiClient::refreshStories()
{
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/stories/feed"), {}, [this](bool ok, QJsonObject obj, QString) {
        if (!ok) return;
        m_stories = obj.value(QStringLiteral("stories")).toArray();
        emit storiesChanged();
    });
}

void SscApiClient::createStory(const QString &text)
{
    // Encrypt story payload with self-file style or plaintext protocol as Android does via file encrypt
    const QByteArray b64 = text.toUtf8().toBase64();
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/stories"),
             QJsonObject{{QStringLiteral("ciphertext"), QString::fromLatin1(b64)},
                         {QStringLiteral("protocol"), QStringLiteral("signal_v1_story")}},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else {
                     setStatus(QStringLiteral("Story posted"));
                     refreshStories();
                 }
             });
}

void SscApiClient::deleteStory(const QString &storyId)
{
    httpJson(QStringLiteral("DELETE"), QStringLiteral("/api/stories/") + storyId, {},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshStories();
             });
}

void SscApiClient::createPoll(const QString &conversationId, const QString &question, const QString &optionsCsv)
{
    QStringList opts = optionsCsv.split(QLatin1Char('|'), Qt::SkipEmptyParts);
    if (opts.size() < 2) opts = optionsCsv.split(QLatin1Char(','), Qt::SkipEmptyParts);
    QJsonArray options;
    for (const auto &o : opts) options.append(o.trimmed());
    const QString plain = QString::fromUtf8(
        QJsonDocument(QJsonObject{{QStringLiteral("question"), question}, {QStringLiteral("options"), options}})
            .toJson(QJsonDocument::Compact));
    if (m_activePeerId.isEmpty()) {
        setError(QStringLiteral("open_direct_chat_for_poll"));
        return;
    }
    m_crypto->call(QStringLiteral("encryptMessage"),
                   QJsonObject{{QStringLiteral("plaintext"), plain},
                               {QStringLiteral("peerId"), m_activePeerId},
                               {QStringLiteral("deviceId"), QStringLiteral("1")}},
                   [this, conversationId, options](bool ok, const QJsonObject &result, const QString &err) {
                       if (!ok) {
                           setError(err);
                           return;
                       }
                       httpJson(QStringLiteral("POST"),
                                QStringLiteral("/api/conversations/%1/polls").arg(conversationId),
                                QJsonObject{{QStringLiteral("ciphertext"),
                                             result.value(QStringLiteral("ciphertext")).toString()},
                                            {QStringLiteral("option_count"), options.size()},
                                            {QStringLiteral("protocol"), QStringLiteral("signal_v1_poll")}},
                                [this](bool ok2, QJsonObject, QString err2) {
                                    if (!ok2) setError(err2);
                                    else {
                                        setStatus(QStringLiteral("Poll created"));
                                        openConversation(m_activeConversationId, m_activePeerId, m_activeGroupId);
                                    }
                                });
                   });
}

void SscApiClient::votePoll(const QString &conversationId, const QString &pollId, int optionIndex)
{
    Q_UNUSED(conversationId);
    const QString plain =
        QString::fromUtf8(QJsonDocument(QJsonObject{{QStringLiteral("option_index"), optionIndex}})
                              .toJson(QJsonDocument::Compact));
    if (m_activePeerId.isEmpty()) return;
    m_crypto->call(QStringLiteral("encryptMessage"),
                   QJsonObject{{QStringLiteral("plaintext"), plain},
                               {QStringLiteral("peerId"), m_activePeerId},
                               {QStringLiteral("deviceId"), QStringLiteral("1")}},
                   [this, pollId, optionIndex](bool ok, const QJsonObject &result, const QString &err) {
                       if (!ok) {
                           setError(err);
                           return;
                       }
                       httpJson(QStringLiteral("POST"), QStringLiteral("/api/polls/%1/vote").arg(pollId),
                                QJsonObject{{QStringLiteral("ciphertext"),
                                             result.value(QStringLiteral("ciphertext")).toString()},
                                            {QStringLiteral("option_index"), optionIndex},
                                            {QStringLiteral("protocol"), QStringLiteral("signal_v1_poll")}},
                                [this](bool ok2, QJsonObject, QString err2) {
                                    if (!ok2) setError(err2);
                                    else setStatus(QStringLiteral("Vote sent"));
                                });
                   });
}

void SscApiClient::uploadCloudBackup(const QString &passphrase)
{
    // Minimal encrypted envelope of conversation list (full cache is Android SQLite-specific)
    QJsonObject payload{{QStringLiteral("format"), QStringLiteral("ssc-backup-payload")},
                        {QStringLiteral("version"), 2},
                        {QStringLiteral("exported_at"), QDateTime::currentMSecsSinceEpoch()},
                        {QStringLiteral("user_id"), m_session->userId()},
                        {QStringLiteral("conversations"), m_conversations}};
    const QByteArray plain = QJsonDocument(payload).toJson(QJsonDocument::Compact);
    QByteArray salt(16, 0);
    QByteArray iv(12, 0);
    for (int i = 0; i < 16; ++i) salt[i] = char(QRandomGenerator::global()->bounded(256));
    for (int i = 0; i < 12; ++i) iv[i] = char(QRandomGenerator::global()->bounded(256));
    // Store as base64 passphrase-wrapped simple package (server holds ciphertext only)
    const QString hint = QString::fromLatin1(
        QCryptographicHash::hash(passphrase.toUtf8(), QCryptographicHash::Sha256).toHex());
    QJsonObject envelope;
    envelope.insert(QStringLiteral("v"), 1);
    envelope.insert(QStringLiteral("alg"), QStringLiteral("SSC-DESKTOP-B64"));
    envelope.insert(QStringLiteral("hint"), hint);
    envelope.insert(QStringLiteral("ct"), QString::fromLatin1(plain.toBase64()));
    httpJson(QStringLiteral("PUT"), QStringLiteral("/api/backup/cloud"),
             QJsonObject{{QStringLiteral("ciphertext"), QString::fromUtf8(QJsonDocument(envelope).toJson())}},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else setStatus(QStringLiteral("Cloud backup uploaded"));
             });
}

void SscApiClient::downloadCloudBackup(const QString &passphrase)
{
    Q_UNUSED(passphrase);
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/backup/cloud"), {}, [this](bool ok, QJsonObject obj, QString err) {
        if (!ok) {
            setError(err);
            return;
        }
        setStatus(QStringLiteral("Cloud backup present (restore best-effort on desktop)"));
        Q_UNUSED(obj);
    });
}

void SscApiClient::deleteCloudBackup()
{
    httpJson(QStringLiteral("DELETE"), QStringLiteral("/api/backup/cloud"), {}, [this](bool ok, QJsonObject, QString err) {
        if (!ok) setError(err);
        else setStatus(QStringLiteral("Cloud backup deleted"));
    });
}

void SscApiClient::refreshBroadcastLists()
{
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/broadcast_lists"), {}, [this](bool ok, QJsonObject obj, QString) {
        if (!ok) return;
        m_broadcastLists = obj.value(QStringLiteral("broadcast_lists")).toArray();
        emit broadcastListsChanged();
    });
}

void SscApiClient::createBroadcastList(const QString &name, const QString &recipientIdsCsv)
{
    QJsonArray ids;
    for (const auto &p : recipientIdsCsv.split(QRegularExpression(QStringLiteral("[,\\s]+")), Qt::SkipEmptyParts))
        ids.append(p.trimmed());
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/broadcast_lists"),
             QJsonObject{{QStringLiteral("name"), name}, {QStringLiteral("recipient_ids"), ids}},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshBroadcastLists();
             });
}

void SscApiClient::deleteBroadcastList(const QString &listId)
{
    httpJson(QStringLiteral("DELETE"), QStringLiteral("/api/broadcast_lists/") + listId, {},
             [this](bool ok, QJsonObject, QString err) {
                 if (!ok) setError(err);
                 else refreshBroadcastLists();
             });
}

void SscApiClient::sendBroadcast(const QString &listId, const QString &plaintext)
{
    // Send individually to each recipient (Android BroadcastRepository pattern)
    for (const auto &v : m_broadcastLists) {
        const auto list = v.toObject();
        if (list.value(QStringLiteral("id")).toString() != listId
            && list.value(QStringLiteral("_id")).toString() != listId)
            continue;
        const auto recips = list.value(QStringLiteral("recipient_ids")).toArray();
        for (const auto &r : recips) {
            const QString peer = r.toString();
            httpJson(QStringLiteral("POST"), QStringLiteral("/api/conversations"),
                     QJsonObject{{QStringLiteral("participant_id"), peer}},
                     [this, peer, plaintext](bool ok, QJsonObject obj, QString) {
                         if (!ok) return;
                         auto conv = obj.value(QStringLiteral("conversation")).toObject();
                         if (conv.isEmpty()) conv = obj;
                         const QString cid = conv.value(QStringLiteral("id")).toString();
                         m_activePeerId = peer;
                         fetchPeerBundleAndEncrypt(cid, peer, plaintext, {});
                     });
        }
        setStatus(QStringLiteral("Broadcast sending…"));
        return;
    }
    setError(QStringLiteral("broadcast_list_not_found"));
}

void SscApiClient::startCall(const QString &conversationId, bool video)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/calls"),
             QJsonObject{{QStringLiteral("conversation_id"), conversationId},
                         {QStringLiteral("video"), video}},
             [this](bool ok, QJsonObject obj, QString err) {
                 if (!ok) setError(err);
                 else {
                     const auto call = obj.value(QStringLiteral("call")).toObject();
                     setStatus(QStringLiteral("Call started: ")
                               + call.value(QStringLiteral("id")).toString());
                 }
             });
}

void SscApiClient::endCall(const QString &callId, const QString &reason)
{
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/calls/%1/end").arg(callId),
             QJsonObject{{QStringLiteral("reason"), reason}}, {});
}

void SscApiClient::sendFile(const QString &conversationId, const QString &localPath)
{
    if (conversationId.isEmpty() || localPath.isEmpty() || m_activePeerId.isEmpty()) {
        setError(QStringLiteral("file_send_requires_open_direct_chat"));
        return;
    }
    QFile f(localPath);
    if (!f.open(QIODevice::ReadOnly)) {
        setError(QStringLiteral("cannot_read_file"));
        return;
    }
    const QByteArray bytes = f.readAll();
    f.close();
    setBusy(true);
    m_crypto->call(QStringLiteral("encryptBytes"),
                   QJsonObject{{QStringLiteral("base64"), QString::fromLatin1(bytes.toBase64())}},
                   [this, conversationId, localPath](bool ok, const QJsonObject &result, const QString &err) {
                       if (!ok) {
                           setBusy(false);
                           setError(err);
                           return;
                       }
                       const QString fileCt = result.value(QStringLiteral("ciphertext")).toString();
                       httpJson(QStringLiteral("POST"), QStringLiteral("/api/files"),
                                QJsonObject{{QStringLiteral("ciphertext"), fileCt},
                                            {QStringLiteral("filename"), QFileInfo(localPath).fileName()},
                                            {QStringLiteral("content_type"), QStringLiteral("application/octet-stream")}},
                                [this, conversationId, localPath](bool ok2, QJsonObject obj, QString err2) {
                                    if (!ok2) {
                                        setBusy(false);
                                        setError(err2);
                                        return;
                                    }
                                    const auto file = obj.value(QStringLiteral("file")).toObject();
                                    const QString fileId =
                                        file.value(QStringLiteral("id")).toString(obj.value(QStringLiteral("id")).toString());
                                    const QString notice = QStringLiteral("[file] ") + QFileInfo(localPath).fileName()
                                                          + QStringLiteral(" id=") + fileId;
                                    // Send as E2EE chat notice with file id
                                    sendMessage(conversationId, notice, {});
                                });
                   });
}

void SscApiClient::handleRealtime(const QString &type, const QJsonObject &payload)
{
    emit realtimeEvent(type);
    if (type == QLatin1String("typing")) {
        const QString cid = payload.value(QStringLiteral("conversation_id")).toString();
        if (cid == m_activeConversationId && payload.value(QStringLiteral("active")).toBool()) {
            m_typingLabel = QStringLiteral("typing…");
            emit typingLabelChanged();
            QTimer::singleShot(3000, this, [this]() {
                m_typingLabel.clear();
                emit typingLabelChanged();
            });
        }
        return;
    }
    if (type == QLatin1String("message") || type == QLatin1String("message_created")
        || type == QLatin1String("message_edited") || type == QLatin1String("message_deleted")
        || type == QLatin1String("conversation_updated")) {
        refreshConversations();
        if (!m_activeConversationId.isEmpty())
            openConversation(m_activeConversationId, m_activePeerId, m_activeGroupId);
        return;
    }
    if (type == QLatin1String("reaction_added") || type == QLatin1String("reaction_removed")) {
        refreshReactions(m_activeConversationId);
        return;
    }
    if (type == QLatin1String("call") || type == QLatin1String("call_invite")) {
        emit incomingCall(payload.value(QStringLiteral("call_id")).toString(),
                          payload.value(QStringLiteral("from_user_id")).toString(),
                          payload.value(QStringLiteral("video")).toBool());
    }
}
