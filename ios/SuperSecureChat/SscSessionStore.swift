import Foundation
import Combine

@MainActor
final class SscSessionStore: ObservableObject {
    @Published var accessToken: String?
    @Published var userId: String?
    @Published var displayName: String?
    @Published var username: String?

    private let tokenAccount = "access_token"
    private let userKey = "ssc_user_id"
    private let nameKey = "ssc_display_name"
    private let userNameKey = "ssc_username"
    private let deviceKey = "ssc_device_id"
    private let defaults = UserDefaults.standard

    var isLoggedIn: Bool { accessToken != nil && userId != nil }

    var deviceId: String {
        if let d = defaults.string(forKey: deviceKey), !d.isEmpty { return d }
        defaults.set("1", forKey: deviceKey)
        return "1"
    }

    init() {
        accessToken = SscKeychain.get(account: tokenAccount)
        userId = defaults.string(forKey: userKey)
        displayName = defaults.string(forKey: nameKey)
        username = defaults.string(forKey: userNameKey)
    }

    func saveSession(token: String, userId: String, displayName: String?, username: String?) {
        self.accessToken = token
        self.userId = userId
        self.displayName = displayName
        self.username = username
        SscKeychain.set(token, account: tokenAccount)
        defaults.set(userId, forKey: userKey)
        defaults.set(displayName, forKey: nameKey)
        defaults.set(username, forKey: userNameKey)
    }

    func clear() {
        accessToken = nil
        userId = nil
        displayName = nil
        username = nil
        SscKeychain.delete(account: tokenAccount)
        defaults.removeObject(forKey: userKey)
        defaults.removeObject(forKey: nameKey)
        defaults.removeObject(forKey: userNameKey)
    }
}
