package com.example.callblocker.ui

import androidx.compose.animation.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import com.example.callblocker.data.BlocklistItem
import com.example.callblocker.voice.VoiceAssistantManager

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun BlocklistDashboard(
    viewModel: BlocklistViewModel,
    onRequestRole: () -> Unit,
    onMicClicked: () -> Unit,
    onNavigateToCalendar: () -> Unit,
    modifier: Modifier = Modifier
) {
    val blockedList by viewModel.blockedNumbers.collectAsState()
    val isActive by viewModel.isBlockerActive.collectAsState()
    val assistantState by viewModel.assistantState.collectAsState()
    val lastCommand by viewModel.recognizedCommand.collectAsState()

    var showAddDialog by remember { mutableStateOf(false) }
    var numberInput by remember { mutableStateOf("") }
    var nameInput by remember { mutableStateOf("") }
    var categorySelect by remember { mutableStateOf("Spam") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Call Blocker", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = onNavigateToCalendar) {
                        Icon(
                            imageVector = Icons.Default.DateRange,
                            contentDescription = "Open Calendar Scheduler"
                        )
                    }
                    IconButton(onClick = onRequestRole) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = "Set Default Screening App"
                        )
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
                onClick = onMicClicked,
                shape = CircleShape,
                containerColor = when (assistantState) {
                    is VoiceAssistantManager.AssistantState.Listening -> MaterialTheme.colorScheme.error
                    is VoiceAssistantManager.AssistantState.Processing -> MaterialTheme.colorScheme.tertiary
                    else -> MaterialTheme.colorScheme.primary
                }
            ) {
                Icon(
                    imageVector = when (assistantState) {
                        is VoiceAssistantManager.AssistantState.Listening -> Icons.Default.Mic
                        is VoiceAssistantManager.AssistantState.Processing -> Icons.Default.Sync
                        else -> Icons.Default.MicNone
                    },
                    contentDescription = "Voice Control microphone trigger",
                    tint = Color.White,
                    modifier = Modifier.size(28.dp)
                )
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
            // --- Global Active Screen Switch Card ---
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isActive) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = if (isActive) Icons.Default.CheckCircle else Icons.Default.PowerSettingsNew,
                                contentDescription = null,
                                tint = if (isActive) MaterialTheme.colorScheme.primary else Color.Gray,
                                modifier = Modifier.size(32.dp)
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = if (isActive) "Blocker Engine: Active" else "Blocker Engine: Paused",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp
                                )
                                Text(
                                    text = if (isActive) "Spam callers will be silently dropped." else "Calls are not filtered and will ring.",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        Switch(
                            checked = isActive,
                            onCheckedChange = { viewModel.setBlockerActive(it) }
                        )
                    }
                }
            }

            // --- Voice Assistant Alert Drawer ---
            AnimatedVisibility(
                visible = assistantState !is VoiceAssistantManager.AssistantState.Idle || lastCommand != null,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut()
            ) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.GraphicEq,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onTertiaryContainer
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Hands-free Voice Assistant",
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onTertiaryContainer
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = when (assistantState) {
                                is VoiceAssistantManager.AssistantState.Listening -> "Listening... Say, e.g., \"Add Spammer 18005550291\""
                                is VoiceAssistantManager.AssistantState.Processing -> "Processing command patterns..."
                                is VoiceAssistantManager.AssistantState.Speaking -> "Responding out loud..."
                                else -> lastCommand ?: ""
                            },
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onTertiaryContainer
                        )
                        if (lastCommand != null) {
                            TextButton(
                                onClick = { viewModel.clearLatestCommand() },
                                modifier = Modifier.align(Alignment.End)
                            ) {
                                Text("Dismiss", color = MaterialTheme.colorScheme.onTertiaryContainer)
                            }
                        }
                    }
                }
            }

            // --- Spammer List Section ---
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Local Blocklist (${blockedList.size})",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Button(
                    onClick = { showAddDialog = true },
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Number")
                }
            }

            if (blockedList.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.Block,
                            contentDescription = null,
                            tint = Color.Gray,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Block list is currently empty.\nPress Mic and say \"Add spam 18005550199\"",
                            textAlign = TextAlign.Center,
                            color = Color.Gray
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    items(blockedList, key = { it.phoneNumber }) { item ->
                        BlockItemRow(
                            item = item,
                            onDelete = { viewModel.deleteBlockedNumber(item.phoneNumber) },
                            modifier = Modifier.animateItem(
                                fadeInSpec = null,
                                fadeOutSpec = null
                            )
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }
    }

    // --- Add Blocked Number Dialog ---
    if (showAddDialog) {
        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Block Number Manually") },
            text = {
                Column {
                    OutlinedTextField(
                        value = numberInput,
                        onValueChange = { numberInput = it },
                        label = { Text("Phone Number") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = nameInput,
                        onValueChange = { nameInput = it },
                        label = { Text("Contact Name (Optional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("Category Tag:")
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        listOf("Spam", "Telemarketer", "Scam").forEach { category ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { categorySelect = category }
                                    .padding(8.dp)
                            ) {
                                RadioButton(
                                    selected = categorySelect == category,
                                    onClick = { categorySelect = category }
                                )
                                Text(category)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (numberInput.isNotBlank()) {
                            viewModel.addBlockedNumber(
                                number = numberInput,
                                name = if (nameInput.isBlank()) null else nameInput,
                                category = categorySelect
                            )
                            showAddDialog = false
                            numberInput = ""
                            nameInput = ""
                        }
                    }
                ) {
                    Text("Block")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
fun BlockItemRow(
    item: BlocklistItem,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
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
                Text(
                    text = item.contactName ?: "Spam Alert",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
                Text(
                    text = item.phoneNumber,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(4.dp))
                SuggestionChip(
                    onClick = {},
                    label = { Text(item.category, fontSize = 10.sp) },
                    modifier = Modifier.height(24.dp)
                )
            }
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Unblock this Caller",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
