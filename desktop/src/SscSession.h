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
    Q_PROPERTY(QString accessToken READ accessToken NOTIFY changed)
    Q_PROPERTY(QString deviceId READ deviceId CONSTANT)
public:
    explicit SscSession(QObject *parent = nullptr);

    bool loggedIn() const;
    QString userId() const;
    QString displayName() const;
    QString accessToken() const;
    QString deviceId() const;

    Q_INVOKABLE void saveSession(const QString &token, const QString &userId, const QString &displayName);
    Q_INVOKABLE void clear();

signals:
    void changed();

private:
    QSettings m_settings;
    QString m_token;
    QString m_userId;
    QString m_displayName;
};
