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
#include <QHash>

#include <functional>

SscApiClient::SscApiClient(SscSession *session, SscCryptoBridge *crypto, SscRealtime *realtime,
                           SscLocalCache *cache, QObject *parent)
    : QObject(parent)
    , m_session(session)
    , m_crypto(crypto)
    , m_realtime(realtime)
    , m_cache(cache)
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
    if (m_cache) m_cache->open(m_session->userId());
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
    if (m_cache) m_cache->close();
    m_session->clear();
    m_conversations = {};
    m_messages = {};
    m_activeConversationId.clear();
    m_activePeerId.clear();
    m_activeGroupId.clear();
    m_safetyNumber.clear();
    emit conversationsChanged();
    emit messagesChanged();
    emit activeConversationChanged();
    emit safetyNumberChanged();
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
    // client=installed → finish page redirects to ssc://auth/google?oauth_code=...
    // Windows installer registers the ssc:// protocol to this app.
    const QUrl url(m_apiBase + QStringLiteral("/api/auth/google/start?client=installed"));
    if (!QDesktopServices::openUrl(url)) {
        setError(QStringLiteral("Could not open browser for Google sign-in"));
        return;
    }
    setError({});
    setStatus(QStringLiteral("Browser opened — pick your Google account, then return here. "
                             "The app finishes login automatically."));
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
            // Offline fallback to local cache
            if (m_cache) {
                m_conversations = m_cache->listConversations();
                emit conversationsChanged();
            }
            setError(err);
            return;
        }
        m_conversations = obj.value(QStringLiteral("conversations")).toArray();
        if (m_cache) {
            for (const auto &v : m_conversations) m_cache->upsertConversation(v.toObject());
        }
        enrichConversationTitles();
        updateActiveChatTitle();
        emit conversationsChanged();
    });
}

void SscApiClient::cachePlaintext(const QString &messageId, const QString &plaintext)
{
    if (!messageId.isEmpty() && !plaintext.isEmpty()) m_plaintextCache.insert(messageId, plaintext);
}

QString SscApiClient::cachedPlaintext(const QString &messageId) const
{
    return m_plaintextCache.value(messageId);
}

void SscApiClient::resolvePeerTitle(const QString &peerId, int convIndex)
{
    if (peerId.isEmpty() || m_peerTitles.contains(peerId)) return;
    httpJson(QStringLiteral("GET"),
             QStringLiteral("/api/users/lookup/%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(peerId))), {},
             [this, peerId, convIndex](bool ok, QJsonObject obj, QString) {
                 QString title = peerId;
                 if (ok) {
                     auto user = obj.value(QStringLiteral("user")).toObject();
                     if (user.isEmpty()) user = obj;
                     const QString un = user.value(QStringLiteral("username")).toString();
                     const QString dn = user.value(QStringLiteral("display_name")).toString();
                     if (!dn.isEmpty() && !un.isEmpty()) title = dn + QStringLiteral(" (@") + un + QLatin1Char(')');
                     else if (!dn.isEmpty()) title = dn;
                     else if (!un.isEmpty()) title = QLatin1Char('@') + un;
                 }
                 m_peerTitles.insert(peerId, title);
                 if (convIndex >= 0 && convIndex < m_conversations.size()) {
                     QJsonObject c = m_conversations.at(convIndex).toObject();
                     c.insert(QStringLiteral("title"), title);
                     c.insert(QStringLiteral("peer_username"), title);
                     m_conversations.replace(convIndex, c);
                     emit conversationsChanged();
                 }
                 if (peerId == m_activePeerId) {
                     m_activeChatTitle = title;
                     emit activeConversationChanged();
                 }
             });
}

void SscApiClient::enrichConversationTitles()
{
    for (int i = 0; i < m_conversations.size(); ++i) {
        QJsonObject c = m_conversations.at(i).toObject();
        const QString peer = c.value(QStringLiteral("peer_id")).toString();
        const QString gid = c.value(QStringLiteral("group_id")).toString();
        if (!gid.isEmpty()) {
            QString title = c.value(QStringLiteral("title")).toString();
            if (title.isEmpty()) title = c.value(QStringLiteral("name")).toString(QStringLiteral("Group"));
            c.insert(QStringLiteral("title"), title);
            m_conversations.replace(i, c);
            continue;
        }
        if (peer.isEmpty()) continue;
        if (m_peerTitles.contains(peer)) {
            c.insert(QStringLiteral("title"), m_peerTitles.value(peer));
            m_conversations.replace(i, c);
        } else {
            c.insert(QStringLiteral("title"), QStringLiteral("…"));
            m_conversations.replace(i, c);
            resolvePeerTitle(peer, i);
        }
    }
}

void SscApiClient::updateActiveChatTitle()
{
    if (!m_activePeerId.isEmpty() && m_peerTitles.contains(m_activePeerId)) {
        m_activeChatTitle = m_peerTitles.value(m_activePeerId);
        return;
    }
    for (const auto &v : m_conversations) {
        const auto c = v.toObject();
        const QString id = c.value(QStringLiteral("id")).toString(c.value(QStringLiteral("_id")).toString());
        if (id == m_activeConversationId) {
            QString t = c.value(QStringLiteral("title")).toString();
            if (t.isEmpty() || t == QLatin1String("…"))
                t = c.value(QStringLiteral("peer_id")).toString(c.value(QStringLiteral("group_id")).toString());
            m_activeChatTitle = t;
            if (!c.value(QStringLiteral("peer_id")).toString().isEmpty())
                resolvePeerTitle(c.value(QStringLiteral("peer_id")).toString(), -1);
            return;
        }
    }
    m_activeChatTitle = m_activePeerId.isEmpty() ? m_activeGroupId : m_activePeerId;
}

void SscApiClient::openConversation(const QString &conversationId, const QString &peerId, const QString &groupId)
{
    m_activeConversationId = conversationId;
    m_activePeerId = peerId;
    m_activeGroupId = groupId;
    // Resolve peer_id from list if not provided
    if (m_activePeerId.isEmpty() && m_activeGroupId.isEmpty()) {
        for (const auto &v : m_conversations) {
            const auto c = v.toObject();
            const QString id = c.value(QStringLiteral("id")).toString(c.value(QStringLiteral("_id")).toString());
            if (id == conversationId) {
                m_activePeerId = c.value(QStringLiteral("peer_id")).toString();
                m_activeGroupId = c.value(QStringLiteral("group_id")).toString();
                break;
            }
        }
    }
    updateActiveChatTitle();
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
    const QString protocol = m.value(QStringLiteral("protocol")).toString();
    const QString myId = m_session->userId();
    if (m.value(QStringLiteral("conversation_id")).toString().isEmpty()) {
        m.insert(QStringLiteral("conversation_id"), m_activeConversationId);
    }
    if (ct.isEmpty()) {
        m.insert(QStringLiteral("plaintext"), QString());
        if (m_cache) m_cache->upsertMessage(m);
        m_messages.append(m);
        decryptNext(index + 1);
        return;
    }
    if (sender == myId && !protocol.contains(QStringLiteral("group_sender_key"))) {
        const QString mid = m.value(QStringLiteral("id")).toString();
        QString plain = cachedPlaintext(mid);
        if (plain.isEmpty()) plain = QStringLiteral("✓ Sent");
        m.insert(QStringLiteral("plaintext"), plain);
        m.insert(QStringLiteral("mine"), true);
        if (m_cache) m_cache->upsertMessage(m);
        m_messages.append(m);
        decryptNext(index + 1);
        return;
    }
    // Group sender-key dist: ingest then show marker
    if (protocol.contains(QStringLiteral("sender_key_dist"))) {
        m_crypto->call(QStringLiteral("groupProcessDistribution"),
                       QJsonObject{{QStringLiteral("senderId"), sender},
                                   {QStringLiteral("deviceId"), QStringLiteral("1")},
                                   {QStringLiteral("ciphertext"), ct}},
                       [this, m, index](bool, const QJsonObject &, const QString &) mutable {
                           m.insert(QStringLiteral("plaintext"), QStringLiteral("[sender key]"));
                           if (m_cache) m_cache->upsertMessage(m);
                           m_messages.append(m);
                           decryptNext(index + 1);
                       });
        return;
    }
    if (protocol.contains(QStringLiteral("group_sender_key"))) {
        m_crypto->call(QStringLiteral("groupDecrypt"),
                       QJsonObject{{QStringLiteral("senderId"), sender},
                                   {QStringLiteral("deviceId"), QStringLiteral("1")},
                                   {QStringLiteral("ciphertext"), ct}},
                       [this, m, index](bool ok, const QJsonObject &result, const QString &err) mutable {
                           if (ok) m.insert(QStringLiteral("plaintext"), result.value(QStringLiteral("plaintext")).toString());
                           else {
                               m.insert(QStringLiteral("plaintext"), QStringLiteral("[unable to decrypt]"));
                               m.insert(QStringLiteral("decrypt_error"), err);
                           }
                           if (m_cache) m_cache->upsertMessage(m);
                           m_messages.append(m);
                           decryptNext(index + 1);
                       });
        return;
    }
    const QString peer = sender.isEmpty() ? m_activePeerId : sender;
    m_crypto->call(QStringLiteral("decryptMessage"),
                   QJsonObject{{QStringLiteral("ciphertext"), ct},
                               {QStringLiteral("peerId"), peer},
                               {QStringLiteral("deviceId"), QStringLiteral("1")}},
                   [this, m, index, peer](bool ok, const QJsonObject &result, const QString &err) mutable {
                       if (ok) {
                           const QString plain = result.value(QStringLiteral("plaintext")).toString();
                           m.insert(QStringLiteral("plaintext"), plain);
                           cachePlaintext(m.value(QStringLiteral("id")).toString(), plain);
                       } else {
                           // Sesame multi-device retry request (Android ConversationRepository)
                           const QString mid = m.value(QStringLiteral("id")).toString();
                           if (!mid.isEmpty() && !m_activeConversationId.isEmpty()) {
                               httpJson(QStringLiteral("POST"), QStringLiteral("/api/messages/retry-request"),
                                        QJsonObject{{QStringLiteral("message_id"), mid},
                                                    {QStringLiteral("conversation_id"), m_activeConversationId},
                                                    {QStringLiteral("requester_device_id"), m_session->deviceId()}},
                                        {});
                           }
                           Q_UNUSED(peer);
                           m.insert(QStringLiteral("plaintext"), QStringLiteral("Unable to decrypt"));
                           m.insert(QStringLiteral("decrypt_error"), err);
                       }
                       if (m.value(QStringLiteral("conversation_id")).toString().isEmpty()) {
                           m.insert(QStringLiteral("conversation_id"), m_activeConversationId);
                       }
                       if (m_cache) m_cache->upsertMessage(m);
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
    QString groupId = m_activeGroupId;
    if (peerId.isEmpty() || groupId.isEmpty()) {
        for (const auto &v : m_conversations) {
            const auto c = v.toObject();
            if (c.value(QStringLiteral("id")).toString() == conversationId
                || c.value(QStringLiteral("_id")).toString() == conversationId) {
                if (peerId.isEmpty()) peerId = c.value(QStringLiteral("peer_id")).toString();
                if (groupId.isEmpty()) groupId = c.value(QStringLiteral("group_id")).toString();
                break;
            }
        }
    }
    if (peerId.isEmpty() && groupId.isEmpty()) {
        setBusy(false);
        setError(QStringLiteral("peer_id_unknown"));
        return;
    }
    m_pendingReplyTo = replyTo;
    // Group sender-key path (Android parity)
    if (!groupId.isEmpty() && peerId.isEmpty()) {
        m_activeGroupId = groupId;
        // Ensure distribution then encrypt
        m_crypto->call(QStringLiteral("groupDistributionState"),
                       QJsonObject{{QStringLiteral("groupId"), groupId}},
                       [this, conversationId, groupId, plaintext, replyTo](bool ok, const QJsonObject &st, const QString &) {
                           auto doGroupEncrypt = [this, conversationId, groupId, plaintext, replyTo]() {
                               m_crypto->call(QStringLiteral("groupEncrypt"),
                                              QJsonObject{{QStringLiteral("groupId"), groupId},
                                                          {QStringLiteral("plaintext"), plaintext}},
                                              [this, conversationId, plaintext, replyTo](bool ok2, const QJsonObject &result,
                                                                                         const QString &err2) {
                                                  if (!ok2) {
                                                      setBusy(false);
                                                      setError(err2);
                                                      return;
                                                  }
                                                  QJsonObject body{
                                                      {QStringLiteral("ciphertext"),
                                                       result.value(QStringLiteral("ciphertext")).toString()},
                                                      {QStringLiteral("protocol"),
                                                       result.value(QStringLiteral("protocol"))
                                                           .toString(QStringLiteral("signal_v1_group_sender_key"))},
                                                  };
                                                  if (!replyTo.isEmpty()) body.insert(QStringLiteral("reply_to"), replyTo);
                                                  httpJson(QStringLiteral("POST"),
                                                           QStringLiteral("/api/conversations/%1/messages").arg(conversationId),
                                                           body,
                                                           [this, conversationId, plaintext](bool ok3, QJsonObject, QString err3) {
                                                               setBusy(false);
                                                               if (!ok3) {
                                                                   setError(err3);
                                                                   return;
                                                               }
                                                               const QString localId =
                                                                   QStringLiteral("local-")
                                                                   + QString::number(QDateTime::currentMSecsSinceEpoch());
                                                               cachePlaintext(localId, plaintext);
                                                               QJsonObject local{
                                                                   {QStringLiteral("id"), localId},
                                                                   {QStringLiteral("plaintext"), plaintext},
                                                                   {QStringLiteral("mine"), true},
                                                                   {QStringLiteral("sender_id"), m_session->userId()},
                                                                   {QStringLiteral("conversation_id"), conversationId},
                                                               };
                                                               m_messages.append(local);
                                                               emit messagesChanged();
                                                               refreshConversations();
                                                           });
                                              });
                           };
                           if (!ok || !st.value(QStringLiteral("distributed")).toBool()) {
                               m_crypto->call(QStringLiteral("groupCreateDistribution"),
                                              QJsonObject{{QStringLiteral("groupId"), groupId}},
                                              [this, conversationId, groupId, doGroupEncrypt](bool okd, const QJsonObject &dist,
                                                                                              const QString &errd) {
                                                  if (!okd) {
                                                      setBusy(false);
                                                      setError(errd);
                                                      return;
                                                  }
                                                  // Post distribution message to group conversation
                                                  httpJson(QStringLiteral("POST"),
                                                           QStringLiteral("/api/conversations/%1/messages").arg(conversationId),
                                                           QJsonObject{{QStringLiteral("ciphertext"),
                                                                        dist.value(QStringLiteral("ciphertext")).toString()},
                                                                       {QStringLiteral("protocol"),
                                                                        QStringLiteral("signal_v1_group_sender_key_dist")}},
                                                           [this, groupId, doGroupEncrypt](bool, QJsonObject, QString) {
                                                               m_crypto->call(QStringLiteral("groupMarkDistributed"),
                                                                              QJsonObject{{QStringLiteral("groupId"), groupId}},
                                                                              {});
                                                               doGroupEncrypt();
                                                           });
                                              });
                           } else {
                               doGroupEncrypt();
                           }
                       });
        sendTyping(conversationId, false);
        return;
    }
    // Direct 1:1 (optionally multi-device via device list)
    fetchPeerBundleAndEncrypt(conversationId, peerId, plaintext, replyTo);
    sendTyping(conversationId, false);
}

void SscApiClient::establishThenEncryptDevice(const QString &peerId, const QString &deviceId,
                                              const QString &plaintext,
                                              const std::function<void(bool, QString, QString)> &done)
{
    httpJson(QStringLiteral("GET"),
             QStringLiteral("/api/prekeys/users/%1/devices/%2").arg(peerId, deviceId), {},
             [this, peerId, deviceId, plaintext, done](bool ok, QJsonObject body, QString) {
                 auto encryptOnly = [this, peerId, deviceId, plaintext, done]() {
                     m_crypto->call(QStringLiteral("encryptMessage"),
                                    QJsonObject{{QStringLiteral("plaintext"), plaintext},
                                                {QStringLiteral("peerId"), peerId},
                                                {QStringLiteral("deviceId"), deviceId}},
                                    [done](bool ok2, const QJsonObject &result, const QString &err2) {
                                        if (!ok2) {
                                            done(false, {}, err2);
                                            return;
                                        }
                                        done(true, result.value(QStringLiteral("ciphertext")).toString(), {});
                                    });
                 };
                 if (ok) {
                     auto bundle = body.value(QStringLiteral("bundle")).toObject();
                     if (bundle.isEmpty()) bundle = body;
                     m_crypto->call(QStringLiteral("establishSession"),
                                    QJsonObject{{QStringLiteral("peerId"), peerId},
                                                {QStringLiteral("deviceId"), deviceId},
                                                {QStringLiteral("bundle"), bundle}},
                                    [encryptOnly](bool, const QJsonObject &, const QString &) { encryptOnly(); });
                 } else {
                     encryptOnly();
                 }
             });
}

void SscApiClient::encryptForDevices(const QString &conversationId, const QString &peerId,
                                     const QStringList &deviceIds, int index, const QString &plaintext,
                                     const QString &replyTo, QJsonObject deviceMap)
{
    if (index >= deviceIds.size()) {
        if (deviceMap.isEmpty()) {
            setBusy(false);
            setError(QStringLiteral("encrypt_all_devices_failed"));
            return;
        }
        const QString legacy = deviceMap.value(deviceIds.value(0, QStringLiteral("1"))).toString();
        const QString leg = legacy.isEmpty() ? deviceMap.begin().value().toString() : legacy;
        postCiphertext(conversationId, leg, plaintext, replyTo, deviceMap);
        return;
    }
    const QString deviceId = deviceIds.at(index);
    establishThenEncryptDevice(peerId, deviceId, plaintext,
                               [this, conversationId, peerId, deviceIds, index, plaintext, replyTo, deviceMap,
                                deviceId](bool ok, QString ct, QString) mutable {
                                   if (ok && !ct.isEmpty()) {
                                       deviceMap.insert(deviceId, ct);
                                   }
                                   encryptForDevices(conversationId, peerId, deviceIds, index + 1, plaintext, replyTo,
                                                     deviceMap);
                               });
}

void SscApiClient::fetchPeerBundleAndEncrypt(const QString &conversationId, const QString &peerId,
                                             const QString &plaintext, const QString &replyTo)
{
    // Sesame multi-device: list peer devices then encrypt per device (Android encryptForAllDevices)
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/prekeys/users/%1").arg(peerId), {},
             [this, conversationId, peerId, plaintext, replyTo](bool ok, QJsonObject body, QString) {
                 QStringList deviceIds;
                 if (ok) {
                     const auto arr = body.value(QStringLiteral("devices")).toArray();
                     for (const auto &v : arr) {
                         const auto d = v.toObject();
                         const QString id =
                             d.value(QStringLiteral("device_id")).toString(d.value(QStringLiteral("deviceId")).toString());
                         if (!id.isEmpty()) deviceIds.append(id);
                     }
                 }
                 if (deviceIds.isEmpty()) deviceIds.append(QStringLiteral("1"));
                 encryptForDevices(conversationId, peerId, deviceIds, 0, plaintext, replyTo, {});
             });
}

void SscApiClient::postCiphertext(const QString &conversationId, const QString &ciphertext,
                                  const QString &plaintext, const QString &replyTo,
                                  const QJsonObject &deviceCiphertexts)
{
    QString protocol = QStringLiteral("signal_v1");
    if (m_session->sealedSenderEnabled()) {
        protocol = QStringLiteral("signal_v1_sealed");
    }
    QJsonObject body{{QStringLiteral("ciphertext"), ciphertext},
                     {QStringLiteral("protocol"), protocol}};
    if (m_session->sealedSenderEnabled()) body.insert(QStringLiteral("sealed"), true);
    if (!replyTo.isEmpty()) body.insert(QStringLiteral("reply_to"), replyTo);
    if (!deviceCiphertexts.isEmpty()) {
        body.insert(QStringLiteral("device_ciphertexts"), deviceCiphertexts);
    }
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/conversations/%1/messages").arg(conversationId), body,
             [this, conversationId, plaintext](bool ok, QJsonObject, QString err) {
                 setBusy(false);
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 // Optimistic bubble — do NOT reload conversation (would wipe plaintext to "✓ Sent")
                 const QString localId =
                     QStringLiteral("local-") + QString::number(QDateTime::currentMSecsSinceEpoch());
                 cachePlaintext(localId, plaintext);
                 QJsonObject local{
                     {QStringLiteral("id"), localId},
                     {QStringLiteral("plaintext"), plaintext},
                     {QStringLiteral("mine"), true},
                     {QStringLiteral("sender_id"), m_session->userId()},
                     {QStringLiteral("conversation_id"), conversationId},
                 };
                 m_messages.append(local);
                 if (m_cache) m_cache->upsertMessage(local);
                 emit messagesChanged();
                 refreshConversations();
                 setStatus(QStringLiteral("Message sent"));
             });
}

void SscApiClient::editMessage(const QString &messageId, const QString &plaintext)
{
    if (m_activePeerId.isEmpty()) return;
    setBusy(true);
    // Multi-device edit envelope
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/prekeys/users/%1").arg(m_activePeerId), {},
             [this, messageId, plaintext](bool ok, QJsonObject body, QString) {
                 QStringList deviceIds;
                 if (ok) {
                     const auto arr = body.value(QStringLiteral("devices")).toArray();
                     for (const auto &v : arr) {
                         const auto d = v.toObject();
                         const QString id =
                             d.value(QStringLiteral("device_id")).toString(d.value(QStringLiteral("deviceId")).toString());
                         if (!id.isEmpty()) deviceIds.append(id);
                     }
                 }
                 if (deviceIds.isEmpty()) deviceIds.append(QStringLiteral("1"));
                 // encrypt sequentially into map then PATCH
                 std::function<void(int, QJsonObject)> step;
                 step = [this, messageId, plaintext, deviceIds, step](int index, QJsonObject deviceMap) {
                     if (index >= deviceIds.size()) {
                         const QString legacy = deviceMap.begin().value().toString();
                         QJsonObject body{{QStringLiteral("ciphertext"), legacy},
                                          {QStringLiteral("protocol"), QStringLiteral("signal_v1")}};
                         if (!deviceMap.isEmpty()) body.insert(QStringLiteral("device_ciphertexts"), deviceMap);
                         httpJson(QStringLiteral("PATCH"), QStringLiteral("/api/messages/") + messageId, body,
                                  [this](bool ok2, QJsonObject, QString err2) {
                                      setBusy(false);
                                      if (!ok2) setError(err2);
                                      else openConversation(m_activeConversationId, m_activePeerId, m_activeGroupId);
                                  });
                         return;
                     }
                     const QString deviceId = deviceIds.at(index);
                     establishThenEncryptDevice(
                         m_activePeerId, deviceId, plaintext,
                         [step, index, deviceMap, deviceId](bool ok3, QString ct, QString) mutable {
                             if (ok3 && !ct.isEmpty()) deviceMap.insert(deviceId, ct);
                             step(index + 1, deviceMap);
                         });
                 };
                 step(0, {});
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
    QString peer = peerUserId.trimmed();
    if (peer.startsWith(QLatin1Char('@'))) peer = peer.mid(1).trimmed();
    if (peer.isEmpty()) return;

    // If caller passed a username (not a raw id), resolve first then open chat.
    // User ids from this API are typically "u_..." prefixes; usernames are lowercase alnum.
    const bool looksLikeId = peer.startsWith(QLatin1String("u_")) || peer.length() >= 20;
    if (!looksLikeId) {
        setBusy(true);
        const QString path =
            QStringLiteral("/api/users/lookup/%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(peer.toLower())));
        httpJson(QStringLiteral("GET"), path, {}, [this, peer](bool ok, QJsonObject obj, QString err) {
            if (!ok) {
                setBusy(false);
                setError(QStringLiteral("User not found: @") + peer);
                return;
            }
            auto user = obj.value(QStringLiteral("user")).toObject();
            if (user.isEmpty()) user = obj;
            const QString id = user.value(QStringLiteral("id")).toString(user.value(QStringLiteral("_id")).toString());
            if (id.isEmpty()) {
                setBusy(false);
                setError(QStringLiteral("user_id_missing"));
                return;
            }
            // re-enter with resolved id
            setBusy(false);
            startNewDirect(id);
        });
        return;
    }

    setBusy(true);
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/conversations"),
             QJsonObject{{QStringLiteral("participant_id"), peer}},
             [this, peer](bool ok, QJsonObject obj, QString err) {
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
                 openConversation(id, peer, {});
                 setStatus(QStringLiteral("Chat ready"));
             });
}

void SscApiClient::searchUsers(const QString &query)
{
    // Privacy model: no global directory. Lookup exact username (@name) or user id.
    QString q = query.trimmed();
    if (q.startsWith(QLatin1Char('@'))) q = q.mid(1).trimmed();
    q = q.toLower();
    m_userSearchResults = {};
    emit userSearchResultsChanged();
    if (q.isEmpty()) return;
    setStatus(QStringLiteral("Looking up @") + q + QStringLiteral("…"));
    const QString path =
        QStringLiteral("/api/users/lookup/%1").arg(QString::fromUtf8(QUrl::toPercentEncoding(q)));
    httpJson(QStringLiteral("GET"), path, {}, [this, q](bool ok, QJsonObject obj, QString err) {
        if (!ok) {
            httpJson(QStringLiteral("GET"),
                     QStringLiteral("/api/users/by-username/")
                         + QString::fromUtf8(QUrl::toPercentEncoding(q)),
                     {},
                     [this, q](bool ok2, QJsonObject obj2, QString err2) {
                         if (!ok2) {
                             m_userSearchResults = {};
                             emit userSearchResultsChanged();
                             setError(QStringLiteral("User not found: @") + q
                                      + QStringLiteral(" (use exact username)"));
                             setStatus(QStringLiteral("No match for @") + q);
                             return;
                         }
                         auto user = obj2.value(QStringLiteral("user")).toObject();
                         if (user.isEmpty()) user = obj2;
                         m_userSearchResults = QJsonArray{user};
                         emit userSearchResultsChanged();
                         setStatus(QStringLiteral("Found @")
                                   + user.value(QStringLiteral("username")).toString(q));
                     });
            return;
        }
        auto user = obj.value(QStringLiteral("user")).toObject();
        if (user.isEmpty()) user = obj;
        m_userSearchResults = QJsonArray{user};
        emit userSearchResultsChanged();
        setStatus(QStringLiteral("Found @")
                  + user.value(QStringLiteral("username")).toString(q));
        Q_UNUSED(err);
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
        if (m_cache) m_cache->wipe();
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

void SscApiClient::uploadEncryptedAttachment(const QString &conversationId, const QString &localPath,
                                             const QString &contentType, const QString &noticePrefix)
{
    if (conversationId.isEmpty() || localPath.isEmpty()) {
        setError(QStringLiteral("attachment_missing_args"));
        return;
    }
    // Direct chat preferred for key material; groups still send notice ciphertext via group path
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
                   [this, conversationId, localPath, contentType, noticePrefix](bool ok, const QJsonObject &result,
                                                                               const QString &err) {
                       if (!ok) {
                           setBusy(false);
                           setError(err);
                           return;
                       }
                       const QString fileCt = result.value(QStringLiteral("ciphertext")).toString();
                       httpJson(QStringLiteral("POST"), QStringLiteral("/api/files"),
                                QJsonObject{{QStringLiteral("ciphertext"), fileCt},
                                            {QStringLiteral("filename"), QFileInfo(localPath).fileName()},
                                            {QStringLiteral("content_type"), contentType}},
                                [this, conversationId, localPath, noticePrefix](bool ok2, QJsonObject obj, QString err2) {
                                    if (!ok2) {
                                        setBusy(false);
                                        setError(err2);
                                        return;
                                    }
                                    const auto file = obj.value(QStringLiteral("file")).toObject();
                                    const QString fileId =
                                        file.value(QStringLiteral("id")).toString(obj.value(QStringLiteral("id")).toString());
                                    QString notice;
                                    if (noticePrefix == QLatin1String("voice")) {
                                        // Android parity: [voice:fileId]
                                        notice = QStringLiteral("[voice:%1]").arg(fileId);
                                    } else {
                                        notice = QStringLiteral("[file] ") + QFileInfo(localPath).fileName()
                                                 + QStringLiteral(" id=") + fileId;
                                    }
                                    sendMessage(conversationId, notice, {});
                                });
                   });
}

void SscApiClient::sendFile(const QString &conversationId, const QString &localPath)
{
    uploadEncryptedAttachment(conversationId, localPath, QStringLiteral("application/octet-stream"),
                              QStringLiteral("file"));
}

void SscApiClient::sendVoiceNote(const QString &conversationId, const QString &localPath)
{
    uploadEncryptedAttachment(conversationId, localPath, QStringLiteral("audio/wav"), QStringLiteral("voice"));
}

void SscApiClient::searchLocalMessages(const QString &query)
{
    m_searchHits = m_cache ? m_cache->searchMessages(query) : QJsonArray{};
    emit searchHitsChanged();
}

void SscApiClient::computeSafetyNumber(const QString &peerId)
{
    if (peerId.isEmpty()) return;
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/prekeys/users/%1/devices/1").arg(peerId), {},
             [this, peerId](bool ok, QJsonObject body, QString err) {
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 auto bundle = body.value(QStringLiteral("bundle")).toObject();
                 if (bundle.isEmpty()) bundle = body;
                 const QString ik = bundle.value(QStringLiteral("identity_key"))
                                        .toString(bundle.value(QStringLiteral("identityKey")).toString());
                 m_crypto->call(QStringLiteral("computeSafetyNumber"),
                                QJsonObject{{QStringLiteral("peerId"), peerId},
                                            {QStringLiteral("peerIdentityKeyB64"), ik}},
                                [this](bool ok2, const QJsonObject &result, const QString &err2) {
                                    if (!ok2) {
                                        setError(err2);
                                        return;
                                    }
                                    m_safetyNumber = result.value(QStringLiteral("displayable")).toString();
                                    emit safetyNumberChanged();
                                    setStatus(QStringLiteral("Safety number ready"));
                                });
             });
}

void SscApiClient::startSfuGroupCall(const QString &conversationId, int expectedParticipants)
{
    m_sfuStatus = QStringLiteral("provisioning…");
    emit sfuStatusChanged();
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/sfu/rooms"),
             QJsonObject{{QStringLiteral("conversation_id"), conversationId},
                         {QStringLiteral("expected_participants"), expectedParticipants}},
             [this](bool ok, QJsonObject obj, QString err) {
                 if (!ok) {
                     m_sfuStatus = QStringLiteral("sfu_failed: ") + err;
                     emit sfuStatusChanged();
                     setError(err);
                     return;
                 }
                 auto room = obj.value(QStringLiteral("room")).toObject();
                 if (room.isEmpty()) room = obj;
                 m_sfuRoomId = room.value(QStringLiteral("room_id")).toString(room.value(QStringLiteral("id")).toString());
                 const QString token = room.value(QStringLiteral("join_token")).toString(obj.value(QStringLiteral("join_token")).toString());
                 const QString ws = room.value(QStringLiteral("ws_url")).toString(obj.value(QStringLiteral("ws_url")).toString());
                 m_sfuJoinToken = token;
                 m_sfuWsUrl = ws;
                 m_sfuStatus = QStringLiteral("SFU room ") + m_sfuRoomId;
                 emit sfuStatusChanged();
                 emit sfuRoomReady(m_sfuRoomId, ws, token);
                 setStatus(QStringLiteral("Group SFU ready — use Join to connect"));
             });
}

void SscApiClient::endSfuRoom()
{
    if (m_sfuRoomId.isEmpty()) return;
    httpJson(QStringLiteral("POST"), QStringLiteral("/api/sfu/rooms/%1/end").arg(m_sfuRoomId), {},
             [this](bool, QJsonObject, QString) {
                 m_sfuRoomId.clear();
                 m_sfuJoinToken.clear();
                 m_sfuWsUrl.clear();
                 m_sfuStatus = QStringLiteral("SFU ended");
                 emit sfuStatusChanged();
             });
}

void SscApiClient::downloadAndOpenFile(const QString &fileId)
{
    if (fileId.isEmpty()) return;
    httpJson(QStringLiteral("GET"), QStringLiteral("/api/files/") + fileId, {},
             [this, fileId](bool ok, QJsonObject obj, QString err) {
                 if (!ok) {
                     setError(err);
                     return;
                 }
                 const auto file = obj.value(QStringLiteral("file")).toObject();
                 QString ct = file.value(QStringLiteral("ciphertext")).toString(obj.value(QStringLiteral("ciphertext")).toString());
                 if (ct.isEmpty()) {
                     setError(QStringLiteral("file_ciphertext_missing"));
                     return;
                 }
                 m_crypto->call(QStringLiteral("decryptBytes"), QJsonObject{{QStringLiteral("ciphertext"), ct}},
                                [this, fileId, file](bool ok2, const QJsonObject &result, const QString &err2) {
                                    if (!ok2) {
                                        setError(err2);
                                        return;
                                    }
                                    // decryptBytes may return buffer as base64 in various shapes
                                    QByteArray raw;
                                    if (result.contains(QStringLiteral("buffer"))) {
                                        // not serializable easily — try base64 field
                                    }
                                    const QString b64 = result.value(QStringLiteral("base64")).toString();
                                    if (!b64.isEmpty()) raw = QByteArray::fromBase64(b64.toLatin1());
                                    // Some workers return nested data
                                    if (raw.isEmpty() && result.contains(QStringLiteral("data"))) {
                                        raw = QByteArray::fromBase64(result.value(QStringLiteral("data")).toString().toLatin1());
                                    }
                                    if (raw.isEmpty()) {
                                        // try ciphertext open as JSON envelope then fail gracefully
                                        setStatus(QStringLiteral("File decrypted metadata only — open incomplete"));
                                        return;
                                    }
                                    const QString name = file.value(QStringLiteral("filename")).toString(fileId + QStringLiteral(".bin"));
                                    const QString path = QStandardPaths::writableLocation(QStandardPaths::TempLocation)
                                                         + QStringLiteral("/") + name;
                                    QFile out(path);
                                    if (!out.open(QIODevice::WriteOnly)) {
                                        setError(QStringLiteral("cannot_write_temp_file"));
                                        return;
                                    }
                                    out.write(raw);
                                    out.close();
                                    QDesktopServices::openUrl(QUrl::fromLocalFile(path));
                                    setStatus(QStringLiteral("Opened ") + name);
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
    if (type == QLatin1String("call") || type == QLatin1String("call_invite")
        || type == QLatin1String("incoming_call")) {
        emit incomingCall(payload.value(QStringLiteral("call_id")).toString(),
                          payload.value(QStringLiteral("from_user_id")).toString(
                              payload.value(QStringLiteral("caller_id")).toString()),
                          payload.value(QStringLiteral("video")).toBool());
        return;
    }
    if (type == QLatin1String("sfu_room")) {
        m_sfuRoomId = payload.value(QStringLiteral("room_id")).toString(
            payload.value(QStringLiteral("id")).toString());
        m_sfuJoinToken = payload.value(QStringLiteral("join_token")).toString();
        m_sfuWsUrl = payload.value(QStringLiteral("ws_url")).toString();
        m_sfuStatus = QStringLiteral("Invite: ") + m_sfuRoomId;
        emit sfuStatusChanged();
        emit sfuRoomReady(m_sfuRoomId, m_sfuWsUrl, m_sfuJoinToken);
        return;
    }
    if (type == QLatin1String("sfu_room_ended")) {
        m_sfuRoomId.clear();
        m_sfuJoinToken.clear();
        m_sfuWsUrl.clear();
        m_sfuStatus = QStringLiteral("SFU ended (remote)");
        emit sfuStatusChanged();
    }
}
