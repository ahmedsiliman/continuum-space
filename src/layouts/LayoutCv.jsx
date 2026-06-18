import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────
//  EDIT YOUR DATA HERE — pure CSV, no rebuild needed
// ─────────────────────────────────────────────────────────────
const CSV_DATA = `section,type,label,sub,date_start,date_end,detail1,detail2,detail3,detail4,detail5,level
meta,name,Ahmed Kattaya,,,,,,,,, 
meta,title,BIM Architect,,,,,,,,, 
meta,title2,BIM Specialist / Coordinator,,,,,,,,, 
meta,title3,BIM Software Developer,,,,,,,,, 
meta,email,ahmed.m.kattaya@gmail.com,,,,,,,,, 
meta,location,Berlin · Germany,,,,,,,, 
meta,profile,"I'm an experienced Architect with 8+ years in Design and Construction, skilled in BIM Coordination, Computational Design, and software development — passionate about technology and sustainability integration in the AEC industry.",,,,,,,,, 
experience,job,LAVA (Laboratory for Visionary Architecture),BIM Architect | Full/Part-time · Berlin Germany,OCT 2024,APR 2026,Develop automation scripts and BIM workflow strategies (Rhino / Revit / Cloud Models),BIM Modeling and coordination for project phases LP 1–3 including as-built for demolition,Working with Saudi Building Code (SBC) and German (DIN),Collaborate in the design process and conceptual typology research,, 
experience,job,Digital Knowledge,BIM Architect | Part-Time · Remote UK,JUN 2023,OCT 2023,Develop automation scripts for modeling and coordination for custom pre-fabricated precast roofing systems,Assist in digital transformation strategy and workflow,,,, 
experience,job,Zuhair Fayez Partnership Consultancy,BIM Coordinator | Full-time · Egypt branch,JAN 2022,SEP 2023,Review the Project's BEP according to UK standards and LOD Specs,Review and track BIM models health and the project's required information,Coordinate between disciplines for clashes and engineering issues,Attend BIM coordination meetings with the Client and Contractor regarding workflow,, 
experience,job,Redcon Construction Co S.A.E.,BIM Coordinator | Full-time · Gizah Egypt,DEC 2018,DEC 2021,Develop automation scripts (Dynamo / Grasshopper) for modelling scheduling and Clash Solving,Audit BIM Models and create validation / soft / hard clash Reports,Architectural BIM modelling and upgrading up to LOD 500,Prepare fully detailed Shop-drawings and quantity survey submittals,Coordinate with ACC / PROCOOR / ACONIX cloud project management platforms, 
experience,job,Badmind Group Studio,Junior Design Architect · Gizah Egypt,Aug 2016,May 2018,Design model and visualize residential layout plans and exteriors,,,, 
experience,job,Engineering Authority of the Armed Forces,Military Service,JAN 2017,MAR 2018,Team Leader at the operations office at the military Brigade,,,, 
experience,job,Gozour Studio,Computational Designer | Full-time · Egypt,Sep 2015,Oct 2016,Design and modelling of residential exteriors landscape and softscape elements,Develop modelling design methods and Grasshopper scripts for generative design,,,, 
education,degree,M.Sc Architecture Typology,Technische Universität Berlin (TUB) · Berlin Germany,2023,Present,Faculty VI — Planning Building Environment,,,,, 
education,degree,BSc. in Architectural Engineering,Misr Higher Institute for Engineering and Technology (MET) · Mansoura Egypt,2011,2016,Architecture Department,,,,, 
skill,software,Autodesk Revit,,,,,,,,,Expert
skill,software,Dynamo Studio,,,,,,,,,Expert
skill,software,Grasshopper 3D,,,,,,,,,Expert
skill,software,C# / Revit API,,,,,,,,,Intermediate
skill,software,Rhinoceros,,,,,,,,,Proficient
skill,software,Navisworks,,,,,,,,,Intermediate
skill,software,Autodesk BIM 360,,,,,,,,,Intermediate
skill,software,Autodesk ACC,,,,,,,,,Intermediate
skill,software,Autodesk Forma,,,,,,,,,Intermediate
skill,software,Python,,,,,,,,,Beginner
skill,software,MS Power BI,,,,,,,,,Intermediate
skill,software,Adobe Photoshop,,,,,,,,,Proficient
skill,software,Adobe Illustrator,,,,,,,,,Intermediate
skill,software,Adobe InDesign,,,,,,,,,Intermediate
language,lang,English,Advanced,,,,,,,,
language,lang,German,Beginner,,,,,,,,
language,lang,Arabic,Native,,,,,,,,
project,item,AFWA HITTIN,Hospitality LP1 · Riyadh KSA,2026,,,,,,, 
project,item,REWE Digital NEUPORTZ IT Hub,Mixed Use LP2 · Köln Deutschland,2025,,,,,,, 
project,item,NEOM TROJENA THE VAULT,Hospitality LP1 · Tabuk KSA,2025,,,,,,, 
project,item,NEOM AQUELLUM,Hospitality LP2 · Tabuk KSA,2024,,,,,,, 
project,item,RED-SEA Six Senses Southern Dunes,Hospitality LP5 · Tabuk KSA,2023,,,,,,, 
project,item,SODIC The Estates,Residential LP5 · New Zayed Egypt,2023,,,,,,, 
project,item,EMAAR BelleVie,Residential LP5-8 · Gizah Egypt,2022,,,,,,, 
project,item,ORA ZED WEST Towers,Mixed Use LP5-8 · Gizah Egypt,2021,,,,,,, 
project,item,SODIC EASTOWN SPECTRUM Block 25,Residential LP5-8 · New Cairo Egypt,2020,,,,,,, 
project,item,NEWGIZA Westridge Neighbourhood 04,Residential LP5-8 · Gizah Egypt,2019,,,,,,, 
project,item,Residential Villas and Landscape,Residential LP3-4 · Qatar,2015,,,,,,, 
course,item,BIM Software Development Diploma using C#,Kaitech,Jan 2026,,,,,,,, 
course,item,Micro to Macro — BIM LCA and data visualization for timber,TU Berlin,July 2024,,,,,,,, 
course,item,Introduction to Data Analysis with Python,Datacamp,WIP,,,,,,,, 
course,item,Greener Egyptian Cities — Habitat Unit DAAD,TU Berlin,Mar 2024,,,,,,,, 
course,item,Crushup 5: CoLab TUB — Building with waste materials,TU Berlin,Nov 2023,,,,,,,, 
course,item,Become a BIM Coordinator,LinkedIn,Mar 2023,,,,,,,, 
course,item,Introduction to ISO Global BIM Standards,LinkedIn,Mar 2023,,,,,,,, 
course,item,Dynamo for Revit Python Scripting,LinkedIn,Mar 2023,,,,,,,,`;


// ─────────────────────────────────────────────────────────────
//  CSV parser
// ─────────────────────────────────────────────────────────────
function parseCSV(raw) {
  const lines = raw.trim().split("\n").filter(Boolean);
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const cols = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && !inQ) { inQ = true; continue; }
      if (c === '"' && inQ) { inQ = false; continue; }
      if (c === "," && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += c;
    }
    cols.push(cur);
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (cols[i] || "").trim()]));
  });
}

// ─────────────────────────────────────────────────────────────
//  Tokens — strict TelemetryHUD monochrome palette
// ─────────────────────────────────────────────────────────────
const MONO = {
  fontFamily: "'Share Tech Mono', 'Consolas', monospace",
  textTransform: "uppercase",
  letterSpacing: "2px",
};

const TEXT_MAIN  = "rgba(255, 255, 255, 0.9)";
const TEXT_MID   = "rgba(255, 255, 255, 0.65)";
const TEXT_MUTED = "rgba(255, 255, 255, 0.5)";
const TEXT_DARK  = "rgba(255, 255, 255, 0.25)";
const ROW_ACTIVE = "rgba(255, 255, 255, 0.06)";
const ROW_HOVER  = "rgba(255, 255, 255, 0.03)";
const GLASS_BG   = "rgba(10, 10, 12, 0.45)";
const GLASS_BDR  = "rgba(255, 255, 255, 0.08)";
const GLASS_SHD  = "0 8px 32px 0 rgba(0,0,0,0.37), inset 0 1px 1px rgba(255,255,255,0.1)";
const LINE_SUB   = "rgba(255, 255, 255, 0.05)";
const LINE_DEEP  = "rgba(255, 255, 255, 0.04)";

const LEVEL_W = {
  Expert: "100%", Proficient: "78%", Intermediate: "55%",
  Beginner: "28%", Advanced: "85%", Native: "100%",
};

const glassPanel = {
  backgroundColor: GLASS_BG,
  border: `1px solid ${GLASS_BDR}`,
  borderRadius: "12px",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  boxShadow: GLASS_SHD,
};

// ─────────────────────────────────────────────────────────────
//  Scroll-reveal hook
// ─────────────────────────────────────────────────────────────
function useReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, vis];
}

// ─────────────────────────────────────────────────────────────
//  SectionHead — matches HUD header style
// ─────────────────────────────────────────────────────────────
function SectionHead({ children }) {
  return (
    <div style={{
      ...MONO,
      color: TEXT_DARK,
      fontSize: "10px",
      letterSpacing: "3px",
      padding: "0 0 12px 0",
      borderBottom: `1px solid ${LINE_SUB}`,
      marginBottom: "16px",
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  TimelineItem — uses HUD structural indicator lines
// ─────────────────────────────────────────────────────────────
function TimelineItem({ label, sub, dateStart, dateEnd, bullets, delay = 0, isActive }) {
  const [ref, vis] = useReveal(0.08);
  const detailBullets = bullets.filter(Boolean);

  return (
    <div ref={ref} className="cv-timeline-item" style={{
      display: "flex", gap: 0, marginBottom: 2,
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(10px)",
      transition: `opacity 0.4s ${delay}s ease, transform 0.4s ${delay}s ease`,
    }}>
      {/* Structural indicator line (HUD-style) */}
      <div className="cv-timeline-line" style={{
        width: 1, flexShrink: 0, alignSelf: "stretch",
        backgroundColor: LINE_SUB,
        marginLeft: 20, marginRight: 0,
      }} />

      {/* Row button */}
      <div
        className="cv-timeline-row"
        style={{
          flex: 1,
          padding: "10px 20px 10px 16px",
          cursor: "default",
          background: isActive ? ROW_ACTIVE : "none",
          transition: "background 150ms ease",
        }}
      >
        {/* Top line: label + dates */}
        <div className="cv-timeline-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            ...MONO,
            fontSize: "11px",
            fontWeight: isActive ? "600" : "400",
            color: isActive ? TEXT_MAIN : TEXT_MUTED,
            letterSpacing: "1.5px",
          }}>
            {isActive ? "■" : "□"}&nbsp;&nbsp;{label}
          </span>
          {(dateStart || dateEnd) && (
            <span className="cv-timeline-date" style={{
              ...MONO,
              fontSize: "9px",
              letterSpacing: "1px",
              color: TEXT_DARK,
              whiteSpace: "nowrap",
            }}>
              {dateStart}{dateEnd && dateEnd !== dateStart ? ` — ${dateEnd}` : ""}
            </span>
          )}
        </div>

        {/* Sub-role */}
        {sub && (
          <div className="cv-timeline-sub" style={{
            ...MONO,
            fontSize: "9px",
            letterSpacing: "1.5px",
            color: TEXT_DARK,
            marginTop: 4,
            paddingLeft: 18,
          }}>
            {sub}
          </div>
        )}

        {/* Bullets with nested indicator */}
        {detailBullets.length > 0 && (
          <div className="cv-timeline-bullets" style={{ position: "relative", marginTop: 8, paddingLeft: 18 }}>
            <div style={{
              position: "absolute", left: 6, top: 0, bottom: 0,
              width: 1, backgroundColor: LINE_DEEP,
            }} />
            {detailBullets.map((b, i) => (
              <div key={i} style={{
                ...MONO,
                fontSize: "9px",
                letterSpacing: "0.5px",
                textTransform: "none",
                color: TEXT_DARK,
                lineHeight: 1.7,
                paddingLeft: 10,
              }}>
                › {b}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SkillRow — HUD row style, no color accents
// ─────────────────────────────────────────────────────────────
function SkillRow({ name, level, delay }) {
  const [ref, vis] = useReveal(0.08);
  const width = LEVEL_W[level] || "40%";

  return (
    <div ref={ref} className="cv-skill-row" style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "7px 20px",
      opacity: vis ? 1 : 0,
      transform: vis ? "translateX(0)" : "translateX(-8px)",
      transition: `opacity 0.35s ${delay}s, transform 0.35s ${delay}s, background 150ms ease`,
    }}>
      <span style={{ ...MONO, fontSize: "10px", color: TEXT_MUTED, letterSpacing: "1px" }}>{name}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Bar */}
        <div style={{ width: 60, height: 2, background: LINE_SUB, borderRadius: 1, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 1,
            background: TEXT_DARK,
            width: vis ? width : "0%",
            transition: `width 0.7s ${delay + 0.1}s cubic-bezier(0.16,1,0.3,1)`,
          }} />
        </div>
        <span style={{ ...MONO, fontSize: "8px", color: TEXT_DARK, letterSpacing: "1px", minWidth: 64, textAlign: "right" }}>
          {level}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ProjectRow — HUD sub-item style
// ─────────────────────────────────────────────────────────────
function ProjectRow({ label, sub, date, delay }) {
  const [ref, vis] = useReveal(0.08);
  return (
    <div ref={ref} className="cv-skill-row cv-project-row" style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      padding: "6px 20px 6px 36px",
      position: "relative",
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(6px)",
      transition: `opacity 0.3s ${delay}s, transform 0.3s ${delay}s, background 150ms ease`,
    }}>
      <div className="cv-project-line" style={{ position: "absolute", left: 24, top: 0, bottom: 0, width: 1, backgroundColor: LINE_DEEP }} />
      <div>
        <span style={{ ...MONO, fontSize: "9px", color: TEXT_MUTED, letterSpacing: "1px" }}>○&nbsp;&nbsp;{label}</span>
        <span style={{ ...MONO, fontSize: "8px", color: TEXT_DARK, letterSpacing: "1px", display: "block", paddingLeft: 14, marginTop: 2 }}>{sub}</span>
      </div>
      <span style={{ ...MONO, fontSize: "8px", color: TEXT_DARK, letterSpacing: "1px", flexShrink: 0 }}>{date}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Main CV
// ─────────────────────────────────────────────────────────────
export default function AhmedKattayaCV() {
  const rows = parseCSV(CSV_DATA);
  const [activeTab, setActiveTab] = useState("experience");

  const meta      = Object.fromEntries(rows.filter(r => r.section === "meta").map(r => [r.type, r.label]));
  const experience = rows.filter(r => r.section === "experience");
  const education  = rows.filter(r => r.section === "education");
  const skills     = rows.filter(r => r.section === "skill");
  const languages  = rows.filter(r => r.section === "language");
  const projects   = rows.filter(r => r.section === "project");
  const courses    = rows.filter(r => r.section === "course");

  const tabs = [
    { id: "experience", label: "Experience" },
    { id: "education",  label: "Education"  },
    { id: "projects",   label: "Projects"   },
    { id: "courses",    label: "Courses"    },
  ];

  return (
    <div className="cv-outer-wrapper" style={{ minHeight: "100vh", background: "transparent", padding: "32px 24px", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; }

        .cv-timeline-row:hover  { background: ${ROW_HOVER} !important; }
        .cv-skill-row:hover     { background: ${ROW_HOVER} !important; }
        .cv-tab-btn:hover       { color: ${TEXT_MAIN} !important; }

        .cv-panel-scroll {
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .cv-panel-scroll::-webkit-scrollbar { display: none; }

        @keyframes hudFade {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── MOBILE VIEWPORT OPTIMIZATIONS ───────────────── */
        @media (max-width: 768px) {
          .cv-outer-wrapper {
            padding: 16px 12px !important;
          }
          .cv-main-layout {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .cv-left-panel, .cv-right-panel {
            width: 100% !important;
          }
          /* Make tab container dynamically scrollable on small viewports */
          .cv-tabs-container {
            overflow-x: auto !important;
            white-space: nowrap !important;
            scrollbar-width: none !important;
          }
          .cv-tabs-container::-webkit-scrollbar {
            display: none !important;
          }
          .cv-tab-btn {
            flex: 1 0 auto !important;
            padding: 12px 14px !important;
            letter-spacing: 1px !important;
            font-size: 9px !important;
          }
          /* Densify layouts and scale internal spatial gaps */
          .cv-panel-header {
            padding: 12px 16px 10px !important;
            font-size: 9px !important;
            letter-spacing: 2px !important;
          }
          .cv-card-body {
            padding: 12px 16px 4px !important;
          }
          .cv-profile-text {
            padding: 10px 16px 16px !important;
          }
          .cv-timeline-line {
            margin-left: 12px !important;
          }
          .cv-timeline-row {
            padding: 10px 14px 10px 10px !important;
          }
          /* Vertically stack Title and Date to prevent collision */
          .cv-timeline-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 2px !important;
          }
          .cv-timeline-date {
            white-space: normal !important;
          }
          .cv-timeline-sub, .cv-timeline-bullets {
            padding-left: 12px !important;
          }
          .cv-skill-row {
            padding: 7px 16px !important;
          }
          .cv-project-row {
            padding: 6px 16px 6px 28px !important;
          }
          .cv-project-line {
            left: 16px !important;
          }
        }
      `}</style>

      <div className="cv-main-layout" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 16, flexWrap: "wrap", position: "relative", zIndex: 1 }}>

        {/* ── LEFT PANEL ────────────────────────────────────── */}
        <div className="cv-left-panel" style={{ width: "min(300px, 100%)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Identity card */}
          <div style={{ ...glassPanel, animation: "hudFade 0.5s ease both" }}>
            {/* HUD header bar */}
            <div className="cv-panel-header" style={{
              ...MONO,
              color: TEXT_DARK,
              fontSize: "10px",
              letterSpacing: "3px",
              padding: "16px 20px 12px",
              borderBottom: `1px solid ${LINE_SUB}`,
              marginBottom: 6,
            }}>
              CONTACT INFORMATION
            </div>

            {/* Monogram */}
            <div className="cv-card-body" style={{ padding: "16px 20px 4px" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%", marginBottom: 14,
                background: ROW_ACTIVE,
                border: `1px solid ${GLASS_BDR}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ ...MONO, fontSize: "16px", color: TEXT_MUTED, letterSpacing: 0 }}>
                  {meta.name?.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </span>
              </div>

              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 17, fontWeight: 600, color: TEXT_MAIN, marginBottom: 6, letterSpacing: 1 }}>
                {meta.name}
              </div>
              <div style={{ ...MONO, fontSize: "9px", color: TEXT_MUTED, marginBottom: 2 }}>#{meta.title}</div>
              <div style={{ ...MONO, fontSize: "9px", color: TEXT_DARK,  marginBottom: 2 }}>#{meta.title2}</div>
              <div style={{ ...MONO, fontSize: "9px", color: TEXT_DARK,  marginBottom: 16 }}>#{meta.title3}</div>

              <div style={{ height: 1, background: LINE_SUB, marginBottom: 12 }} />

              {[
                { icon: "✉", val: meta.email },
                { icon: "◎", val: meta.location },
              ].map(({ icon, val }) => val && (
                <div key={icon} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ ...MONO, fontSize: "9px", color: TEXT_DARK, marginTop: 1 }}>{icon}</span>
                  <span style={{ ...MONO, fontSize: "9px", color: TEXT_MUTED, textTransform: "none", letterSpacing: 0.5 }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 12 }} />
          </div>

          {/* Profile */}
          <div style={{ ...glassPanel, animation: "hudFade 0.5s 0.08s ease both" }}>
            <div className="cv-panel-header" style={{
              ...MONO, color: TEXT_DARK, fontSize: "10px", letterSpacing: "3px",
              padding: "16px 20px 12px", borderBottom: `1px solid ${LINE_SUB}`, marginBottom: 6,
            }}>PROFILE</div>
            <p className="cv-profile-text" style={{
              fontFamily: "'Share Tech Mono', monospace", fontSize: 10.5, color: TEXT_MUTED,
              lineHeight: 1.8, margin: 0, padding: "10px 20px 18px", textTransform: "none", letterSpacing: 0.3,
            }}>{meta.profile}</p>
          </div>

          {/* Software */}
          <div style={{ ...glassPanel, animation: "hudFade 0.5s 0.12s ease both" }}>
            <div className="cv-panel-header" style={{
              ...MONO, color: TEXT_DARK, fontSize: "10px", letterSpacing: "3px",
              padding: "16px 20px 12px", borderBottom: `1px solid ${LINE_SUB}`, marginBottom: 6,
            }}>SOFTWARE</div>
            {skills.map((s, i) => (
              <SkillRow key={i} name={s.label} level={s.level || "Intermediate"} delay={i * 0.03} />
            ))}
            <div style={{ height: 8 }} />
          </div>

          {/* Languages */}
          <div style={{ ...glassPanel, animation: "hudFade 0.5s 0.16s ease both" }}>
            <div className="cv-panel-header" style={{
              ...MONO, color: TEXT_DARK, fontSize: "10px", letterSpacing: "3px",
              padding: "16px 20px 12px", borderBottom: `1px solid ${LINE_SUB}`, marginBottom: 6,
            }}>LANGUAGES</div>
            {languages.map((l, i) => (
              <div key={i} className="cv-skill-row" style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 20px", transition: "background 150ms ease",
              }}>
                <span style={{ ...MONO, fontSize: "10px", color: TEXT_MUTED, letterSpacing: "1px" }}>{l.label}</span>
                <span style={{ ...MONO, fontSize: "8px",  color: TEXT_DARK,  letterSpacing: "1px" }}>{l.sub}</span>
              </div>
            ))}
            <div style={{ height: 8 }} />
          </div>
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────── */}
        <div className="cv-right-panel" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Tab bar */}
          <div className="cv-tabs-container" style={{ ...glassPanel, display: "flex", paddingBottom: 0, animation: "hudFade 0.5s 0.04s ease both" }}>
            {tabs.map((t, i) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  className="cv-tab-btn"
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    flex: 1,
                    ...MONO,
                    fontSize: "10px",
                    letterSpacing: "2px",
                    color: active ? TEXT_MAIN : TEXT_DARK,
                    background: active ? ROW_ACTIVE : "none",
                    border: "none",
                    borderBottom: `1px solid ${active ? GLASS_BDR : "transparent"}`,
                    borderRight: i < tabs.length - 1 ? `1px solid ${LINE_SUB}` : "none",
                    padding: "14px 8px",
                    cursor: "pointer",
                    transition: "color 150ms ease, background 150ms ease",
                    borderRadius: i === 0 ? "12px 0 0 0" : i === tabs.length - 1 ? "0 12px 0 0" : 0,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Content panel */}
          <div style={{ ...glassPanel, flex: 1 }} className="cv-panel-scroll">

            {/* HUD header for active tab */}
            <div className="cv-panel-header" style={{
              ...MONO, color: TEXT_DARK, fontSize: "10px", letterSpacing: "3px",
              padding: "16px 20px 12px",
              borderBottom: `1px solid ${LINE_SUB}`,
              marginBottom: 6,
            }}>
              {tabs.find(t => t.id === activeTab)?.label} — AHMED KATTAYA
            </div>

            {/* EXPERIENCE */}
            {activeTab === "experience" && experience.map((e, i) => (
              <TimelineItem
                key={i}
                label={e.label} sub={e.sub}
                dateStart={e.date_start} dateEnd={e.date_end}
                bullets={[e.detail1, e.detail2, e.detail3, e.detail4, e.detail5]}
                delay={i * 0.06}
                isActive={e.date_end?.toLowerCase() === "present" || e.date_end?.includes("2026")}
              />
            ))}

            {/* EDUCATION */}
            {activeTab === "education" && education.map((e, i) => (
              <TimelineItem
                key={i}
                label={e.label} sub={e.sub}
                dateStart={e.date_start} dateEnd={e.date_end}
                bullets={[e.detail1]}
                delay={i * 0.1}
                isActive={e.date_end?.toLowerCase() === "present"}
              />
            ))}

            {/* PROJECTS */}
            {activeTab === "projects" && (
              <div>
                <div style={{ position: "relative" }}>
                  <div className="cv-timeline-line" style={{ position: "absolute", left: 24, top: 0, bottom: 0, width: 1, backgroundColor: LINE_SUB }} />
                  {projects.map((p, i) => (
                    <ProjectRow key={i} label={p.label} sub={p.sub} date={p.date_start} delay={i * 0.04} />
                  ))}
                </div>
              </div>
            )}

            {/* COURSES */}
            {activeTab === "courses" && courses.map((c, i) => (
              <TimelineItem
                key={i}
                label={c.label} sub={c.sub}
                dateStart={c.date_start}
                bullets={[]}
                delay={i * 0.06}
                isActive={c.date_start === "WIP" || c.date_start?.includes("2026")}
              />
            ))}

            <div style={{ height: 20 }} />
          </div>

          {/* Footer */}
          <div style={{ ...MONO, fontSize: "9px", color: TEXT_DARK, letterSpacing: "3px", textAlign: "right", padding: "4px 4px 0" }}>
            CONTINUUM INDEX · CV · 2026
          </div>
        </div>
      </div>
    </div>
  );
}