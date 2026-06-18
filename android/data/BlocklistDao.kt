package com.example.callblocker.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface BlocklistDao {

    // --- Blocked Caller Query & Mutation ---

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
}
