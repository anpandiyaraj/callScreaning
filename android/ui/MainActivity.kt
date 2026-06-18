package com.example.callblocker.ui

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.telecom.CallScreeningService
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.callblocker.voice.VoiceAssistantManager

class MainActivity : ComponentActivity() {

    private val viewModel: BlocklistViewModel by viewModels()
    private var voiceAssistantManager: VoiceAssistantManager? = null

    // Request permissions launcher
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        var allGranted = true
        permissions.forEach { (perm, granted) ->
            if (!granted) {
                allGranted = false
            }
        }
        if (!allGranted) {
            Toast.makeText(
                this,
                "Microphone and Phone permission are required for full features.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    // Role Manager default Call Screening app request launcher
    private val requestRoleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            Toast.makeText(this, "Success: Default Call Filter registered!", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Review: Android default screening not enabled.", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Audio and Speech Assistant
        voiceAssistantManager = VoiceAssistantManager(
            context = this,
            uiScope = lifecycleScope,
            onStateChange = { state ->
                viewModel.updateAssistantState(state)
            },
            onCommandResult = { command, transcript, speech ->
                viewModel.setLatestCommandResult(command, transcript, speech)
            }
        )

        // Jetpack Compose Entrypoint
        setContent {
            IntelligentCallBlockerTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var currentScreen by remember { mutableStateOf("dashboard") }

                    if (currentScreen == "dashboard") {
                        BlocklistDashboard(
                            viewModel = viewModel,
                            onRequestRole = { requestCallScreeningRole() },
                            onMicClicked = { triggerHandsFreeAssistant() },
                            onNavigateToCalendar = { currentScreen = "calendar" }
                        )
                    } else {
                        CalendarScreen(
                            viewModel = viewModel,
                            onBack = { currentScreen = "dashboard" }
                        )
                    }
                }
            }
        }

        // Verify/Request runtime permissions early
        requestRequiredPermissions()
    }

    /**
     * Launch default Android Role Manager dialog to solicit Screening capabilities.
     */
    private fun requestCallScreeningRole() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(Context.ROLE_SERVICE) as RoleManager
            if (roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                if (!roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                    requestRoleLauncher.launch(intent)
                } else {
                    Toast.makeText(this, "This app is already your default Call Screener.", Toast.LENGTH_SHORT).show()
                }
            }
        } else {
            Toast.makeText(this, "Call Screening Role is supported on Android 10+ (API 29).", Toast.LENGTH_LONG).show()
        }
    }

    private fun requestRequiredPermissions() {
        val permissions = mutableListOf(
            android.Manifest.permission.READ_PHONE_STATE,
            android.Manifest.permission.ANSWER_PHONE_CALLS,
            android.Manifest.permission.RECORD_AUDIO
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val notGranted = permissions.filter {
                ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
            }
            if (notGranted.isNotEmpty()) {
                requestPermissionLauncher.launch(notGranted.toTypedArray())
            }
        }
    }

    private fun triggerHandsFreeAssistant() {
        // Toggle listening session
        val currentState = viewModel.assistantState.value
        if (currentState is VoiceAssistantManager.AssistantState.Listening) {
            voiceAssistantManager?.stopListening()
        } else {
            // Check microphone record permission active
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                voiceAssistantManager?.startListening()
            } else {
                Toast.makeText(this, "Recorder Permission required for Voice Assistant", Toast.LENGTH_SHORT).show()
                requestPermissionLauncher.launch(arrayOf(android.Manifest.permission.RECORD_AUDIO))
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        voiceAssistantManager?.destroy()
    }
}
