import { useState, useEffect, useMemo } from "react";
import {
  Calendar, Users, UserCog, LogOut, Plus, X, Check, AlertTriangle,
  ChevronLeft, ChevronRight, Lock, Trash2, Edit3, CalendarX,
  Stethoscope, Shield, UserPlus, Languages, Phone, Zap, Droplet,
  Hand, Syringe, Save, Info, Clock, TrendingUp, TrendingDown,
  Briefcase, Sun, FileText, Eye, EyeOff
} from "lucide-react";

import { loadData, saveData, subscribeToChanges } from "./lib/supabase";

// ============================================================================
// KONSTANTEN
// ============================================================================

const ICON_OPTIONS = [
  { key: "languages", label: "Sprache", icon: Languages },
  { key: "phone", label: "Telefon", icon: Phone },
  { key: "zap", label: "Laser / Blitz", icon: Zap },
  { key: "droplet", label: "Tropfen", icon: Droplet },
  { key: "hand", label: "Hand", icon: Hand },
  { key: "syringe", label: "Spritze", icon: Syringe },
  { key: "stethoscope", label: "Stethoskop", icon: Stethoscope },
  { key: "clipboard", label: "Klemmbrett", icon: FileText },
  { key: "users", label: "Personen", icon: Users },
  { key: "eye", label: "Auge", icon: Eye },
  { key: "shield", label: "Schild", icon: Shield },
  { key: "briefcase", label: "Koffer", icon: Briefcase },
  { key: "clock", label: "Uhr", icon: Clock },
  { key: "info", label: "Info", icon: Info },
];
const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map((o) => [o.key, o.icon]));

const DEFAULT_SKILLS = [
  { id: "deutsch", label: "Sprache Deutsch", iconKey: "languages" },
  { id: "ukrainisch", label: "Sprache Ukrainisch", iconKey: "languages" },
  { id: "telefon", label: "Telefon/Empfang", iconKey: "phone" },
  { id: "laser", label: "Laser", iconKey: "zap" },
  { id: "infusion_abnehmen", label: "Infusion abnehmen", iconKey: "droplet" },
  { id: "assistenz", label: "Assistenz beim Arzt", iconKey: "hand" },
  { id: "infusion_stechen", label: "Infusion stechen", iconKey: "syringe" },
];

function getSkillMap(data) {
  return Object.fromEntries((data?.skills || DEFAULT_SKILLS).map((s) => [s.id, s]));
}

function getSkills(data) {
  return data?.skills || DEFAULT_SKILLS;
}

function SkillIcon({ iconKey, ...props }) {
  const Icon = ICON_MAP[iconKey] || Hand;
  return <Icon {...props} />;
}

const DAYS = [
  { id: 1, label: "Montag", short: "Mo" },
  { id: 2, label: "Dienstag", short: "Di" },
  { id: 3, label: "Mittwoch", short: "Mi" },
  { id: 4, label: "Donnerstag", short: "Do" },
  { id: 5, label: "Freitag", short: "Fr" },
  { id: 6, label: "Samstag", short: "Sa" },
];

const ENTRY_TYPES = [
  { id: "arbeit", label: "Arbeitsstunden", icon: Briefcase, sign: 1 },
  { id: "urlaub", label: "Urlaub", icon: Sun, sign: -1 },
  { id: "krank", label: "Krankenstand", icon: AlertTriangle, sign: 0 },
  { id: "ueberstunde", label: "Überstunde +", icon: TrendingUp, sign: 1 },
  { id: "abzug", label: "Abzug / Korrektur −", icon: TrendingDown, sign: -1 },
];
const ENTRY_TYPE_MAP = Object.fromEntries(ENTRY_TYPES.map((t) => [t.id, t]));

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function pad(n) { return String(n).padStart(2, "0"); }

function dateToKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(d) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function getWeekDates(monday) {
  return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
}

function getISOWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function shiftHours(s) {
  return (timeToMinutes(s.endTime) - timeToMinutes(s.startTime)) / 60;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ============================================================================
// DEMO-DATEN
// ============================================================================

function createInitialData() {
  return {
    admin: { password: "admin" },
    skills: DEFAULT_SKILLS.map((s) => ({ ...s })),
    doctors: [
      {
        id: "d1", name: "Dr. Michael Jaksch", password: "michael",
        regularSchedule: [
          { id: uid(), dayOfWeek: 1, startTime: "09:00", endTime: "14:00" },
        ],
        requiredSkills: ["assistenz"],
        assistantsNeeded: 1,
      },
      {
        id: "d2", name: "Dr. Thomas Kovacsevich", password: "thomas",
        regularSchedule: [
          { id: uid(), dayOfWeek: 1, startTime: "14:45", endTime: "18:00" },
        ],
        requiredSkills: ["assistenz"],
        assistantsNeeded: 1,
      },
      {
        id: "d3", name: "Dr. Pamela Jahn", password: "pamela",
        regularSchedule: [
          { id: uid(), dayOfWeek: 2, startTime: "07:00", endTime: "12:00" },
          { id: uid(), dayOfWeek: 3, startTime: "09:00", endTime: "13:00" },
          { id: uid(), dayOfWeek: 4, startTime: "08:00", endTime: "11:00" },
          { id: uid(), dayOfWeek: 4, startTime: "14:00", endTime: "18:00" },
        ],
        requiredSkills: ["assistenz"],
        assistantsNeeded: 1,
      },
      {
        id: "d4", name: "Dr. Paul Pittermann", password: "paul",
        regularSchedule: [
          { id: uid(), dayOfWeek: 3, startTime: "14:00", endTime: "18:00" },
        ],
        requiredSkills: ["assistenz"],
        assistantsNeeded: 1,
      },
      {
        id: "d5", name: "Dr. Stefanie Bakewell", password: "stefanie",
        regularSchedule: [
          { id: uid(), dayOfWeek: 5, startTime: "09:00", endTime: "12:00" },
        ],
        requiredSkills: ["assistenz"],
        assistantsNeeded: 1,
      },
    ],
    employees: [
      {
        id: "e1", name: "Maria Huber", password: "maria",
        skills: ["deutsch", "telefon", "assistenz", "infusion_abnehmen"],
        weeklyHours: 38.5, initialHours: 0, initialVacationHours: 200,
        hourEntries: [],
      },
      {
        id: "e2", name: "Anna Bauer", password: "anna",
        skills: ["deutsch", "telefon", "assistenz", "laser", "infusion_stechen"],
        weeklyHours: 38.5, initialHours: 12, initialVacationHours: 200,
        hourEntries: [],
      },
      {
        id: "e3", name: "Iryna Petrenko", password: "iryna",
        skills: ["deutsch", "ukrainisch", "telefon", "assistenz", "infusion_abnehmen"],
        weeklyHours: 30, initialHours: 0, initialVacationHours: 160,
        hourEntries: [],
      },
      {
        id: "e4", name: "Lisa Schmid", password: "lisa",
        skills: ["deutsch", "telefon", "assistenz", "infusion_stechen", "infusion_abnehmen"],
        weeklyHours: 20, initialHours: -5, initialVacationHours: 100,
        hourEntries: [],
      },
    ],
    absences: [],
    assignments: {},
    substitutes: {},
  };
}

// ============================================================================
// LOGIK – PLAN BERECHNEN
// ============================================================================

function getShiftsForDate(data, date) {
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
  const dateKey = dateToKey(date);
  const shifts = [];

  for (const doc of data.doctors) {
    const slots = doc.regularSchedule.filter((s) => s.dayOfWeek === dayOfWeek);
    for (const slot of slots) {
      const isAbsent = data.absences.some(
        (a) => a.personId === doc.id && a.personType === "doctor" && a.date === dateKey
      );
      const subKey = `${dateKey}_${doc.id}_${slot.id}`;
      const substituteId = data.substitutes[subKey];
      const assignKey = `${dateKey}_${doc.id}_${slot.id}`;
      const assignedEmployeeIds = data.assignments[assignKey] || [];

      shifts.push({
        id: subKey,
        doctorId: doc.id,
        doctor: doc,
        slotId: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        date: dateKey,
        isAbsent,
        substituteId,
        substitute: substituteId ? data.doctors.find((d) => d.id === substituteId) : null,
        assignedEmployeeIds,
        assignedEmployees: assignedEmployeeIds
          .map((id) => data.employees.find((e) => e.id === id))
          .filter(Boolean),
        requiredSkills: doc.requiredSkills,
        assistantsNeeded: doc.assistantsNeeded,
      });
    }
  }
  return shifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function getShiftStatus(shift) {
  if (shift.isAbsent && !shift.substituteId) return "no_doctor";
  const assigned = shift.assignedEmployees;
  if (assigned.length < shift.assistantsNeeded) return "missing";
  const allRequired = shift.requiredSkills.every((req) =>
    assigned.some((e) => e.skills.includes(req))
  );
  if (!allRequired) return "skill_missing";
  return "complete";
}

function isEmployeeAvailable(data, employeeId, date) {
  const key = dateToKey(date);
  return !data.absences.some(
    (a) => a.personId === employeeId && a.personType === "employee" && a.date === key
  );
}

function computeBalance(employee) {
  const fromEntries = (employee.hourEntries || []).reduce((sum, e) => {
    const type = ENTRY_TYPE_MAP[e.type];
    if (!type) return sum;
    if (type.id === "krank") return sum;
    return sum + e.hours * type.sign;
  }, 0);
  return (employee.initialHours || 0) + fromEntries;
}

function computeVacationUsed(employee) {
  return (employee.hourEntries || [])
    .filter((e) => e.type === "urlaub")
    .reduce((s, e) => s + e.hours, 0);
}

function computeWorkedHours(employee) {
  return (employee.hourEntries || [])
    .filter((e) => e.type === "arbeit" || e.type === "ueberstunde")
    .reduce((s, e) => s + e.hours, 0);
}

// ============================================================================
// UI – PRIMITIVE
// ============================================================================

const Button = ({ children, variant = "primary", size = "md", className = "", ...props }) => {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed border";
  const sizes = { sm: "px-2.5 py-1 text-sm", md: "px-3.5 py-2 text-sm", lg: "px-4 py-2.5 text-base" };
  const variants = {
    primary: "bg-[#1B3A5C] text-white border-[#1B3A5C] hover:bg-[#14304E]",
    secondary: "bg-white text-[#1B3A5C] border-[#C5CCD6] hover:bg-[#F4F6F9]",
    ghost: "bg-transparent text-[#1B3A5C] border-transparent hover:bg-[#EEF1F5]",
    danger: "bg-white text-[#B23A3A] border-[#E2C2C2] hover:bg-[#FBEFEF]",
    success: "bg-[#2D7A4C] text-white border-[#2D7A4C] hover:bg-[#256240]",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-[#E2E6EC] rounded-lg ${className}`}>{children}</div>
);

const Label = ({ children, className = "" }) => (
  <label className={`block text-xs font-semibold uppercase tracking-wide text-[#5A6478] mb-1.5 ${className}`}>
    {children}
  </label>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full px-3 py-2 text-sm bg-white border border-[#C5CCD6] rounded focus:outline-none focus:border-[#1B3A5C] focus:ring-1 focus:ring-[#1B3A5C] ${className}`}
    {...props}
  />
);

const Select = ({ className = "", children, ...props }) => (
  <select
    className={`w-full px-3 py-2 text-sm bg-white border border-[#C5CCD6] rounded focus:outline-none focus:border-[#1B3A5C] focus:ring-1 focus:ring-[#1B3A5C] ${className}`}
    {...props}
  >
    {children}
  </select>
);

const Modal = ({ open, onClose, title, children, size = "md" }) => {
  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className={`w-full ${sizes[size]} bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E6EC]">
          <h2 className="text-lg font-serif text-[#1B3A5C]">{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#EEF1F5] text-[#5A6478]">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

const Badge = ({ children, color = "blue" }) => {
  const colors = {
    blue: "bg-[#EEF3F8] text-[#1B3A5C] border-[#C5D6E5]",
    green: "bg-[#E8F2EC] text-[#2D7A4C] border-[#BFD9C9]",
    amber: "bg-[#FDF4DF] text-[#8A6310] border-[#E8D49A]",
    red: "bg-[#FBE9E9] text-[#B23A3A] border-[#E8C2C2]",
    gray: "bg-[#F1F3F6] text-[#5A6478] border-[#D6DCE3]",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border rounded ${colors[color]}`}>
      {children}
    </span>
  );
};

const StatusDot = ({ status }) => {
  const map = {
    complete: { color: "#2D7A4C", label: "Vollständig" },
    missing: { color: "#B23A3A", label: "Mitarbeiter fehlen" },
    skill_missing: { color: "#B8861B", label: "Qualifikation fehlt" },
    no_doctor: { color: "#7A4E8E", label: "Arzt fehlt" },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
      <span className="text-[#5A6478]">{s.label}</span>
    </span>
  );
};

// ============================================================================
// LOGIN-BILDSCHIRM
// ============================================================================

function LoginScreen({ data, onLogin }) {
  const [selectedId, setSelectedId] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const allUsers = [
    { id: "admin", name: "Administrator", role: "admin" },
    ...data.doctors.map((d) => ({ id: d.id, name: d.name, role: "doctor" })),
    ...data.employees.map((e) => ({ id: e.id, name: e.name, role: "employee" })),
  ];

  const handleSubmit = () => {
    setError("");
    let valid = false;
    if (selectedId === "admin") {
      valid = data.admin.password === password;
      if (valid) onLogin({ id: "admin", name: "Administrator", role: "admin" });
    } else {
      const doc = data.doctors.find((d) => d.id === selectedId);
      if (doc) {
        valid = doc.password === password;
        if (valid) onLogin({ id: doc.id, name: doc.name, role: "doctor" });
      } else {
        const emp = data.employees.find((e) => e.id === selectedId);
        if (emp) {
          valid = emp.password === password;
          if (valid) onLogin({ id: emp.id, name: emp.name, role: "employee" });
        }
      }
    }
    if (!valid) setError("Falsches Passwort");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9] p-4" style={{ backgroundImage: "radial-gradient(circle at 50% 0%, #E8EEF5 0%, #F4F6F9 50%)" }}>
      <Card className="w-full max-w-md shadow-sm">
        <div className="px-8 py-8">
          <div className="flex items-center justify-center w-14 h-14 mx-auto mb-4 rounded-full bg-[#1B3A5C]">
            <Stethoscope className="text-white" size={26} />
          </div>
          <h1 className="text-2xl font-serif text-center text-[#1B3A5C] mb-1">Ordination</h1>
          <p className="text-center text-sm text-[#5A6478] mb-7">Arbeitseinteilung &amp; Dienstplan</p>

          <div className="space-y-4">
            <div>
              <Label>Benutzer</Label>
              <Select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setError(""); }}>
                <optgroup label="Verwaltung">
                  <option value="admin">Administrator</option>
                </optgroup>
                {data.doctors.length > 0 && (
                  <optgroup label="Ärzte">
                    {data.doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </optgroup>
                )}
                {data.employees.length > 0 && (
                  <optgroup label="Mitarbeiter">
                    {data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </optgroup>
                )}
              </Select>
            </div>
            <div>
              <Label>Passwort</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#5A6478] hover:text-[#1B3A5C]">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-[#B23A3A] bg-[#FBE9E9] border border-[#E8C2C2] rounded">
                <AlertTriangle size={14} /> {error}
              </div>
            )}
            <Button onClick={handleSubmit} className="w-full" size="lg">
              <Lock size={16} /> Anmelden
            </Button>
          </div>
          <div className="mt-6 pt-5 border-t border-[#E2E6EC] text-xs text-[#5A6478] leading-relaxed">
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              <div>
                <strong>Demo-Zugänge:</strong> Passwort ist jeweils der Vorname in Kleinbuchstaben (z.B. <code className="bg-[#F1F3F6] px-1 rounded">sabine</code>, <code className="bg-[#F1F3F6] px-1 rounded">maria</code>). Admin-Passwort: <code className="bg-[#F1F3F6] px-1 rounded">admin</code>.
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================

function Header({ user, activeTab, setActiveTab, onLogout, saveStatus }) {
  const tabs = useMemo(() => {
    const t = [
      { id: "wochenplan", label: "Wochenplan", icon: Calendar },
      { id: "monat", label: "Monatsübersicht", icon: Calendar },
    ];
    if (user.role === "admin") {
      t.push({ id: "aerzte", label: "Ärzte", icon: Stethoscope });
      t.push({ id: "mitarbeiter", label: "Mitarbeiter", icon: Users });
      t.push({ id: "aufgaben", label: "Aufgaben", icon: FileText });
      t.push({ id: "stunden", label: "Stundenkonten", icon: Clock });
    }
    if (user.role === "doctor") t.push({ id: "meine_abwesenheit", label: "Meine Abwesenheiten", icon: CalendarX });
    if (user.role === "employee") {
      t.push({ id: "meine_abwesenheit", label: "Meine Abwesenheiten", icon: CalendarX });
      t.push({ id: "mein_konto", label: "Mein Stundenkonto", icon: Clock });
    }
    return t;
  }, [user.role]);

  const roleLabel = { admin: "Administrator", doctor: "Arzt/Ärztin", employee: "Mitarbeiter:in" }[user.role];
  const RoleIcon = { admin: Shield, doctor: Stethoscope, employee: UserCog }[user.role];

  return (
    <header className="bg-white border-b border-[#E2E6EC] sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-5">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded bg-[#1B3A5C]">
              <Stethoscope className="text-white" size={16} />
            </div>
            <div>
              <div className="text-base font-serif text-[#1B3A5C] leading-none">Ordination</div>
              <div className="text-[10px] uppercase tracking-wider text-[#5A6478] mt-0.5">Arbeitseinteilung</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="text-xs text-[#5A6478] flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#B8861B] animate-pulse" /> Speichere…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-[#2D7A4C] flex items-center gap-1">
                <Check size={12} /> Gespeichert
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-[#B23A3A] flex items-center gap-1">
                <AlertTriangle size={12} /> Speicherfehler
              </span>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F4F6F9] rounded text-sm">
              <RoleIcon size={14} className="text-[#1B3A5C]" />
              <span className="text-[#1B3A5C] font-medium">{user.name}</span>
              <span className="text-[#5A6478] text-xs">· {roleLabel}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut size={14} /> Abmelden
            </Button>
          </div>
        </div>
        <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active ? "border-[#1B3A5C] text-[#1B3A5C]" : "border-transparent text-[#5A6478] hover:text-[#1B3A5C]"
                }`}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

// ============================================================================
// WOCHENPLAN – Matrix + Karten
// ============================================================================

function WochenplanView({ data, setData, user }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [viewMode, setViewMode] = useState("matrix");
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const [editShift, setEditShift] = useState(null);

  const canEdit = user.role === "admin";
  const openShift = (s) => canEdit && setEditShift(s);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif text-[#1B3A5C]">Wochenplan</h2>
          <p className="text-sm text-[#5A6478] mt-0.5">
            KW {getISOWeek(weekStart)} · {formatDate(weekDates[0])} – {formatDate(weekDates[5])}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white border border-[#C5CCD6] rounded p-0.5 text-sm">
            <button
              onClick={() => setViewMode("matrix")}
              className={`px-3 py-1 rounded ${viewMode === "matrix" ? "bg-[#1B3A5C] text-white" : "text-[#5A6478]"}`}
            >
              Matrix
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1 rounded ${viewMode === "cards" ? "bg-[#1B3A5C] text-white" : "text-[#5A6478]"}`}
            >
              Karten
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft size={14} /> Vorher
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(getMonday(new Date()))}>
            Heute
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Nächste <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold uppercase tracking-wide text-[#5A6478]">Legende:</span>
          <StatusDot status="complete" />
          <StatusDot status="missing" />
          <StatusDot status="skill_missing" />
          <StatusDot status="no_doctor" />
        </div>
      </Card>

      {viewMode === "matrix" ? (
        <MatrixWeekView data={data} setData={setData} user={user} weekDates={weekDates} onEditShift={openShift} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {weekDates.map((date) => (
            <DayColumn key={dateToKey(date)} date={date} data={data} setData={setData} user={user} onEditShift={openShift} />
          ))}
        </div>
      )}

      {editShift && (
        <ShiftEditModal shift={editShift} data={data} setData={setData} onClose={() => setEditShift(null)} />
      )}
    </div>
  );
}

// ----------------- Matrix-Ansicht -----------------

function MatrixWeekView({ data, setData, user, weekDates, onEditShift }) {
  const skillMap = getSkillMap(data);
  const visibleDoctors = useMemo(() => {
    return data.doctors.filter((d) =>
      weekDates.some((date) => {
        const dow = date.getDay() === 0 ? 7 : date.getDay();
        return d.regularSchedule.some((s) => s.dayOfWeek === dow);
      })
    );
  }, [data.doctors, weekDates]);

  if (visibleDoctors.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-[#9AA3B2]">
        Keine Ärzte mit regulären Diensten in dieser Woche.
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[#F4F6F9] border-b-2 border-[#E2E6EC]">
            <th className="px-3 py-3 text-left sticky left-0 bg-[#F4F6F9] z-10 min-w-[170px] border-r border-[#E2E6EC]">
              <div className="text-xs uppercase tracking-wide text-[#5A6478]">Arzt</div>
            </th>
            {weekDates.map((date) => {
              const dayName = DAYS.find((d) => d.id === (date.getDay() === 0 ? 7 : date.getDay()))?.label || "";
              const isToday = dateToKey(date) === dateToKey(new Date());
              return (
                <th
                  key={dateToKey(date)}
                  className={`px-2 py-3 text-center min-w-[145px] border-r border-[#E2E6EC] last:border-r-0 ${isToday ? "bg-[#EEF3F8]" : ""}`}
                >
                  <div className="font-serif text-[#1B3A5C]">{dayName}</div>
                  <div className="text-xs text-[#5A6478] mt-0.5">{formatDate(date)}</div>
                  {isToday && <div className="text-[10px] text-[#1B3A5C] mt-0.5 font-semibold">HEUTE</div>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visibleDoctors.map((doc, di) => (
            <tr key={doc.id} className={`border-b border-[#E2E6EC] ${di % 2 === 1 ? "bg-[#FAFBFC]" : ""}`}>
              <td className={`px-3 py-2.5 sticky left-0 z-10 border-r border-[#E2E6EC] ${di % 2 === 1 ? "bg-[#FAFBFC]" : "bg-white"}`}>
                <div className="font-medium text-[#1B3A5C] text-sm leading-tight">{doc.name}</div>
                <div className="text-[11px] text-[#5A6478] mt-0.5">
                  {doc.assistantsNeeded} Assistenz{doc.assistantsNeeded > 1 ? "en" : ""}
                </div>
                {doc.requiredSkills.length > 0 && (
                  <div className="text-[10px] text-[#5A6478] mt-0.5 leading-tight">
                    {doc.requiredSkills.map((s) => skillMap[s]?.label.split(" ").slice(-1)[0]).join(", ")}
                  </div>
                )}
              </td>
              {weekDates.map((date) => {
                const shifts = getShiftsForDate(data, date).filter((s) => s.doctorId === doc.id);
                const isToday = dateToKey(date) === dateToKey(new Date());
                return (
                  <td
                    key={dateToKey(date)}
                    className={`px-2 py-2 align-top border-r border-[#E2E6EC] last:border-r-0 ${isToday ? "bg-[#F7F9FC]" : ""}`}
                  >
                    {shifts.length === 0 ? (
                      <div className="h-full min-h-[44px]"></div>
                    ) : (
                      <div className="space-y-1">
                        {shifts.map((s) => (
                          <MatrixCell key={s.id} shift={s} data={data} setData={setData} user={user} onClick={() => onEditShift(s)} />
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function MatrixCell({ shift, data, setData, user, onClick }) {
  const skillMap = getSkillMap(data);
  const status = getShiftStatus(shift);
  const styles = {
    complete: { bg: "#4F9F6A", border: "#2D7A4C", text: "#FFFFFF", subText: "#E8F2EC" },
    missing: { bg: "#C84B4B", border: "#A33333", text: "#FFFFFF", subText: "#FAE0E0" },
    skill_missing: { bg: "#D4A040", border: "#B8861B", text: "#FFFFFF", subText: "#FBF1D9" },
    no_doctor: { bg: "#9268A8", border: "#7A4E8E", text: "#FFFFFF", subText: "#EBE0F0" },
  }[status];

  const displayedDoctor = shift.substitute || shift.doctor;
  const canSignUp =
    user.role === "employee" &&
    shift.assignedEmployees.length < shift.assistantsNeeded &&
    !shift.assignedEmployeeIds.includes(user.id) &&
    isEmployeeAvailable(data, user.id, new Date(shift.date));
  const canSubstitute =
    user.role === "doctor" &&
    shift.isAbsent &&
    !shift.substituteId &&
    user.id !== shift.doctorId;

  const handleSignUp = (e) => {
    e.stopPropagation();
    const key = `${shift.date}_${shift.doctorId}_${shift.slotId}`;
    const cur = data.assignments[key] || [];
    if (cur.includes(user.id) || cur.length >= shift.assistantsNeeded) return;
    setData({ ...data, assignments: { ...data.assignments, [key]: [...cur, user.id] } });
  };
  const handleSubstitute = (e) => {
    e.stopPropagation();
    const key = `${shift.date}_${shift.doctorId}_${shift.slotId}`;
    setData({ ...data, substitutes: { ...data.substitutes, [key]: user.id } });
  };

  return (
    <div
      onClick={user.role === "admin" ? onClick : undefined}
      className={`rounded-md border-2 p-2 ${user.role === "admin" ? "cursor-pointer hover:brightness-110" : ""} shadow-sm`}
      style={{ backgroundColor: styles.bg, borderColor: styles.border, color: styles.text }}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="font-bold text-sm leading-none">
          {shift.startTime}–{shift.endTime}
        </div>
        <div className="text-[11px] font-semibold leading-none px-1.5 py-0.5 rounded bg-white/25">
          {shift.assignedEmployees.length}/{shift.assistantsNeeded}
        </div>
      </div>

      {shift.substitute && (
        <div className="text-[10px] mt-1 leading-tight font-medium" style={{ color: styles.subText }}>
          Vertretung: {shift.substitute.name.replace(/^Dr\. /, "")}
        </div>
      )}
      {shift.isAbsent && !shift.substitute && (
        <div className="text-[10px] mt-1 leading-tight font-semibold" style={{ color: styles.subText }}>
          Arzt abwesend
        </div>
      )}

      <div className="mt-1.5 pt-1.5 border-t border-white/30">
        {shift.assignedEmployees.length === 0 ? (
          <div className="text-[11px] italic" style={{ color: styles.subText }}>
            Niemand zugeteilt
          </div>
        ) : (
          <div className="text-[11px] leading-tight" style={{ color: styles.text }}>
            {shift.assignedEmployees.map((e) => e.name.split(" ")[0]).join(", ")}
          </div>
        )}
      </div>

      {shift.requiredSkills.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-1.5">
          {shift.requiredSkills.map((sId) => {
            const covered = shift.assignedEmployees.some((e) => e.skills.includes(sId));
            return (
              <span
                key={sId}
                className="text-[9px] px-1.5 py-0.5 rounded font-medium leading-none flex items-center gap-0.5"
                style={{
                  backgroundColor: covered ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.18)",
                  color: styles.text,
                }}
                title={skillMap[sId].label}
              >
                {covered ? <Check size={8} /> : <X size={8} />}
                {skillMap[sId].label}
              </span>
            );
          })}
        </div>
      )}

      {(canSignUp || canSubstitute) && (
        <div className="mt-2">
          {canSignUp && (
            <button
              onClick={handleSignUp}
              className="w-full text-[11px] font-semibold py-1 rounded bg-white/95 hover:bg-white"
              style={{ color: styles.bg }}
            >
              <UserPlus size={11} className="inline -mt-0.5 mr-0.5" /> Mich eintragen
            </button>
          )}
          {canSubstitute && (
            <button
              onClick={handleSubstitute}
              className="w-full text-[11px] font-semibold py-1 rounded bg-white/95 hover:bg-white"
              style={{ color: styles.bg }}
            >
              <UserPlus size={11} className="inline -mt-0.5 mr-0.5" /> Als Vertretung
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DayColumn({ date, data, setData, user, onEditShift }) {
  const shifts = useMemo(() => getShiftsForDate(data, date), [data, date]);
  const dayName = DAYS.find((d) => d.id === (date.getDay() === 0 ? 7 : date.getDay()))?.label || "";
  const isToday = dateToKey(date) === dateToKey(new Date());

  return (
    <Card className={isToday ? "border-[#1B3A5C] border-2" : ""}>
      <div className="px-4 py-3 border-b border-[#E2E6EC] flex items-center justify-between">
        <div>
          <div className="font-serif text-[#1B3A5C]">{dayName}</div>
          <div className="text-xs text-[#5A6478]">{formatDate(date)}</div>
        </div>
        {isToday && <Badge color="blue">Heute</Badge>}
      </div>
      <div className="p-3 space-y-2 min-h-[100px]">
        {shifts.length === 0 ? (
          <div className="text-xs text-[#9AA3B2] text-center py-4">Keine Dienste geplant</div>
        ) : (
          shifts.map((s) => (
            <ShiftCard
              key={s.id}
              shift={s}
              data={data}
              setData={setData}
              user={user}
              onClick={() => onEditShift(s)}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function ShiftCard({ shift, data, setData, user, onClick }) {
  const skillMap = getSkillMap(data);
  const status = getShiftStatus(shift);
  const statusBg = {
    complete: "bg-[#F0F7F2] border-[#BFD9C9]",
    missing: "bg-[#FBEFEF] border-[#E8C2C2]",
    skill_missing: "bg-[#FDF7E6] border-[#E8D49A]",
    no_doctor: "bg-[#F3EBF7] border-[#D4C2E0]",
  }[status];
  const statusBar = {
    complete: "#2D7A4C",
    missing: "#B23A3A",
    skill_missing: "#B8861B",
    no_doctor: "#7A4E8E",
  }[status];

  const displayedDoctor = shift.substitute || shift.doctor;
  const canSignUp =
    user.role === "employee" &&
    shift.assignedEmployees.length < shift.assistantsNeeded &&
    !shift.assignedEmployeeIds.includes(user.id) &&
    isEmployeeAvailable(data, user.id, new Date(shift.date));
  const canSubstitute =
    user.role === "doctor" &&
    shift.isAbsent &&
    !shift.substituteId &&
    user.id !== shift.doctorId;

  const handleSignUp = async (e) => {
    e.stopPropagation();
    const key = `${shift.date}_${shift.doctorId}_${shift.slotId}`;
    const cur = data.assignments[key] || [];
    if (cur.includes(user.id) || cur.length >= shift.assistantsNeeded) return;
    setData({ ...data, assignments: { ...data.assignments, [key]: [...cur, user.id] } });
  };

  const handleSubstitute = (e) => {
    e.stopPropagation();
    const key = `${shift.date}_${shift.doctorId}_${shift.slotId}`;
    setData({ ...data, substitutes: { ...data.substitutes, [key]: user.id } });
  };

  return (
    <div
      onClick={user.role === "admin" ? onClick : undefined}
      className={`relative border rounded overflow-hidden ${statusBg} ${user.role === "admin" ? "cursor-pointer hover:shadow-sm" : ""}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: statusBar }} />
      <div className="pl-3 pr-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Stethoscope size={12} className="text-[#1B3A5C] shrink-0" />
              <span className={`text-sm font-medium ${shift.isAbsent && !shift.substituteId ? "line-through text-[#B23A3A]" : "text-[#1B3A5C]"}`}>
                {displayedDoctor.name}
              </span>
              {shift.substitute && <Badge color="amber">Vertretung</Badge>}
            </div>
            <div className="text-xs text-[#5A6478] mt-0.5">
              {shift.startTime}–{shift.endTime} ({shiftHours(shift)}h)
            </div>
          </div>
        </div>

        {shift.requiredSkills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {shift.requiredSkills.map((sId) => {
              const s = skillMap[sId];
              const covered = shift.assignedEmployees.some((e) => e.skills.includes(sId));
              return (
                <Badge key={sId} color={covered ? "green" : "red"}>
                  {covered ? <Check size={10} /> : <X size={10} />}
                  {s.label}
                </Badge>
              );
            })}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-black/5">
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478] mb-1">
            Assistenz {shift.assignedEmployees.length}/{shift.assistantsNeeded}
          </div>
          {shift.assignedEmployees.length === 0 ? (
            <div className="text-xs text-[#9AA3B2] italic">Niemand zugeteilt</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {shift.assignedEmployees.map((e) => (
                <span key={e.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-white border border-[#D6DCE3] rounded">
                  <UserCog size={10} /> {e.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {(canSignUp || canSubstitute) && (
          <div className="mt-2 pt-2 border-t border-black/5">
            {canSignUp && (
              <Button variant="success" size="sm" onClick={handleSignUp} className="w-full">
                <UserPlus size={12} /> Mich eintragen
              </Button>
            )}
            {canSubstitute && (
              <Button variant="success" size="sm" onClick={handleSubstitute} className="w-full">
                <UserPlus size={12} /> Als Vertretung eintragen
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ShiftEditModal({ shift, data, setData, onClose }) {
  const skillMap = getSkillMap(data);
  const key = `${shift.date}_${shift.doctorId}_${shift.slotId}`;
  const [assigned, setAssigned] = useState(shift.assignedEmployeeIds);
  const [substituteId, setSubstituteId] = useState(shift.substituteId || "");

  const toggleEmployee = (id) => {
    setAssigned((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const handleSave = () => {
    const newData = { ...data };
    newData.assignments = { ...data.assignments, [key]: assigned };
    newData.substitutes = { ...data.substitutes };
    if (substituteId) newData.substitutes[key] = substituteId;
    else delete newData.substitutes[key];
    setData(newData);
    onClose();
  };

  const availableEmployees = data.employees.filter((e) =>
    isEmployeeAvailable(data, e.id, new Date(shift.date))
  );
  const unavailableEmployees = data.employees.filter((e) =>
    !isEmployeeAvailable(data, e.id, new Date(shift.date))
  );

  return (
    <Modal open onClose={onClose} title={`Dienst bearbeiten · ${formatDate(new Date(shift.date))}`}>
      <div className="space-y-5">
        <div className="p-3 bg-[#F4F6F9] rounded">
          <div className="font-medium text-[#1B3A5C]">{shift.doctor.name}</div>
          <div className="text-sm text-[#5A6478]">
            {shift.startTime}–{shift.endTime} · {shift.assistantsNeeded} Assistenz benötigt
          </div>
          {shift.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {shift.requiredSkills.map((sId) => (
                <Badge key={sId} color="blue">{skillMap[sId].label}</Badge>
              ))}
            </div>
          )}
        </div>

        {shift.isAbsent && (
          <div>
            <Label>Vertretungsarzt</Label>
            <Select value={substituteId} onChange={(e) => setSubstituteId(e.target.value)}>
              <option value="">— Keiner —</option>
              {data.doctors.filter((d) => d.id !== shift.doctorId).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label>Verfügbare Mitarbeiter</Label>
          <div className="space-y-1.5">
            {availableEmployees.map((e) => {
              const isAssigned = assigned.includes(e.id);
              const hasAllSkills = shift.requiredSkills.every((s) => e.skills.includes(s));
              return (
                <label
                  key={e.id}
                  className={`flex items-center gap-2 px-3 py-2 border rounded cursor-pointer ${
                    isAssigned ? "bg-[#EEF3F8] border-[#1B3A5C]" : "bg-white border-[#E2E6EC] hover:border-[#C5CCD6]"
                  }`}
                >
                  <input type="checkbox" checked={isAssigned} onChange={() => toggleEmployee(e.id)} className="rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1B3A5C]">{e.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {e.skills.map((s) => (
                        <Badge key={s} color={shift.requiredSkills.includes(s) ? "green" : "gray"}>
                          {skillMap[s].label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {hasAllSkills && <Check size={16} className="text-[#2D7A4C]" />}
                </label>
              );
            })}
          </div>
        </div>

        {unavailableEmployees.length > 0 && (
          <div>
            <Label>Nicht verfügbar an diesem Tag</Label>
            <div className="space-y-1">
              {unavailableEmployees.map((e) => (
                <div key={e.id} className="flex items-center gap-2 px-3 py-2 bg-[#F4F6F9] border border-[#E2E6EC] rounded text-sm text-[#9AA3B2]">
                  <CalendarX size={14} /> {e.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E6EC]">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave}><Save size={14} /> Speichern</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// ÄRZTE VERWALTEN
// ============================================================================

function AerzteView({ data, setData }) {
  const skillMap = getSkillMap(data);
  const [editing, setEditing] = useState(null);

  const handleDelete = (id) => {
    if (!confirm("Diesen Arzt wirklich löschen?")) return;
    setData({ ...data, doctors: data.doctors.filter((d) => d.id !== id) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-[#1B3A5C]">Ärzte</h2>
          <p className="text-sm text-[#5A6478] mt-0.5">{data.doctors.length} Arzt/Ärztinnen verwaltet</p>
        </div>
        <Button onClick={() => setEditing({})}><Plus size={14} /> Neuer Arzt</Button>
      </div>

      <div className="grid gap-3">
        {data.doctors.map((doc) => (
          <Card key={doc.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope size={16} className="text-[#1B3A5C]" />
                  <span className="text-lg font-serif text-[#1B3A5C]">{doc.name}</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label>Regulärer Dienstplan</Label>
                    {doc.regularSchedule.length === 0 ? (
                      <div className="text-sm text-[#9AA3B2] italic">Keine regulären Zeiten</div>
                    ) : (
                      <div className="space-y-1">
                        {doc.regularSchedule.map((s) => (
                          <div key={s.id} className="text-sm flex items-center gap-2">
                            <Badge color="blue">{DAYS.find((d) => d.id === s.dayOfWeek)?.label}</Badge>
                            <span className="text-[#1B3A5C]">{s.startTime}–{s.endTime}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Anforderungen pro Dienst</Label>
                    <div className="text-sm mb-2">
                      <span className="font-medium text-[#1B3A5C]">{doc.assistantsNeeded}</span>
                      <span className="text-[#5A6478]"> {doc.assistantsNeeded === 1 ? "Assistenz" : "Assistenzen"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {doc.requiredSkills.length === 0 ? (
                        <span className="text-xs text-[#9AA3B2] italic">Keine besonderen Qualifikationen</span>
                      ) : (
                        doc.requiredSkills.map((sId) => (
                          <Badge key={sId} color="blue">{skillMap[sId].label}</Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setEditing(doc)}><Edit3 size={14} /></Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(doc.id)}><Trash2 size={14} /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <DoctorEditModal
          doctor={editing}
          data={data}
          setData={setData}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DoctorEditModal({ doctor, data, setData, onClose }) {
  const isNew = !doctor.id;
  const [form, setForm] = useState({
    id: doctor.id || uid(),
    name: doctor.name || "",
    password: doctor.password || "",
    regularSchedule: doctor.regularSchedule ? [...doctor.regularSchedule] : [],
    requiredSkills: doctor.requiredSkills ? [...doctor.requiredSkills] : [],
    assistantsNeeded: doctor.assistantsNeeded || 1,
  });

  const addSlot = () => {
    setForm({
      ...form,
      regularSchedule: [
        ...form.regularSchedule,
        { id: uid(), dayOfWeek: 1, startTime: "08:00", endTime: "13:00" },
      ],
    });
  };
  const updateSlot = (id, field, value) => {
    setForm({
      ...form,
      regularSchedule: form.regularSchedule.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    });
  };
  const removeSlot = (id) => {
    setForm({ ...form, regularSchedule: form.regularSchedule.filter((s) => s.id !== id) });
  };
  const toggleSkill = (id) => {
    setForm({
      ...form,
      requiredSkills: form.requiredSkills.includes(id)
        ? form.requiredSkills.filter((s) => s !== id)
        : [...form.requiredSkills, id],
    });
  };

  const handleSave = () => {
    if (!form.name || !form.password) { alert("Name und Passwort sind erforderlich"); return; }
    const newDocs = isNew ? [...data.doctors, form] : data.doctors.map((d) => (d.id === form.id ? form : d));
    setData({ ...data, doctors: newDocs });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isNew ? "Neuer Arzt" : `Arzt bearbeiten`} size="lg">
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. Vorname Nachname" />
          </div>
          <div>
            <Label>Passwort (zum Anmelden)</Label>
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="mb-0">Regulärer Dienstplan</Label>
            <Button size="sm" variant="secondary" onClick={addSlot}><Plus size={12} /> Zeit hinzufügen</Button>
          </div>
          <div className="space-y-2">
            {form.regularSchedule.length === 0 && (
              <div className="text-sm text-[#9AA3B2] italic px-3 py-3 bg-[#F4F6F9] rounded">Noch keine regulären Zeiten</div>
            )}
            {form.regularSchedule.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <Select value={s.dayOfWeek} onChange={(e) => updateSlot(s.id, "dayOfWeek", Number(e.target.value))} className="flex-1">
                  {DAYS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </Select>
                <Input type="time" value={s.startTime} onChange={(e) => updateSlot(s.id, "startTime", e.target.value)} className="w-28" />
                <span className="text-[#5A6478]">–</span>
                <Input type="time" value={s.endTime} onChange={(e) => updateSlot(s.id, "endTime", e.target.value)} className="w-28" />
                <Button size="sm" variant="danger" onClick={() => removeSlot(s.id)}><Trash2 size={12} /></Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Anzahl Assistenz benötigt</Label>
            <Select value={form.assistantsNeeded} onChange={(e) => setForm({ ...form, assistantsNeeded: Number(e.target.value) })}>
              <option value={1}>1 Assistenz</option>
              <option value={2}>2 Assistenzen</option>
              <option value={3}>3 Assistenzen</option>
            </Select>
          </div>
        </div>

        <div>
          <Label>Benötigte Qualifikationen der Assistenz</Label>
          <p className="text-xs text-[#5A6478] mb-2">Die zugeteilten Mitarbeiter müssen zusammen alle gewählten Qualifikationen abdecken.</p>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {getSkills(data).map((s) => {
              const checked = form.requiredSkills.includes(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm ${checked ? "bg-[#EEF3F8] border-[#1B3A5C]" : "bg-white border-[#E2E6EC]"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSkill(s.id)} />
                  <SkillIcon iconKey={s.iconKey} size={12} className="text-[#1B3A5C]" />
                  <span className="text-[#1B3A5C]">{s.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E6EC]">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave}><Save size={14} /> Speichern</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// MITARBEITER VERWALTEN
// ============================================================================

function MitarbeiterView({ data, setData }) {
  const skillMap = getSkillMap(data);
  const [editing, setEditing] = useState(null);

  const handleDelete = (id) => {
    if (!confirm("Diesen Mitarbeiter wirklich löschen?")) return;
    setData({ ...data, employees: data.employees.filter((e) => e.id !== id) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-[#1B3A5C]">Mitarbeiter</h2>
          <p className="text-sm text-[#5A6478] mt-0.5">{data.employees.length} Mitarbeiter:innen verwaltet</p>
        </div>
        <Button onClick={() => setEditing({})}><Plus size={14} /> Neuer Mitarbeiter</Button>
      </div>

      <div className="grid gap-3">
        {data.employees.map((emp) => {
          const balance = computeBalance(emp);
          return (
            <Card key={emp.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <UserCog size={16} className="text-[#1B3A5C]" />
                    <span className="text-lg font-serif text-[#1B3A5C]">{emp.name}</span>
                    <Badge color="gray">{emp.weeklyHours}h/Woche</Badge>
                    <Badge color={balance >= 0 ? "green" : "red"}>
                      {balance >= 0 ? "+" : ""}{balance.toFixed(1)}h
                    </Badge>
                  </div>
                  <div>
                    <Label>Qualifikationen</Label>
                    <div className="flex flex-wrap gap-1">
                      {emp.skills.length === 0 ? (
                        <span className="text-xs text-[#9AA3B2] italic">Keine Qualifikationen eingetragen</span>
                      ) : (
                        emp.skills.map((sId) => (
                          <Badge key={sId} color="blue">{skillMap[sId].label}</Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(emp)}><Edit3 size={14} /></Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(emp.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {editing && (
        <EmployeeEditModal
          employee={editing}
          data={data}
          setData={setData}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EmployeeEditModal({ employee, data, setData, onClose }) {
  const isNew = !employee.id;
  const [form, setForm] = useState({
    id: employee.id || uid(),
    name: employee.name || "",
    password: employee.password || "",
    skills: employee.skills ? [...employee.skills] : [],
    weeklyHours: employee.weeklyHours ?? 38.5,
    initialHours: employee.initialHours ?? 0,
    initialVacationHours: employee.initialVacationHours ?? 200,
    hourEntries: employee.hourEntries ? [...employee.hourEntries] : [],
  });

  const toggleSkill = (id) => {
    setForm({
      ...form,
      skills: form.skills.includes(id) ? form.skills.filter((s) => s !== id) : [...form.skills, id],
    });
  };

  const handleSave = () => {
    if (!form.name || !form.password) { alert("Name und Passwort sind erforderlich"); return; }
    const newEmps = isNew ? [...data.employees, form] : data.employees.map((e) => (e.id === form.id ? form : e));
    setData({ ...data, employees: newEmps });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isNew ? "Neuer Mitarbeiter" : `Mitarbeiter bearbeiten`} size="lg">
      <div className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Vorname Nachname" />
          </div>
          <div>
            <Label>Passwort (zum Anmelden)</Label>
            <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Wochenstunden</Label>
            <Input type="number" step="0.5" value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Anfangsstunden (Saldo)</Label>
            <Input type="number" step="0.5" value={form.initialHours} onChange={(e) => setForm({ ...form, initialHours: Number(e.target.value) })} />
            <p className="text-xs text-[#5A6478] mt-1">Stundensaldo beim Eintritt</p>
          </div>
          <div>
            <Label>Jahres-Urlaubsstunden</Label>
            <Input type="number" step="1" value={form.initialVacationHours} onChange={(e) => setForm({ ...form, initialVacationHours: Number(e.target.value) })} />
          </div>
        </div>

        <div>
          <Label>Qualifikationen / Was kann er/sie?</Label>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {getSkills(data).map((s) => {
              const checked = form.skills.includes(s.id);
              return (
                <label key={s.id} className={`flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm ${checked ? "bg-[#EEF3F8] border-[#1B3A5C]" : "bg-white border-[#E2E6EC]"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSkill(s.id)} />
                  <SkillIcon iconKey={s.iconKey} size={12} className="text-[#1B3A5C]" />
                  <span className="text-[#1B3A5C]">{s.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E6EC]">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave}><Save size={14} /> Speichern</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// STUNDENKONTEN-ÜBERSICHT (ADMIN)
// ============================================================================

function StundenView({ data, setData }) {
  const [openId, setOpenId] = useState(null);
  const openEmployee = data.employees.find((e) => e.id === openId);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-serif text-[#1B3A5C]">Stundenkonten</h2>
        <p className="text-sm text-[#5A6478] mt-0.5">Übersicht und Bearbeitung der Stundensalden</p>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6F9] border-b border-[#E2E6EC]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#5A6478]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Wochenstd.</th>
              <th className="px-4 py-3 text-right">Anfangssaldo</th>
              <th className="px-4 py-3 text-right">Arbeitsstd.</th>
              <th className="px-4 py-3 text-right">Urlaub genommen</th>
              <th className="px-4 py-3 text-right">Urlaub übrig</th>
              <th className="px-4 py-3 text-right">Aktueller Saldo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.employees.map((emp) => {
              const balance = computeBalance(emp);
              const used = computeVacationUsed(emp);
              const remaining = (emp.initialVacationHours || 0) - used;
              const worked = computeWorkedHours(emp);
              return (
                <tr key={emp.id} className="border-b border-[#E2E6EC] last:border-0 hover:bg-[#FAFBFC]">
                  <td className="px-4 py-3 font-medium text-[#1B3A5C]">{emp.name}</td>
                  <td className="px-4 py-3 text-right text-[#5A6478]">{emp.weeklyHours}h</td>
                  <td className="px-4 py-3 text-right text-[#5A6478]">{emp.initialHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-[#5A6478]">{worked.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-[#5A6478]">{used.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-[#5A6478]">{remaining.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right">
                    <Badge color={balance >= 0 ? "green" : "red"}>
                      {balance >= 0 ? "+" : ""}{balance.toFixed(1)}h
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setOpenId(emp.id)}>Buchungen</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {openEmployee && (
        <HourEntriesModal
          employee={openEmployee}
          data={data}
          setData={setData}
          onClose={() => setOpenId(null)}
          editable
        />
      )}
    </div>
  );
}

function HourEntriesModal({ employee, data, setData, onClose, editable }) {
  const [entries, setEntries] = useState(employee.hourEntries || []);
  const [draft, setDraft] = useState({
    type: "arbeit",
    date: dateToKey(new Date()),
    hours: 0,
    note: "",
  });

  const addEntry = () => {
    if (!draft.hours || draft.hours <= 0) return;
    setEntries([...entries, { id: uid(), ...draft }]);
    setDraft({ type: "arbeit", date: dateToKey(new Date()), hours: 0, note: "" });
  };
  const removeEntry = (id) => setEntries(entries.filter((e) => e.id !== id));

  const handleSave = () => {
    setData({
      ...data,
      employees: data.employees.map((e) => (e.id === employee.id ? { ...e, hourEntries: entries } : e)),
    });
    onClose();
  };

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const balance = computeBalance({ ...employee, hourEntries: entries });
  const vacationUsed = entries.filter((e) => e.type === "urlaub").reduce((s, e) => s + e.hours, 0);
  const vacationLeft = (employee.initialVacationHours || 0) - vacationUsed;

  return (
    <Modal open onClose={onClose} title={`Stundenkonto · ${employee.name}`} size="xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Anfangssaldo</div>
            <div className="text-xl font-serif text-[#1B3A5C] mt-1">{employee.initialHours.toFixed(1)}h</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Urlaub genommen</div>
            <div className="text-xl font-serif text-[#1B3A5C] mt-1">{vacationUsed.toFixed(1)}h</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Urlaub übrig</div>
            <div className="text-xl font-serif text-[#1B3A5C] mt-1">{vacationLeft.toFixed(1)}h</div>
          </Card>
          <Card className="p-3">
            <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Saldo aktuell</div>
            <div className={`text-xl font-serif mt-1 ${balance >= 0 ? "text-[#2D7A4C]" : "text-[#B23A3A]"}`}>
              {balance >= 0 ? "+" : ""}{balance.toFixed(1)}h
            </div>
          </Card>
        </div>

        {editable && (
          <Card className="p-3 bg-[#F4F6F9]">
            <Label>Neue Buchung hinzufügen</Label>
            <div className="grid sm:grid-cols-5 gap-2">
              <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                {ENTRY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
              <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              <Input type="number" step="0.25" placeholder="Stunden" value={draft.hours || ""} onChange={(e) => setDraft({ ...draft, hours: Number(e.target.value) })} />
              <Input placeholder="Notiz (optional)" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              <Button onClick={addEntry}><Plus size={14} /> Hinzufügen</Button>
            </div>
          </Card>
        )}

        <div>
          <Label>Alle Buchungen ({sorted.length})</Label>
          {sorted.length === 0 ? (
            <div className="text-sm text-[#9AA3B2] italic px-3 py-4 bg-[#F4F6F9] rounded">Noch keine Buchungen</div>
          ) : (
            <div className="border border-[#E2E6EC] rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F4F6F9] border-b border-[#E2E6EC]">
                  <tr className="text-left text-xs uppercase tracking-wide text-[#5A6478]">
                    <th className="px-3 py-2">Datum</th>
                    <th className="px-3 py-2">Typ</th>
                    <th className="px-3 py-2 text-right">Stunden</th>
                    <th className="px-3 py-2">Notiz</th>
                    {editable && <th className="px-3 py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => {
                    const type = ENTRY_TYPE_MAP[e.type];
                    const Icon = type?.icon || Clock;
                    return (
                      <tr key={e.id} className="border-b border-[#E2E6EC] last:border-0">
                        <td className="px-3 py-2 text-[#1B3A5C]">{formatDate(new Date(e.date))}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-[#1B3A5C]">
                            <Icon size={12} /> {type?.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-[#1B3A5C]">
                          {type?.sign === -1 ? "−" : type?.sign === 1 ? "+" : ""}{e.hours}h
                        </td>
                        <td className="px-3 py-2 text-[#5A6478]">{e.note || "—"}</td>
                        {editable && (
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="ghost" onClick={() => removeEntry(e.id)}><X size={12} /></Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E6EC]">
          <Button variant="secondary" onClick={onClose}>Schließen</Button>
          {editable && <Button onClick={handleSave}><Save size={14} /> Speichern</Button>}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// MEIN STUNDENKONTO (MITARBEITER) – mit Selbst-Eintrag
// ============================================================================

function MeinKontoView({ data, setData, user }) {
  const emp = data.employees.find((e) => e.id === user.id);
  const [draft, setDraft] = useState({
    type: "arbeit",
    date: dateToKey(new Date()),
    startTime: "",
    endTime: "",
    hours: 0,
    note: "",
    useTime: true,
  });
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  if (!emp) return null;
  const balance = computeBalance(emp);
  const used = computeVacationUsed(emp);
  const remaining = (emp.initialVacationHours || 0) - used;
  const worked = computeWorkedHours(emp);
  const sorted = [...(emp.hourEntries || [])].sort((a, b) => b.date.localeCompare(a.date));

  // Stunden aus Start/Ende berechnen, falls Zeit-Modus aktiv
  const computedHours = useMemo(() => {
    if (!draft.useTime) return draft.hours;
    if (!draft.startTime || !draft.endTime) return 0;
    const diff = (timeToMinutes(draft.endTime) - timeToMinutes(draft.startTime)) / 60;
    return diff > 0 ? Number(diff.toFixed(2)) : 0;
  }, [draft]);

  const addEntry = () => {
    const hours = computedHours;
    if (!hours || hours <= 0) {
      alert("Bitte gültige Stundenanzahl angeben (mehr als 0).");
      return;
    }
    const entry = {
      id: uid(),
      type: draft.type,
      date: draft.date,
      hours,
      note: draft.note ||
        (draft.useTime && draft.startTime && draft.endTime
          ? `${draft.startTime}–${draft.endTime}`
          : ""),
    };
    setData({
      ...data,
      employees: data.employees.map((e) =>
        e.id === emp.id ? { ...e, hourEntries: [...(e.hourEntries || []), entry] } : e
      ),
    });
    setDraft({
      ...draft,
      startTime: "",
      endTime: "",
      hours: 0,
      note: "",
    });
  };

  const removeEntry = (id) => {
    setData({
      ...data,
      employees: data.employees.map((e) =>
        e.id === emp.id
          ? { ...e, hourEntries: (e.hourEntries || []).filter((x) => x.id !== id) }
          : e
      ),
    });
    setConfirmRemoveId(null);
  };

  const todayKey = dateToKey(new Date());

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-serif text-[#1B3A5C]">Mein Stundenkonto</h2>
        <p className="text-sm text-[#5A6478] mt-0.5">
          Übersicht und Eintragung tatsächlich geleisteter Stunden, Urlaub etc.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Wochenstunden</div>
          <div className="text-2xl font-serif text-[#1B3A5C] mt-1">{emp.weeklyHours}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Saldo aktuell</div>
          <div className={`text-2xl font-serif mt-1 ${balance >= 0 ? "text-[#2D7A4C]" : "text-[#B23A3A]"}`}>
            {balance >= 0 ? "+" : ""}{balance.toFixed(1)}h
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Arbeitsstunden</div>
          <div className="text-2xl font-serif text-[#1B3A5C] mt-1">{worked.toFixed(1)}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Urlaub übrig</div>
          <div className="text-2xl font-serif text-[#1B3A5C] mt-1">
            {remaining.toFixed(1)}<span className="text-sm">/{emp.initialVacationHours}h</span>
          </div>
        </Card>
      </div>

      {/* Selbst-Eintrag */}
      <Card className="p-4 bg-[#FBFCFD] border-[#C5D6E5]">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-[#1B3A5C]" />
          <div className="font-serif text-lg text-[#1B3A5C]">Stunden eintragen</div>
        </div>
        <p className="text-xs text-[#5A6478] mb-3">
          Tragen Sie Ihre tatsächlich geleisteten Stunden ein – unabhängig vom Dienstplan.
          Sie können entweder Start- und Endzeit angeben oder die Stundenanzahl direkt eingeben.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Art der Buchung</Label>
            <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              {ENTRY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </div>
          <div>
            <Label>Datum</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDraft({ ...draft, date: todayKey })}
                className="shrink-0"
              >
                Heute
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-3 mb-2">
            <Label className="mb-0">Stunden erfassen</Label>
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, useTime: true })}
                className={`px-2.5 py-1 rounded border ${draft.useTime ? "bg-[#1B3A5C] text-white border-[#1B3A5C]" : "bg-white text-[#5A6478] border-[#C5CCD6]"}`}
              >
                Start–Ende
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, useTime: false })}
                className={`px-2.5 py-1 rounded border ${!draft.useTime ? "bg-[#1B3A5C] text-white border-[#1B3A5C]" : "bg-white text-[#5A6478] border-[#C5CCD6]"}`}
              >
                Anzahl Stunden
              </button>
            </div>
          </div>

          {draft.useTime ? (
            <div className="grid grid-cols-[1fr_auto_1fr_auto] sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
              <Input
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                placeholder="von"
              />
              <span className="text-[#5A6478]">–</span>
              <Input
                type="time"
                value={draft.endTime}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                placeholder="bis"
              />
              <span className="px-3 py-2 bg-white border border-[#E2E6EC] rounded text-sm text-[#1B3A5C] font-medium whitespace-nowrap">
                = {computedHours.toFixed(2)}h
              </span>
            </div>
          ) : (
            <Input
              type="number"
              step="0.25"
              placeholder="z.B. 7.5"
              value={draft.hours || ""}
              onChange={(e) => setDraft({ ...draft, hours: Number(e.target.value) })}
            />
          )}
        </div>

        <div className="mt-3">
          <Label>Notiz (optional)</Label>
          <Input
            placeholder="z.B. länger geblieben, früher gegangen, Sondereinsatz …"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={addEntry}>
            <Plus size={14} /> Eintrag speichern
          </Button>
        </div>
      </Card>

      {/* Liste */}
      <Card>
        <div className="px-4 py-3 border-b border-[#E2E6EC] flex items-center justify-between">
          <div className="text-sm font-semibold text-[#1B3A5C]">Meine Buchungen ({sorted.length})</div>
          <div className="text-xs text-[#5A6478]">Neueste zuerst</div>
        </div>
        {sorted.length === 0 ? (
          <div className="text-sm text-[#9AA3B2] italic px-4 py-5">Noch keine Buchungen</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F4F6F9] border-b border-[#E2E6EC]">
                <tr className="text-left text-xs uppercase tracking-wide text-[#5A6478]">
                  <th className="px-4 py-2">Datum</th>
                  <th className="px-4 py-2">Typ</th>
                  <th className="px-4 py-2 text-right">Stunden</th>
                  <th className="px-4 py-2">Notiz</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => {
                  const type = ENTRY_TYPE_MAP[e.type];
                  const Icon = type?.icon || Clock;
                  return (
                    <tr key={e.id} className="border-b border-[#E2E6EC] last:border-0">
                      <td className="px-4 py-2 text-[#1B3A5C] whitespace-nowrap">
                        {formatDate(new Date(e.date))}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1.5 text-[#1B3A5C]">
                          <Icon size={12} /> {type?.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-[#1B3A5C] whitespace-nowrap">
                        {type?.sign === -1 ? "−" : type?.sign === 1 ? "+" : ""}{e.hours}h
                      </td>
                      <td className="px-4 py-2 text-[#5A6478]">{e.note || "—"}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {confirmRemoveId === e.id ? (
                          <div className="inline-flex gap-1">
                            <Button size="sm" variant="danger" onClick={() => removeEntry(e.id)}>
                              <Check size={12} /> Löschen
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmRemoveId(null)}>
                              <X size={12} />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setConfirmRemoveId(e.id)}>
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// ABWESENHEITEN
// ============================================================================

function AbwesenheitView({ data, setData, user }) {
  const [newDate, setNewDate] = useState(dateToKey(new Date()));
  const [reason, setReason] = useState("");

  const personType = user.role === "doctor" ? "doctor" : "employee";
  const myAbsences = data.absences
    .filter((a) => a.personId === user.id && a.personType === personType)
    .sort((a, b) => a.date.localeCompare(b.date));

  const addAbsence = () => {
    if (!newDate) return;
    if (myAbsences.some((a) => a.date === newDate)) return;
    setData({
      ...data,
      absences: [...data.absences, { personId: user.id, personType, date: newDate, reason }],
    });
    setReason("");
  };

  const removeAbsence = (date) => {
    setData({
      ...data,
      absences: data.absences.filter(
        (a) => !(a.personId === user.id && a.personType === personType && a.date === date)
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-serif text-[#1B3A5C]">Meine Abwesenheiten</h2>
        <p className="text-sm text-[#5A6478] mt-0.5">
          Tragen Sie ein, wann Sie nicht arbeiten können. Die Verwaltung sieht diese Tage im Wochenplan.
        </p>
      </div>

      <Card className="p-4">
        <Label>Neue Abwesenheit eintragen</Label>
        <div className="grid sm:grid-cols-[auto_1fr_auto] gap-2">
          <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <Input placeholder="Grund (optional, z.B. Urlaub, Termin)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={addAbsence}><Plus size={14} /> Eintragen</Button>
        </div>
      </Card>

      <Card>
        <div className="px-4 py-3 border-b border-[#E2E6EC]">
          <div className="text-sm font-semibold text-[#1B3A5C]">Eingetragene Abwesenheiten ({myAbsences.length})</div>
        </div>
        {myAbsences.length === 0 ? (
          <div className="text-sm text-[#9AA3B2] italic px-4 py-5">Keine Abwesenheiten eingetragen</div>
        ) : (
          <div className="divide-y divide-[#E2E6EC]">
            {myAbsences.map((a) => (
              <div key={a.date} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-[#1B3A5C]">{formatDate(new Date(a.date))}</div>
                  {a.reason && <div className="text-xs text-[#5A6478]">{a.reason}</div>}
                </div>
                <Button size="sm" variant="danger" onClick={() => removeAbsence(a.date)}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================================
// AUFGABEN-VERWALTUNG (Skills)
// ============================================================================

function AufgabenView({ data, setData }) {
  const [editing, setEditing] = useState(null);

  const handleDelete = (skillId) => {
    const skill = data.skills.find((s) => s.id === skillId);
    if (!skill) return;
    const docCount = data.doctors.filter((d) => d.requiredSkills.includes(skillId)).length;
    const empCount = data.employees.filter((e) => e.skills.includes(skillId)).length;
    const msg = docCount + empCount > 0
      ? `„${skill.label}“ wirklich löschen? Diese Aufgabe ist bei ${docCount} Arzt/Ärzten und ${empCount} Mitarbeiter:innen hinterlegt und wird dort entfernt.`
      : `„${skill.label}“ wirklich löschen?`;
    if (!confirm(msg)) return;
    setData({
      ...data,
      skills: data.skills.filter((s) => s.id !== skillId),
      doctors: data.doctors.map((d) => ({ ...d, requiredSkills: d.requiredSkills.filter((s) => s !== skillId) })),
      employees: data.employees.map((e) => ({ ...e, skills: e.skills.filter((s) => s !== skillId) })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-[#1B3A5C]">Aufgaben / Qualifikationen</h2>
          <p className="text-sm text-[#5A6478] mt-0.5">
            {data.skills.length} Aufgaben definiert. Hier können Sie Tätigkeiten anlegen, umbenennen oder entfernen.
          </p>
        </div>
        <Button onClick={() => setEditing({})}><Plus size={14} /> Neue Aufgabe</Button>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6F9] border-b border-[#E2E6EC]">
            <tr className="text-left text-xs uppercase tracking-wide text-[#5A6478]">
              <th className="px-4 py-3 w-12"></th>
              <th className="px-4 py-3">Bezeichnung</th>
              <th className="px-4 py-3">Kennung (intern)</th>
              <th className="px-4 py-3 text-right">Verwendet von</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.skills.map((s) => {
              const docCount = data.doctors.filter((d) => d.requiredSkills.includes(s.id)).length;
              const empCount = data.employees.filter((e) => e.skills.includes(s.id)).length;
              return (
                <tr key={s.id} className="border-b border-[#E2E6EC] last:border-0 hover:bg-[#FAFBFC]">
                  <td className="px-4 py-3">
                    <div className="w-8 h-8 rounded bg-[#EEF3F8] flex items-center justify-center">
                      <SkillIcon iconKey={s.iconKey} size={16} className="text-[#1B3A5C]" />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-[#1B3A5C]">{s.label}</td>
                  <td className="px-4 py-3 text-[#5A6478] font-mono text-xs">{s.id}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {docCount > 0 && <Badge color="blue">{docCount} Arzt</Badge>}
                      {empCount > 0 && <Badge color="green">{empCount} MA</Badge>}
                      {docCount === 0 && empCount === 0 && <span className="text-xs text-[#9AA3B2] italic">nicht verwendet</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(s)}><Edit3 size={14} /></Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(s.id)}><Trash2 size={14} /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {editing && (
        <AufgabeEditModal
          skill={editing}
          data={data}
          setData={setData}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AufgabeEditModal({ skill, data, setData, onClose }) {
  const isNew = !skill.id;
  const [form, setForm] = useState({
    id: skill.id || "",
    label: skill.label || "",
    iconKey: skill.iconKey || "hand",
  });

  // Auto-ID generieren bei neuen Aufgaben aus dem Label
  const handleLabelChange = (val) => {
    const auto = val.toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    setForm({ ...form, label: val, id: isNew ? auto : form.id });
  };

  const handleSave = () => {
    if (!form.label.trim()) { alert("Bitte eine Bezeichnung eingeben."); return; }
    if (!form.id.trim()) { alert("Bitte eine Kennung angeben."); return; }
    if (isNew && data.skills.some((s) => s.id === form.id)) {
      alert("Eine Aufgabe mit dieser Kennung existiert bereits.");
      return;
    }
    const newSkills = isNew
      ? [...data.skills, form]
      : data.skills.map((s) => (s.id === skill.id ? form : s));
    setData({ ...data, skills: newSkills });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isNew ? "Neue Aufgabe" : "Aufgabe bearbeiten"} size="md">
      <div className="space-y-5">
        <div>
          <Label>Bezeichnung</Label>
          <Input
            value={form.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="z.B. Wundversorgung, Sprache Polnisch …"
            autoFocus
          />
        </div>
        <div>
          <Label>Kennung (intern)</Label>
          <Input
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
            disabled={!isNew}
            className={!isNew ? "bg-[#F4F6F9] text-[#9AA3B2]" : "font-mono"}
          />
          <p className="text-xs text-[#5A6478] mt-1">
            {isNew ? "Wird automatisch aus der Bezeichnung gebildet. Eindeutige Kennung für die interne Zuordnung." : "Kann nach dem Anlegen nicht mehr geändert werden."}
          </p>
        </div>
        <div>
          <Label>Symbol</Label>
          <div className="grid grid-cols-7 gap-1.5">
            {ICON_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = form.iconKey === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setForm({ ...form, iconKey: opt.key })}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded border text-xs ${active ? "bg-[#1B3A5C] text-white border-[#1B3A5C]" : "bg-white text-[#5A6478] border-[#E2E6EC] hover:border-[#C5CCD6]"}`}
                  title={opt.label}
                >
                  <Icon size={16} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E6EC]">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={handleSave}><Save size={14} /> Speichern</Button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// MONATSÜBERSICHT
// ============================================================================

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"];

function getMonthGrid(monthStart) {
  const start = getMonday(monthStart);
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(addDays(start, w * 7 + d));
    }
    weeks.push(week);
  }
  return weeks.filter((week) => week.some((d) => d.getMonth() === monthStart.getMonth()));
}

function MonatsView({ data, setData, user }) {
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(null);

  const weeks = useMemo(() => getMonthGrid(monthStart), [monthStart]);

  const prevMonth = () => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() - 1);
    setMonthStart(d);
  };
  const nextMonth = () => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + 1);
    setMonthStart(d);
  };
  const thisMonth = () => {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0);
    setMonthStart(d);
  };

  // Statistik pro Monat berechnen
  const stats = useMemo(() => {
    let complete = 0, missing = 0, skill = 0, noDoc = 0, total = 0;
    weeks.flat().forEach((date) => {
      if (date.getMonth() !== monthStart.getMonth()) return;
      const shifts = getShiftsForDate(data, date);
      shifts.forEach((s) => {
        total++;
        const st = getShiftStatus(s);
        if (st === "complete") complete++;
        else if (st === "missing") missing++;
        else if (st === "skill_missing") skill++;
        else if (st === "no_doctor") noDoc++;
      });
    });
    return { complete, missing, skill, noDoc, total };
  }, [data, weeks, monthStart]);

  const statusColors = {
    complete: "#4F9F6A",
    missing: "#C84B4B",
    skill_missing: "#D4A040",
    no_doctor: "#9268A8",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif text-[#1B3A5C]">Monatsübersicht</h2>
          <p className="text-sm text-[#5A6478] mt-0.5">
            {MONTH_NAMES[monthStart.getMonth()]} {monthStart.getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={prevMonth}>
            <ChevronLeft size={14} /> Vorher
          </Button>
          <Button variant="secondary" size="sm" onClick={thisMonth}>
            Aktueller Monat
          </Button>
          <Button variant="secondary" size="sm" onClick={nextMonth}>
            Nächster <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Dienste gesamt</div>
          <div className="text-2xl font-serif text-[#1B3A5C] mt-1">{stats.total}</div>
        </Card>
        <Card className="p-3" style={{ borderLeftColor: statusColors.complete, borderLeftWidth: 4 }}>
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Vollständig</div>
          <div className="text-2xl font-serif mt-1" style={{ color: statusColors.complete }}>{stats.complete}</div>
        </Card>
        <Card className="p-3" style={{ borderLeftColor: statusColors.missing, borderLeftWidth: 4 }}>
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">MA fehlen</div>
          <div className="text-2xl font-serif mt-1" style={{ color: statusColors.missing }}>{stats.missing}</div>
        </Card>
        <Card className="p-3" style={{ borderLeftColor: statusColors.skill_missing, borderLeftWidth: 4 }}>
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Qualifikation fehlt</div>
          <div className="text-2xl font-serif mt-1" style={{ color: statusColors.skill_missing }}>{stats.skill}</div>
        </Card>
        <Card className="p-3" style={{ borderLeftColor: statusColors.no_doctor, borderLeftWidth: 4 }}>
          <div className="text-[10px] uppercase tracking-wide text-[#5A6478]">Arzt fehlt</div>
          <div className="text-2xl font-serif mt-1" style={{ color: statusColors.no_doctor }}>{stats.noDoc}</div>
        </Card>
      </div>

      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold uppercase tracking-wide text-[#5A6478]">Legende:</span>
          <StatusDot status="complete" />
          <StatusDot status="missing" />
          <StatusDot status="skill_missing" />
          <StatusDot status="no_doctor" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#E2E6EC] bg-[#F4F6F9]">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-[#5A6478] border-r border-[#E2E6EC] last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-[#E2E6EC] last:border-b-0">
              {week.map((date) => {
                const inMonth = date.getMonth() === monthStart.getMonth();
                const dateKey = dateToKey(date);
                const isToday = dateKey === dateToKey(new Date());
                const shifts = inMonth ? getShiftsForDate(data, date) : [];
                const hasProblems = shifts.some((s) => getShiftStatus(s) !== "complete");
                return (
                  <button
                    key={dateKey}
                    onClick={() => inMonth && setSelectedDate(date)}
                    disabled={!inMonth}
                    className={`text-left px-2 py-2 min-h-[105px] border-r border-[#E2E6EC] last:border-r-0 transition-colors ${
                      !inMonth ? "bg-[#FAFBFC] opacity-40 cursor-default" :
                      isToday ? "bg-[#EEF3F8] hover:bg-[#E2EBF3]" :
                      hasProblems ? "bg-[#FEF8F4] hover:bg-[#FAEEE4]" :
                      "bg-white hover:bg-[#F4F6F9]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={`text-sm font-medium ${isToday ? "text-[#1B3A5C] font-bold" : inMonth ? "text-[#1B3A5C]" : "text-[#9AA3B2]"}`}>
                        {date.getDate()}
                      </div>
                      {isToday && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[#1B3A5C] text-white font-semibold leading-none">HEUTE</span>
                      )}
                    </div>
                    {shifts.length > 0 && (
                      <div className="space-y-0.5">
                        {shifts.slice(0, 4).map((s) => {
                          const status = getShiftStatus(s);
                          const doctor = s.substitute || s.doctor;
                          return (
                            <div
                              key={s.id}
                              className="rounded px-1.5 py-0.5 text-[10px] leading-tight font-medium text-white truncate"
                              style={{ backgroundColor: statusColors[status] }}
                              title={`${doctor.name} ${s.startTime}–${s.endTime} · ${s.assignedEmployees.length}/${s.assistantsNeeded}`}
                            >
                              {s.startTime.slice(0, 5)} {doctor.name.replace(/^Dr\. /, "").split(" ")[0]}
                            </div>
                          );
                        })}
                        {shifts.length > 4 && (
                          <div className="text-[10px] text-[#5A6478] px-1">
                            +{shifts.length - 4} weitere
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {selectedDate && (
        <MonthDayDetailModal
          date={selectedDate}
          data={data}
          setData={setData}
          user={user}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

function MonthDayDetailModal({ date, data, setData, user, onClose }) {
  const shifts = useMemo(() => getShiftsForDate(data, date), [data, date]);
  const dayName = DAYS.find((d) => d.id === (date.getDay() === 0 ? 7 : date.getDay()))?.label || "";
  const [editShift, setEditShift] = useState(null);

  return (
    <>
      <Modal open onClose={onClose} title={`${dayName}, ${formatDate(date)}`} size="lg">
        {shifts.length === 0 ? (
          <div className="text-center py-8 text-sm text-[#9AA3B2]">Keine Dienste an diesem Tag geplant.</div>
        ) : (
          <div className="space-y-2">
            {shifts.map((s) => (
              <ShiftCard
                key={s.id}
                shift={s}
                data={data}
                setData={setData}
                user={user}
                onClick={() => user.role === "admin" && setEditShift(s)}
              />
            ))}
          </div>
        )}
      </Modal>
      {editShift && (
        <ShiftEditModal
          shift={editShift}
          data={data}
          setData={setData}
          onClose={() => setEditShift(null)}
        />
      )}
    </>
  );
}

// ============================================================================
// HAUPT-APP
// ============================================================================

export default function App() {
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("wochenplan");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [loadError, setLoadError] = useState(false);

  // Initial laden
  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadData();
        // Wenn keine Daten oder leeres Objekt: Initialdaten verwenden
        const isEmpty = !loaded || Object.keys(loaded).length === 0 || !loaded.doctors;
        let initialData = isEmpty ? createInitialData() : loaded;
        // Migration: stelle sicher, dass alle erwarteten Felder existieren
        if (!initialData.skills) initialData.skills = DEFAULT_SKILLS.map((s) => ({ ...s }));
        if (!initialData.doctors) initialData.doctors = [];
        if (!initialData.employees) initialData.employees = [];
        if (!initialData.absences) initialData.absences = [];
        if (!initialData.assignments) initialData.assignments = {};
        if (!initialData.substitutes) initialData.substitutes = {};
        if (!initialData.admin) initialData.admin = { password: "admin" };
        // Falls noch keine Daten existieren, einmal speichern
        if (isEmpty) {
          await saveData(initialData);
        }
        setData(initialData);
      } catch (e) {
        console.error(e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Echtzeit-Updates: wenn ein anderer Nutzer Daten ändert, übernehmen
  useEffect(() => {
    if (!data) return;
    const unsubscribe = subscribeToChanges((newData) => {
      setData(newData);
    });
    return unsubscribe;
  }, [data === null]);

  // Auto-Speichern bei Änderungen
  useEffect(() => {
    if (!data || loading) return;
    let cancelled = false;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      const ok = await saveData(data);
      if (!cancelled) {
        setSaveStatus(ok ? "saved" : "error");
        if (ok) setTimeout(() => !cancelled && setSaveStatus("idle"), 1500);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, loading]);

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F6F9] gap-4">
        <div className="text-[#5A6478]">Lade…</div>
        {loadError && (
          <div className="max-w-md text-center text-sm text-[#B23A3A] bg-[#FBE9E9] border border-[#E8C2C2] rounded p-4">
            <AlertTriangle size={20} className="mx-auto mb-2" />
            Verbindung zu Supabase fehlgeschlagen. Bitte prüfen Sie die Konfiguration (VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY) und laden die Seite neu.
          </div>
        )}
      </div>
    );
  }

  if (!user) return <LoginScreen data={data} onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-[#F4F6F9]">
      <Header user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => setUser(null)} saveStatus={saveStatus} />
      <main className="max-w-[1400px] mx-auto px-5 py-6">
        {activeTab === "wochenplan" && <WochenplanView data={data} setData={setData} user={user} />}
        {activeTab === "monat" && <MonatsView data={data} setData={setData} user={user} />}
        {activeTab === "aerzte" && user.role === "admin" && <AerzteView data={data} setData={setData} />}
        {activeTab === "mitarbeiter" && user.role === "admin" && <MitarbeiterView data={data} setData={setData} />}
        {activeTab === "aufgaben" && user.role === "admin" && <AufgabenView data={data} setData={setData} />}
        {activeTab === "stunden" && user.role === "admin" && <StundenView data={data} setData={setData} />}
        {activeTab === "meine_abwesenheit" && <AbwesenheitView data={data} setData={setData} user={user} />}
        {activeTab === "mein_konto" && user.role === "employee" && <MeinKontoView data={data} setData={setData} user={user} />}
      </main>
    </div>
  );
}
