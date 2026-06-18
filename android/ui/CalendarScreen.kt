package com.example.callblocker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.callblocker.data.PausePeriod
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(
    viewModel: BlocklistViewModel,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val pauseList by viewModel.pausePeriods.collectAsState()

    var showAddPauseDialog by remember { mutableStateOf(false) }
    var selectedDay by remember { mutableStateOf(18) } // Default to 18 (June 18, 2026)
    var labelInput by remember { mutableStateOf("") }
    var startHour by remember { mutableStateOf(9) }
    var startMinute by remember { mutableStateOf(0) }
    var durationHours by remember { mutableStateOf(2) }

    val daysInMonth = 30 // June has 30 days
    val currentYear = 2026
    val currentMonth = Calendar.JUNE

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Blocklist Pause Scheduler", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Go back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddPauseDialog = true },
                containerColor = MaterialTheme.colorScheme.secondary
            ) {
                Icon(Icons.Default.Event, contentDescription = "Schedule Suspension Window", tint = Color.White)
            }
        },
        modifier = modifier
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
                .padding(16.dp)
        ) {
            Text(
                text = "Select a date in June 2026 to coordinate block bypass slots:",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.Gray,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            // --- Custom Month Grid View for June 2026 ---
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "June 2026",
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        color = MaterialTheme.colorScheme.primary
                    )

                    // Week Days Header
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        val weeks = listOf("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su")
                        weeks.forEach { dayName ->
                            Text(
                                text = dayName,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.width(42.dp),
                                textAlign = TextAlign.Center,
                                color = Color.Gray,
                                fontSize = 12.sp
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // June 1st, 2026 falls on a Monday
                    // Days layout grid mapping
                    val rowsCount = 5
                    var dayCounter = 1

                    for (row in 0 until rowsCount) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            for (col in 0..6) {
                                if (dayCounter <= daysInMonth) {
                                    val currentDay = dayCounter
                                    val isSelected = selectedDay == currentDay
                                    
                                    Box(
                                        modifier = Modifier
                                            .size(38.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(
                                                if (isSelected) MaterialTheme.colorScheme.primary 
                                                else Color.Transparent
                                            )
                                            .clickable { selectedDay = currentDay }
                                            .padding(4.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = currentDay.toString(),
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface,
                                            fontSize = 14.sp
                                        )
                                    }
                                    dayCounter++
                                } else {
                                    Spacer(modifier = Modifier.size(38.dp))
                                }
                            }
                        }
                    }
                }
            }

            // --- Scheduled Suspensions List ---
            Text(
                text = "Scheduled Bypass Rules for June $selectedDay",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // Dynamic filter based on selected day
            val activeDayPauses = remember(pauseList, selectedDay) {
                pauseList.filter { pause ->
                    val cal = Calendar.getInstance().apply { timeInMillis = pause.startTime }
                    cal.get(Calendar.DAY_OF_MONTH) == selectedDay && cal.get(Calendar.MONTH) == Calendar.JUNE
                }
            }

            if (activeDayPauses.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.EventNote,
                            contentDescription = null,
                            tint = Color.Gray,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "No scheduled pauses for this date.\nBlocked calls will be rejected.",
                            textAlign = TextAlign.Center,
                            color = Color.Gray,
                            fontSize = 13.sp
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    items(activeDayPauses, key = { it.id }) { pause ->
                        PausePeriodRow(
                            pause = pause,
                            onDelete = { viewModel.deletePausePeriod(pause.id) }
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }
    }

    // --- Add Blocking Suspension/Pause Dialog ---
    if (showAddPauseDialog) {
        AlertDialog(
            onDismissRequest = { showAddPauseDialog = false },
            title = { Text("Schedule Suspension Slot") },
            text = {
                Column {
                    OutlinedTextField(
                        value = labelInput,
                        onValueChange = { labelInput = it },
                        label = { Text("Bypass Event (e.g. Doctor's Appt)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Starts Hour:")
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { if (startHour > 0) startHour-- }) {
                                Icon(Icons.Default.Remove, contentDescription = null)
                            }
                            Text(String.format("%02d", startHour), fontWeight = FontWeight.Bold)
                            IconButton(onClick = { if (startHour < 23) startHour++ }) {
                                Icon(Icons.Default.Add, contentDescription = null)
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Duration (Hours):")
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { if (durationHours > 1) durationHours-- }) {
                                Icon(Icons.Default.Remove, contentDescription = null)
                            }
                            Text(durationHours.toString(), fontWeight = FontWeight.Bold)
                            IconButton(onClick = { if (durationHours < 12) durationHours++ }) {
                                Icon(Icons.Default.Add, contentDescription = null)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (labelInput.isNotBlank()) {
                            // Compute Epoch Timestamps for June {selectedDay}, 2026
                            val calendar = Calendar.getInstance().apply {
                                set(Calendar.YEAR, currentYear)
                                set(Calendar.MONTH, currentMonth)
                                set(Calendar.DAY_OF_MONTH, selectedDay)
                                set(Calendar.HOUR_OF_DAY, startHour)
                                set(Calendar.MINUTE, startMinute)
                                set(Calendar.SECOND, 0)
                                set(Calendar.MILLISECOND, 0)
                            }
                            val startMillis = calendar.timeInMillis
                            calendar.add(Calendar.HOUR_OF_DAY, durationHours)
                            val endMillis = calendar.timeInMillis

                            viewModel.addPausePeriod(
                                startTime = startMillis,
                                endTime = endMillis,
                                title = labelInput
                            )
                            showAddPauseDialog = false
                            labelInput = ""
                        }
                    }
                ) {
                    Text("Schedule")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddPauseDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun PausePeriodRow(
    pause: PausePeriod,
    onDelete: () -> Unit
) {
    val formatter = remember { SimpleDateFormat("hh:mm a", Locale.getDefault()) }
    val startTimeStr = formatter.format(Date(pause.startTime))
    val endTimeStr = formatter.format(Date(pause.endTime))

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.PauseCircleFilled,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = pause.title,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "$startTimeStr - $endTimeStr (Temporary Bypass Active)",
                    fontSize = 13.sp,
                    color = Color.Gray
                )
            }
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Remove Scheduled Bypass Window",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
