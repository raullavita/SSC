package com.supersecurechat.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.supersecurechat.app.SscApplication
import com.supersecurechat.app.ui.auth.AuthViewModel
import com.supersecurechat.app.ui.auth.LoginScreen
import com.supersecurechat.app.ui.auth.RegisterScreen
import com.supersecurechat.app.ui.chat.ChatScreen
import com.supersecurechat.app.ui.chat.ChatViewModel
import com.supersecurechat.app.ui.chats.ConversationListScreen
import com.supersecurechat.app.ui.chats.ConversationListViewModel
import com.supersecurechat.app.ui.splash.SplashScreen
import com.supersecurechat.app.ui.splash.SplashViewModel

@Composable
fun SscNavGraph(
    app: SscApplication,
    navController: NavHostController = rememberNavController(),
    pendingOAuthCode: String? = null,
    pendingOAuthError: String? = null,
    onGoogleSignIn: () -> Unit,
    onOAuthHandled: () -> Unit,
) {
    val authRepository = app.authRepository

    val splashViewModel: SplashViewModel = viewModel(
        factory = remember(authRepository) {
            simpleViewModelFactory { SplashViewModel(authRepository) }
        },
    )

    val authViewModel: AuthViewModel = viewModel(
        factory = remember(authRepository) {
            simpleViewModelFactory { AuthViewModel(authRepository) }
        },
    )

    androidx.compose.runtime.LaunchedEffect(pendingOAuthCode, pendingOAuthError) {
        pendingOAuthError?.let {
            authViewModel.reportGoogleOAuthError(it)
            onOAuthHandled()
        }
        pendingOAuthCode?.let { code ->
            navController.navigate(Routes.Login) {
                popUpTo(Routes.Splash) { inclusive = false }
                launchSingleTop = true
            }
            authViewModel.completeGoogleOAuth(code)
            onOAuthHandled()
        }
    }

    NavHost(
        navController = navController,
        startDestination = Routes.Splash,
    ) {
        composable(Routes.Splash) {
            SplashScreen(
                viewModel = splashViewModel,
                onNavigateLogin = {
                    navController.navigate(Routes.Login) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                },
                onNavigateHome = {
                    navController.navigate(Routes.Chats) {
                        popUpTo(Routes.Splash) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.Login) {
            LoginScreen(
                viewModel = authViewModel,
                onNavigateRegister = {
                    navController.navigate(Routes.Register)
                },
                onAuthenticated = {
                    navController.navigate(Routes.Chats) {
                        popUpTo(Routes.Login) { inclusive = true }
                    }
                },
                onGoogleSignIn = onGoogleSignIn,
            )
        }
        composable(Routes.Register) {
            RegisterScreen(
                viewModel = authViewModel,
                onNavigateLogin = { navController.popBackStack() },
                onAuthenticated = {
                    navController.navigate(Routes.Chats) {
                        popUpTo(Routes.Login) { inclusive = true }
                    }
                },
                onGoogleSignIn = onGoogleSignIn,
            )
        }
        composable(Routes.Chats) {
            val conversationListViewModel: ConversationListViewModel = viewModel(
                factory = remember(app) {
                    simpleViewModelFactory {
                        ConversationListViewModel(
                            sessionStore = app.sessionStore,
                            authRepository = app.authRepository,
                            conversationRepository = app.conversationRepository,
                            chatSessionManager = app.chatSessionManager,
                        )
                    }
                },
            )
            ConversationListScreen(
                viewModel = conversationListViewModel,
                onOpenChat = { conversationId ->
                    navController.navigate(Routes.chat(conversationId))
                },
                onLoggedOut = {
                    navController.navigate(Routes.Login) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }
        composable(
            route = Routes.Chat,
            arguments = listOf(navArgument("conversationId") { type = NavType.StringType }),
        ) { entry ->
            val conversationId = entry.arguments?.getString("conversationId").orEmpty()
            val chatViewModel: ChatViewModel = viewModel(
                key = conversationId,
                factory = remember(app, conversationId) {
                    simpleViewModelFactory {
                        ChatViewModel(
                            conversationId = conversationId,
                            sessionStore = app.sessionStore,
                            authRepository = app.authRepository,
                            conversationRepository = app.conversationRepository,
                            messageRepository = app.messageRepository,
                            chatSessionManager = app.chatSessionManager,
                        )
                    }
                },
            )
            ChatScreen(
                viewModel = chatViewModel,
                onBack = { navController.popBackStack() },
            )
        }
    }
}

private fun <T : androidx.lifecycle.ViewModel> simpleViewModelFactory(
    create: () -> T,
): androidx.lifecycle.ViewModelProvider.Factory =
    object : androidx.lifecycle.ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <VM : androidx.lifecycle.ViewModel> create(modelClass: Class<VM>): VM =
            create() as VM
    }