package com.example.callblocker.data

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
    val title: String = "Meeting", // Title of the scheduled pause (e.g. "Meeting", "Family Time")
    val isEnabled: Boolean = true
) {
    /**
     * Checks if this pause period is currently active at given timestamp
     */
    fun isActiveAt(timestamp: Long): Boolean {
        return isEnabled && timestamp in startTime..endTime
    }
}
