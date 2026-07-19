#include "SscApiClient.h"
#include <QNetworkReply>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSysInfo>

SscApiClient::SscApiClient(SscSession *session, QObject *parent)
    : QObject(parent)
    , m_session(session)
{
#if defined(Q_OS_MACOS)
    m_platform = QStringLiteral("mac");
#elif defined(Q_OS_WIN)
    m_platform = QStringLiteral("windows");
#else
    m_platform = QStringLiteral("windows");
#endif
}

void SscApiClient::setPlatform(const QString &platform)
{
    m_platform = platform;
}

QNetworkRequest SscApiClient::makeRequest(const QString &path) const
{
    QNetworkRequest req{QUrl(m_apiBase + path)};
    req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    req.setRawHeader("Accept", "application/json");
    const QString client = m_platform + QStringLiteral("/0.4.0/15");
    req.setRawHeader("X-SSC-Client", client.toUtf8());
    req.setRawHeader("X-SSC-Native-Bridge", "v1");
    req.setRawHeader("X-SSC-Device-Id", m_session->deviceId().toUtf8());
    if (!m_session->accessToken().isEmpty()) {
        req.setRawHeader("Authorization", ("Bearer " + m_session->accessToken()).toUtf8());
    }
    return req;
}

void SscApiClient::setError(const QString &e)
{
    m_lastError = e;
    emit lastErrorChanged();
}

void SscApiClient::login(const QString &email, const QString &password)
{
    QJsonObject body{{QStringLiteral("email"), email}, {QStringLiteral("password"), password}};
    auto *reply = m_nam.post(makeRequest(QStringLiteral("/api/auth/login")),
                             QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            setError(reply->errorString());
            emit loginFailed(m_lastError);
            return;
        }
        const auto doc = QJsonDocument::fromJson(reply->readAll());
        const auto obj = doc.object();
        const auto user = obj.value(QStringLiteral("user")).toObject();
        const auto token = obj.value(QStringLiteral("ws_token")).toString();
        if (token.isEmpty()) {
            setError(QStringLiteral("missing_ws_token"));
            emit loginFailed(m_lastError);
            return;
        }
        m_session->saveSession(
            token,
            user.value(QStringLiteral("id")).toString(),
            user.value(QStringLiteral("display_name")).toString());
        emit loginSucceeded();
        refreshConversations();
    });
}

void SscApiClient::logout()
{
    auto *reply = m_nam.post(makeRequest(QStringLiteral("/api/auth/logout")), QByteArray("{}"));
    connect(reply, &QNetworkReply::finished, reply, &QObject::deleteLater);
    m_session->clear();
    m_conversations = {};
    m_messages = {};
    m_activeConversationId.clear();
    emit conversationsChanged();
    emit messagesChanged();
    emit activeConversationChanged();
}

void SscApiClient::refreshConversations()
{
    auto *reply = m_nam.get(makeRequest(QStringLiteral("/api/conversations")));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            setError(reply->errorString());
            return;
        }
        const auto doc = QJsonDocument::fromJson(reply->readAll());
        m_conversations = doc.object().value(QStringLiteral("conversations")).toArray();
        emit conversationsChanged();
    });
}

void SscApiClient::openConversation(const QString &conversationId)
{
    m_activeConversationId = conversationId;
    emit activeConversationChanged();
    auto *reply = m_nam.get(
        makeRequest(QStringLiteral("/api/conversations/%1/messages").arg(conversationId)));
    connect(reply, &QNetworkReply::finished, this, [this, reply]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            setError(reply->errorString());
            return;
        }
        const auto doc = QJsonDocument::fromJson(reply->readAll());
        m_messages = doc.object().value(QStringLiteral("messages")).toArray();
        emit messagesChanged();
    });
}

void SscApiClient::sendMessage(const QString &conversationId, const QString &plaintext)
{
    // Placeholder ciphertext until libsignal FFI is linked — production rejects short/dev blobs.
    // Send path posts structure; real encrypt lands with libsignal-client native binding.
    const QByteArray raw = plaintext.toUtf8().toBase64();
    QJsonObject body{
        {QStringLiteral("ciphertext"), QString::fromLatin1(raw)},
        {QStringLiteral("protocol"), QStringLiteral("signal_v1")},
    };
    auto *reply = m_nam.post(
        makeRequest(QStringLiteral("/api/conversations/%1/messages").arg(conversationId)),
        QJsonDocument(body).toJson(QJsonDocument::Compact));
    connect(reply, &QNetworkReply::finished, this, [this, reply, conversationId]() {
        reply->deleteLater();
        if (reply->error() != QNetworkReply::NoError) {
            setError(reply->errorString());
            return;
        }
        openConversation(conversationId);
    });
}
