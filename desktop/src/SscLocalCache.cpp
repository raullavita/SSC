#include "SscLocalCache.h"

#include <QSqlQuery>
#include <QSqlError>
#include <QStandardPaths>
#include <QDir>
#include <QUuid>
#include <QVariant>

SscLocalCache::SscLocalCache(QObject *parent)
    : QObject(parent)
    , m_connName(QStringLiteral("ssc_cache_") + QUuid::createUuid().toString(QUuid::Id128))
{
}

SscLocalCache::~SscLocalCache()
{
    close();
}

void SscLocalCache::open(const QString &userId)
{
    close();
    const QString base = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(base);
    const QString path = base + QStringLiteral("/messages_") + (userId.isEmpty() ? QStringLiteral("anon") : userId) + QStringLiteral(".db");
    m_db = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), m_connName);
    m_db.setDatabaseName(path);
    if (!m_db.open()) {
        qWarning("local cache open failed: %s", qPrintable(m_db.lastError().text()));
        return;
    }
    m_open = true;
    ensureSchema();
}

void SscLocalCache::close()
{
    if (m_open) {
        m_db.close();
        m_open = false;
    }
    if (QSqlDatabase::contains(m_connName)) {
        QSqlDatabase::removeDatabase(m_connName);
    }
}

void SscLocalCache::wipe()
{
    if (!m_open) return;
    QSqlQuery q(m_db);
    q.exec(QStringLiteral("DELETE FROM messages"));
    q.exec(QStringLiteral("DELETE FROM conversations"));
}

void SscLocalCache::ensureSchema()
{
    QSqlQuery q(m_db);
    q.exec(QStringLiteral(
        "CREATE TABLE IF NOT EXISTS messages ("
        "id TEXT PRIMARY KEY,"
        "conversation_id TEXT,"
        "sender_id TEXT,"
        "plaintext TEXT,"
        "ciphertext TEXT,"
        "protocol TEXT,"
        "created_at TEXT"
        ")"));
    q.exec(QStringLiteral(
        "CREATE TABLE IF NOT EXISTS conversations ("
        "id TEXT PRIMARY KEY,"
        "title TEXT,"
        "peer_id TEXT,"
        "group_id TEXT,"
        "type TEXT,"
        "updated_at TEXT,"
        "pinned INTEGER DEFAULT 0,"
        "muted INTEGER DEFAULT 0"
        ")"));
    q.exec(QStringLiteral("CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id)"));
    q.exec(QStringLiteral("CREATE INDEX IF NOT EXISTS idx_msg_plain ON messages(plaintext)"));
}

void SscLocalCache::upsertMessage(const QJsonObject &msg)
{
    if (!m_open) return;
    const QString id = msg.value(QStringLiteral("id")).toString();
    if (id.isEmpty()) return;
    QSqlQuery q(m_db);
    q.prepare(QStringLiteral(
        "INSERT OR REPLACE INTO messages(id,conversation_id,sender_id,plaintext,ciphertext,protocol,created_at)"
        " VALUES(?,?,?,?,?,?,?)"));
    q.addBindValue(id);
    q.addBindValue(msg.value(QStringLiteral("conversation_id")).toString(
        msg.value(QStringLiteral("conversationId")).toString()));
    q.addBindValue(msg.value(QStringLiteral("sender_id")).toString());
    q.addBindValue(msg.value(QStringLiteral("plaintext")).toString());
    q.addBindValue(msg.value(QStringLiteral("ciphertext")).toString());
    q.addBindValue(msg.value(QStringLiteral("protocol")).toString());
    q.addBindValue(msg.value(QStringLiteral("created_at")).toString());
    if (!q.exec()) {
        qWarning("upsertMessage: %s", qPrintable(q.lastError().text()));
    }
}

void SscLocalCache::upsertConversation(const QJsonObject &conv)
{
    if (!m_open) return;
    const QString id = conv.value(QStringLiteral("id")).toString(conv.value(QStringLiteral("_id")).toString());
    if (id.isEmpty()) return;
    QSqlQuery q(m_db);
    q.prepare(QStringLiteral(
        "INSERT OR REPLACE INTO conversations(id,title,peer_id,group_id,type,updated_at,pinned,muted)"
        " VALUES(?,?,?,?,?,?,?,?)"));
    q.addBindValue(id);
    q.addBindValue(conv.value(QStringLiteral("title")).toString());
    q.addBindValue(conv.value(QStringLiteral("peer_id")).toString());
    q.addBindValue(conv.value(QStringLiteral("group_id")).toString());
    q.addBindValue(conv.value(QStringLiteral("type")).toString());
    q.addBindValue(conv.value(QStringLiteral("updated_at")).toString());
    q.addBindValue(conv.value(QStringLiteral("pinned")).toBool() ? 1 : 0);
    q.addBindValue(conv.value(QStringLiteral("muted")).toBool() ? 1 : 0);
    q.exec();
}

QJsonArray SscLocalCache::listConversations() const
{
    QJsonArray out;
    if (!m_open) return out;
    QSqlQuery q(m_db);
    q.exec(QStringLiteral("SELECT id,title,peer_id,group_id,type,updated_at,pinned,muted FROM conversations ORDER BY pinned DESC, updated_at DESC"));
    while (q.next()) {
        out.append(QJsonObject{
            {QStringLiteral("id"), q.value(0).toString()},
            {QStringLiteral("title"), q.value(1).toString()},
            {QStringLiteral("peer_id"), q.value(2).toString()},
            {QStringLiteral("group_id"), q.value(3).toString()},
            {QStringLiteral("type"), q.value(4).toString()},
            {QStringLiteral("updated_at"), q.value(5).toString()},
            {QStringLiteral("pinned"), q.value(6).toInt() != 0},
            {QStringLiteral("muted"), q.value(7).toInt() != 0},
        });
    }
    return out;
}

QJsonArray SscLocalCache::listMessages(const QString &conversationId) const
{
    QJsonArray out;
    if (!m_open) return out;
    QSqlQuery q(m_db);
    q.prepare(QStringLiteral(
        "SELECT id,conversation_id,sender_id,plaintext,ciphertext,protocol,created_at FROM messages"
        " WHERE conversation_id=? ORDER BY created_at ASC"));
    q.addBindValue(conversationId);
    q.exec();
    while (q.next()) {
        out.append(QJsonObject{
            {QStringLiteral("id"), q.value(0).toString()},
            {QStringLiteral("conversation_id"), q.value(1).toString()},
            {QStringLiteral("sender_id"), q.value(2).toString()},
            {QStringLiteral("plaintext"), q.value(3).toString()},
            {QStringLiteral("ciphertext"), q.value(4).toString()},
            {QStringLiteral("protocol"), q.value(5).toString()},
            {QStringLiteral("created_at"), q.value(6).toString()},
        });
    }
    return out;
}

QJsonArray SscLocalCache::searchMessages(const QString &query, int limit) const
{
    QJsonArray out;
    if (!m_open || query.trimmed().isEmpty()) return out;
    QSqlQuery q(m_db);
    q.prepare(QStringLiteral(
        "SELECT id,conversation_id,plaintext FROM messages"
        " WHERE plaintext LIKE ? AND plaintext NOT IN ('[sent]','[encrypted]','[unable to decrypt]','[sender key]')"
        " ORDER BY created_at DESC LIMIT ?"));
    q.addBindValue(QStringLiteral("%") + query.trimmed() + QStringLiteral("%"));
    q.addBindValue(limit);
    q.exec();
    while (q.next()) {
        out.append(QJsonObject{
            {QStringLiteral("messageId"), q.value(0).toString()},
            {QStringLiteral("conversationId"), q.value(1).toString()},
            {QStringLiteral("snippet"), q.value(2).toString()},
        });
    }
    return out;
}

void SscLocalCache::deleteMessage(const QString &messageId)
{
    if (!m_open) return;
    QSqlQuery q(m_db);
    q.prepare(QStringLiteral("DELETE FROM messages WHERE id=?"));
    q.addBindValue(messageId);
    q.exec();
}
