import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import LoginScreen from "./components/LoginScreen";
import ReportsScreen from "./components/ReportsScreen";

type AppView = "meeting" | "history" | "reports";

type Participant = {
  id: number;
  name: string;
  time: number;
  isRunning: boolean;
  isLate: boolean;
  shouldAttend: boolean;
  notes: string[];
  tempTime?: number;
};

type MeetingHistory = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalTime: number;
  participants: Participant[];
  isEditing?: boolean;
};

const defaultParticipants: Participant[] = [
  { id: 1, name: "AKSİYON TAKİBİ", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 2, name: "İSG & İNSAN KAYNAKLARI", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 3, name: "KALİTE & ÇEVRE", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 4, name: "SATIŞ & PAZARLAMA", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 5, name: "BAKIM & ONARIM", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 6, name: "PLANLAMA", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 7, name: "SATIN ALMA", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 8, name: "TALAŞLI İMALAT", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 9, name: "MES", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 10, name: "SEVKİYAT & LOJİSTİK", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 11, name: "SÜREKLİ İYİLEŞTİRME", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
  { id: 12, name: "TASARIM MERKEZİ", time: 0, isRunning: false, isLate: false, shouldAttend: false, notes: [] },
];

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const formatDateOnly = (date: Date) =>
  new Date(date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

const formatTimeOnly = (date: Date) =>
  new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).format(date);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3004";

const formatDateForApi = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatClockForApi = (date: Date) => {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

export default function App() {
  const timerRef = useRef<number | null>(null);
  const meetingStartTime = useRef<Date | null>(null);
  const [participants, setParticipants] = useState<Participant[]>(defaultParticipants);
  const [isMeetingRunning, setIsMeetingRunning] = useState(false);
  const [totalMeetingTime, setTotalMeetingTime] = useState(0);
  const [participantNotes, setParticipantNotes] = useState<Record<number, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [expandedNoteItems, setExpandedNoteItems] = useState<Record<string, boolean>>({});
  const [expandedMeetings, setExpandedMeetings] = useState<Record<string, boolean>>({});
  const [activeView, setActiveView] = useState<AppView>("meeting");
  const [meetingHistory, setMeetingHistory] = useState<MeetingHistory[]>([]);
  const [authHeader, setAuthHeader] = useState(sessionStorage.getItem("basicAuth") ?? "");
  const [isLoggedIn, setIsLoggedIn] = useState(!!sessionStorage.getItem("basicAuth"));
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(meetingHistory.length / itemsPerPage));
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>([1, totalPages, currentPage]);
    if (currentPage > 1) pages.add(currentPage - 1);
    if (currentPage < totalPages) pages.add(currentPage + 1);
    return Array.from(pages).sort((a, b) => a - b);
  }, [totalPages, currentPage]);
  const paginatedMeetings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return meetingHistory.slice(start, start + itemsPerPage);
  }, [meetingHistory, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    const loadedHistory = localStorage.getItem("meetingHistory");
    const savedView = localStorage.getItem("viewState");
    if (loadedHistory) setMeetingHistory(JSON.parse(loadedHistory));
    if (savedView) {
      try {
        const parsed = JSON.parse(savedView);
        if (parsed === true) setActiveView("history");
        else if (parsed === false) setActiveView("meeting");
        else if (parsed === "meeting" || parsed === "history" || parsed === "reports") setActiveView(parsed);
      } catch {
        /* ignore */
      }
    }
    const notesSeed: Record<number, string> = {};
    defaultParticipants.forEach((p) => (notesSeed[p.id] = ""));
    setParticipantNotes(notesSeed);
  }, []);

  const apiRequest = async (path: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    const token = authHeader || sessionStorage.getItem("basicAuth") || "";
    if (token) headers.Authorization = token;
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (response.status === 401) {
      sessionStorage.removeItem("basicAuth");
      setAuthHeader("");
      setIsLoggedIn(false);
    }
    return response;
  };

  const loadMeetingsFromApi = async () => {
    const listResponse = await apiRequest("/api/toplantilar");
    if (!listResponse.ok) throw new Error("Toplantı listesi alınamadı");
    const meetings: Array<{ toplantiId: number }> = await listResponse.json();
    const details = await Promise.all(
      meetings.map(async (m) => {
        const detailResponse = await apiRequest(`/api/toplantilar/${m.toplantiId}`);
        if (!detailResponse.ok) throw new Error("Toplantı detayı alınamadı");
        return detailResponse.json();
      })
    );
    const mapped: MeetingHistory[] = details.map((m) => ({
      id: String(m.toplantiId),
      date: formatDateOnly(new Date(m.toplantiTarihi)),
      startTime: m.baslangicSaati,
      endTime: m.bitisSaati,
      totalTime: m.toplamSureSn,
      participants: (m.katilimcilar ?? []).map((k: any) => ({
        id: k.departmanId,
        name: k.departmanAdi,
        time: k.konusmaSuresiSn,
        isRunning: false,
        isLate: k.gecGeldi,
        shouldAttend: k.katilmadi,
        notes: Array.isArray(k.notlar) ? k.notlar : [],
      })),
      isEditing: false,
    }));
    setMeetingHistory(mapped);
  };

  const loadDepartmentsFromApi = async () => {
    const response = await apiRequest("/api/departmanlar");
    if (!response.ok) throw new Error("Departmanlar alınamadı");
    const departments: Array<{ departmanId: number; departmanAdi: string }> = await response.json();
    const mapped = departments.map((d) => ({
      id: d.departmanId,
      name: d.departmanAdi,
      time: 0,
      isRunning: false,
      isLate: false,
      shouldAttend: false,
      notes: [],
    }));
    setParticipants(mapped);
    setParticipantNotes(
      mapped.reduce<Record<number, string>>((acc, p) => {
        acc[p.id] = "";
        return acc;
      }, {})
    );
  };

  useEffect(() => {
    localStorage.setItem("meetingHistory", JSON.stringify(meetingHistory.map((m) => ({ ...m, isEditing: false }))));
  }, [meetingHistory]);

  useEffect(() => {
    localStorage.setItem("viewState", JSON.stringify(activeView));
  }, [activeView]);

  useEffect(() => {
    if (!isMeetingRunning) return;
    timerRef.current = window.setInterval(() => {
      setTotalMeetingTime((prev) => prev + 1);
      setParticipants((prev) =>
        prev.map((p) => (p.isRunning ? { ...p, time: p.time + 1 } : p))
      );
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isMeetingRunning]);

  useEffect(() => {
    if (!isLoggedIn || !authHeader) return;
    Promise.all([loadDepartmentsFromApi(), loadMeetingsFromApi()]).catch(() =>
      setInfoMessage("API verileri alınamadı")
    );
  }, [isLoggedIn, authHeader]);

  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ KullaniciAdi: username, Sifre: password }),
      });
      if (!response.ok) {
        return { ok: false, message: "Kullanıcı adı veya şifre hatalı" };
      }
      const basicToken = btoa(`${username}:${password}`);
      const header = `Basic ${basicToken}`;
      sessionStorage.setItem("basicAuth", header);
      setAuthHeader(header);
      setIsLoggedIn(true);
      return { ok: true };
    } catch {
      return { ok: false, message: "API bağlantısı kurulamadı" };
    }
  };

  const toggleMeeting = () => {
    setIsMeetingRunning((prev) => {
      const next = !prev;
      if (next && !meetingStartTime.current) meetingStartTime.current = new Date();
      if (!next && timerRef.current) window.clearInterval(timerRef.current);
      return next;
    });
  };

  const resetMeeting = () => {
    setIsMeetingRunning(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    setTotalMeetingTime(0);
    meetingStartTime.current = null;
    setParticipants(defaultParticipants);
    setParticipantNotes((prev) =>
      Object.keys(prev).reduce<Record<number, string>>((acc, key) => ({ ...acc, [Number(key)]: "" }), {})
    );
  };

  const endMeeting = async () => {
    const end = new Date();
    const start = meetingStartTime.current ?? new Date(end.getTime() - totalMeetingTime * 1000);
    const payload = {
      toplantiTarihi: formatDateForApi(start),
      baslangicSaati: formatClockForApi(start),
      bitisSaati: formatClockForApi(end),
      toplamSureSn: Math.floor((end.getTime() - start.getTime()) / 1000),
      katilimcilar: participants.map((p) => ({
        departmanId: p.id,
        konusmaSuresiSn: p.time,
        gecGeldi: p.isLate,
        katilmadi: p.shouldAttend,
        notlar: p.notes,
      })),
    };
    try {
      const response = await apiRequest("/api/toplantilar", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      await loadMeetingsFromApi();
      resetMeeting();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setInfoMessage("Toplantı API'ye kaydedilemedi");
    }
  };

  const saveMeetingToApi = async (meeting: MeetingHistory) => {
    const [day, month, year] = meeting.date.split(".");
    const payload = {
      toplantiTarihi: `${year}-${month}-${day}`,
      baslangicSaati: meeting.startTime,
      bitisSaati: meeting.endTime,
      toplamSureSn: meeting.totalTime,
      katilimcilar: meeting.participants.map((p) => ({
        departmanId: p.id,
        konusmaSuresiSn: p.time,
        gecGeldi: p.isLate,
        katilmadi: p.shouldAttend,
        notlar: p.notes,
      })),
    };
    const response = await apiRequest(`/api/toplantilar/${meeting.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error();
  };

  const deleteMeetingFromApi = async (meetingId: string) => {
    const response = await apiRequest(`/api/toplantilar/${meetingId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error();
  };

  const exportToExcel = (fromDate = startDate, toDate = endDate) => {
    if (!fromDate || !toDate) return setInfoMessage("Lütfen başlangıç ve bitiş tarihlerini seçin");
    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    const filtered = meetingHistory.filter((m) => {
      const d = new Date(m.date.split(".").reverse().join("-"));
      return d >= start && d <= end;
    });
    if (!filtered.length) return setInfoMessage("Seçilen tarih aralığında veri yok");

    const summary = filtered.map((meeting) => ({
      "Toplantı Tarihi": meeting.date,
      "Başlangıç": meeting.startTime,
      "Bitiş": meeting.endTime,
      "Toplam Süre": formatTime(meeting.totalTime),
    }));

    const details: Array<Record<string, string | number>> = [];
    filtered.forEach((meeting) => {
      meeting.participants.forEach((p) => {
        details.push({
          Tarih: meeting.date,
          "Katılımcı": p.name,
          "Konuşma Süresi": formatTime(p.time),
          Durum: p.isLate ? "Geç Geldi" : p.shouldAttend ? "Katılmadı" : "Katıldı",
        });
      });
    });

    const autoFitColumns = (rows: Array<Record<string, string | number>>) => {
      if (!rows.length) return [];
      const keys = Object.keys(rows[0]);
      return keys.map((key) => {
        const headerLen = key.length;
        const maxValueLen = rows.reduce((max, row) => {
          const val = row[key];
          const len = val == null ? 0 : String(val).length;
          return len > max ? len : max;
        }, 0);
        return { wch: Math.max(headerLen, maxValueLen) + 2 };
      });
    };

    const wb = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet(summary);
    summarySheet["!cols"] = autoFitColumns(summary);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Toplantı Özeti");

    const detailsSheet = XLSX.utils.json_to_sheet(details);
    detailsSheet["!cols"] = autoFitColumns(details);
    XLSX.utils.book_append_sheet(wb, detailsSheet, "Katılımcı Detay");

    XLSX.writeFile(wb, `Toplanti_Raporu_${fromDate}_${toDate}.xlsx`);
    setShowExportModal(false);
  };

  if (!isLoggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="app-bar__brand">
          <span className="app-bar__title">Asakai Toplantı</span>
          <span className="app-bar__subtitle">Toplantı Takip Paneli</span>
        </div>
        <button
          className="app-bar__logout"
          onClick={() =>
            setConfirm({
              title: "Çıkış Yap",
              message: "Çıkış yapmak istediğinizden emin misiniz?",
              onConfirm: () => {
                sessionStorage.removeItem("basicAuth");
                setAuthHeader("");
                setIsLoggedIn(false);
              },
            })
          }
        >
          Çıkış Yap
        </button>
      </header>

      <main className="meeting-tracker">
        <section className={`hero-card ${isMeetingRunning ? "hero-card--live" : ""}`}>
          <div className="hero-card__top">
            <div>
              <span className="hero-card__label">Toplantı Kontrolü</span>
              <div className="hero-card__timer">{formatTime(totalMeetingTime)}</div>
            </div>
            <span className={`hero-card__status ${isMeetingRunning ? "hero-card__status--live" : ""}`}>
              <span className="hero-card__dot" />
              {isMeetingRunning ? "Canlı" : "Beklemede"}
            </span>
          </div>
          <div className="hero-card__actions">
            <button className="btn btn-primary" onClick={toggleMeeting}>{isMeetingRunning ? "Durdur" : "Başlat"}</button>
            <button className="btn btn-warning" onClick={() => setConfirm({ title: "Toplantıyı Sıfırla", message: "Toplantı sıfırlansın mı?", onConfirm: resetMeeting })}>Sıfırla</button>
          </div>
        </section>

        <div className="view-tabs">
          <button className={`view-tab ${activeView === "meeting" ? "view-tab--active" : ""}`} onClick={() => setActiveView("meeting")}>Toplantı</button>
          <button className={`view-tab ${activeView === "history" ? "view-tab--active" : ""}`} onClick={() => setActiveView("history")}>Geçmiş</button>
          <button className={`view-tab ${activeView === "reports" ? "view-tab--active" : ""}`} onClick={() => setActiveView("reports")}>Rapor</button>
        </div>

      {activeView === "meeting" && (
        <section className="meeting-section">
          <div className="section-head">
            <h2>Katılımcılar</h2>
            <span className="section-head__count">{participants.length}</span>
          </div>
          <div className="participants">
            {participants.map((participant) => (
              <div className={`participant-card ${participant.isRunning ? "participant-card--active" : ""}`} key={participant.id}>
                <div className="participant-card__header">
                  <div className="participant-card__title">
                    <h3>{participant.name}</h3>
                    <div className="participant-card__badges">
                      {participant.isLate && <span className="badge badge--warning">Geç Geldi</span>}
                      {participant.shouldAttend && <span className="badge badge--danger">Katılmadı</span>}
                      {participant.isRunning && <span className="badge badge--live"><span className="badge__dot" /> Canlı</span>}
                    </div>
                  </div>
                </div>

                <div className="participant-card__time">
                  <span className="participant-card__time-label">Konuşma Süresi</span>
                  <span className="participant-card__time-value">{formatTime(participant.time)}</span>
                </div>

                <div className="pill-toggles">
                  <button
                    type="button"
                    className={`pill-toggle ${participant.isLate ? "pill-toggle--warning" : ""}`}
                    onClick={() => setParticipants((prev) => prev.map((p) => p.id === participant.id ? { ...p, isLate: !p.isLate, shouldAttend: !p.isLate ? false : p.shouldAttend } : p))}
                  >
                    Geç Geldi
                  </button>
                  <button
                    type="button"
                    className={`pill-toggle ${participant.shouldAttend ? "pill-toggle--danger" : ""}`}
                    onClick={() => setParticipants((prev) => prev.map((p) => p.id === participant.id ? { ...p, shouldAttend: !p.shouldAttend, isLate: !p.shouldAttend ? false : p.isLate } : p))}
                  >
                    Katılmadı
                  </button>
                </div>

                <div className="participant-card__actions">
                  <button
                    className={`action-btn action-btn--primary ${!isMeetingRunning ? "action-btn--disabled" : ""}`}
                    disabled={!isMeetingRunning}
                    onClick={() => isMeetingRunning && setParticipants((prev) => prev.map((p) => ({ ...p, isRunning: p.id === participant.id ? !p.isRunning : false })))}
                  >
                    {participant.isRunning ? "Durdur" : "Başlat"}
                  </button>
                  <button
                    className="action-btn action-btn--ghost"
                    onClick={() => setParticipants((prev) => prev.map((p) => p.id === participant.id ? { ...p, time: 0, isRunning: false } : p))}
                  >
                    Sıfırla
                  </button>
                </div>

                <div className="note-block">
                  <div className="note-block__input">
                    <input
                      className="note-block__field"
                      value={participantNotes[participant.id] ?? ""}
                      onChange={(e) => setParticipantNotes((prev) => ({ ...prev, [participant.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const note = (participantNotes[participant.id] ?? "").trim();
                          if (!note) return;
                          setParticipants((prev) => prev.map((p) => p.id === participant.id ? { ...p, notes: [...p.notes, note] } : p));
                          setParticipantNotes((prev) => ({ ...prev, [participant.id]: "" }));
                        }
                      }}
                      placeholder="Yeni not ekle..."
                    />
                    <button
                      className="note-block__add"
                      onClick={() => {
                        const note = (participantNotes[participant.id] ?? "").trim();
                        if (!note) return;
                        setParticipants((prev) => prev.map((p) => p.id === participant.id ? { ...p, notes: [...p.notes, note] } : p));
                        setParticipantNotes((prev) => ({ ...prev, [participant.id]: "" }));
                      }}
                    >
                      Ekle
                    </button>
                  </div>

                  {participant.notes.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="note-block__toggle"
                        onClick={() => setExpandedNotes((prev) => ({ ...prev, [participant.id]: !prev[participant.id] }))}
                        aria-expanded={!!expandedNotes[participant.id]}
                      >
                        <span>{expandedNotes[participant.id] ? "Notları Gizle" : "Notları Göster"}</span>
                        <span className="note-block__count">{participant.notes.length}</span>
                        <span className={`note-block__chevron ${expandedNotes[participant.id] ? "note-block__chevron--open" : ""}`} aria-hidden="true">▾</span>
                      </button>
                      {expandedNotes[participant.id] && (
                        <ul className="note-list">
                          {participant.notes.map((note, i) => {
                            const itemKey = `${participant.id}-${i}`;
                            const isItemExpanded = !!expandedNoteItems[itemKey];
                            return (
                              <li className={`note-chip ${isItemExpanded ? "note-chip--expanded" : ""}`} key={itemKey}>
                                <textarea
                                  className="note-chip__input"
                                  rows={isItemExpanded ? Math.max(2, Math.ceil(note.length / 30)) : 1}
                                  value={note}
                                  onChange={(e) => setParticipants((prev) => prev.map((p) => p.id === participant.id ? { ...p, notes: p.notes.map((n, ni) => ni === i ? e.target.value : n) } : p))}
                                />
                                <button
                                  type="button"
                                  className="note-chip__expand"
                                  aria-label={isItemExpanded ? "Notu daralt" : "Notun tamamını göster"}
                                  onClick={() => setExpandedNoteItems((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                                >
                                  {isItemExpanded ? "▴" : "▾"}
                                </button>
                                <button
                                  className="note-chip__remove"
                                  aria-label="Notu sil"
                                  onClick={() => setParticipants((prev) => prev.map((p) => p.id === participant.id ? { ...p, notes: p.notes.filter((_, ni) => ni !== i) } : p))}
                                >
                                  ×
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="end-meeting-section">
            <button className="btn btn-danger btn-large" disabled={totalMeetingTime === 0} onClick={() => setConfirm({ title: "Toplantıyı Bitir", message: "Toplantı kaydedilip kapatılacak. Devam edilsin mi?", onConfirm: () => { void endMeeting(); } })}>Toplantıyı Bitir</button>
          </div>
        </section>
      )}

      {activeView === "history" && (
        <section className="meeting-history">
          <div className="section-head">
            <h2>Geçmiş Toplantılar</h2>
            <span className="section-head__count">{meetingHistory.length}</span>
          </div>
          <div className="history-controls">
            <button className="btn" onClick={() => {
              const end = new Date();
              const start = new Date();
              start.setDate(start.getDate() - 30);
              setStartDate(start.toISOString().slice(0, 10));
              setEndDate(end.toISOString().slice(0, 10));
              setShowExportModal(true);
            }}>Excel'e Aktar</button>
          </div>

          {paginatedMeetings.map((meeting) => {
            const isOpen = !!expandedMeetings[meeting.id] || !!meeting.isEditing;
            return (
              <div className={`history-card ${isOpen ? "history-card--open" : ""} ${meeting.isEditing ? "history-card--editing" : ""}`} key={meeting.id}>
                <button
                  type="button"
                  className="history-card__summary"
                  onClick={() => setExpandedMeetings((prev) => ({ ...prev, [meeting.id]: !prev[meeting.id] }))}
                  aria-expanded={isOpen}
                >
                  <div className="history-card__main">
                    <span className="history-card__date">{meeting.date}</span>
                    <span className="history-card__hours">{meeting.startTime} - {meeting.endTime}</span>
                  </div>
                  <div className="history-card__meta">
                    <span className="history-card__total">{formatTime(meeting.totalTime)}</span>
                    <span className={`history-card__chevron ${isOpen ? "history-card__chevron--open" : ""}`} aria-hidden="true">▾</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="history-card__body">
                    {meeting.isEditing && (
                      <div className="edit-banner">
                        <span className="edit-banner__icon" aria-hidden="true">✎</span>
                        <span className="edit-banner__text">Düzenleme modu aktif. Süreleri ve durumları değiştirip "Kaydet"e basın.</span>
                      </div>
                    )}

                    <div className="history-card__details">
                      <span><strong>Başlangıç:</strong> {meeting.startTime}</span>
                      <span><strong>Bitiş:</strong> {meeting.endTime}</span>
                      <span><strong>Toplam Süre:</strong> {formatTime(meeting.totalTime)}</span>
                    </div>

                    <div className="history-actions">
                      {!meeting.isEditing && (
                        <>
                          <button className="action-btn action-btn--primary" onClick={() => setMeetingHistory((prev) => prev.map((m) => m.id === meeting.id ? { ...m, isEditing: true } : { ...m, isEditing: false }))}>Düzenle</button>
                          <button className="action-btn action-btn--ghost" onClick={() => setConfirm({ title: "Toplantıyı Sil", message: "Bu kayıt silinsin mi?", onConfirm: () => { void (async () => { try { await deleteMeetingFromApi(meeting.id); setMeetingHistory((prev) => prev.filter((m) => m.id !== meeting.id)); } catch { setInfoMessage("Toplantı API'den silinemedi"); } })(); } })}>Sil</button>
                        </>
                      )}
                      {meeting.isEditing && (
                        <>
                          <button className="action-btn action-btn--success" onClick={() => { void (async () => { try { await saveMeetingToApi(meeting); setMeetingHistory((prev) => prev.map((m) => m.id === meeting.id ? { ...m, isEditing: false } : m)); } catch { setInfoMessage("Toplantı güncellemesi API'ye kaydedilemedi"); } })(); }}>Kaydet</button>
                          <button className="action-btn action-btn--ghost" onClick={() => setMeetingHistory((prev) => prev.map((m) => m.id === meeting.id ? { ...m, isEditing: false } : m))}>İptal</button>
                        </>
                      )}
                    </div>

                    <div className="history-participants">
                      {meeting.participants.map((p) => (
                        <div className={`history-participant ${meeting.isEditing ? "history-participant--editing" : ""}`} key={`${meeting.id}-${p.id}`}>
                          <div className="history-participant__head">
                            <h4>{p.name}</h4>
                            <div className="history-participant__badges">
                              {p.isLate && <span className="badge badge--warning">Geç Geldi</span>}
                              {p.shouldAttend && <span className="badge badge--danger">Katılmadı</span>}
                            </div>
                          </div>

                          {!meeting.isEditing && <p className="history-participant__time">Süre: {formatTime(p.time)}</p>}

                          {meeting.isEditing && (
                            <div className="edit-fields">
                              <div className="edit-field">
                                <span className="edit-field__label">Konuşma Süresi</span>
                                <div className="edit-field__input">
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={p.time === 0 ? "" : p.time}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const val = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
                                      setMeetingHistory((prev) => prev.map((m) => m.id === meeting.id ? { ...m, participants: m.participants.map((mp) => mp.id === p.id ? { ...mp, time: val } : mp) } : m));
                                    }}
                                  />
                                  <span className="edit-field__unit">sn</span>
                                </div>
                                <span className="edit-field__hint">{formatTime(p.time)}</span>
                              </div>

                              <div className="edit-toggles">
                                <button
                                  type="button"
                                  className={`pill-toggle ${p.isLate ? "pill-toggle--warning" : ""}`}
                                  onClick={() => setMeetingHistory((prev) => prev.map((m) => m.id === meeting.id ? { ...m, participants: m.participants.map((mp) => mp.id === p.id ? { ...mp, isLate: !mp.isLate, shouldAttend: !mp.isLate ? false : mp.shouldAttend } : mp) } : m))}
                                >
                                  Geç Geldi
                                </button>
                                <button
                                  type="button"
                                  className={`pill-toggle ${p.shouldAttend ? "pill-toggle--danger" : ""}`}
                                  onClick={() => setMeetingHistory((prev) => prev.map((m) => m.id === meeting.id ? { ...m, participants: m.participants.map((mp) => mp.id === p.id ? { ...mp, shouldAttend: !mp.shouldAttend, isLate: !mp.shouldAttend ? false : mp.isLate } : mp) } : m))}
                                >
                                  Katılmadı
                                </button>
                              </div>
                            </div>
                          )}

                          {p.notes && p.notes.length > 0 && (
                            <div className="history-participant__notes">
                              <span className="history-participant__notes-label">Notlar</span>
                              <ul className="history-participant__notes-list">
                                {p.notes.map((note, ni) => (
                                  <li key={`${meeting.id}-${p.id}-${ni}`}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="btn btn-secondary pagination-controls__nav"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Önceki sayfa"
              >
                ‹
              </button>
              <div className="page-numbers">
                {pageNumbers.map((p, index) => {
                  const prev = pageNumbers[index - 1];
                  const showEllipsis = prev != null && p - prev > 1;
                  return (
                    <span key={p} className="page-numbers__item">
                      {showEllipsis && <span className="page-numbers__ellipsis">…</span>}
                      <button
                        className={`btn ${p === currentPage ? "btn-primary" : "btn-outline-primary"}`}
                        onClick={() => setCurrentPage(p)}
                        aria-current={p === currentPage ? "page" : undefined}
                      >
                        {p}
                      </button>
                    </span>
                  );
                })}
              </div>
              <span className="pagination-controls__status">
                {currentPage} / {totalPages}
              </span>
              <button
                className="btn btn-secondary pagination-controls__nav"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Sonraki sayfa"
              >
                ›
              </button>
            </div>
          )}
        </section>
      )}

      {activeView === "reports" && (
        <ReportsScreen
          meetings={meetingHistory}
          formatTime={formatTime}
        />
      )}
      </main>

      {confirm && (
        <div className="custom-modal">
          <div className="modal-overlay" onClick={() => setConfirm(null)} />
          <div className="modal-content">
            <h3>{confirm.title}</h3>
            <p>{confirm.message}</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirm(null)}>İptal</button>
              <button className="btn btn-danger" onClick={() => { confirm.onConfirm(); setConfirm(null); }}>Onayla</button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Toplantı Verilerini Dışa Aktar</h3>
            <div className="date-picker-container">
              <div className="date-input">
                <label>Başlangıç Tarihi</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="date-input">
                <label>Bitiş Tarihi</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="modal-buttons">
              <button className="btn" onClick={() => exportToExcel()}>Dışa Aktar</button>
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {infoMessage && (
        <div className="modal info-modal">
          <div className="modal-content info-modal-content">
            <div className="info-message">
              <p>{infoMessage}</p>
            </div>
            <div className="modal-buttons">
              <button className="btn" onClick={() => setInfoMessage("")}>Tamam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
