#pragma once

#include <QObject>
#include <QString>
#include <QSettings>

class SscSession : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool loggedIn READ loggedIn NOTIFY changed)
    Q_PROPERTY(QString userId READ userId NOTIFY changed)
    Q_PROPERTY(QString displayName READ displayName NOTIFY changed)
    Q_PROPERTY(QString username READ username NOTIFY changed)
    Q_PROPERTY(QString accessToken READ accessToken NOTIFY changed)
    Q_PROPERTY(QString deviceId READ deviceId CONSTANT)
    Q_PROPERTY(QString signalStorePath READ signalStorePath CONSTANT)
    Q_PROPERTY(bool sealedSenderEnabled READ sealedSenderEnabled WRITE setSealedSenderEnabled NOTIFY changed)
public:
    explicit SscSession(QObject *parent = nullptr);

    bool loggedIn() const;
    QString userId() const;
    QString displayName() const;
    QString username() const;
    QString accessToken() const;
    QString deviceId() const;
    QString signalStorePath() const;
    bool sealedSenderEnabled() const;
    void setSealedSenderEnabled(bool on);

    Q_INVOKABLE void saveSession(const QString &token, const QString &userId, const QString &displayName,
                                 const QString &username = {});
    Q_INVOKABLE void clear();

signals:
    void changed();

private:
    QSettings m_settings;
    QString m_token;
    QString m_userId;
    QString m_displayName;
    QString m_username;
};
