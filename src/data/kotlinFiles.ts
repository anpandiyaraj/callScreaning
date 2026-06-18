export interface KotlinFile {
  name: string;
  path: string;
  type: string;
  code: string;
}

export const KOTLIN_PROJECT_FILES: KotlinFile[] = [
  {
    name: "AndroidManifest.xml",
    path: "app/src/main/AndroidManifest.xml",
    type: "xml",
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.callblocker">

    <!-- Core Permissions required for call screening and blocking -->
    <uses-permission android:name="android.permission.READ_PHONE_STATE" />
    <uses-permission android:name="android.permission.ANSWER_PHONE_CALLS" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    
    <!-- Required to record user voice for the local Voice Assistant -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    
    <!-- Required if we access local system contacts to verify family/friends -->
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    
    <!-- Required to schedule background tasks for blocking schedule windows -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.IntelligentCallBlocker">

        <!-- Main Dashboard Activity -->
        <activity
            android:name=".ui.MainActivity"
            android:exported="true"
            android:theme="@style/Theme.IntelligentCallBlocker">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- 
          The Custom Call Screening Service.
          Must demand the BIND_SCREENING_SERVICE permission so only the Android system OS 
          can bind to it to screen incoming numbers.
        -->
        <service
            android:name=".service.CustomCallScreeningService"
            android:permission="android.permission.BIND_SCREENING_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.telecom.CallScreeningService" />
            </intent-filter>
        </service>

        <!-- Dynamic receiver to reinitialize WorkManager on boot for calendar blocks -->
        <receiver
            android:name=".service.BootReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

    </application>
</manifest>`
  },
  {
    name: "BlocklistItem.kt",
    path: "app/src/main/java/com/example/callblocker/data/BlocklistItem.kt",
    type: "kotlin",
    code: `package com.example.callblocker.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room Entity representing a number in the blocked caller list.
 */
@Entity(tableName = "blocked_numbers")
data class BlocklistItem(
    @PrimaryKey
    val phoneNumber: String, // Normalized phone number
    val contactName: String?, // Name if the user saved it with metadata
    val category: String = "Spam", // "Spam", "Telemarketer", "Custom", "Scam"
    val reason: String? = null, // Optional custom blocker reason notes
    val addedTimestamp: Long = System.currentTimeMillis()
)`
  },
  {
    name: "PausePeriod.kt",
    path: "app/src/main/java/com/example/callblocker/data/PausePeriod.kt",
    type: "kotlin",
    code: `package com.example.callblocker.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room Entity representing a time period where call blocking is temporarily paused,
 * e.g., during scheduled meetings, doctors appointments, study slots, or sleep.
 */
@Entity(tableName = "pause_periods")
data class PausePeriod(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val startTime: Long, // Start epoch timestamp (ms)
    val endTime: Long,   // End epoch timestamp (ms)
    val title: String = "Meeting", // Title of the scheduled pause
    val isEnabled: Boolean = true
) {
    fun isActiveAt(timestamp: Long): Boolean {
        return isEnabled && timestamp in startTime..endTime
    }
}`
  },
  {
    name: "BlocklistDao.kt",
    path: "app/src/main/java/com/example/callblocker/data/BlocklistDao.kt",
    type: "kotlin",
    code: `package com.example.callblocker.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface BlocklistDao {

    @Query("SELECT * FROM blocked_numbers ORDER BY addedTimestamp DESC")
    fun getAllBlockedNumbers(): Flow<List<BlocklistItem>>

    @Query("SELECT EXISTS(SELECT 1 FROM blocked_numbers WHERE phoneNumber = :phoneNumber)")
    suspend fun isNumberBlocked(phoneNumber: String): Boolean

    @Query("SELECT * FROM blocked_numbers WHERE phoneNumber = :phoneNumber LIMIT 1")
    suspend fun getBlockedItemByNumber(phoneNumber: String): BlocklistItem?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBlockedNumber(item: BlocklistItem)

    @Query("DELETE FROM blocked_numbers WHERE phoneNumber = :phoneNumber")
    suspend fun deleteBlockedNumber(phoneNumber: String)

    @Delete
    suspend fun deleteBlockedItem(item: BlocklistItem)

    // --- Pause/Suspend Block Intervals ---

    @Query("SELECT * FROM pause_periods ORDER BY startTime ASC")
    fun getAllPausePeriods(): Flow<List<PausePeriod>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPausePeriod(period: PausePeriod): Long

    @Query("DELETE FROM pause_periods WHERE id = :id")
    suspend fun deletePausePeriod(id: Int)

    @Query("SELECT * FROM pause_periods WHERE isEnabled = 1 AND :currentTime BETWEEN startTime AND endTime")
    suspend fun getActivePausePeriods(currentTime: Long): List<PausePeriod>
}`
  },
  {
    name: "AppDatabase.kt",
    path: "app/src/main/java/com/example/callblocker/data/AppDatabase.kt",
    type: "kotlin",
    code: `package com.example.callblocker.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [BlocklistItem::class, PausePeriod::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun blocklistDao(): BlocklistDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "intelligent_call_blocker_db"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}`
  },
  {
    name: "CustomCallScreeningService.kt",
    path: "app/src/main/java/com/example/callblocker/service/CustomCallScreeningService.kt",
    type: "kotlin",
    code: `package com.example.callblocker.service

import android.content.Context
import android.net.Uri
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import com.example.callblocker.data.AppDatabase
import kotlinx.coroutines.runBlocking

/**
 * Android system service that triggers for every incoming call when this app
 * is registered and configured by the user as the Default Call Screening App.
 */
class CustomCallScreeningService : CallScreeningService() {

    companion object {
        private const val TAG = "CallScreeningService"
        const val PREFS_NAME = "CallBlockerPrefs"
        const val KEY_GLOBAL_ACTIVE = "global_blocker_active"
    }

    override fun onScreenCall(callDetails: Call.Details) {
        if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) {
            allowCall(callDetails)
            return
        }

        val handle: Uri? = callDetails.handle
        val rawNumber = handle?.schemeSpecificPart ?: ""
        val normalizedNumber = normalizePhoneNumber(rawNumber)

        if (normalizedNumber.isEmpty()) {
            allowCall(callDetails)
            return
        }

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isBlockerActive = prefs.getBoolean(KEY_GLOBAL_ACTIVE, true)

        if (!isBlockerActive) {
            Log.d(TAG, "Call allowed: Blocking engine is GLOBALLY PAUSED.")
            allowCall(callDetails)
            return
        }

        val db = AppDatabase.getDatabase(this)
        val dao = db.blocklistDao()
        val currentTime = System.currentTimeMillis()

        // Sync scheduled pauses
        val activeCalendarPauses = runBlocking { dao.getActivePausePeriods(currentTime) }
        if (activeCalendarPauses.isNotEmpty()) {
            Log.d(TAG, "Call allowed: Suspended by active scheduled pause: \${activeCalendarPauses.first().title}")
            allowCall(callDetails)
            return
        }

        val isBlocked = runBlocking {
            dao.isNumberBlocked(normalizedNumber)
        }

        if (isBlocked) {
            Log.i(TAG, "SYSTEM INTERCEPT: Spam call detected and rejected from \$normalizedNumber")
            blockCall(callDetails)
        } else {
            allowCall(callDetails)
        }
    }

    private fun blockCall(callDetails: Call.Details) {
        val response = CallResponse.Builder()
            .setDisallowCall(true)
            .setRejectCall(true)
            .setSkipCallLog(false)
            .setSkipNotification(true)
            .build()
        respondToCall(callDetails, response)
    }

    private fun allowCall(callDetails: Call.Details) {
        val response = CallResponse.Builder()
            .setDisallowCall(false)
            .setRejectCall(false)
            .build()
        respondToCall(callDetails, response)
    }

    private fun normalizePhoneNumber(raw: String): String {
        var clean = raw.replace(Regex("[^0-9+]"), "")
        if (clean.startsWith("+1") && clean.length > 2) {
            clean = clean.substring(2)
        }
        return clean
    }
}`
  },
  {
    name: "VoiceAssistantManager.kt",
    path: "app/src/main/java/com/example/callblocker/voice/VoiceAssistantManager.kt",
    type: "kotlin",
    code: `package com.example.callblocker.voice

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
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                setRecognitionListener(this@VoiceAssistantManager)
            }
        }
        textToSpeech = TextToSpeech(context, this)
    }

    fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
        }
        speechRecognizer?.startListening(intent)
        onStateChange(AssistantState.Listening)
    }

    private fun processCommand(text: String) {
        onStateChange(AssistantState.Processing)
        val cleaned = text.lowercase(Locale.getDefault()).trim()
        val db = AppDatabase.getDatabase(context)
        val dao = db.blocklistDao()
        val prefs = context.getSharedPreferences(CustomCallScreeningService.PREFS_NAME, Context.MODE_PRIVATE)

        val addPattern = Pattern.compile("(?:add|block|insert|blacklist)\\\\s+([a-zA-Z\\\\s]+)\\\\s+(\\\\d+)")
        val pausePattern = Pattern.compile("(?:pause|stop|disable|deactivate)\\\\s+blocker")
        val resumePattern = Pattern.compile("(?:resume|start|enable|activate)\\\\s+blocker")

        val addMatcher = addPattern.matcher(cleaned)
        val pauseMatcher = pausePattern.matcher(cleaned)
        val resumeMatcher = resumePattern.matcher(cleaned)

        when {
            addMatcher.find() -> {
                val name = addMatcher.group(1)?.trim()?.replaceFirstChar { it.uppercase() } ?: "Spam"
                val number = addMatcher.group(2) ?: ""
                uiScope.launch(Dispatchers.IO) {
                    dao.insertBlockedNumber(BlocklistItem(number, name))
                    val speech = "Successfully blocked number \$number under the name \$name."
                    speak(speech)
                    onCommandResult("ADD_CONTACT", text, speech)
                }
            }
            pauseMatcher.find() -> {
                prefs.edit().putBoolean(CustomCallScreeningService.KEY_GLOBAL_ACTIVE, false).apply()
                val speech = "Call blocking is now paused. Incoming calls will ring normally."
                speak(speech)
                onCommandResult("PAUSE_BLOCKER", text, speech)
            }
            resumeMatcher.find() -> {
                prefs.edit().putBoolean(CustomCallScreeningService.KEY_GLOBAL_ACTIVE, true).apply()
                val speech = "Call blocking has resumed. Filter is now active."
                speak(speech)
                onCommandResult("RESUME_BLOCKER", text, speech)
            }
            else -> {
                val speech = "Command not recognized. Say, 'add John 555-1234' or 'pause blocker'."
                speak(speech)
                onCommandResult("UNKNOWN_COMMAND", text, speech)
            }
        }
    }

    fun speak(text: String) {
        textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "CALL_BLOCKER_ID")
    }

    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        if (!matches.isNullAsEmpty()) {
            processCommand(matches[0])
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech?.setLanguage(Locale.US)
            isTtsInitialized = true
        }
    }

    override fun onReadyForSpeech(p0: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(p0: Float) {}
    override fun onBufferReceived(p0: ByteArray?) {}
    override fun onEndOfSpeech() {}
    override fun onError(p0: Int) {}
    override fun onPartialResults(p0: Bundle?) {}
    override fun onEvent(p0: Int, p1: Bundle?) {}
    fun destroy() {
        speechRecognizer?.destroy()
        textToSpeech?.shutdown()
    }
}`
  },
  {
    name: "MainActivity.kt",
    path: "app/src/main/java/com/example/callblocker/ui/MainActivity.kt",
    type: "kotlin",
    code: `package com.example.callblocker.ui

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.material3.Surface
import androidx.lifecycle.lifecycleScope
import com.example.callblocker.voice.VoiceAssistantManager

class MainActivity : ComponentActivity() {

    private val viewModel: BlocklistViewModel by viewModels()
    private var voiceAssistantManager: VoiceAssistantManager? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        voiceAssistantManager = VoiceAssistantManager(
            context = this,
            uiScope = lifecycleScope,
            onStateChange = { viewModel.updateAssistantState(it) },
            onCommandResult = { cmd, tr, sp -> viewModel.setLatestCommandResult(cmd, tr, sp) }
        )

        setContent {
            IntelligentCallBlockerTheme {
                Surface {
                    // Compose screens navigation layout
                }
            }
        }
    }
}`
  }
];
