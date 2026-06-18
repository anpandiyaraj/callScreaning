package com.example.callblocker.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.callblocker.data.AppDatabase
import com.example.callblocker.data.BlocklistItem
import com.example.callblocker.data.PausePeriod
import com.example.callblocker.service.CustomCallScreeningService
import com.example.callblocker.voice.VoiceAssistantManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class BlocklistViewModel(application: Application) : AndroidViewModel(application) {

    private val db = AppDatabase.getDatabase(application)
    private val dao = db.blocklistDao()
    private val prefs = application.getSharedPreferences(CustomCallScreeningService.PREFS_NAME, Context.MODE_PRIVATE)

    // Exposed Flows from Room
    val blockedNumbers: StateFlow<List<BlocklistItem>> = dao.getAllBlockedNumbers()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val pausePeriods: StateFlow<List<PausePeriod>> = dao.getAllPausePeriods()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Local and UI States
    private val _isBlockerActive = MutableStateFlow(true)
    val isBlockerActive: StateFlow<Boolean> = _isBlockerActive.asStateFlow()

    private val _assistantState = MutableStateFlow<VoiceAssistantManager.AssistantState>(VoiceAssistantManager.AssistantState.Idle)
    val assistantState: StateFlow<VoiceAssistantManager.AssistantState> = _assistantState.asStateFlow()

    private val _recognizedCommand = MutableStateFlow<String?>(null)
    val recognizedCommand: StateFlow<String?> = _recognizedCommand.asStateFlow()

    init {
        // Load initial state from shared prefs
        _isBlockerActive.value = prefs.getBoolean(CustomCallScreeningService.KEY_GLOBAL_ACTIVE, true)
    }

    fun setBlockerActive(active: Boolean) {
        prefs.edit().putBoolean(CustomCallScreeningService.KEY_GLOBAL_ACTIVE, active).apply()
        _isBlockerActive.value = active
    }

    /**
     * Toggles the active call filtering capability state
     */
    fun toggleBlocker() {
        setBlockerActive(!_isBlockerActive.value)
    }

    // --- Blocklist Operations ---

    fun addBlockedNumber(number: String, name: String?, category: String = "Spam") {
        viewModelScope.launch(Dispatchers.IO) {
            dao.insertBlockedNumber(
                BlocklistItem(
                    phoneNumber = number,
                    contactName = name,
                    category = category,
                    reason = "Added manually via layout UI"
                )
            )
        }
    }

    fun deleteBlockedNumber(phoneNumber: String) {
        viewModelScope.launch(Dispatchers.IO) {
            dao.deleteBlockedNumber(phoneNumber)
        }
    }

    // --- Calendar Block Suspends ---

    fun addPausePeriod(startTime: Long, endTime: Long, title: String) {
        viewModelScope.launch(Dispatchers.IO) {
            dao.insertPausePeriod(
                PausePeriod(
                    startTime = startTime,
                    endTime = endTime,
                    title = title,
                    isEnabled = true
                )
            )
        }
    }

    fun deletePausePeriod(id: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            dao.deletePausePeriod(id)
        }
    }

    // --- Assistant State Bridge ---

    fun updateAssistantState(state: VoiceAssistantManager.AssistantState) {
        _assistantState.value = state
    }

    fun setLatestCommandResult(command: String, recognizedText: String, speechOutput: String) {
        _recognizedCommand.value = "Recognized: \"$recognizedText\"\nOutput: \"$speechOutput\""
        
        // Make sure to sync settings if changed via Voice
        if (command == "PAUSE_BLOCKER") {
            _isBlockerActive.value = false
        } else if (command == "RESUME_BLOCKER") {
            _isBlockerActive.value = true
        }
    }

    fun clearLatestCommand() {
        _recognizedCommand.value = null
    }
}
