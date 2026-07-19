#include "SscDeepLink.h"

#include <QUrl>
#include <QUrlQuery>
#include <QCoreApplication>

SscDeepLink::SscDeepLink(QObject *parent)
    : QObject(parent)
{
    connect(&m_server, &QLocalServer::newConnection, this, &SscDeepLink::onNewConnection);
}

SscDeepLink::~SscDeepLink()
{
    m_server.close();
    QLocalServer::removeServer(QString::fromLatin1(kServerName));
}

QString SscDeepLink::findDeepLinkArg(const QStringList &args)
{
    for (const QString &a : args) {
        if (a.startsWith(QLatin1String("ssc://"), Qt::CaseInsensitive)
            || a.startsWith(QLatin1String("ssc:"), Qt::CaseInsensitive)
            || a.contains(QLatin1String("oauth_code="), Qt::CaseInsensitive)) {
            return a;
        }
    }
    return {};
}

QString SscDeepLink::extractOAuthCode(const QString &raw)
{
    if (raw.isEmpty()) return {};
    QString s = raw.trimmed();
    // Browser may pass quoted URL
    if ((s.startsWith(QLatin1Char('"')) && s.endsWith(QLatin1Char('"')))
        || (s.startsWith(QLatin1Char('\'')) && s.endsWith(QLatin1Char('\'')))) {
        s = s.mid(1, s.size() - 2);
    }
    // Direct query fragment
    if (!s.contains(QLatin1String("://")) && s.contains(QLatin1String("oauth_code="))) {
        const int i = s.indexOf(QLatin1String("oauth_code="));
        QString code = s.mid(i + 11);
        const int amp = code.indexOf(QLatin1Char('&'));
        if (amp >= 0) code = code.left(amp);
        return QUrl::fromPercentEncoding(code.toUtf8());
    }
    QUrl url(s);
    if (!url.isValid()) {
        // try force as ssc URL
        url = QUrl(QStringLiteral("ssc://auth/google?") + s);
    }
    QUrlQuery q(url);
    QString code = q.queryItemValue(QStringLiteral("oauth_code"));
    if (code.isEmpty()) code = q.queryItemValue(QStringLiteral("code"));
    return code;
}

bool SscDeepLink::claimPrimaryInstance(const QStringList &args)
{
    const QString link = findDeepLinkArg(args);
    // Try connect to existing primary
    QLocalSocket sock;
    sock.connectToServer(QString::fromLatin1(kServerName));
    if (sock.waitForConnected(250)) {
        const QByteArray payload = link.isEmpty()
                                       ? QByteArrayLiteral("ACTIVATE")
                                       : link.toUtf8();
        sock.write(payload);
        sock.flush();
        sock.waitForBytesWritten(500);
        sock.disconnectFromServer();
        return false; // secondary
    }

    QLocalServer::removeServer(QString::fromLatin1(kServerName));
    if (!m_server.listen(QString::fromLatin1(kServerName))) {
        // Still run as primary if listen fails (dev edge case)
        return true;
    }

    if (!link.isEmpty()) {
        // Primary started via deep link (cold start after Google)
        QMetaObject::invokeMethod(
            this,
            [this, link]() { handlePayload(link.toUtf8()); },
            Qt::QueuedConnection);
    }
    return true;
}

void SscDeepLink::onNewConnection()
{
    while (QLocalSocket *sock = m_server.nextPendingConnection()) {
        connect(sock, &QLocalSocket::readyRead, this, [this, sock]() {
            handlePayload(sock->readAll());
            sock->disconnectFromServer();
            sock->deleteLater();
        });
        connect(sock, &QLocalSocket::disconnected, sock, &QObject::deleteLater);
    }
}

void SscDeepLink::handlePayload(const QByteArray &payload)
{
    const QString text = QString::fromUtf8(payload).trimmed();
    if (text.isEmpty() || text == QLatin1String("ACTIVATE")) {
        emit deepLinkReceived(QStringLiteral("activate"));
        return;
    }
    emit deepLinkReceived(text);
    const QString code = extractOAuthCode(text);
    if (!code.isEmpty()) emit oauthCodeReceived(code);
}
