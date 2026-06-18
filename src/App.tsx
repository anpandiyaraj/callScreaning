import React, { useState, useEffect, useRef } from "react";
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Volume2, 
  ShieldCheck, 
  Check, 
  Settings, 
  X, 
  Clock, 
  ArrowLeft,
  BookOpen,
  Info,
  Sliders,
  Sparkles,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SourceInspector from "./components/SourceInspector";

// Mock database format
interface BlockedItem {
  phoneNumber: string;
  contactName: string | null;
  category: string;
  reason: string;
  addedTimestamp: number;
}

interface PauseSlot {
  id: number;
  startTimeStr: string; // "09:00 AM" etc.
  endTimeStr: string;
  title: string;
}

export default function App() {
  // --- States for Room DB Simulation ---
  const [blockedList, setBlockedList] = useState<BlockedItem[]>([
    {
      phoneNumber: "18005550199",
      contactName: "IRS Tax Scam",
      category: "Scam",
      reason: "Blocked automatically on start",
      addedTimestamp: Date.now() - 36000000
    },
    {
      phoneNumber: "15550188",
      contactName: "Car Loan Telemarket",
      category: "Telemarketer",
      reason: "Robocaller frequency pattern matching",
      addedTimestamp: Date.now() - 18000000
    },
    {
      phoneNumber: "13125556789",
      contactName: "IRS Gift Card Spoof",
      category: "Scam",
      reason: "Voice added candidate",
      addedTimestamp: Date.now() - 2000000
    }
  ]);

  // Calendar scheduled pause windows (June 18, 2026)
  const [pauseSlots, setPauseSlots] = useState<PauseSlot[]>([
    {
      id: 1,
      startTimeStr: "09:00 AM",
      endTimeStr: "11:30 AM",
      title: "Boardroom Meeting"
    },
    {
      id: 2,
      startTimeStr: "04:00 PM",
      endTimeStr: "06:00 PM",
      title: "Important Family Call"
    }
  ]);

  // System States
  const [isBlockerActive, setIsBlockerActive] = useState<Boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<"dashboard" | "calendar">("dashboard");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(18); // June 18
  const [simulatedTime, setSimulatedTime] = useState<string>("10:30 AM"); // Within Boardroom Meeting time! Set default to trigger allow demonstration!

  // Input states for dialogs inside the simulated phone
  const [showAddManualDialog, setShowAddManualDialog] = useState(false);
  const [manualNumber, setManualNumber] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState("Spam");

  const [showAddPauseDialog, setShowAddPauseDialog] = useState(false);
  const [pauseTitle, setPauseTitle] = useState("");
  const [pauseStartHour, setPauseStartHour] = useState(9);
  const [pauseDurationHours, setPauseDurationHours] = useState(2);

  // Voice Assistant states
  const [assistantState, setAssistantState] = useState<"idle" | "listening" | "processing" | "speaking" | "error">("idle");
  const [assistantText, setAssistantText] = useState<string>("");
  const [transcriptInput, setTranscriptInput] = useState<string>("");
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Call simulator interface
  const [isIncomingCall, setIsIncomingCall] = useState<boolean>(false);
  const [callerName, setCallerName] = useState<string>("Suspected Spammer");
  const [callerNumber, setCallerNumber] = useState<string>("18005550199");
  const [callStatusMessage, setCallStatusMessage] = useState<string>("Inbound Ringing...");
  const [isCallBlocked, setIsCallBlocked] = useState<boolean>(false);
  const [isCallAllowed, setIsCallAllowed] = useState<boolean>(false);
  const [callActive, setCallActive] = useState<boolean>(false);

  // System screening event log tracker
  const [systemLogs, setSystemLogs] = useState<{ id: number; text: string; time: string; type: "info" | "success" | "warning" | "block" }[]>([
    {
      id: 1,
      text: "System: App boot. DB Connection established successfully.",
      time: "03:00:01 AM",
      type: "info"
    },
    {
      id: 2,
      text: "🛡️ CustomCallScreeningService registered to OS as default spam filter.",
      time: "03:00:03 AM",
      type: "success"
    }
  ]);

  // Audio Context for nice synthesizer ringtones
  const audioContextRef = useRef<AudioContext | null>(null);

  const writeLog = (text: string, type: "info" | "success" | "warning" | "block" = "info") => {
    const time = new Date().toLocaleTimeString();
    setSystemLogs(prev => [
      { id: Date.now(), text, time, type },
      ...prev
    ]);
  };

  // Check if simulated time falls within any scheduled pause window
  const checkIsBypassActiveAtTime = (timeStr: string): PauseSlot | undefined => {
    try {
      // Parse current time to minutes
      const [hm, ampm] = timeStr.split(" ");
      const [h, m] = hm.split(":").map(Number);
      let targetMins = h * 60 + m;
      if (ampm === "PM" && h !== 12) targetMins += 12 * 60;
      if (ampm === "AM" && h === 12) targetMins -= 12 * 60;

      // Find matching pause intervals
      return pauseSlots.find(slot => {
        // Parse start to mins
        const [shm, sampm] = slot.startTimeStr.split(" ");
        const [sh, sm] = shm.split(":").map(Number);
        let startMins = sh * 60 + sm;
        if (sampm === "PM" && sh !== 12) startMins += 12 * 60;
        if (sampm === "AM" && sh === 12) startMins -= 12 * 60;

        // Parse end to mins
        const [ehm, eampm] = slot.endTimeStr.split(" ");
        const [eh, em] = ehm.split(":").map(Number);
        let endMins = eh * 60 + em;
        if (eampm === "PM" && eh !== 12) endMins += 12 * 60;
        if (eampm === "AM" && eh === 12) endMins -= 12 * 60;

        return targetMins >= startMins && targetMins <= endMins;
      });
    } catch (e) {
      return undefined;
    }
  };

  const isBypassScheduled = selectedCalendarDay === 18 && checkIsBypassActiveAtTime(simulatedTime) !== undefined;

  // Synthesis speak wrapper
  const triggerTextToSpeech = (speechText: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = "en-US";
      
      utterance.onstart = () => {
        setAssistantState("speaking");
        setAssistantText(speechText);
        writeLog(`TTS Output: "${speechText}"`, "info");
      };
      
      utterance.onend = () => {
        setAssistantState("idle");
      };

      utterance.onerror = () => {
        setAssistantState("idle");
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback
      setAssistantState("speaking");
      setAssistantText(speechText);
      writeLog(`TTS Output (No Speech Synthesis support): "${speechText}"`, "info");
      setTimeout(() => {
        setAssistantState("idle");
      }, 3000);
    }
  };

  // Beep sound generator for call ring or drop synth
  const playSynthesizerTone = (type: "ring" | "drop" | "success" | "beep") => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      if (type === "ring") {
        // High dual pitch alert tone
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.value = 440; // A4
        osc2.type = "sine";
        osc2.frequency.value = 480;

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.2);
        osc2.stop(ctx.currentTime + 1.2);
      } else if (type === "drop") {
        // Flat fail low sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = 180; // Low hum
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.8);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } else if (type === "success") {
        // Happy sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 523.25; // C5
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === "beep") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 600;

        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      // Ignored audio errors
    }
  };

  // Browser voice input support
  const handlePhysicalMicTrigger = () => {
    const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRec) {
      setSpeechError("Speech recognition is not supported in this browser. Please use the shortcut simulation controls directly!");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setAssistantState("listening");
        setSpeechError(null);
      };

      recognition.onresult = (evt: any) => {
        const text = evt.results[0][0].transcript;
        setTranscriptInput(text);
        processCommandPattern(text);
      };

      recognition.onerror = (err: any) => {
        setAssistantState("error");
        setSpeechError("Microphone permission denied or inactive inside preview container.");
        writeLog("Microphone input error on browser speech capture.", "warning");
      };

      recognition.onend = () => {
        // If not processed yet, reset to idle
      };

      recognition.start();
    } catch (e) {
      setAssistantState("error");
    }
  };

  // Process raw text controls (Both Speech-to-Text and Direct Simulator Clicks)
  const processCommandPattern = (text: string) => {
    setAssistantState("processing");
    const cleaned = text.toLowerCase().trim();
    writeLog(`SpeechRecognizer parsed: "${text}"`, "info");

    const addPattern = /(?:add|block|insert|blacklist)\s+([a-zA-Z\s]+)\s+(\d+)/i;
    const removePattern = /(?:remove|delete|unblock|whitelist)\s+(\d+|[a-zA-Z\s]+)/i;
    const pausePattern = /(?:pause|stop|disable|deactivate)\s+blocker/i;
    const resumePattern = /(?:resume|start|enable|activate)\s+blocker/i;

    setTimeout(() => {
      if (addPattern.test(cleaned)) {
        const match = cleaned.match(addPattern);
        if (match) {
          const rawName = match[1].trim();
          const nameFormatted = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          const numberDigits = match[2];

          setBlockedList(prev => [
            ...prev.filter(item => item.phoneNumber !== numberDigits),
            {
              phoneNumber: numberDigits,
              contactName: nameFormatted,
              category: "Spam",
              reason: "Added via Voice Command",
              addedTimestamp: Date.now()
            }
          ]);

          const playback = `Successfully blocked number ${numberDigits} under the name ${nameFormatted}.`;
          triggerTextToSpeech(playback);
          playSynthesizerTone("success");
          writeLog(`DB Mutation: Inserted blocked caller ${numberDigits} (${nameFormatted})`, "success");
        }
      } else if (removePattern.test(cleaned)) {
        const match = cleaned.match(removePattern);
        if (match) {
          const identifier = match[1].trim();
          const isNum = /^\d+$/.test(identifier);
          let found = false;

          if (isNum) {
            const matchIndex = blockedList.findIndex(item => item.phoneNumber === identifier);
            if (matchIndex !== -1) {
              setBlockedList(prev => prev.filter(x => x.phoneNumber !== identifier));
              found = true;
            }
          } else {
            const matchIndex = blockedList.findIndex(item => item.contactName?.toLowerCase().includes(identifier.toLowerCase()));
            if (matchIndex !== -1) {
              const item = blockedList[matchIndex];
              setBlockedList(prev => prev.filter(x => x.phoneNumber !== item.phoneNumber));
              found = true;
            }
          }

          const playback = found 
            ? `Removed ${identifier} from the blocked list.`
            : `Could not find any blocked item matching ${identifier}.`;
          triggerTextToSpeech(playback);
          if (found) playSynthesizerTone("success");
          writeLog(`DB Mutation: Removed entry matching "${identifier}"`, "success");
        }
      } else if (pausePattern.test(cleaned)) {
        setIsBlockerActive(false);
        const playback = "Call blocking is now paused. Incoming calls will ring normally.";
        triggerTextToSpeech(playback);
        playSynthesizerTone("success");
        writeLog("Setting Switch: Globally paused filter screening", "warning");
      } else if (resumePattern.test(cleaned)) {
        setIsBlockerActive(true);
        const playback = "Call blocking has resumed. Filter is now active.";
        triggerTextToSpeech(playback);
        playSynthesizerTone("success");
        writeLog("Setting Switch: Globally resumed filter screening", "success");
      } else {
        const playback = "Command not recognized. Say, 'add scam 18005550100', 'pause blocker' or 'resume blocker'.";
        triggerTextToSpeech(playback);
        setAssistantState("idle");
      }
    }, 1200);
  };

  // Simulated phone caller injector
  const triggerIncomingPhoneCall = () => {
    if (isIncomingCall) return;
    
    // Normalize target digits
    const cleanedDigits = callerNumber.replace(/[^0-9]/g, "");
    
    setIsCallBlocked(false);
    setIsCallAllowed(false);
    setCallActive(false);
    setIsIncomingCall(true);
    setCallStatusMessage("Incoming connection established...");
    writeLog(`Telecom System Inbound Request: ${cleanedDigits} (${callerName})`, "info");

    const activePauseSlot = checkIsBypassActiveAtTime(simulatedTime);

    // CallScreeningService Intercept Cycle
    setTimeout(() => {
      setCallStatusMessage("CustomCallScreeningService screening active...");
      playSynthesizerTone("beep");

      setTimeout(() => {
        // Check 1: Is blocker globally disabled?
        if (!isBlockerActive) {
          setIsCallAllowed(true);
          setCallStatusMessage("Allowed: Call Blocker is globally PAUSED.");
          writeLog(`Call Allowed: Screening service bypassed (Globally Switched Off)`, "warning");
          playCallRepeatingRing();
          return;
        }

        // Check 2: Calendar Bypass Active? (June 18 schedule)
        if (selectedCalendarDay === 18 && activePauseSlot) {
          setIsCallAllowed(true);
          setCallStatusMessage(`Allowed: Suspended by calendar slot "${activePauseSlot.title}"`);
          writeLog(`Call Allowed: Intercept bypassed during scheduled calendar window "${activePauseSlot.title}"`, "warning");
          playCallRepeatingRing();
          return;
        }

        // Check 3: Is number in local list?
        const matchItem = blockedList.find(x => x.phoneNumber === cleanedDigits);
        if (matchItem) {
          setIsCallBlocked(true);
          setCallStatusMessage("REJECTED & DISALLOWED: Instant silent drop executed.");
          writeLog(`🛡️ CALL BLOCKED: screening service matched database list: ${matchItem.phoneNumber} (${matchItem.contactName})`, "block");
          playSynthesizerTone("drop");

          // Timeout to slide down incoming call overlay after drop
          setTimeout(() => {
            setIsIncomingCall(false);
          }, 3500);
        } else {
          setIsCallAllowed(true);
          setCallStatusMessage("Allowed: Caller number is not on the block list.");
          writeLog(`Call Allowed: screening service check passed (Not in block list)`, "success");
          playCallRepeatingRing();
        }

      }, 1500);

    }, 800);
  };

  const playCallRepeatingRing = () => {
    playSynthesizerTone("ring");
    let count = 0;
    const interval = setInterval(() => {
      if (isIncomingCall && !callActive && count < 3 && !isCallBlocked) {
        playSynthesizerTone("ring");
        count++;
      } else {
        clearInterval(interval);
      }
    }, 2000);
  };

  // Add Manuel entry locally
  const addBlocklistItemManually = () => {
    if (!manualNumber) return;
    const cleanedDigits = manualNumber.replace(/[^0-9]/g, "");
    
    setBlockedList(prev => [
      ...prev.filter(x => x.phoneNumber !== cleanedDigits),
      {
        phoneNumber: cleanedDigits,
        contactName: manualName || "Anonymous Spammer",
        category: manualCategory,
        reason: "Added manually via visual layout",
        addedTimestamp: Date.now()
      }
    ]);

    writeLog(`DB Mutation: Blocked caller inserted: ${cleanedDigits} (${manualName || "Anonymous Spammer"})`, "success");
    setManualNumber("");
    setManualName("");
    setShowAddManualDialog(false);
  };

  // Add Scheduled Break Slot manually
  const addCalendarPauseSlot = () => {
    if (!pauseTitle) return;
    
    // Formulate times
    const startHourVal = pauseStartHour;
    const endHourVal = (startHourVal + pauseDurationHours) % 24;

    const startSuffix = startHourVal >= 12 ? "PM" : "AM";
    const startHourStr = startHourVal === 0 ? 12 : startHourVal > 12 ? startHourVal - 12 : startHourVal;
    
    const endSuffix = endHourVal >= 12 ? "PM" : "AM";
    const endHourStr = endHourVal === 0 ? 12 : endHourVal > 12 ? endHourVal - 12 : endHourVal;

    const formattedStart = `${String(startHourStr).padStart(2, "0")}:00 ${startSuffix}`;
    const formattedEnd = `${String(endHourStr).padStart(2, "0")}:00 ${endSuffix}`;

    setPauseSlots(prev => [
      ...prev,
      {
        id: Date.now(),
        startTimeStr: formattedStart,
        endTimeStr: formattedEnd,
        title: pauseTitle
      }
    ]);

    writeLog(`WorkManager configuration scheduled: Pause blocking for "${pauseTitle}" (${formattedStart} - ${formattedEnd})`, "success");
    setPauseTitle("");
    setShowAddPauseDialog(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Visual Navigation Bar */}
      <header className="px-8 py-5 border-b border-slate-900 bg-slate-950 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-widest">
              Standalone Local Environment
            </span>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
            🛡️ Intelligent Call Blocker Sandbox
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Recreating Room queries, custom SpeechRecognizer, and Telecom CallScreeningService logic in Jetpack Compose layout.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800">
          <label className="text-xs text-slate-400 px-2 font-medium">Simulation Clock:</label>
          <div className="flex items-center gap-1.5">
            <select 
              value={simulatedTime} 
              onChange={(e) => {
                setSimulatedTime(e.target.value);
                writeLog(`System Clock changed to ${e.target.value}`, "info");
              }}
              className="bg-slate-950 text-xs text-blue-400 border border-slate-800 hover:border-slate-700 font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
            >
              <option value="08:00 AM">08:00 AM</option>
              <option value="10:30 AM">10:30 AM (In Boardroom Meeting)</option>
              <option value="01:00 PM">01:00 PM</option>
              <option value="04:30 PM">04:30 PM (In Family Call)</option>
              <option value="08:00 PM">08:00 PM</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Sandbox Workspace Layout */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-6 py-6 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* COLUMN 1: High Fidelity Android Phone Mockup (xl:col-span-4) */}
        <div className="xl:col-span-4 flex justify-center sticky top-6">
          <div className="relative w-[370px] h-[760px] bg-black rounded-[52px] shadow-[0_25px_60px_-15px_rgba(0,0,0,1)] border-[10px] border-slate-800 p-3 ring-1 ring-slate-700/50 flex flex-col overflow-hidden">
            
            {/* Phone Ear Piece Camera Notch */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-50 flex items-center justify-center">
              <div className="w-12 h-1 bg-slate-800 rounded-full mb-1"></div>
              <div className="w-2.5 h-2.5 bg-slate-900 rounded-full ml-3 mb-1 border border-slate-800"></div>
            </div>

            {/* Android Screen Container */}
            <div className="flex-1 bg-slate-950 rounded-[40px] overflow-hidden relative flex flex-col select-text">
              
              {/* Android Custom Status Bar (Top UI) */}
              <div className="h-10 px-6 pt-3 pb-1 bg-slate-900 flex items-center justify-between text-[11px] font-semibold text-slate-300 font-mono select-none">
                <span>03:03 AM</span>
                <div className="flex items-center gap-1.5">
                  {isBlockerActive ? (
                    <span className="text-[9px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-sans">
                      <ShieldCheck className="w-2.5 h-2.5" /> Filtering
                    </span>
                  ) : (
                    <span className="text-[9px] bg-amber-600/20 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1 font-sans">
                      Bypass
                    </span>
                  )}
                  <span className="text-slate-500">🟢 LTE</span>
                  <span className="text-slate-400">⚡ 94%</span>
                </div>
              </div>

              {/* ACTIVE PHONE LAYOUT IN METADATA */}
              <div className="flex-1 flex flex-col bg-slate-950 p-4 overflow-y-auto">
                {currentScreen === "dashboard" ? (
                  /* JETPACK COMPOSE: DASHBOARD VIEW */
                  <div className="flex-1 flex flex-col">
                    {/* Compose Row Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-900 select-none">
                      <div className="flex items-center gap-2">
                        <span className="p-1 px-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/40 text-[10px] font-bold">
                          COMPOSE
                        </span>
                        <h3 className="text-sm font-bold text-slate-100">Call Screening Dashboard</h3>
                      </div>
                      <button 
                        onClick={() => setCurrentScreen("calendar")}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Open Calendar Schedule"
                      >
                        <CalendarIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Blocker Engine Status Toggle Card */}
                    <div className="mt-4 p-4 rounded-2xl border transition-all duration-300 bg-slate-900/60 border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-full ${isBlockerActive ? "bg-blue-500/10 text-blue-400" : "bg-slate-800 text-slate-500"}`}>
                            {isBlockerActive ? <ShieldCheck className="w-6 h-6 animate-pulse" /> : <PhoneOff className="w-6 h-6" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-200">
                              {isBlockerActive ? "Blocker Engine: Active" : "Blocker Engine: Paused"}
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {isBlockerActive ? "Silently drops spammers below." : "Blocked numbers will ring normally."}
                            </p>
                          </div>
                        </div>
                        
                        {/* Switch simulated Compose button */}
                        <button 
                          onClick={() => {
                            setIsBlockerActive(prev => !prev);
                            playSynthesizerTone("beep");
                            writeLog(`Main switch toggled to ${!isBlockerActive ? "ACTIVE" : "PAUSED"} manually inside simulated Compose layout`, !isBlockerActive ? "success" : "warning");
                          }}
                          className={`w-10 h-6 rounded-full p-1 transition-all ${isBlockerActive ? "bg-blue-500" : "bg-slate-800"}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${isBlockerActive ? "translate-x-4" : "translate-x-0"}`}></div>
                        </button>
                      </div>
                    </div>

                    {/* Speech Assistant Active Status Alert */}
                    <AnimatePresence>
                      {assistantState !== "idle" && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="mt-3 p-3.5 bg-gradient-to-r from-violet-950/90 to-blue-950/90 border border-indigo-500/20 rounded-2xl flex flex-col gap-2 shadow-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                              </span>
                              <span className="text-[10px] font-bold tracking-wider text-indigo-400 uppercase font-mono">
                                {assistantState === "listening" ? "Assistant: Listening" : 
                                 assistantState === "processing" ? "Assistant: Thinking" : "Assistant: Speaking"}
                              </span>
                            </div>
                            <span className="text-[9px] bg-indigo-500/30 text-indigo-300 font-bold px-1.5 py-0.5 rounded">
                              LOCAL
                            </span>
                          </div>
                          
                          <p className="text-[11px] text-slate-300 leading-normal font-sans italic">
                            {assistantState === "listening" && "Speak or click a voice sample shortcut..."}
                            {assistantState === "processing" && "Pattern parsing regex expressions..."}
                            {assistantState === "speaking" && `"${assistantText}"`}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Section Header */}
                    <div className="mt-5 flex items-center justify-between text-xs select-none">
                      <span className="font-mono text-slate-400 font-bold uppercase tracking-wider">
                        Local Room Blocklist ({blockedList.length})
                      </span>
                      <button 
                        onClick={() => setShowAddManualDialog(true)}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-0.5 text-[11px] hover:cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Block
                      </button>
                    </div>

                    {/* Scrolling Blocklist numbers list (Room emulation) */}
                    <div className="flex-1 mt-3 space-y-2.5 overflow-y-auto max-h-[360px] pr-1">
                      {blockedList.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-slate-900 rounded-2xl">
                          <span className="text-2xl block">🛌</span>
                          <span className="text-xs text-slate-500 block mt-2">Blocklist is empty. Add numbers manually or say &quot;Add Spam&quot;</span>
                        </div>
                      ) : (
                        blockedList.map((item) => (
                          <div 
                            key={item.phoneNumber}
                            className="p-3.5 rounded-xl border border-slate-900 bg-slate-900/40 hover:bg-slate-900/70 flex items-center justify-between group transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-base">👤</span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-100">
                                  {item.contactName || "Spam Alert"}
                                </h4>
                                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                  {item.phoneNumber}
                                </p>
                                <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                  item.category === "Scam" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                                  item.category === "Telemarketer" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                  "bg-slate-800 text-slate-300 border border-slate-700"
                                }`}>
                                  {item.category}
                                </span>
                              </div>
                            </div>

                            <button 
                              onClick={() => {
                                setBlockedList(prev => prev.filter(x => x.phoneNumber !== item.phoneNumber));
                                playSynthesizerTone("drop");
                                writeLog(`DB Mutation: Unblocked caller ${item.phoneNumber} (${item.contactName})`, "warning");
                              }}
                              className="p-1 text-slate-600 hover:text-red-400 rounded-lg hover:bg-slate-950 transition-all hover:cursor-pointer"
                              title="Delete blocker"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Compose Floating Voice trigger mic button */}
                    <div className="absolute bottom-6 right-6 select-none">
                      <button 
                        onClick={handlePhysicalMicTrigger}
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transform hover:scale-105 active:scale-95 transition-all outline-none ${
                          assistantState === "listening" ? "bg-red-500 hover:bg-red-600 animate-pulse" :
                          assistantState === "processing" ? "bg-emerald-500 animate-spin" :
                          "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        <Mic className="w-6 h-6" />
                      </button>
                    </div>

                  </div>
                ) : (
                  /* JETPACK COMPOSE: CALENDAR SCHEDULE SCREEN */
                  <div className="flex-1 flex flex-col">
                    
                    {/* Header back button row */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-950 select-none">
                      <button 
                        onClick={() => setCurrentScreen("dashboard")}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-all font-semibold hover:cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back
                      </button>
                      <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400">PAUSE SCHEDULER</h3>
                      <button 
                        onClick={() => setShowAddPauseDialog(true)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 hover:cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>

                    {/* Calendar Month Header */}
                    <div className="mt-4 p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
                      <h4 className="text-sm font-bold text-center text-slate-200">June 2026</h4>
                      
                      {/* Week days layout */}
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500 font-bold mt-3">
                        <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
                      </div>

                      {/* Day items (June 1st, 2026 starts on Monday) */}
                      <div className="grid grid-cols-7 gap-1 mt-2 text-center text-xs font-mono">
                        {Array.from({ length: 30 }).map((_, idx) => {
                          const day = idx + 1;
                          const isSelected = selectedCalendarDay === day;
                          return (
                            <button
                              key={day}
                              onClick={() => {
                                setSelectedCalendarDay(day);
                                writeLog(`Calendar selected date changed to June ${day}, 2026`, "info");
                              }}
                              className={`p-1.5 rounded-lg font-bold transition-all ${
                                isSelected 
                                  ? "bg-blue-600 text-white shadow-md font-extrabold" 
                                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dynamic Bypass Rules lists for selected date */}
                    <h5 className="mt-5 text-xs font-mono font-bold text-slate-400 uppercase tracking-widest select-none">
                      Bypass Rules (June {selectedCalendarDay})
                    </h5>

                    <div className="flex-1 mt-2 space-y-2.5 overflow-y-auto max-h-[220px] pr-1">
                      {selectedCalendarDay !== 18 || pauseSlots.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-slate-900 rounded-2xl">
                          <span className="text-xl block">👁️</span>
                          <span className="text-[10px] text-slate-500 block mt-1.5">Blocking remains 100% active. No pause intervals set for this date.</span>
                        </div>
                      ) : (
                        pauseSlots.map((slot) => {
                          const isCurrentlyHappening = isBypassScheduled && checkIsBypassActiveAtTime(simulatedTime)?.id === slot.id;
                          return (
                            <div 
                              key={slot.id}
                              className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                                isCurrentlyHappening 
                                  ? "bg-emerald-950/40 border-emerald-500/30 ring-1 ring-emerald-500/20" 
                                  : "bg-slate-900/30 border-slate-900 hover:bg-slate-900/60"
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${isCurrentlyHappening ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}></span>
                                  <h6 className="text-xs font-bold text-slate-200">{slot.title}</h6>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1 font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" /> {slot.startTimeStr} - {slot.endTimeStr}
                                </p>
                                {isCurrentlyHappening && (
                                  <span className="inline-block mt-1 text-[9px] px-1.5 font-bold bg-emerald-900/40 text-emerald-400 rounded">
                                    ACTIVE NOW (Bypassing filter)
                                  </span>
                                )}
                              </div>
                              <button 
                                onClick={() => {
                                  setPauseSlots(prev => prev.filter(x => x.id !== slot.id));
                                  writeLog(`WorkManager Config: Cancelled pause interval "${slot.title}"`, "warning");
                                  playSynthesizerTone("drop");
                                }}
                                className="p-1 px-2 text-slate-600 hover:text-red-400 rounded-lg hover:bg-slate-950 transition-colors hover:cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Instruction notice card */}
                    <div className="mt-4 p-3 rounded-xl bg-slate-900/40 border border-slate-900 text-[10px] text-slate-500 leading-normal flex gap-2">
                      <Info className="w-4 h-4 text-blue-500 shrink-0" />
                      <p>
                        Allows calls to bypass blocking during precise scheduled calendar windows. Handled via Android WorkManager triggers.
                      </p>
                    </div>

                  </div>
                )}
              </div>

              {/* HIGH FIDELITY SIMULATION OVERLAY: SYSTEM INCOMING PHONE CALL */}
              <AnimatePresence>
                {isIncomingCall && (
                  <motion.div 
                    initial={{ opacity: 0, y: 150 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 150 }}
                    className="absolute inset-x-0 bottom-0 top-10 bg-slate-950 z-[100] flex flex-col p-6 text-center select-none"
                  >
                    {/* Ring status panel info */}
                    <div className="mt-8 flex flex-col items-center flex-1">
                      <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 animate-bounce">
                        <Phone className="w-8 h-8 text-slate-300" />
                      </div>
                      
                      <h4 className="text-lg font-bold mt-5 text-slate-200">
                        {callerName}
                      </h4>
                      <p className="text-sm font-mono text-slate-400 mt-1">
                        {callerNumber}
                      </p>

                      {/* Tag indicators */}
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <span className="px-2.5 py-0.5 bg-slate-900 border border-slate-800 text-xs rounded-full text-slate-400">
                          Incoming Call Request
                        </span>
                        {blockedList.some(x => x.phoneNumber === callerNumber.replace(/\D/g, "")) && (
                          <span className="px-2 py-0.5 bg-red-600/10 text-red-500 border border-red-500/20 text-xs rounded-full font-bold">
                            Matches Blocklist
                          </span>
                        )}
                      </div>

                      {/* Screening progress status box */}
                      <div className={`mt-10 p-5 rounded-2xl w-full border text-xs max-w-xs transition-all duration-300 ${
                        isCallBlocked ? "bg-red-950/40 border-red-500/30 text-red-400" :
                        isCallAllowed ? "bg-emerald-900/40 border-emerald-500/30 text-emerald-400" :
                        "bg-slate-900 border-slate-800 text-slate-300"
                      }`}>
                        <div className="flex items-center justify-center gap-2 font-mono">
                          {!isCallBlocked && !isCallAllowed && (
                            <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                          )}
                          {isCallBlocked && <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />}
                          {isCallAllowed && <ShieldCheck className="w-5 h-5 text-emerald-500 animate-bounce" />}
                          <span className="font-bold">{callStatusMessage}</span>
                        </div>
                        {isCallBlocked && (
                          <p className="text-[10px] text-red-500 mt-2 leading-relaxed">
                            Telecom Action Context: Rejected with disallowCall(true) + rejectCall(true) silently.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Simulation Ring Action Buttons (If Allowed) */}
                    <div className="mb-10 flex justify-center gap-10">
                      {isCallAllowed && !callActive ? (
                        <>
                          <button 
                            onClick={() => {
                              playSynthesizerTone("drop");
                              setIsIncomingCall(false);
                              writeLog("Simulated Call declined by subscriber.", "warning");
                            }}
                            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg active:scale-90 transition-all hover:cursor-pointer"
                          >
                            <PhoneOff className="w-6 h-6" />
                          </button>
                          
                          <button 
                            onClick={() => {
                              playSynthesizerTone("success");
                              setCallActive(true);
                              setCallStatusMessage("Call Active (Connected)");
                              writeLog("Subscriber picked up the call.", "success");
                            }}
                            className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white shadow-lg active:scale-90 transition-all hover:cursor-pointer"
                          >
                            <Phone className="w-6 h-6" />
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => {
                            playSynthesizerTone("drop");
                            setIsIncomingCall(false);
                          }}
                          className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white border border-slate-700 transition-colors hover:cursor-pointer"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* DIALOG IN PHONE: ADD MANUAL CALL BLOCK */}
              <AnimatePresence>
                {showAddManualDialog && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/85 flex items-center justify-center p-5 z-[200]"
                  >
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl w-full flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                          New Blocker Target
                        </h4>
                        <button onClick={() => setShowAddManualDialog(false)} className="text-slate-500 hover:text-white hover:cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-bold">PHONE NUMBER</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 5550291"
                            value={manualNumber}
                            onChange={(e) => setManualNumber(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-bold">CONTACT LABEL</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Robo Spam Alert"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-bold">CATEGORY TAG</label>
                          <select 
                            value={manualCategory}
                            onChange={(e) => setManualCategory(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-400 focus:outline-none focus:border-blue-500"
                          >
                            <option value="Spam">Spam</option>
                            <option value="Telemarketer">Telemarketer</option>
                            <option value="Scam">Scam</option>
                          </select>
                        </div>
                      </div>

                      <button 
                        onClick={addBlocklistItemManually}
                        disabled={!manualNumber}
                        className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold text-xs shadow-md transition-colors hover:cursor-pointer"
                      >
                        Insert Call block
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* DIALOG IN PHONE: ADD CALENDAR SCHEDULE WINDOW */}
              <AnimatePresence>
                {showAddPauseDialog && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/85 flex items-center justify-center p-5 z-[200]"
                  >
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl w-full flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                          Schedule Block Bypass
                        </h4>
                        <button onClick={() => setShowAddPauseDialog(false)} className="text-slate-500 hover:text-white hover:cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-bold">BYPASS TITLE</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Doctor Sleep window"
                            value={pauseTitle}
                            onChange={(e) => setPauseTitle(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-bold">STARTS HOUR (24h)</label>
                          <input 
                            type="number" 
                            min="0"
                            max="23"
                            value={pauseStartHour}
                            onChange={(e) => setPauseStartHour(Number(e.target.value))}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-slate-400 font-bold">DURATION (HOURS)</label>
                          <input 
                            type="number" 
                            min="1"
                            max="12"
                            value={pauseDurationHours}
                            onChange={(e) => setPauseDurationHours(Number(e.target.value))}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={addCalendarPauseSlot}
                        disabled={!pauseTitle}
                        className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold text-xs shadow-md transition-colors hover:cursor-pointer"
                      >
                        Schedule Bypass
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Android Custom Bottom Navigation Bar */}
              <div className="h-12 bg-slate-900 border-t border-slate-950 flex items-center justify-around text-slate-400 text-xs select-none">
                <button className="p-2 hover:text-white transition-colors" title="System Back" onClick={() => setCurrentScreen("dashboard")}>
                  ◁
                </button>
                <button className="p-2 hover:text-white transition-colors" title="System Home" onClick={() => setCurrentScreen("dashboard")}>
                  ◯
                </button>
                <button className="p-2 hover:text-white transition-colors" title="Recents" onClick={() => writeLog(`Android System event: Recents layout invoked.`, "info")}>
                  ☐
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* COLUMN 2: Sandbox controls & logs (xl:col-span-8) */}
        <div className="xl:col-span-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* INCOMING CALL TESTING PANEL */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800 select-none">
                <Sliders className="text-blue-400 w-5 h-5 focus:outline-none" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest font-mono">
                  Sandbox Testing Controls
                </h3>
              </div>

              <div className="space-y-4 flex-1">
                {/* Simulated Caller customizer */}
                <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300">Simulate Incoming Connection</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-bold">CALLER NAME</label>
                      <input 
                        type="text" 
                        value={callerName} 
                        onChange={(e) => setCallerName(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none" 
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-bold">CALLER NUMBER</label>
                      <input 
                        type="text" 
                        value={callerNumber} 
                        onChange={(e) => setCallerNumber(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-xs text-white focus:outline-none" 
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2">
                    <button 
                      onClick={() => {
                        setCallerName("IRS Tax Scam spoof");
                        setCallerNumber("18005550199");
                        playSynthesizerTone("beep");
                      }}
                      className="px-2.5 py-1.5 bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 rounded-lg text-[10px] text-red-400 font-mono font-bold hover:cursor-pointer"
                    >
                      Preset: Spam IRS (+18005550199)
                    </button>
                    <button 
                      onClick={() => {
                        setCallerName("Car Loan Telemarket");
                        setCallerNumber("15550188");
                        playSynthesizerTone("beep");
                      }}
                      className="px-2.5 py-1.5 bg-amber-950/20 hover:bg-amber-900/30 border border-amber-500/20 rounded-lg text-[10px] text-amber-400 font-mono font-bold hover:cursor-pointer"
                    >
                      Preset: Telemarket (+15550188)
                    </button>
                    <button 
                      onClick={() => {
                        setCallerName("Personal Friend (John)");
                        setCallerNumber("13125550011");
                        playSynthesizerTone("beep");
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] text-slate-300 font-mono hover:cursor-pointer"
                    >
                      Preset: Friend (+13125550011)
                    </button>
                  </div>
                </div>

                <button 
                  onClick={triggerIncomingPhoneCall}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-bold text-sm rounded-2xl shadow-lg transition-all transform hover:scale-[1.01] active:translate-y-0.5 hover:cursor-pointer"
                >
                  📡 Trigger Simulated Call Inbound
                </button>
              </div>
            </div>

            {/* HANDS-FREE SHORTCUTS */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800 select-none">
                <Sparkles className="text-violet-400 w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest font-mono">
                  Speech Command shortcuts
                </h3>
              </div>

              <div className="space-y-4 flex-1 flex flex-col">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Testing browser audio or iframe permission limits? Tap any vocal instruction block below to inject its patterns instantly into the regex parser!
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                  <button 
                    onClick={() => {
                      setTranscriptInput("add SpamAlert 18005559988");
                      processCommandPattern("add SpamAlert 18005559988");
                    }} 
                    className="p-3 bg-slate-950/60 hover:bg-indigo-950/40 hover:border-indigo-500/30 border border-slate-800 rounded-xl text-left transition-all hover:cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold tracking-wider font-mono uppercase">
                      <Volume2 className="w-3.5 h-3.5" /> ADD PATTERN
                    </div>
                    <p className="text-xs font-mono text-slate-200 mt-1">&quot;Add SpamAlert 18005559988&quot;</p>
                  </button>

                  <button 
                    onClick={() => {
                      setTranscriptInput("pause blocker");
                      processCommandPattern("pause blocker");
                    }} 
                    className="p-3 bg-slate-950/60 hover:bg-violet-950/40 hover:border-violet-500/30 border border-slate-800 rounded-xl text-left transition-all hover:cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-violet-400 font-bold tracking-wider font-mono uppercase">
                      <Volume2 className="w-3.5 h-3.5" /> PAUSE PATTERN
                    </div>
                    <p className="text-xs font-mono text-slate-200 mt-1">&quot;Pause blocker&quot;</p>
                  </button>

                  <button 
                    onClick={() => {
                      setTranscriptInput("resume blocker");
                      processCommandPattern("resume blocker");
                    }} 
                    className="p-3 bg-slate-950/60 hover:bg-blue-950/40 hover:border-blue-500/30 border border-slate-800 rounded-xl text-left transition-all hover:cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold tracking-wider font-mono uppercase">
                      <Volume2 className="w-3.5 h-3.5" /> RESUME PATTERN
                    </div>
                    <p className="text-xs font-mono text-slate-200 mt-1">&quot;Resume blocker&quot;</p>
                  </button>

                  <button 
                    onClick={() => {
                      setTranscriptInput("remove Car Loan Telemarket");
                      processCommandPattern("remove Car Loan Telemarket");
                    }} 
                    className="p-3 bg-slate-950/60 hover:bg-slate-850 hover:border-slate-700 border border-slate-800 rounded-xl text-left transition-all hover:cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold tracking-wider font-mono uppercase">
                      <Volume2 className="w-3.5 h-3.5" /> REMOVE PATTERN
                    </div>
                    <p className="text-xs font-mono text-slate-200 mt-1">&quot;Remove Car Loan...&quot;</p>
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* TELECOM INTEGRATION - SYSTEM LOGS FEED (Direct diagnostic tool, extremely helpful for the user!) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 select-none">
              <div className="flex items-center gap-2">
                <BookOpen className="text-blue-400 w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest font-mono">
                  Screener Logs and WorkManager Events (Logcat)
                </h3>
              </div>
              <button 
                onClick={() => setSystemLogs([{ id: 1, text: "Logs cleared.", time: new Date().toLocaleTimeString(), type: "info" }])}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Clear Screen
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl h-40 overflow-y-auto font-mono text-xs text-slate-300 space-y-2 select-text border border-slate-850">
              {systemLogs.map((log) => (
                <div key={log.id} className="flex gap-3 leading-relaxed items-start select-text border-b border-slate-900/30 pb-1.5">
                  <span className="text-slate-500 shrink-0 font-medium select-none">[{log.time}]</span>
                  <span className={`flex-1 ${
                    log.type === "block" ? "text-red-400 font-semibold" :
                    log.type === "success" ? "text-emerald-400 font-medium" :
                    log.type === "warning" ? "text-amber-400" :
                    "text-slate-300"
                  }`}>
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SOURCE PROJECT INSTRUCTOR CODE VIEW */}
          <div className="pt-2 select-text">
            <SourceInspector />
          </div>

        </div>

      </main>

      {/* Footer System Credits */}
      <footer className="mt-auto px-8 py-6 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-500 font-mono">
        <p>🛡️ Standalone Local Call Screening Agent • Minimum API 29 • Designed for Android 10+</p>
        <p className="mt-1.5 text-[10px] text-slate-600">
          Created in Sandbox Workspace with pristine typography & modular structure.
        </p>
      </footer>
    </div>
  );
}
