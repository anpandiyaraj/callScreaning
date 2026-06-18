package com.example.callblocker.data

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
)
