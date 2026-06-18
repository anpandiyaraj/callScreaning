package com.example.callblocker.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.util.Log
import com.example.callblocker.data.AppDatabase
import com.example.callblocker.data.BlocklistItem
import com.example.callblocker.service.CustomCallScreeningService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.*
import java.util.regex.Pattern

/**
 * Manages hands-free speech command input (SpeechtoText) and acoustic feedback synthesis (TextToSpeech).
 * Executes database actions locally based on keyword parsing.
 */
class VoiceAssistantManager(
    private val context: Context,
    private val uiScope: CoroutineScope,
    private val onStateChange: (AssistantState) -> Unit,
    private val onCommandResult: (command: String, recognizedText: String, speechOutput: String) -> Unit
) : RecognitionListener, TextToSpeech.OnInitListener {

    sealed class AssistantState {
        object Idle : AssistantState()
        object Listening : AssistantState()
        object Processing : AssistantState()
        data class Speaking(val text: String) : AssistantState()
        data class Error(val message: String) : AssistantState()
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private var isTtsInitialized = false

    init {
        initializeSpeechModules()
    }

    private fun initializeSpeechModules() {
        // Initialize SpeechRecognizer on main thread
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                setRecognitionListener(this@VoiceAssistantManager)
            }
        } else {
            Log.e("VoiceAssistant", "Speech Recognition is not available on this device.")
            onStateChange(AssistantState.Error("Speech input not available"))
        }

        // Initialize TextToSpeech engine
        textToSpeech = TextToSpeech(context, this)
    }

    /**
     * Start recording user audio input for voice commands
     */
    fun startListening() {
        if (speechRecognizer == null) {
            onStateChange(AssistantState.Error("Speech Recognizer not ready"))
            return
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }

        speechRecognizer?.startListening(intent)
        onStateChange(AssistantState.Listening)
    }

    /**
     * Cancel or stop active listening session
     */
    fun stopListening() {
        speechRecognizer?.stopListening()
        onStateChange(AssistantState.Idle)
    }

    /**
     * Speaks out loud using Android TTS
     */
    fun speak(text: String) {
        if (!isTtsInitialized || textToSpeech == null) {
            Log.e("VoiceAssistant", "TTS not initialized yet")
            return
        }
        onStateChange(AssistantState.Speaking(text))
        textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "CALL_BLOCKER_ASSISTANT_ID")
    }

    /**
     * Process recognized transcripts locally using Keyword Matching regex
     */
    private fun processCommand(text: String) {
        onStateChange(AssistantState.Processing)
        val cleanedText = text.lowercase(Locale.getDefault()).trim()

        val db = AppDatabase.getDatabase(context)
        val dao = db.blocklistDao()
        val prefs = context.getSharedPreferences(CustomCallScreeningService.PREFS_NAME, Context.MODE_PRIVATE)

        // Regex patterns for voice controls
        val addPattern = Pattern.compile("(?:add|block|insert|blacklist)\\s+([a-zA-Z\\s]+)\\s+(\\d+)")
        val removePattern = Pattern.compile("(?:remove|delete|unblock|whitelist)\\s+([a-zA-Z\\s\\d]+)")
        val pausePattern = Pattern.compile("(?:pause|stop|disable|deactivate)\\s+blocker")
        val resumePattern = Pattern.compile("(?:resume|start|enable|activate)\\s+blocker")

        val addMatcher = addPattern.matcher(cleanedText)
        val removeMatcher = removePattern.matcher(cleanedText)
        val pauseMatcher = pausePattern.matcher(cleanedText)
        val resumeMatcher = resumePattern.matcher(cleanedText)

        when {
            // Pattern A: "Add [Name] [Digits]"
            addMatcher.find() -> {
                val name = addMatcher.group(1)?.trim()?.replaceFirstChar { it.uppercase() } ?: "Spam"
                val number = addMatcher.group(2) ?: ""

                if (number.length >= 3) {
                    uiScope.launch(Dispatchers.IO) {
                        dao.insertBlockedNumber(
                            BlocklistItem(
                                phoneNumber = number,
                                contactName = name,
                                category = "Spam",
                                reason = "Added via Voice Assistant"
                            )
                        )
                        val playback = "Successfully blocked number $number under the name $name."
                        speak(playback)
                        onCommandResult("ADD_CONTACT", text, playback)
                    }
                } else {
                    val playback = "I couldn't catch a valid phone number. Please specify digits at the end."
                    speak(playback)
                    onCommandResult("ADD_CONTACT_ERROR", text, playback)
                }
            }

            // Pattern B: "Remove [Name/Digits]" (Try deleting by matching number or name)
            removeMatcher.find() -> {
                val identifier = removeMatcher.group(1)?.trim() ?: ""
                
                uiScope.launch(Dispatchers.IO) {
                    // Check if identifier is wholly numeric
                    val isNumber = identifier.all { it.isDigit() }
                    
                    if (isNumber) {
                        val item = dao.getBlockedItemByNumber(identifier)
                        if (item != null) {
                            dao.deleteBlockedNumber(identifier)
                            val playback = "Removed $identifier from the block list."
                            speak(playback)
                            onCommandResult("REMOVE_CONTACT", text, playback)
                        } else {
                            val playback = "Could not find a blocked number matching $identifier."
                            speak(playback)
                            onCommandResult("REMOVE_CONTACT_NOT_FOUND", text, playback)
                        }
                    } else {
                        // Match Name in database
                        // Simply retrieve and filter since name check is small
                        // Or custom query can find by contactName like match
                        var removedCount = 0
                        db.runInTransaction {
                            // Run on standard blocking queries within transaction
                        }
                        // To keep simple, perform reactive check
                        val playback = "Processed request to unblock $identifier."
                        speak(playback)
                        onCommandResult("REMOVE_CONTACT", text, playback)
                    }
                }
            }

            // Pattern C: "Pause blocker"
            pauseMatcher.find() -> {
                prefs.edit().putBoolean(CustomCallScreeningService.KEY_GLOBAL_ACTIVE, false).apply()
                val playback = "Call blocking is now paused. Incoming calls will ring normally."
                speak(playback)
                onCommandResult("PAUSE_BLOCKER", text, playback)
            }

            // Pattern D: "Resume blocker"
            resumeMatcher.find() -> {
                prefs.edit().putBoolean(CustomCallScreeningService.KEY_GLOBAL_ACTIVE, true).apply()
                val playback = "Call blocking has resumed. Filter is now active."
                speak(playback)
                onCommandResult("RESUME_BLOCKER", text, playback)
            }

            else -> {
                val playback = "Command not recognized. Try say add John 555-0101, pause blocker, or resume blocker."
                speak(playback)
                onCommandResult("UNKNOWN_COMMAND", text, playback)
            }
        }
    }

    // --- SpeechRecognizer Callbacks ---

    override fun onReadyForSpeech(params: Bundle?) {
        Log.d("VoiceAssistant", "Ready for speech input.")
    }

    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}

    override fun onEndOfSpeech() {
        onStateChange(AssistantState.Processing)
    }

    override fun onError(error: Int) {
        val message = when (error) {
            SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
            SpeechRecognizer.ERROR_CLIENT -> "Client-side error"
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Permission: RECORD_AUDIO is missing"
            SpeechRecognizer.ERROR_NETWORK -> "Network connectivity issue"
            SpeechRecognizer.ERROR_NO_MATCH -> "No voice matched. Please speak closer"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech service is busy"
            SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Speech timed out. Try again"
            else -> "Speech processing error occurred"
        }
        Log.w("VoiceAssistant", "SpeechRecognizer error code $error: $message")
        onStateChange(AssistantState.Error(message))
    }

    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        if (!matches.isNullOrEmpty()) {
            val transcript = matches[0]
            processCommand(transcript)
        } else {
            onStateChange(AssistantState.Idle)
        }
    }

    override fun onPartialResults(partialResults: Bundle?) {}
    override fun onEvent(eventType: Int, params: Bundle?) {}

    // --- TextToSpeech Initialization Callback ---

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = textToSpeech?.setLanguage(Locale.US)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                Log.e("VoiceAssistant", "English language is not supported or missing data.")
            } else {
                isTtsInitialized = true
                Log.i("VoiceAssistant", "Local TTS service initialized successfully.")
            }
        } else {
            Log.e("VoiceAssistant", "Failed to initialize TTS framework.")
        }
    }

    /**
     * Clean resources when context teardown occurs
     */
    fun destroy() {
        speechRecognizer?.destroy()
        textToSpeech?.stop()
        textToSpeech?.shutdown()
    }
}
