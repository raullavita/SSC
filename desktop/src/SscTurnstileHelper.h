#pragma once

#include <QObject>
#include <QTcpServer>
#include <QTcpSocket>
#include <QString>

/**
 * Local loopback server that serves Turnstile HTML and captures the token
 * (same idea as Android WebView bridge, without bundling Chromium).
 * Opens the system browser to http://127.0.0.1:<port>/
 */
class SscTurnstileHelper : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString token READ token NOTIFY tokenChanged)
    Q_PROPERTY(bool listening READ listening NOTIFY listeningChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)
public:
    explicit SscTurnstileHelper(QObject *parent = nullptr);
    ~SscTurnstileHelper() override;

    QString token() const { return m_token; }
    bool listening() const { return m_listening; }
    QString lastError() const { return m_lastError; }

    /** Start server for siteKey and open browser. */
    Q_INVOKABLE void begin(const QString &siteKey);
    Q_INVOKABLE void stop();
    Q_INVOKABLE void clearToken();

signals:
    void tokenChanged();
    void listeningChanged();
    void lastErrorChanged();
    void tokenReceived(const QString &token);

private:
    void setError(const QString &e);
    void handleConnection();
    void reply(QTcpSocket *sock, int code, const QByteArray &contentType, const QByteArray &body);
    QByteArray pageHtml(const QString &siteKey) const;

    QTcpServer m_server;
    QString m_siteKey;
    QString m_token;
    QString m_lastError;
    bool m_listening = false;
    quint16 m_port = 0;
};
