import SwiftUI

/// Native SwiftUI root — no WKWebView for messenger UI (NATIVE_CLIENT_CHARTER).
struct ContentView: View {
    @StateObject private var session = SscSessionStore()
    @State private var api: SscApiClient?

    var body: some View {
        Group {
            if let api {
                if session.isLoggedIn {
                    NativeChatShell(session: session, api: api)
                } else {
                    NativeLoginView(session: session, api: api)
                }
            } else {
                ProgressView()
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            if api == nil {
                api = SscApiClient(session: session)
            }
        }
    }
}

struct NativeLoginView: View {
    @ObservedObject var session: SscSessionStore
    @ObservedObject var api: SscApiClient
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        VStack(spacing: 16) {
            Text("SSC")
                .font(.largeTitle.bold())
                .foregroundStyle(Color(red: 0, green: 0.66, blue: 0.52))
            Text("Native iOS · no WebView")
                .font(.caption)
                .foregroundStyle(.secondary)
            TextField("Email", text: $email)
                .textInputAutocapitalization(.never)
                .keyboardType(.emailAddress)
                .textFieldStyle(.roundedBorder)
            SecureField("Password", text: $password)
                .textFieldStyle(.roundedBorder)
            if let error {
                Text(error).font(.caption).foregroundStyle(.red)
            }
            Button(loading ? "…" : "Sign in") {
                Task {
                    loading = true
                    error = nil
                    do {
                        try await api.login(email: email, password: password)
                    } catch {
                        self.error = error.localizedDescription
                    }
                    loading = false
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(email.isEmpty || password.count < 8 || loading)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.04, green: 0.08, blue: 0.10))
    }
}

struct NativeChatShell: View {
    @ObservedObject var session: SscSessionStore
    @ObservedObject var api: SscApiClient
    @State private var conversations: [SscConversation] = []

    var body: some View {
        NavigationStack {
            List(conversations) { c in
                NavigationLink(c.title) {
                    NativeThreadView(conversation: c, api: api, session: session)
                }
            }
            .navigationTitle("Chats")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Refresh") { Task { await reload() } }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Log out") {
                        Task { await api.logout() }
                    }
                }
            }
            .task { await reload() }
        }
    }

    private func reload() async {
        conversations = (try? await api.listConversations()) ?? []
    }
}

struct NativeThreadView: View {
    let conversation: SscConversation
    @ObservedObject var api: SscApiClient
    @ObservedObject var session: SscSessionStore
    @State private var messages: [SscMessage] = []
    @State private var draft = ""

    var body: some View {
        VStack {
            List(messages) { m in
                Text(m.plaintext ?? "[encrypted]")
                    .frame(maxWidth: .infinity, alignment: m.senderId == session.userId ? .trailing : .leading)
            }
            HStack {
                TextField("Message", text: $draft)
                Button("Send") {
                    Task {
                        guard let peer = conversation.peerId else { return }
                        try? await api.sendPlaintext(conversationId: conversation.id, peerId: peer, text: draft)
                        draft = ""
                        messages = (try? await api.listMessages(conversationId: conversation.id)) ?? messages
                    }
                }
            }
            .padding()
        }
        .navigationTitle(conversation.title)
        .task {
            messages = (try? await api.listMessages(conversationId: conversation.id)) ?? []
        }
    }
}
