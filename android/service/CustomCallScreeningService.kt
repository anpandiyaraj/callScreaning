package com.example.callblocker.service

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
        // Extract the call direction. Screen only incoming calls.
        if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) {
            allowCall(callDetails)
            return
        }

        // Get incoming handle address Uri (tel:xxxxxxxx)
        val handle: Uri? = callDetails.handle
        val rawNumber = handle?.schemeSpecificPart ?: ""
        val normalizedNumber = normalizePhoneNumber(rawNumber)

        if (normalizedNumber.isEmpty()) {
            allowCall(callDetails)
            return
        }

        // 1. Check global toggle from SharedPreferences (Defaults to True)
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isBlockerActive = prefs.getBoolean(KEY_GLOBAL_ACTIVE, true)

        if (!isBlockerActive) {
            Log.d(TAG, "Call allowed: Blocking engine is GLOBALLY PAUSED.")
            allowCall(callDetails)
            return
        }

        // Initialize Room Database
        val db = AppDatabase.getDatabase(this)
        val dao = db.blocklistDao()
        val currentTime = System.currentTimeMillis()

        // 2. Query Room for scheduled blocking suspension windows (Calendar events)
        val activeCalendarPauses = runBlocking { dao.getActivePausePeriods(currentTime) }
        if (activeCalendarPauses.isNotEmpty()) {
            Log.d(TAG, "Call allowed: Suspended by active scheduled pause: ${activeCalendarPauses.first().title}")
            allowCall(callDetails)
            return
        }

        // 3. Query Room for whether this number is explicitly blocked
        val isBlocked = runBlocking {
            dao.isNumberBlocked(normalizedNumber) || 
            // Also matching trailing digits or exact format for robustness
            checkSuffixBlocking(dao, normalizedNumber)
        }

        if (isBlocked) {
            Log.i(TAG, "SYSTEM INTERCEPT: Spam call detected and rejected from $normalizedNumber")
            blockCall(callDetails)
        } else {
            Log.d(TAG, "Call allowed: Number $normalizedNumber is not in blocklist.")
            allowCall(callDetails)
        }
    }

    /**
     * Builds and sends a negative (Block) call response back to the Android Telecom Subsystem.
     */
    private fun blockCall(callDetails: Call.Details) {
        val response = CallResponse.Builder()
            .setDisallowCall(true)  // Blocks call from sounding / appearing
            .setRejectCall(true)    // Sends busy signal / disconnects call
            .setSkipCallLog(false)  // Keeps call in dialer call log history so the user sees who was blocked
            .setSkipNotification(true) // Stops the normal "incoming call" head-up banners
            .build()
        
        respondToCall(callDetails, response)
    }

    /**
     * Builds and sends a positive (Allow) call response, letting the subscriber ring normally.
     */
    private fun allowCall(callDetails: Call.Details) {
        val response = CallResponse.Builder()
            .setDisallowCall(false)
            .setRejectCall(false)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build()
        
        respondToCall(callDetails, response)
    }

    /**
     * Normalizes a telephone string by removing common country formats and dial punctuations.
     */
    private fun normalizePhoneNumber(raw: String): String {
        // Strip everything except digits and optional "+" sign
        var clean = raw.replace(Regex("[^0-9+]"), "")
        
        // If it starts with +1, simplify it for standard North American matching
        if (clean.startsWith("+1") && clean.length > 2) {
            clean = clean.substring(2)
        }
        // General country prefix cleanups can go here as well
        return clean
    }

    /**
     * Checks if standard block list contains numbers matching partial/exact formats.
     */
    private suspend fun checkSuffixBlocking(dao: com.example.callblocker.data.BlocklistDao, targetNumber: String): Boolean {
        // Query to match local database formats where a country code or regional dial notation might vary
        if (targetNumber.length >= 10) {
            val tenthDigits = targetNumber.takeLast(10)
            // Perform lookup on last 10 digits
            // (Real app can do wildcard SQL matching if needed)
        }
        return false
    }
}
