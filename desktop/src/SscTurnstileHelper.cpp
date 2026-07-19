#include "SscTurnstileHelper.h"

#include <QDesktopServices>
#include <QHostAddress>
#include <QUrl>
#include <QUrlQuery>
#include <QRegularExpression>
#include <QDateTime>

SscTurnstileHelper::SscTurnstileHelper(QObject *parent)
    : QObject(parent)
{
    connect(&m_server, &QTcpServer::newConnection, this, &SscTurnstileHelper::handleConnection);
}

SscTurnstileHelper::~SscTurnstileHelper()
{
    stop();
}

void SscTurnstileHelper::setError(const QString &e)
{
    m_lastError = e;
    emit lastErrorChanged();
}

void SscTurnstileHelper::clearToken()
{
    if (m_token.isEmpty()) {
        return;
    }
    m_token.clear();
    emit tokenChanged();
}

void SscTurnstileHelper::stop()
{
    m_server.close();
    if (m_listening) {
        m_listening = false;
        emit listeningChanged();
    }
}

void SscTurnstileHelper::begin(const QString &siteKey)
{
    stop();
    clearToken();
    m_siteKey = siteKey.trimmed();
    if (m_siteKey.isEmpty()) {
        setError(QStringLiteral("missing_turnstile_site_key"));
        return;
    }
    if (!m_server.listen(QHostAddress::LocalHost, 0)) {
        setError(QStringLiteral("turnstile_listen_failed: ") + m_server.errorString());
        return;
    }
    m_port = m_server.serverPort();
    m_listening = true;
    emit listeningChanged();
    const QUrl url(QStringLiteral("http://127.0.0.1:%1/").arg(m_port));
    if (!QDesktopServices::openUrl(url)) {
        setError(QStringLiteral("open_browser_failed — open ") + url.toString());
        return;
    }
    setError({});
}

QByteArray SscTurnstileHelper::pageHtml(const QString &siteKey) const
{
    const QString key = QString(siteKey).replace(QLatin1Char('"'), QString());
    const QString html = QStringLiteral(
        R"HTML(<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SSC Security Check</title>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
<style>
  body{font-family:Segoe UI,system-ui,sans-serif;background:#0B141A;color:#E9EDEF;
       display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0}
  h1{color:#00A884;font-size:28px;margin:0 0 8px}
  p{color:#8696A0;margin:0 0 20px}
  #ok{display:none;color:#00A884;margin-top:16px}
</style></head><body>
<h1>SSC</h1>
<p>Complete the security check, then return to the app.</p>
<div id="cf-turnstile"></div>
<p id="ok">✓ Verified — you can close this tab and register in SSC.</p>
<script>
function ready(){
  if(!window.turnstile){ setTimeout(ready,50); return; }
  turnstile.render('#cf-turnstile',{
    sitekey: "%1",
    callback: function(token){
      fetch('/token?t='+encodeURIComponent(token)).then(function(){
        document.getElementById('ok').style.display='block';
      });
    }
  });
}
ready();
</script>
</body></html>)HTML")
                            .arg(key);
    return html.toUtf8();
}

void SscTurnstileHelper::reply(QTcpSocket *sock, int code, const QByteArray &contentType, const QByteArray &body)
{
    QByteArray out;
    out += "HTTP/1.1 " + QByteArray::number(code) + " OK\r\n";
    out += "Content-Type: " + contentType + "\r\n";
    out += "Content-Length: " + QByteArray::number(body.size()) + "\r\n";
    out += "Connection: close\r\n";
    out += "Cache-Control: no-store\r\n\r\n";
    out += body;
    sock->write(out);
    sock->disconnectFromHost();
}

void SscTurnstileHelper::handleConnection()
{
    while (m_server.hasPendingConnections()) {
        QTcpSocket *sock = m_server.nextPendingConnection();
        connect(sock, &QTcpSocket::readyRead, this, [this, sock]() {
            const QByteArray req = sock->readAll();
            const QString first = QString::fromUtf8(req.split('\n').value(0));
            // GET /token?t=...
            if (first.contains(QStringLiteral("/token"))) {
                QRegularExpression re(QStringLiteral("[?&]t=([^\\s&]+)"));
                const auto m = re.match(first);
                if (m.hasMatch()) {
                    m_token = QUrl::fromPercentEncoding(m.captured(1).toUtf8());
                    emit tokenChanged();
                    emit tokenReceived(m_token);
                    reply(sock, 200, "text/plain", "ok");
                    return;
                }
                reply(sock, 400, "text/plain", "missing");
                return;
            }
            // GET /
            reply(sock, 200, "text/html; charset=utf-8", pageHtml(m_siteKey));
        });
        connect(sock, &QTcpSocket::disconnected, sock, &QObject::deleteLater);
    }
}
