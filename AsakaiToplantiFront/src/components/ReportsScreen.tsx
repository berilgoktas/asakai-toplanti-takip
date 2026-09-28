import { useMemo, useState } from "react";

type Participant = {
  id: number;
  name: string;
  time: number;
  isLate: boolean;
  shouldAttend: boolean;
  notes: string[];
};

type MeetingHistory = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalTime: number;
  participants: Participant[];
};

type ReportsScreenProps = {
  meetings: MeetingHistory[];
  formatTime: (seconds: number) => string;
};

const parseMeetingDate = (dateStr: string) => {
  const [day, month, year] = dateStr.split(".");
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const toMonthValue = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

const formatMonthLabel = (year: number, monthIndex: number) =>
  new Date(year, monthIndex, 1).toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

export default function ReportsScreen({ meetings, formatTime }: ReportsScreenProps) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [notesOpen, setNotesOpen] = useState(false);

  const shiftMonth = (delta: number) => {
    const next = new Date(selectedYear, selectedMonth + delta, 1);
    setSelectedYear(next.getFullYear());
    setSelectedMonth(next.getMonth());
  };

  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      const d = parseMeetingDate(m.date);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [meetings, selectedYear, selectedMonth]);

  const stats = useMemo(() => {
    const meetingCount = filteredMeetings.length;
    const totalMeetingTime = filteredMeetings.reduce((sum, m) => sum + m.totalTime, 0);
    const avgMeetingTime = meetingCount ? Math.round(totalMeetingTime / meetingCount) : 0;

    type DeptAgg = {
      id: number;
      name: string;
      talkTime: number;
      late: number;
      absent: number;
      attended: number;
      notes: number;
    };

    const deptMap = new Map<number, DeptAgg>();
    let totalTalk = 0;
    let lateCount = 0;
    let absentCount = 0;
    let attendedCount = 0;
    let noteCount = 0;
    const recentNotes: Array<{ date: string; dept: string; note: string }> = [];

    filteredMeetings.forEach((m) => {
      m.participants.forEach((p) => {
        const isAbsent = p.shouldAttend;
        const isLate = p.isLate;

        totalTalk += p.time;
        if (isLate) lateCount += 1;
        else if (isAbsent) absentCount += 1;
        else attendedCount += 1;

        noteCount += p.notes.length;
        p.notes.forEach((note) => {
          recentNotes.push({ date: m.date, dept: p.name, note });
        });

        const existing = deptMap.get(p.id) ?? {
          id: p.id,
          name: p.name,
          talkTime: 0,
          late: 0,
          absent: 0,
          attended: 0,
          notes: 0,
        };
        existing.talkTime += p.time;
        existing.notes += p.notes.length;
        if (isLate) existing.late += 1;
        else if (isAbsent) existing.absent += 1;
        else existing.attended += 1;
        deptMap.set(p.id, existing);
      });
    });

    const deptStats = Array.from(deptMap.values()).sort((a, b) => b.talkTime - a.talkTime);
    const maxTalk = deptStats[0]?.talkTime || 1;
    const statusTotal = attendedCount + lateCount + absentCount || 1;
    const absenceList = Array.from(deptMap.values())
      .filter((d) => d.absent > 0)
      .sort((a, b) => b.absent - a.absent || a.name.localeCompare(b.name, "tr"))
      .slice(0, 3);

    const weekMap = new Map<
      number,
      { weekNo: number; total: number; days: Set<string> }
    >();
    filteredMeetings.forEach((m) => {
      const d = parseMeetingDate(m.date);
      const weekNo = Math.ceil(d.getDate() / 7);
      const existing = weekMap.get(weekNo) ?? { weekNo, total: 0, days: new Set<string>() };
      existing.total += m.totalTime;
      existing.days.add(m.date);
      weekMap.set(weekNo, existing);
    });
    const weeklyTrend = Array.from(weekMap.values())
      .map((w) => ({ weekNo: w.weekNo, total: w.total, dayCount: w.days.size }))
      .sort((a, b) => a.weekNo - b.weekNo);
    const maxWeek = Math.max(...weeklyTrend.map((w) => w.total), 1);

    return {
      meetingCount,
      avgMeetingTime,
      totalTalk,
      lateCount,
      absentCount,
      attendedCount,
      noteCount,
      statusTotal,
      deptStats,
      maxTalk,
      absenceList,
      weeklyTrend,
      maxWeek,
      recentNotes: recentNotes.slice(0, 30),
    };
  }, [filteredMeetings]);

  return (
    <section className="reports">
      <div className="section-head">
        <h2>Raporlar</h2>
        <span className="section-head__count">{stats.meetingCount}</span>
      </div>

      <div className="report-month-nav">
        <button
          type="button"
          className="report-month-nav__btn"
          aria-label="Önceki ay"
          onClick={() => shiftMonth(-1)}
        >
          ‹
        </button>
        <label className="report-month-nav__current">
          <span>{formatMonthLabel(selectedYear, selectedMonth)}</span>
          <input
            type="month"
            value={toMonthValue(selectedYear, selectedMonth)}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              if (!y || !m) return;
              setSelectedYear(y);
              setSelectedMonth(m - 1);
            }}
            aria-label="Ay seç"
          />
        </label>
        <button
          type="button"
          className="report-month-nav__btn"
          aria-label="Sonraki ay"
          onClick={() => shiftMonth(1)}
        >
          ›
        </button>
      </div>

      <div className="report-kpi-grid">
        <div className="report-kpi">
          <span className="report-kpi__label">Toplantı</span>
          <strong className="report-kpi__value">{stats.meetingCount}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Ort. Süre</span>
          <strong className="report-kpi__value">{formatTime(stats.avgMeetingTime)}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Toplam Konuşma</span>
          <strong className="report-kpi__value">{formatTime(stats.totalTalk)}</strong>
        </div>
        <div className="report-kpi">
          <span className="report-kpi__label">Geç / Yok</span>
          <strong className="report-kpi__value">
            {stats.lateCount}/{stats.absentCount}
          </strong>
        </div>
      </div>

      {stats.meetingCount === 0 ? (
        <div className="report-empty">Seçilen ayda toplantı kaydı yok.</div>
      ) : (
        <>
          <div className="report-panel">
            <h3>Katılım Dağılımı</h3>
            <div className="report-status-bars">
              {(
                [
                  ["Katıldı", stats.attendedCount, "#16a34a"],
                  ["Geç Geldi", stats.lateCount, "#d97706"],
                  ["Katılmadı", stats.absentCount, "#dc2626"],
                ] as Array<[string, number, string]>
              ).map(([label, count, color]) => (
                <div className="report-status-row" key={label}>
                  <div className="report-status-row__meta">
                    <span>{label}</span>
                    <span>
                      {count} ({Math.round((count / stats.statusTotal) * 100)}%)
                    </span>
                  </div>
                  <div className="report-bar-track">
                    <div
                      className="report-bar-fill"
                      style={{
                        width: `${Math.round((count / stats.statusTotal) * 100)}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="report-panel">
            <h3>Haftalık Toplantı Süresi</h3>
            {stats.weeklyTrend.length === 0 ? (
              <p className="report-panel__hint">Trend verisi yok</p>
            ) : (
              <div className="report-trend">
                {stats.weeklyTrend.map((w) => (
                  <div className="report-trend__col" key={w.weekNo}>
                    <span className="report-trend__time">{formatTime(w.total)}</span>
                    <div className="report-trend__bar-wrap">
                      <div
                        className="report-trend__bar"
                        style={{ height: `${Math.max(8, Math.round((w.total / stats.maxWeek) * 100))}%` }}
                        title={`${w.dayCount} gün · ${formatTime(w.total)}`}
                      />
                    </div>
                    <span className="report-trend__label">{w.weekNo}. Hafta</span>
                    <span className="report-trend__sub">{w.dayCount} gün</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="report-panel">
            <h3>Departman Konuşma Süreleri</h3>
            <div className="report-dept-list">
              {stats.deptStats.map((d, index) => (
                <div className="report-dept-item" key={d.id}>
                  <div className="report-dept-item__head">
                    <span className="report-dept-item__rank">{index + 1}</span>
                    <div className="report-dept-item__info">
                      <strong>{d.name}</strong>
                      <span>
                        {formatTime(d.talkTime)}
                        {stats.totalTalk > 0
                          ? ` · %${Math.round((d.talkTime / stats.totalTalk) * 100)}`
                          : ""}
                      </span>
                    </div>
                  </div>
                  <div className="report-bar-track">
                    <div
                      className="report-bar-fill report-bar-fill--primary"
                      style={{ width: `${Math.round((d.talkTime / stats.maxTalk) * 100)}%` }}
                    />
                  </div>
                  <div className="report-dept-item__stats">
                    <span>Katıldı: {d.attended}</span>
                    <span>Geç: {d.late}</span>
                    <span>Yok: {d.absent}</span>
                    <span>Not: {d.notes}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="report-panel report-panel--absence">
            <h3>En Çok Devamsız</h3>
            {stats.absenceList.length === 0 ? (
              <p className="report-panel__hint">Bu ayda katılmama kaydı yok</p>
            ) : (
              <ol className="absence-top">
                {stats.absenceList.map((d, index) => {
                  const appearances = d.attended + d.late + d.absent;
                  const pct =
                    appearances > 0 ? Math.round((d.absent / appearances) * 100) : 0;
                  return (
                    <li
                      key={d.id}
                      className={`absence-top__item absence-top__item--${index + 1}`}
                    >
                      <span className="absence-top__place" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div className="absence-top__body">
                        <strong className="absence-top__name">{d.name}</strong>
                        <span className="absence-top__meta">%{pct} oran</span>
                      </div>
                      <div className="absence-top__count">
                        <strong>{d.absent}</strong>
                        <span>kez</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="report-panel">
            <button
              type="button"
              className="report-notes-toggle"
              onClick={() => setNotesOpen((v) => !v)}
              aria-expanded={notesOpen}
            >
              <span>Not Özeti ({stats.noteCount})</span>
              <span className={`note-block__chevron ${notesOpen ? "note-block__chevron--open" : ""}`}>
                ▾
              </span>
            </button>
            {notesOpen && (
              <ul className="report-notes-list">
                {stats.recentNotes.length === 0 && (
                  <li className="report-panel__hint">Bu dönemde not yok</li>
                )}
                {stats.recentNotes.map((n, i) => (
                  <li key={`${n.date}-${n.dept}-${i}`}>
                    <div className="report-notes-list__meta">
                      <span>{n.date}</span>
                      <span>{n.dept}</span>
                    </div>
                    <p>{n.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
