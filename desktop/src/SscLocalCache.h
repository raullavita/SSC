#pragma once

#include <QObject>
#include <QSqlDatabase>
#include <QJsonArray>
#include <QJsonObject>
#include <QString>

/**
 * Local SQLite cache of decrypted messages for search (Android LocalMessageDb analogue).
 * Plaintext stored only on-device; optional wipe on panic.
 */
class SscLocalCache : public QObject
{
    Q_OBJECT
public:
    explicit SscLocalCache(QObject *parent = nullptr);
    ~SscLocalCache() override;

    void open(const QString &userId);
    void close();
    void wipe();

    void upsertMessage(const QJsonObject &msg);
    void upsertConversation(const QJsonObject &conv);
    QJsonArray listConversations() const;
    QJsonArray listMessages(const QString &conversationId) const;
    Q_INVOKABLE QJsonArray searchMessages(const QString &query, int limit = 40) const;
    void deleteMessage(const QString &messageId);

private:
    void ensureSchema();
    QSqlDatabase m_db;
    QString m_connName;
    bool m_open = false;
};
